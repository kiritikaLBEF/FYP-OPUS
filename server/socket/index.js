import { Server } from 'socket.io';
import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { isSuperAdminUser } from '../utils/adminConfig.js';
import {
  getConversationForUser,
  createTextMessage,
  createCallEventMessage,
  serializeConversation,
  roleInConversation,
} from '../utils/messaging.js';
import {
  createCommunityTextMessage,
  assertActiveCommunityMember,
  CommunityMember,
  canModerate,
} from '../utils/community.js';
import { communityPresence } from '../utils/communityPresence.js';
import CommunityMessage from '../models/CommunityMessage.js';

let ioInstance = null;

export const getIO = () => ioInstance;

export const initSocketServer = (httpServer, { clientOrigin }) => {
  const io = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Unauthorized'));

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      if (!user) return next(new Error('Unauthorized'));
      if (user.accountStatus === 'suspended' && !isSuperAdminUser(user)) {
        return next(new Error('Account suspended'));
      }
      if (!['employer', 'freelancer', 'admin'].includes(user.role)) {
        return next(new Error('Messaging not available'));
      }

      socket.user = user;
      socket.userId = String(user._id);
      socket.role = user.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    communityPresence.add(socket.userId, socket.id);
    socket.communityGroups = new Set();

    socket.on('community:join', async (payload, ack) => {
      try {
        const groupId = payload?.groupId;
        if (!groupId) {
          ack?.({ ok: false, message: 'Group required' });
          return;
        }
        const membership = await assertActiveCommunityMember(groupId, socket.userId);
        if (!membership) {
          ack?.({ ok: false, message: 'Not a group member' });
          return;
        }
        socket.join(`community:${groupId}`);
        socket.communityGroups.add(String(groupId));
        communityPresence.joinGroup(groupId, socket.userId);
        membership.lastSeenAt = new Date();
        await membership.save();
        io.to(`community:${groupId}`).emit('community:presence', {
          groupId: String(groupId),
          userId: socket.userId,
          online: true,
          onlineIds: [...communityPresence.onlineIds(groupId)],
        });
        ack?.({ ok: true, onlineIds: [...communityPresence.onlineIds(groupId)] });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to join group' });
      }
    });

    socket.on('community:leave', async (payload) => {
      const groupId = payload?.groupId;
      if (!groupId) return;
      socket.leave(`community:${groupId}`);
      socket.communityGroups.delete(String(groupId));
      communityPresence.leaveGroup(groupId, socket.userId);
      io.to(`community:${groupId}`).emit('community:presence', {
        groupId: String(groupId),
        userId: socket.userId,
        online: communityPresence.isOnline(socket.userId),
        onlineIds: [...communityPresence.onlineIds(groupId)],
      });
    });

    socket.on('community:message', async (payload, ack) => {
      try {
        const groupId = payload?.groupId;
        if (!groupId) {
          ack?.({ ok: false, message: 'Group required' });
          return;
        }
        const result = await createCommunityTextMessage({
          groupId,
          user: socket.user,
          text: payload?.text,
          kind: payload?.kind || 'regular',
          clientMsgId: payload?.clientMsgId || '',
        });
        if (!result.duplicate) {
          io.to(`community:${groupId}`).emit('community:message:new', {
            groupId: String(groupId),
            message: result.message,
          });
        }
        ack?.({ ok: true, message: result.message, duplicate: result.duplicate });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to send' });
      }
    });

    socket.on('community:typing', async (payload) => {
      const groupId = payload?.groupId;
      if (!groupId) return;
      const membership = await assertActiveCommunityMember(groupId, socket.userId);
      if (!membership) return;
      socket.to(`community:${groupId}`).emit('community:typing', {
        groupId: String(groupId),
        userId: socket.userId,
        typing: !!payload?.typing,
      });
    });

    socket.on('community:message:delete', async (payload, ack) => {
      try {
        const messageId = payload?.messageId;
        const msg = await CommunityMessage.findById(messageId);
        if (!msg || msg.deletedAt) {
          ack?.({ ok: false, message: 'Message not found' });
          return;
        }
        const membership = await assertActiveCommunityMember(msg.groupId, socket.userId);
        if (!membership) {
          ack?.({ ok: false, message: 'Not a group member' });
          return;
        }
        const isAuthor = String(msg.authorId) === socket.userId;
        if (!isAuthor && !canModerate(membership.role)) {
          ack?.({ ok: false, message: 'Not allowed' });
          return;
        }
        msg.deletedAt = new Date();
        msg.deletedBy = socket.user._id;
        msg.body = '';
        msg.attachments = [];
        await msg.save();
        io.to(`community:${msg.groupId}`).emit('community:message:deleted', {
          groupId: String(msg.groupId),
          messageId: String(msg._id),
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to delete' });
      }
    });

    socket.on('conversation:join', async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const conversation = await getConversationForUser(conversationId, socket.user);
        if (!conversation) {
          ack?.({ ok: false, message: 'Conversation not found' });
          return;
        }
        socket.join(`conversation:${conversation._id}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to join' });
      }
    });

    socket.on('conversation:leave', (payload) => {
      const conversationId = payload?.conversationId;
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on('message:send', async (payload, ack) => {
      try {
        const conversation = await getConversationForUser(payload?.conversationId, socket.user);
        if (!conversation) {
          ack?.({ ok: false, message: 'Conversation not found' });
          return;
        }

        const result = await createTextMessage({
          conversation,
          sender: socket.user,
          text: payload?.text,
          clientMsgId: payload?.clientMsgId || '',
        });

        if (!result.duplicate) {
          io.to(`conversation:${conversation._id}`).emit('message:new', result.message);

          const updatePayload = {
            conversationId: String(conversation._id),
            lastMessageAt: conversation.lastMessageAt,
            lastMessagePreview: conversation.lastMessagePreview,
            unreadBy: conversation.unreadBy,
          };
          io.to(`user:${conversation.employerId}`).emit('conversation:updated', updatePayload);
          io.to(`user:${conversation.freelancerId}`).emit('conversation:updated', updatePayload);
        }

        ack?.({
          ok: true,
          message: result.message,
          duplicate: result.duplicate,
          conversation: await serializeConversation(conversation, socket.user),
        });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to send' });
      }
    });

    socket.on('typing:start', async (payload) => {
      const conversation = await getConversationForUser(payload?.conversationId, socket.user);
      if (!conversation) return;
      socket.to(`conversation:${conversation._id}`).emit('typing:update', {
        conversationId: String(conversation._id),
        userId: socket.userId,
        typing: true,
      });
    });

    socket.on('typing:stop', async (payload) => {
      const conversation = await getConversationForUser(payload?.conversationId, socket.user);
      if (!conversation) return;
      socket.to(`conversation:${conversation._id}`).emit('typing:update', {
        conversationId: String(conversation._id),
        userId: socket.userId,
        typing: false,
      });
    });

    const emitCall = async (event, payload) => {
      const conversation = await getConversationForUser(payload?.conversationId, socket.user);
      if (!conversation) return null;

      const peerId = String(conversation.employerId) === socket.userId
        ? String(conversation.freelancerId)
        : String(conversation.employerId);

      const data = {
        conversationId: String(conversation._id),
        fromUserId: socket.userId,
        fromRole: roleInConversation(conversation, socket.user),
        fromName: socket.user.role === 'employer'
          ? (socket.user.organizationName || 'Organization')
          : ([socket.user.firstName, socket.user.lastName].filter(Boolean).join(' ') || 'Freelancer'),
        callType: payload?.callType === 'audio' ? 'audio' : 'video',
        roomName: `opus-conv-${conversation._id}`,
      };

      io.to(`user:${peerId}`).emit(event, data);
      io.to(`conversation:${conversation._id}`).emit(event, data);
      return { conversation, data };
    };

    socket.on('call:invite', async (payload, ack) => {
      try {
        const result = await emitCall('call:invite', payload);
        if (!result) {
          ack?.({ ok: false, message: 'Conversation not found' });
          return;
        }
        const msg = await createCallEventMessage(
          result.conversation,
          `${result.data.fromName} started a ${result.data.callType} call`,
        );
        io.to(`conversation:${result.conversation._id}`).emit('message:new', msg);
        ack?.({ ok: true, ...result.data });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to invite' });
      }
    });

    socket.on('call:accept', async (payload, ack) => {
      try {
        const result = await emitCall('call:accept', payload);
        if (!result) {
          ack?.({ ok: false, message: 'Conversation not found' });
          return;
        }
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to accept' });
      }
    });

    socket.on('call:decline', async (payload, ack) => {
      try {
        const result = await emitCall('call:decline', payload);
        if (!result) {
          ack?.({ ok: false, message: 'Conversation not found' });
          return;
        }
        const msg = await createCallEventMessage(
          result.conversation,
          `${result.data.fromName} declined the call`,
        );
        io.to(`conversation:${result.conversation._id}`).emit('message:new', msg);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to decline' });
      }
    });

    socket.on('call:ended', async (payload, ack) => {
      try {
        const result = await emitCall('call:ended', payload);
        if (!result) {
          ack?.({ ok: false, message: 'Conversation not found' });
          return;
        }
        const msg = await createCallEventMessage(
          result.conversation,
          'Call ended',
        );
        io.to(`conversation:${result.conversation._id}`).emit('message:new', msg);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message || 'Failed to end call' });
      }
    });

    socket.on('disconnect', async () => {
      const wentOffline = communityPresence.remove(socket.userId, socket.id);
      const groups = [...(socket.communityGroups || [])];
      for (const groupId of groups) {
        if (wentOffline) communityPresence.leaveGroup(groupId, socket.userId);
        io.to(`community:${groupId}`).emit('community:presence', {
          groupId: String(groupId),
          userId: socket.userId,
          online: communityPresence.isOnline(socket.userId),
          onlineIds: [...communityPresence.onlineIds(groupId)],
        });
      }
      if (wentOffline) {
        try {
          await CommunityMember.updateMany(
            { userId: socket.user._id, status: 'active' },
            { $set: { lastSeenAt: new Date() } },
          );
        } catch {
          /* ignore */
        }
      }
    });
  });

  ioInstance = io;
  return io;
};

export const emitConversationCreated = async (conversation, serializeFor) => {
  if (!ioInstance || !conversation) return;
  try {
    const forEmployer = await serializeFor(
      conversation,
      { _id: conversation.employerId, role: 'employer' },
    );
    const forFreelancer = await serializeFor(
      conversation,
      { _id: conversation.freelancerId, role: 'freelancer' },
    );
    ioInstance.to(`user:${conversation.employerId}`).emit('conversation:created', forEmployer);
    ioInstance.to(`user:${conversation.freelancerId}`).emit('conversation:created', forFreelancer);
  } catch (err) {
    console.error('emitConversationCreated failed:', err.message);
  }
};

import {
  listConversationsForUser,
  getConversationForUser,
  listMessages,
  markConversationRead,
  serializeConversation,
  createTextMessage,
  setConversationArchived,
  deleteMessageForUser,
  searchMessaging,
} from '../utils/messaging.js';
import { AccessToken } from 'livekit-server-sdk';

const emitConversationUpdated = (io, conversation) => {
  if (!io || !conversation) return;
  const updatePayload = {
    conversationId: String(conversation._id),
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    unreadBy: conversation.unreadBy,
  };
  io.to(`user:${conversation.employerId}`).emit('conversation:updated', updatePayload);
  io.to(`user:${conversation.freelancerId}`).emit('conversation:updated', updatePayload);
};

export const getConversations = async (req, res) => {
  try {
    if (!['employer', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Messaging is only available for employers and freelancers' });
    }
    const archived = req.query.archived === '1' || req.query.archived === 'true';
    const q = req.query.q || '';
    const conversations = await listConversationsForUser(req.user, { archived, q });
    const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
    res.json({ conversations, unreadTotal });
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ message: 'Failed to load conversations' });
  }
};

export const searchMyMessaging = async (req, res) => {
  try {
    const data = await searchMessaging(req.user, req.query.q || '');
    res.json(data);
  } catch (err) {
    console.error('Search messaging error:', err);
    res.status(500).json({ message: 'Failed to search' });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const data = await listMessages(conversation._id, req.user._id, {
      cursor: req.query.cursor,
      limit: req.query.limit,
    });
    await markConversationRead(conversation, req.user);

    res.json({
      conversation: await serializeConversation(conversation, req.user),
      ...data,
    });
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ message: 'Failed to load messages' });
  }
};

export const postConversationRead = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    await markConversationRead(conversation, req.user);
    res.json({
      conversation: await serializeConversation(conversation, req.user),
    });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: 'Failed to mark conversation as read' });
  }
};

export const postConversationArchive = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
    await setConversationArchived(conversation, req.user, !!req.body?.archived);
    res.json({
      conversation: await serializeConversation(conversation, req.user),
    });
  } catch (err) {
    console.error('Archive conversation error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Failed to archive' });
  }
};

export const postTextMessage = async (req, res) => {
  try {
    const conversation = await getConversationForUser(req.params.id, req.user);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files.map((f) => ({
      fileName: f.originalname,
      filePath: `/uploads/chat/${f.filename}`,
      mimeType: f.mimetype || '',
      fileSize: f.size || 0,
    }));

    const result = await createTextMessage({
      conversation,
      sender: req.user,
      text: req.body?.text,
      clientMsgId: req.body?.clientMsgId || '',
      attachments,
    });

    const io = req.app.get('io');
    if (io && !result.duplicate) {
      io.to(`conversation:${conversation._id}`).emit('message:new', result.message);
      emitConversationUpdated(io, conversation);
    }

    res.status(result.duplicate ? 200 : 201).json({
      message: result.message,
      conversation: await serializeConversation(conversation, req.user),
    });
  } catch (err) {
    console.error('Post message error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Failed to send message' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const everyone = req.query.everyone === '1' || req.body?.everyone === true;
    const message = await deleteMessageForUser(req.params.messageId, req.user, { everyone });
    const io = req.app.get('io');
    if (io && message) {
      io.to(`conversation:${message.conversationId}`).emit('message:deleted', {
        messageId: message?.id || req.params.messageId,
        conversationId: message?.conversationId,
        everyone,
        message,
      });
    }
    res.json({ message: message || { id: req.params.messageId, deleted: true } });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Failed to delete message' });
  }
};

export const createCallToken = async (req, res) => {
  try {
    const conversationId = req.body?.conversationId;
    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conversation = await getConversationForUser(conversationId, req.user);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const livekitUrl = process.env.LIVEKIT_URL?.trim();
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.status(503).json({
        message: 'LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in server/.env',
        configured: false,
      });
    }

    const roomName = `opus-conv-${conversation._id}`;
    const identity = String(req.user._id);
    const name = req.user.role === 'employer'
      ? (req.user.organizationName || 'Organization')
      : ([req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'Freelancer');

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '1h',
      metadata: JSON.stringify({
        role: req.user.role,
        conversationId: String(conversation._id),
      }),
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({
      token,
      url: livekitUrl,
      roomName,
      identity,
      configured: true,
    });
  } catch (err) {
    console.error('Call token error:', err);
    res.status(500).json({ message: err.message || 'Failed to create call token' });
  }
};

export const getMessagingUnread = async (req, res) => {
  try {
    const conversations = await listConversationsForUser(req.user, { archived: false });
    const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
    res.json({ unreadTotal });
  } catch (err) {
    console.error('Messaging unread error:', err);
    res.status(500).json({ message: 'Failed to load unread count' });
  }
};

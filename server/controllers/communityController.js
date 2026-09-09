import {
  CommunityGroup,
  CommunityMember,
  CommunityMessage,
  CommunityInvite,
  ensureUniqueSlug,
  createInvite,
  inviteIsValid,
  getMembership,
  isActiveMember,
  canModerate,
  canManageRoles,
  canChangeMember,
  canPostSpecialKind,
  serializeGroup,
  serializeMember,
  serializeMessage,
  loadAuthorsMap,
  attachmentTypeFromMime,
  ROLE_RANK,
  getGroupModerationBlock,
} from '../utils/community.js';
import { communityPresence } from '../utils/communityPresence.js';
import { getIO } from '../socket/index.js';

const emitToGroup = (groupId, event, payload) => {
  try {
    const io = getIO();
    if (!io) return;
    io.to(`community:${groupId}`).emit(event, payload);
  } catch {
    /* ignore before socket ready */
  }
};

const requireCommunityUser = (req, res) => {
  if (!['freelancer', 'employer', 'admin'].includes(req.user.role)) {
    res.status(403).json({ message: 'Community is available for registered freelancers and organizations' });
    return false;
  }
  return true;
};

export const listMyGroups = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const memberships = await CommunityMember.find({
      userId: req.user._id,
      status: { $ne: 'banned' },
    }).lean();
    const groupIds = memberships.map((m) => m.groupId);
    const groups = await CommunityGroup.find({ _id: { $in: groupIds } })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();
    const memMap = Object.fromEntries(memberships.map((m) => [String(m.groupId), m]));

    const unreadPairs = await Promise.all(
      memberships.map(async (m) => {
        const since = m.lastReadAt || m.joinedAt || new Date(0);
        const count = await CommunityMessage.countDocuments({
          groupId: m.groupId,
          deletedAt: null,
          authorId: { $ne: req.user._id },
          createdAt: { $gt: since },
        });
        return [String(m.groupId), count];
      }),
    );
    const unreadMap = Object.fromEntries(unreadPairs);
    const unreadTotal = unreadPairs.reduce((sum, [, n]) => sum + n, 0);

    res.json({
      groups: groups.map((g) => serializeGroup(g, memMap[String(g._id)], {
        unread: unreadMap[String(g._id)] || 0,
      })),
      unreadTotal,
    });
  } catch (err) {
    console.error('listMyGroups:', err);
    res.status(500).json({ message: 'Failed to load groups' });
  }
};

export const getCommunityUnread = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const memberships = await CommunityMember.find({
      userId: req.user._id,
      status: 'active',
    }).lean();
    const counts = await Promise.all(
      memberships.map(async (m) => {
        const since = m.lastReadAt || m.joinedAt || new Date(0);
        return CommunityMessage.countDocuments({
          groupId: m.groupId,
          deletedAt: null,
          authorId: { $ne: req.user._id },
          createdAt: { $gt: since },
        });
      }),
    );
    res.json({ unreadTotal: counts.reduce((a, b) => a + b, 0) });
  } catch (err) {
    console.error('getCommunityUnread:', err);
    res.status(500).json({ message: 'Failed to load unread count' });
  }
};

export const markGroupRead = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const membership = await getMembership(req.params.groupId, req.user._id);
    if (!isActiveMember(membership)) {
      return res.status(403).json({ message: 'Not a group member' });
    }
    membership.lastReadAt = new Date();
    membership.lastSeenAt = membership.lastReadAt;
    await membership.save();
    res.json({ message: 'Marked read', lastReadAt: membership.lastReadAt });
  } catch (err) {
    console.error('markGroupRead:', err);
    res.status(500).json({ message: 'Failed to mark read' });
  }
};

export const discoverGroups = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const q = String(req.query.q || '').trim();
    const filter = {
      visibility: 'public',
      moderationStatus: { $nin: ['restricted', 'suspended'] },
    };
    if (q) filter.$text = { $search: q };
    const groups = await CommunityGroup.find(filter)
      .sort(q ? { score: { $meta: 'textScore' } } : { memberCount: -1, updatedAt: -1 })
      .limit(40)
      .lean();
    const memberships = await CommunityMember.find({
      userId: req.user._id,
      groupId: { $in: groups.map((g) => g._id) },
    }).lean();
    const memMap = Object.fromEntries(memberships.map((m) => [String(m.groupId), m]));
    res.json({
      groups: groups.map((g) => serializeGroup(g, memMap[String(g._id)])),
    });
  } catch (err) {
    console.error('discoverGroups:', err);
    res.status(500).json({ message: 'Failed to discover groups' });
  }
};

export const createGroup = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const name = String(req.body.name || '').trim();
    if (name.length < 2) {
      return res.status(400).json({ message: 'Group name must be at least 2 characters' });
    }
    const visibility = req.body.visibility === 'private' ? 'private' : 'public';
    const description = String(req.body.description || '').trim().slice(0, 500);
    const slug = await ensureUniqueSlug(name);
    const group = await CommunityGroup.create({
      name: name.slice(0, 80),
      slug,
      description,
      visibility,
      createdBy: req.user._id,
      memberCount: 1,
      lastMessageAt: new Date(),
      lastMessagePreview: 'Group created',
    });
    const membership = await CommunityMember.create({
      groupId: group._id,
      userId: req.user._id,
      role: 'owner',
      status: 'active',
    });
    const invite = await createInvite(group._id, req.user._id);
    res.status(201).json({
      group: serializeGroup(group, membership),
      invite: {
        code: invite.code,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err) {
    console.error('createGroup:', err);
    res.status(500).json({ message: err.message || 'Failed to create group' });
  }
};

export const getGroup = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    if (group.visibility === 'private' && !isActiveMember(membership)) {
      return res.status(403).json({ message: 'This group is private. Join with an invite link.' });
    }
    if (membership?.status === 'banned') {
      return res.status(403).json({ message: 'You are banned from this group' });
    }
    res.json({ group: serializeGroup(group, membership) });
  } catch (err) {
    console.error('getGroup:', err);
    res.status(500).json({ message: 'Failed to load group' });
  }
};

export const updateGroup = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    if (!isActiveMember(membership) || !canManageRoles(membership.role)) {
      return res.status(403).json({ message: 'Only admins can edit this group' });
    }
    if (req.body.name != null) {
      const name = String(req.body.name).trim();
      if (name.length < 2) return res.status(400).json({ message: 'Name is too short' });
      group.name = name.slice(0, 80);
    }
    if (req.body.description != null) {
      group.description = String(req.body.description).trim().slice(0, 500);
    }
    if (req.body.visibility === 'public' || req.body.visibility === 'private') {
      group.visibility = req.body.visibility;
    }
    await group.save();
    res.json({ group: serializeGroup(group, membership) });
  } catch (err) {
    console.error('updateGroup:', err);
    res.status(500).json({ message: 'Failed to update group' });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ message: 'Only the owner can delete this group' });
    }
    await Promise.all([
      CommunityMessage.deleteMany({ groupId: group._id }),
      CommunityMember.deleteMany({ groupId: group._id }),
      CommunityInvite.deleteMany({ groupId: group._id }),
      group.deleteOne(),
    ]);
    emitToGroup(group._id, 'community:group:deleted', { groupId: String(group._id) });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error('deleteGroup:', err);
    res.status(500).json({ message: 'Failed to delete group' });
  }
};

export const joinPublicGroup = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const joinBlock = getGroupModerationBlock(group, 'join');
    if (joinBlock) return res.status(403).json({ message: joinBlock });
    if (group.visibility !== 'public') {
      return res.status(400).json({ message: 'Use an invite link to join this private group' });
    }
    let membership = await getMembership(group._id, req.user._id);
    if (membership?.status === 'banned') {
      return res.status(403).json({ message: 'You are banned from this group' });
    }
    if (isActiveMember(membership)) {
      return res.json({ group: serializeGroup(group, membership), message: 'Already a member' });
    }
    if (membership) {
      membership.status = 'active';
      membership.role = membership.role === 'owner' ? 'owner' : 'member';
      await membership.save();
    } else {
      membership = await CommunityMember.create({
        groupId: group._id,
        userId: req.user._id,
        role: 'member',
        status: 'active',
      });
      group.memberCount = (group.memberCount || 0) + 1;
      await group.save();
    }
    res.json({ group: serializeGroup(group, membership) });
  } catch (err) {
    console.error('joinPublicGroup:', err);
    res.status(500).json({ message: 'Failed to join group' });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    if (!membership || membership.status === 'banned') {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }
    if (membership.role === 'owner') {
      return res.status(400).json({ message: 'Owner cannot leave. Delete the group or transfer ownership first.' });
    }
    await membership.deleteOne();
    group.memberCount = Math.max(0, (group.memberCount || 1) - 1);
    await group.save();
    communityPresence.leaveGroup(group._id, req.user._id);
    res.json({ message: 'Left group' });
  } catch (err) {
    console.error('leaveGroup:', err);
    res.status(500).json({ message: 'Failed to leave group' });
  }
};

export const listMembers = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const me = await getMembership(group._id, req.user._id);
    if (group.visibility === 'private' && !isActiveMember(me)) {
      return res.status(403).json({ message: 'Members list is only for group members' });
    }
    const members = await CommunityMember.find({ groupId: group._id })
      .sort({ role: 1, joinedAt: 1 })
      .lean();
    const authors = await loadAuthorsMap(members.map((m) => m.userId));
    const online = communityPresence.onlineIds(group._id);
    res.json({
      members: members.map((m) => serializeMember(m, authors[String(m.userId)], online)),
    });
  } catch (err) {
    console.error('listMembers:', err);
    res.status(500).json({ message: 'Failed to load members' });
  }
};

export const updateMember = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const actor = await getMembership(group._id, req.user._id);
    if (!isActiveMember(actor) || !canModerate(actor.role)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }
    const target = await CommunityMember.findOne({
      groupId: group._id,
      userId: req.params.userId,
    });
    if (!target) return res.status(404).json({ message: 'Member not found' });
    if (!canChangeMember(actor, target)) {
      return res.status(403).json({ message: 'You cannot change this member' });
    }

    if (req.body.role) {
      if (!canManageRoles(actor.role)) {
        return res.status(403).json({ message: 'Only admins can change roles' });
      }
      const nextRole = req.body.role;
      if (!['admin', 'moderator', 'member'].includes(nextRole)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      if (actor.role === 'admin' && nextRole === 'admin' && ROLE_RANK[target.role] >= ROLE_RANK.admin) {
        return res.status(403).json({ message: 'Cannot promote to this role' });
      }
      target.role = nextRole;
    }

    if (req.body.status) {
      const nextStatus = req.body.status;
      if (!['active', 'inactive', 'banned'].includes(nextStatus)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      target.status = nextStatus;
      target.statusReason = String(req.body.statusReason || '').trim().slice(0, 200);
      if (nextStatus !== 'active') {
        communityPresence.leaveGroup(group._id, target.userId);
      }
    }

    await target.save();
    const authors = await loadAuthorsMap([target.userId]);
    const serialized = serializeMember(target, authors[String(target.userId)], communityPresence.onlineIds(group._id));
    emitToGroup(group._id, 'community:member:updated', { member: serialized });
    res.json({ member: serialized });
  } catch (err) {
    console.error('updateMember:', err);
    res.status(500).json({ message: 'Failed to update member' });
  }
};

export const createGroupInvite = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    if (!isActiveMember(membership) || !canModerate(membership.role)) {
      return res.status(403).json({ message: 'Moderator access required to create invites' });
    }
    const invite = await createInvite(group._id, req.user._id, {
      expiresInDays: Number(req.body.expiresInDays) || 30,
      maxUses: Number(req.body.maxUses) || 0,
    });
    res.status(201).json({
      invite: {
        id: String(invite._id),
        code: invite.code,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        useCount: invite.useCount,
      },
    });
  } catch (err) {
    console.error('createGroupInvite:', err);
    res.status(500).json({ message: 'Failed to create invite' });
  }
};

export const listGroupInvites = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const membership = await getMembership(req.params.groupId, req.user._id);
    if (!isActiveMember(membership) || !canModerate(membership.role)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }
    const invites = await CommunityInvite.find({
      groupId: req.params.groupId,
      revoked: false,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({
      invites: invites
        .filter(inviteIsValid)
        .map((i) => ({
          id: String(i._id),
          code: i.code,
          expiresAt: i.expiresAt,
          maxUses: i.maxUses,
          useCount: i.useCount,
          createdAt: i.createdAt,
        })),
    });
  } catch (err) {
    console.error('listGroupInvites:', err);
    res.status(500).json({ message: 'Failed to list invites' });
  }
};

export const revokeInvite = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const invite = await CommunityInvite.findById(req.params.inviteId);
    if (!invite) return res.status(404).json({ message: 'Invite not found' });
    const membership = await getMembership(invite.groupId, req.user._id);
    if (!isActiveMember(membership) || !canModerate(membership.role)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }
    invite.revoked = true;
    await invite.save();
    res.json({ message: 'Invite revoked' });
  } catch (err) {
    console.error('revokeInvite:', err);
    res.status(500).json({ message: 'Failed to revoke invite' });
  }
};

export const resolveInvite = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const invite = await CommunityInvite.findOne({ code: req.params.code }).lean();
    if (!inviteIsValid(invite)) {
      return res.status(404).json({ message: 'Invite is invalid or expired' });
    }
    const group = await CommunityGroup.findById(invite.groupId).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    res.json({
      group: serializeGroup(group, membership),
      invite: { code: invite.code, expiresAt: invite.expiresAt },
    });
  } catch (err) {
    console.error('resolveInvite:', err);
    res.status(500).json({ message: 'Failed to resolve invite' });
  }
};

export const joinByInvite = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const invite = await CommunityInvite.findOne({ code: req.params.code });
    if (!inviteIsValid(invite)) {
      return res.status(404).json({ message: 'Invite is invalid or expired' });
    }
    const group = await CommunityGroup.findById(invite.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const joinBlock = getGroupModerationBlock(group, 'join');
    if (joinBlock) return res.status(403).json({ message: joinBlock });

    let membership = await getMembership(group._id, req.user._id);
    if (membership?.status === 'banned') {
      return res.status(403).json({ message: 'You are banned from this group' });
    }
    if (!isActiveMember(membership)) {
      if (membership) {
        membership.status = 'active';
        await membership.save();
      } else {
        membership = await CommunityMember.create({
          groupId: group._id,
          userId: req.user._id,
          role: 'member',
          status: 'active',
        });
        group.memberCount = (group.memberCount || 0) + 1;
        await group.save();
      }
      invite.useCount += 1;
      await invite.save();
    }
    res.json({ group: serializeGroup(group, membership) });
  } catch (err) {
    console.error('joinByInvite:', err);
    res.status(500).json({ message: 'Failed to join with invite' });
  }
};

export const listMessages = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    if (!isActiveMember(membership)) {
      if (group.visibility === 'private') {
        return res.status(403).json({ message: 'Join the group to read messages' });
      }
      // public: allow read for non-members, but typically require join for chat UX
    }
    if (membership?.status === 'banned') {
      return res.status(403).json({ message: 'You are banned from this group' });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const cursor = req.query.cursor || req.query.before;
    const before = cursor ? new Date(cursor) : null;
    const filter = { groupId: group._id };
    if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };

    const messages = await CommunityMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const authors = await loadAuthorsMap(messages.map((m) => m.authorId));
    const pinned = await CommunityMessage.find({ groupId: group._id, pinned: true, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      messages: messages.reverse().map((m) => serializeMessage(m, authors[String(m.authorId)])),
      pinned: pinned.map((m) => serializeMessage(m, authors[String(m.authorId)] || null)),
      myRole: membership?.role || null,
      canPostSpecial: membership ? canPostSpecialKind(membership.role, 'notice') : false,
    });

    if (isActiveMember(membership)) {
      membership.lastReadAt = new Date();
      membership.lastSeenAt = membership.lastReadAt;
      membership.save().catch(() => {});
    }
  } catch (err) {
    console.error('listMessages:', err);
    res.status(500).json({ message: 'Failed to load messages' });
  }
};

const buildAttachmentsFromFiles = (files = []) =>
  files.map((f) => ({
    type: attachmentTypeFromMime(f.mimetype, f.originalname),
    path: `/uploads/community/${f.filename}`,
    mime: f.mimetype || '',
    size: f.size || 0,
    name: f.originalname || f.filename,
  }));

export const sendMessage = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const membership = await getMembership(group._id, req.user._id);
    if (!isActiveMember(membership)) {
      return res.status(403).json({ message: 'Join the group to post messages' });
    }
    const postBlock = getGroupModerationBlock(group, 'post');
    if (postBlock) return res.status(403).json({ message: postBlock });
    if (membership.status === 'inactive') {
      return res.status(403).json({ message: 'Your membership is inactive' });
    }

    const kind = ['regular', 'alert', 'warning', 'notice'].includes(req.body.kind)
      ? req.body.kind
      : 'regular';
    if (!canPostSpecialKind(membership.role, kind)) {
      return res.status(403).json({ message: 'Only moderators can post alerts, warnings, and notices' });
    }

    const body = String(req.body.body || req.body.text || '').trim();
    const attachments = buildAttachmentsFromFiles(req.files || []);
    if (!body && attachments.length === 0) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const clientMsgId = String(req.body.clientMsgId || '').trim();
    if (clientMsgId) {
      const existing = await CommunityMessage.findOne({ groupId: group._id, clientMsgId }).lean();
      if (existing) {
        return res.json({
          message: serializeMessage(existing, req.user),
          duplicate: true,
        });
      }
    }

    const msg = await CommunityMessage.create({
      groupId: group._id,
      authorId: req.user._id,
      kind,
      body: body.slice(0, 4000),
      attachments,
      clientMsgId,
    });

    const preview = kind !== 'regular'
      ? `[${kind}] ${body || 'Attachment'}`
      : (body || (attachments[0]?.name ? `Sent ${attachments[0].name}` : 'Attachment'));
    group.lastMessageAt = msg.createdAt;
    group.lastMessagePreview = preview.slice(0, 140);
    await group.save();

    const serialized = serializeMessage(msg, req.user);
    emitToGroup(group._id, 'community:message:new', {
      groupId: String(group._id),
      message: serialized,
    });
    res.status(201).json({ message: serialized });
  } catch (err) {
    console.error('sendMessage:', err);
    res.status(500).json({ message: err.message || 'Failed to send message' });
  }
};

export const deleteCommunityMessage = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const msg = await CommunityMessage.findById(req.params.messageId);
    if (!msg || msg.deletedAt) return res.status(404).json({ message: 'Message not found' });
    const membership = await getMembership(msg.groupId, req.user._id);
    const isAuthor = String(msg.authorId) === String(req.user._id);
    if (!isActiveMember(membership)) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (!isAuthor && !canModerate(membership.role)) {
      return res.status(403).json({ message: 'Only moderators can delete others\' messages' });
    }
    msg.deletedAt = new Date();
    msg.deletedBy = req.user._id;
    msg.pinned = false;
    msg.body = '';
    msg.attachments = [];
    await msg.save();
    emitToGroup(msg.groupId, 'community:message:deleted', {
      messageId: String(msg._id),
      groupId: String(msg.groupId),
    });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('deleteCommunityMessage:', err);
    res.status(500).json({ message: 'Failed to delete message' });
  }
};

export const pinMessage = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const msg = await CommunityMessage.findById(req.params.messageId);
    if (!msg || msg.deletedAt) return res.status(404).json({ message: 'Message not found' });
    const membership = await getMembership(msg.groupId, req.user._id);
    if (!isActiveMember(membership) || !canModerate(membership.role)) {
      return res.status(403).json({ message: 'Moderator access required' });
    }
    const pinned = req.body.pinned !== false && req.body.pinned !== 'false';
    msg.pinned = pinned;
    await msg.save();
    const authors = await loadAuthorsMap([msg.authorId]);
    const serialized = serializeMessage(msg, authors[String(msg.authorId)]);
    emitToGroup(msg.groupId, 'community:message:updated', { message: serialized });
    res.json({ message: serialized });
  } catch (err) {
    console.error('pinMessage:', err);
    res.status(500).json({ message: 'Failed to update pin' });
  }
};

const REPORT_REASONS = new Set([
  'spam',
  'harassment',
  'hate_speech',
  'scam',
  'inappropriate_content',
  'other',
]);

export const reportGroup = async (req, res) => {
  try {
    if (!requireCommunityUser(req, res)) return;
    const group = await CommunityGroup.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const reason = String(req.body.reason || '').trim();
    if (!REPORT_REASONS.has(reason)) {
      return res.status(400).json({ message: 'Select a valid report reason' });
    }

    const note = String(req.body.note || '').trim().slice(0, 2000);
    const alreadyReported = (group.reports || []).some(
      (r) => r.status === 'open' && String(r.reportedBy) === String(req.user._id),
    );
    if (alreadyReported) {
      return res.status(400).json({ message: 'You already reported this group' });
    }

    group.reports.push({
      reportedBy: req.user._id,
      reporterName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim(),
      reporterEmail: req.user.email || '',
      reason,
      note,
      status: 'open',
      createdAt: new Date(),
    });
    group.reportCount = (group.reports || []).filter((r) => r.status === 'open').length;
    await group.save();

    res.status(201).json({ message: 'Report submitted. OPUS admin will review this group.' });
  } catch (err) {
    console.error('reportGroup:', err);
    res.status(500).json({ message: 'Failed to submit report' });
  }
};

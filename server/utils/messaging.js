import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { notifyUser } from './notify.js';

const displayName = (user, role) => {
  if (!user) return role === 'employer' ? 'Organization' : 'Freelancer';
  if (role === 'employer') {
    return user.organizationName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Organization';
  }
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Freelancer';
};

const ordinal = (n) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const map = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${n}${map[n % 10] || 'th'}`;
};

const collabMessage = (n, jobTitle) => {
  if (n <= 1) return 'Start a conversation';
  if (n === 2) return `2nd work together on "${jobTitle}" - start your work!`;
  return `${ordinal(n)} work together on "${jobTitle}"!`;
};

export const serializeMessage = (msg, viewerId = null) => {
  const deletedForEveryone = !!msg.deletedForEveryone;
  const deletedForMe = viewerId
    && (msg.deletedFor || []).some((id) => String(id) === String(viewerId));

  if (deletedForEveryone) {
    return {
      id: String(msg._id),
      conversationId: String(msg.conversationId),
      senderId: msg.senderId ? String(msg.senderId) : null,
      senderRole: msg.senderRole,
      type: 'system',
      text: 'This message was deleted',
      attachments: [],
      clientMsgId: msg.clientMsgId || '',
      createdAt: msg.createdAt,
      deleted: true,
      deletedForEveryone: true,
      readBy: [],
    };
  }

  if (deletedForMe) return null;

  return {
    id: String(msg._id),
    conversationId: String(msg.conversationId),
    senderId: msg.senderId ? String(msg.senderId) : null,
    senderRole: msg.senderRole,
    type: msg.type,
    text: msg.text || '',
    attachments: (msg.attachments || []).map((a) => ({
      fileName: a.fileName,
      filePath: a.filePath,
      mimeType: a.mimeType || '',
      fileSize: a.fileSize || 0,
    })),
    clientMsgId: msg.clientMsgId || '',
    createdAt: msg.createdAt,
    deleted: false,
    deletedForEveryone: false,
    readBy: (msg.readBy || []).map((r) => ({
      userId: String(r.userId),
      readAt: r.readAt,
    })),
  };
};

export const userIsParticipant = (conversation, userId) => {
  const id = String(userId);
  if (conversation.kind === 'group') {
    const ids = (conversation.participantIds || []).map(String);
    if (ids.includes(id)) return true;
    return (conversation.participants || []).some((p) => String(p.userId) === id);
  }
  return String(conversation.employerId) === id || String(conversation.freelancerId) === id;
};

export const roleInConversation = (conversation, user) => {
  if (conversation.kind === 'group') {
    const hit = (conversation.participants || []).find((p) => String(p.userId) === String(user._id));
    if (hit?.role) return hit.role;
    if (String(conversation.employerId) === String(user._id)) return 'employer';
    if ((conversation.participantIds || []).some((id) => String(id) === String(user._id))) {
      return user.role === 'employer' ? 'employer' : 'freelancer';
    }
    return null;
  }
  if (String(conversation.employerId) === String(user._id)) return 'employer';
  if (String(conversation.freelancerId) === String(user._id)) return 'freelancer';
  return null;
};

/** Merge every duplicate thread for a pair into the oldest one. */
export const resolvePairConversation = async (employerId, freelancerId) => {
  const rows = await Conversation.find({ employerId, freelancerId }).sort({ createdAt: 1 });
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];

  const primary = rows[0];
  let maxCollab = primary.collaborationCount || 1;

  for (const dup of rows.slice(1)) {
    await Message.updateMany(
      { conversationId: dup._id },
      { $set: { conversationId: primary._id } },
    );
    maxCollab = Math.max(maxCollab, dup.collaborationCount || 1);
    if (dup.lastMessageAt && (!primary.lastMessageAt || dup.lastMessageAt > primary.lastMessageAt)) {
      primary.lastMessageAt = dup.lastMessageAt;
      primary.lastMessagePreview = dup.lastMessagePreview;
    }
    if (dup.jobTitle) primary.jobTitle = dup.jobTitle;
    if (dup.applicationId) primary.applicationId = dup.applicationId;
    if (dup.workSessionId) primary.workSessionId = dup.workSessionId;
    if (dup.jobPostingId) primary.jobPostingId = dup.jobPostingId;
    primary.unreadBy = {
      employer: Math.max(primary.unreadBy?.employer || 0, dup.unreadBy?.employer || 0),
      freelancer: Math.max(primary.unreadBy?.freelancer || 0, dup.unreadBy?.freelancer || 0),
    };
    await Conversation.deleteOne({ _id: dup._id });
  }

  try {
    const JobApplication = (await import('../models/JobApplication.js')).default;
    const accepted = await JobApplication.countDocuments({
      employerId,
      freelancerId,
      status: 'accepted',
    });
    maxCollab = Math.max(maxCollab, accepted || 1);
  } catch {
    /* ignore */
  }

  primary.collaborationCount = maxCollab;
  await primary.save();
  return primary;
};

/** Collapse all duplicate pair threads visible to this user. */
export const dedupeConversationsForUser = async (user) => {
  const filter = user.role === 'employer'
    ? { kind: { $ne: 'group' }, employerId: user._id }
    : { kind: { $ne: 'group' }, freelancerId: user._id };
  const rows = await Conversation.find(filter).select('employerId freelancerId').lean();
  const seen = new Set();
  for (const c of rows) {
    const key = `${c.employerId}:${c.freelancerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const count = rows.filter(
      (r) => String(r.employerId) === String(c.employerId)
        && String(r.freelancerId) === String(c.freelancerId),
    ).length;
    if (count > 1) {
      await resolvePairConversation(c.employerId, c.freelancerId);
    }
  }
};

export const ensureConversationForApplication = async (application, workspaceId = null) => {
  if (!application?.employerId || !application?.freelancerId) {
    return { conversation: null, isNew: false, systemMessage: null };
  }

  const jobTitle = application.jobTitle || 'a project';
  let conversation = await resolvePairConversation(
    application.employerId,
    application.freelancerId,
  );

  if (conversation) {
    if (conversation.applicationId && String(conversation.applicationId) === String(application._id)) {
      if (workspaceId && !conversation.workSessionId) {
        conversation.workSessionId = workspaceId;
        await conversation.save();
      }
      return { conversation, isNew: false, reunited: false, systemMessage: null };
    }

    const nextCount = (conversation.collaborationCount || 1) + 1;
    conversation.collaborationCount = nextCount;
    conversation.jobPostingId = application.jobPostingId;
    conversation.applicationId = application._id;
    if (workspaceId) conversation.workSessionId = workspaceId;
    conversation.jobTitle = jobTitle;
    conversation.organizationName = application.organizationName || conversation.organizationName || '';
    conversation.archivedBy = { employer: false, freelancer: false };

    const text = collabMessage(nextCount, jobTitle);
    let msg = null;
    try {
      msg = await Message.create({
        conversationId: conversation._id,
        senderId: null,
        senderRole: 'system',
        type: 'system',
        text,
        clientMsgId: `system-collab-${conversation._id}-${application._id}`,
      });
    } catch (err) {
      if (err?.code === 11000) {
        msg = await Message.findOne({
          conversationId: conversation._id,
          clientMsgId: `system-collab-${conversation._id}-${application._id}`,
        });
      } else throw err;
    }

    if (msg) {
      conversation.lastMessageAt = msg.createdAt;
      conversation.lastMessagePreview = text;
      conversation.unreadBy = conversation.unreadBy || { employer: 0, freelancer: 0 };
      conversation.unreadBy.employer = (conversation.unreadBy.employer || 0) + 1;
      conversation.unreadBy.freelancer = (conversation.unreadBy.freelancer || 0) + 1;
    }
    await conversation.save();

    return {
      conversation,
      isNew: false,
      reunited: true,
      systemMessage: msg ? serializeMessage(msg) : null,
    };
  }

  conversation = await Conversation.create({
    kind: 'direct',
    employerId: application.employerId,
    freelancerId: application.freelancerId,
    jobPostingId: application.jobPostingId,
    applicationId: application._id,
    workSessionId: workspaceId || undefined,
    jobTitle,
    organizationName: application.organizationName || '',
    collaborationCount: 1,
    lastMessageAt: new Date(),
    lastMessagePreview: 'Start a conversation',
    unreadBy: { employer: 0, freelancer: 0 },
    archivedBy: { employer: false, freelancer: false },
  });

  const msg = await Message.create({
    conversationId: conversation._id,
    senderId: null,
    senderRole: 'system',
    type: 'system',
    text: 'Start a conversation',
    clientMsgId: `system-start-${conversation._id}`,
  });

  return {
    conversation,
    isNew: true,
    reunited: false,
    systemMessage: serializeMessage(msg),
  };
};

/**
 * In-app notices after a conversation is created or reused.
 * Fires for both new threads (conversation_started) and repeat hires (collaboration_again).
 */
export const notifyConversationConnected = async (application, conversationResult) => {
  const conversation = conversationResult?.conversation;
  if (!conversation || !application) return;

  const reunited = !!conversationResult.reunited;
  const count = conversation.collaborationCount || 1;
  const orgName = application.organizationName || 'An organization';
  const jobTitle = application.jobTitle || 'a job';

  await notifyUser({
    userId: application.freelancerId,
    type: reunited ? 'collaboration_again' : 'conversation_started',
    title: reunited ? `Working together again (${count})` : 'Messaging connected',
    message: reunited
      ? `${orgName} accepted another bid. You're collaborating for the ${count} time - continue in the same Messages thread.`
      : `${orgName} is now connected with you in Messages. Start a conversation anytime.`,
    link: '/messages',
    meta: {
      conversationId: conversation._id,
      applicationId: application._id,
    },
  });
  await notifyUser({
    userId: application.employerId,
    type: reunited ? 'collaboration_again' : 'conversation_started',
    title: reunited ? `Working together again (${count})` : 'Messaging connected',
    message: reunited
      ? `You accepted this freelancer again for "${jobTitle}". Continue in your existing Messages thread.`
      : `You are now connected with the freelancer for "${jobTitle}" in Messages.`,
    link: '/employer/messages',
    meta: {
      conversationId: conversation._id,
      applicationId: application._id,
    },
  });
};

export const serializeConversation = async (conversation, viewer) => {
  const role = roleInConversation(conversation, viewer);

  if (conversation.kind === 'group') {
    const memberIds = (conversation.participantIds || []).map(String);
    const members = await User.find({ _id: { $in: memberIds } })
      .select('firstName lastName organizationName username profilePicture role')
      .lean();
    const memberMap = Object.fromEntries(members.map((u) => [String(u._id), u]));
    let unread = 0;
    if (conversation.unreadByMap?.get) {
      unread = conversation.unreadByMap.get(String(viewer._id)) || 0;
    } else if (conversation.unreadByMap && typeof conversation.unreadByMap === 'object') {
      unread = conversation.unreadByMap[String(viewer._id)] || 0;
    }
    const archived = (conversation.archivedByUserIds || []).some((id) => String(id) === String(viewer._id));

    return {
      id: String(conversation._id),
      kind: 'group',
      groupType: conversation.groupType || '',
      title: conversation.title || conversation.jobTitle || 'Group chat',
      jobTitle: conversation.jobTitle || '',
      organizationName: conversation.organizationName || '',
      jobPostingId: conversation.jobPostingId ? String(conversation.jobPostingId) : null,
      applicationId: null,
      workSessionId: null,
      teamWorkspaceId: conversation.teamWorkspaceId ? String(conversation.teamWorkspaceId) : null,
      collaborationCount: conversation.collaborationCount || 1,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview || '',
      unread,
      archived,
      myRole: role,
      memberCount: memberIds.length,
      members: memberIds.map((id) => {
        const u = memberMap[id];
        const pRole = (conversation.participants || []).find((p) => String(p.userId) === id)?.role
          || (u?.role === 'employer' ? 'employer' : 'freelancer');
        return {
          id,
          name: displayName(u, pRole),
          role: pRole,
          profilePicture: u?.profilePicture || '',
        };
      }),
      peer: {
        id: String(conversation._id),
        name: conversation.title || conversation.jobTitle || 'Group',
        role: 'group',
        profilePicture: '',
        freelancerId: '',
        employerId: '',
      },
    };
  }

  const otherId = role === 'employer' ? conversation.freelancerId : conversation.employerId;
  const other = await User.findById(otherId)
    .select('firstName lastName organizationName username profilePicture freelancerId employerId role')
    .lean();

  const otherRole = role === 'employer' ? 'freelancer' : 'employer';

  return {
    id: String(conversation._id),
    kind: 'direct',
    groupType: '',
    title: '',
    jobTitle: conversation.jobTitle || '',
    organizationName: conversation.organizationName || '',
    jobPostingId: conversation.jobPostingId ? String(conversation.jobPostingId) : null,
    applicationId: conversation.applicationId ? String(conversation.applicationId) : null,
    workSessionId: conversation.workSessionId ? String(conversation.workSessionId) : null,
    teamWorkspaceId: null,
    collaborationCount: conversation.collaborationCount || 1,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview || '',
    unread: role ? (conversation.unreadBy?.[role] || 0) : 0,
    archived: role ? !!conversation.archivedBy?.[role] : false,
    myRole: role,
    peer: {
      id: other ? String(other._id) : String(otherId),
      name: displayName(other, otherRole),
      role: otherRole,
      profilePicture: other?.profilePicture || '',
      freelancerId: other?.freelancerId || '',
      employerId: other?.employerId || '',
    },
  };
};

let conversationIndexesReady = false;
async function ensureConversationIndexes() {
  if (conversationIndexesReady) return;
  conversationIndexesReady = true;
  try {
    await Conversation.collection.dropIndex('employerId_1_freelancerId_1_applicationId_1');
  } catch {
    /* ok */
  }
  try {
    await Conversation.syncIndexes();
  } catch (err) {
    console.error('Conversation syncIndexes:', err.message);
  }
}

export const listConversationsForUser = async (user, { archived = false, q = '' } = {}) => {
  await dedupeConversationsForUser(user);
  await ensureConversationIndexes();
  await backfillConversationsForUser(user);

  const roleKey = user.role === 'employer' ? 'employer' : 'freelancer';
  const directFilter = user.role === 'employer'
    ? { kind: { $ne: 'group' }, employerId: user._id }
    : { kind: { $ne: 'group' }, freelancerId: user._id };
  directFilter[`archivedBy.${roleKey}`] = archived ? true : { $ne: true };

  const groupFilter = {
    kind: 'group',
    $or: [
      { participantIds: user._id },
      { 'participants.userId': user._id },
    ],
  };
  if (archived) {
    groupFilter.archivedByUserIds = user._id;
  } else {
    groupFilter.archivedByUserIds = { $ne: user._id };
  }

  const [directRows, groupRows] = await Promise.all([
    Conversation.find(directFilter).sort({ lastMessageAt: -1 }).lean(),
    Conversation.find(groupFilter).sort({ lastMessageAt: -1 }).lean(),
  ]);

  const rows = [...directRows, ...groupRows].sort(
    (a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0),
  );

  const serialized = await Promise.all(rows.map((c) => serializeConversation(c, user)));
  const query = String(q || '').trim().toLowerCase();
  if (!query) return serialized;

  return serialized.filter((c) => {
    const hay = [
      c.peer?.name,
      c.title,
      c.jobTitle,
      c.organizationName,
      c.lastMessagePreview,
    ].join(' ').toLowerCase();
    return hay.includes(query);
  });
};

export const backfillConversationsForUser = async (user) => {
  try {
    const JobApplication = (await import('../models/JobApplication.js')).default;
    const WorkSession = (await import('../models/WorkSession.js')).default;

    const filter = user.role === 'employer'
      ? { employerId: user._id, status: 'accepted' }
      : { freelancerId: user._id, status: 'accepted' };

    const apps = await JobApplication.find(filter).sort({ reviewedAt: 1, appliedAt: 1 }).limit(80).lean();
    if (!apps.length) return;

    const seen = new Set();
    for (const app of apps) {
      const key = `${app.employerId}:${app.freelancerId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = await Conversation.findOne({
        employerId: app.employerId,
        freelancerId: app.freelancerId,
      }).select('_id').lean();
      if (existing) continue;

      const session = await WorkSession.findOne({ applicationId: app._id }).select('_id').lean();
      await ensureConversationForApplication(app, session?._id || null);
    }
  } catch (err) {
    console.error('backfillConversationsForUser:', err.message);
  }
};

export const getConversationForUser = async (conversationId, user) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !userIsParticipant(conversation, user._id)) return null;
  return conversation;
};

export const listMessages = async (conversationId, viewerId, { cursor, limit = 40 } = {}) => {
  const lim = Math.min(80, Math.max(1, Number(limit) || 40));
  const filter = { conversationId };
  if (cursor) filter._id = { $lt: cursor };

  const rows = await Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(lim)
    .lean();

  const messages = rows
    .reverse()
    .map((m) => serializeMessage(m, viewerId))
    .filter(Boolean);
  const nextCursor = rows.length === lim ? String(rows[rows.length - 1]._id) : null;
  return { messages, nextCursor };
};

export const markConversationRead = async (conversation, user) => {
  const role = roleInConversation(conversation, user);
  if (!role) return conversation;

  if (conversation.kind === 'group') {
    if (!conversation.unreadByMap) conversation.unreadByMap = new Map();
    if (conversation.unreadByMap.set) {
      conversation.unreadByMap.set(String(user._id), 0);
    } else {
      conversation.unreadByMap[String(user._id)] = 0;
    }
    conversation.markModified('unreadByMap');
    await conversation.save();
  } else if ((conversation.unreadBy?.[role] || 0) !== 0) {
    conversation.unreadBy[role] = 0;
    await conversation.save();
  }

  await Message.updateMany(
    {
      conversationId: conversation._id,
      senderId: { $ne: user._id },
      'readBy.userId': { $ne: user._id },
      deletedForEveryone: { $ne: true },
    },
    { $push: { readBy: { userId: user._id, readAt: new Date() } } },
  );

  return conversation;
};

export const setConversationArchived = async (conversation, user, archived) => {
  const role = roleInConversation(conversation, user);
  if (!role) {
    const err = new Error('Not a participant');
    err.status = 403;
    throw err;
  }
  if (conversation.kind === 'group') {
    const ids = (conversation.archivedByUserIds || []).map(String);
    if (archived && !ids.includes(String(user._id))) {
      conversation.archivedByUserIds = [...(conversation.archivedByUserIds || []), user._id];
    } else if (!archived) {
      conversation.archivedByUserIds = (conversation.archivedByUserIds || [])
        .filter((id) => String(id) !== String(user._id));
    }
    await conversation.save();
    return conversation;
  }
  conversation.archivedBy = conversation.archivedBy || { employer: false, freelancer: false };
  conversation.archivedBy[role] = !!archived;
  await conversation.save();
  return conversation;
};

export const createTextMessage = async ({
  conversation,
  sender,
  text,
  clientMsgId = '',
  attachments = [],
}) => {
  const role = roleInConversation(conversation, sender);
  if (!role) {
    const err = new Error('Not a participant');
    err.status = 403;
    throw err;
  }

  const trimmed = String(text || '').trim();
  if (!trimmed && !attachments.length) {
    const err = new Error('Message text or attachment is required');
    err.status = 400;
    throw err;
  }
  if (trimmed.length > 4000) {
    const err = new Error('Message is too long');
    err.status = 400;
    throw err;
  }

  if (clientMsgId) {
    const existing = await Message.findOne({
      conversationId: conversation._id,
      clientMsgId,
    }).lean();
    if (existing) return { message: serializeMessage(existing, sender._id), duplicate: true, conversation };
  }

  const preview = trimmed
    || (attachments.length === 1 ? `📎 ${attachments[0].fileName}` : `📎 ${attachments.length} attachments`);

  let msg;
  try {
    msg = await Message.create({
      conversationId: conversation._id,
      senderId: sender._id,
      senderRole: role,
      type: attachments.length ? 'attachment' : 'text',
      text: trimmed || (attachments.length ? '' : ''),
      attachments,
      clientMsgId: clientMsgId || '',
      readBy: [{ userId: sender._id, readAt: new Date() }],
    });
  } catch (err) {
    if (err?.code === 11000 && clientMsgId) {
      const existing = await Message.findOne({
        conversationId: conversation._id,
        clientMsgId,
      }).lean();
      if (existing) return { message: serializeMessage(existing, sender._id), duplicate: true, conversation };
    }
    throw err;
  }

  conversation.lastMessageAt = msg.createdAt;
  conversation.lastMessagePreview = preview.slice(0, 160);

  if (conversation.kind === 'group') {
    if (!conversation.unreadByMap) conversation.unreadByMap = new Map();
    const ids = (conversation.participantIds || []).map(String);
    for (const id of ids) {
      if (id === String(sender._id)) {
        if (conversation.unreadByMap.set) conversation.unreadByMap.set(id, 0);
        else conversation.unreadByMap[id] = 0;
        continue;
      }
      const prev = conversation.unreadByMap.get
        ? (conversation.unreadByMap.get(id) || 0)
        : (conversation.unreadByMap[id] || 0);
      if (conversation.unreadByMap.set) conversation.unreadByMap.set(id, prev + 1);
      else conversation.unreadByMap[id] = prev + 1;
    }
    conversation.markModified('unreadByMap');
    conversation.archivedByUserIds = (conversation.archivedByUserIds || [])
      .filter((id) => String(id) !== String(sender._id));
  } else {
    const otherRole = role === 'employer' ? 'freelancer' : 'employer';
    conversation.unreadBy = conversation.unreadBy || { employer: 0, freelancer: 0 };
    conversation.unreadBy[otherRole] = (conversation.unreadBy[otherRole] || 0) + 1;
    conversation.archivedBy = conversation.archivedBy || { employer: false, freelancer: false };
    conversation.archivedBy[otherRole] = false;
  }
  await conversation.save();

  return { message: serializeMessage(msg, sender._id), duplicate: false, conversation };
};

export const deleteMessageForUser = async (messageId, user, { everyone = false } = {}) => {
  const msg = await Message.findById(messageId);
  if (!msg) {
    const err = new Error('Message not found');
    err.status = 404;
    throw err;
  }

  const conversation = await Conversation.findById(msg.conversationId);
  if (!conversation || !userIsParticipant(conversation, user._id)) {
    const err = new Error('Not allowed');
    err.status = 403;
    throw err;
  }

  if (everyone) {
    if (String(msg.senderId) !== String(user._id)) {
      const err = new Error('Only the sender can delete for everyone');
      err.status = 403;
      throw err;
    }
    msg.deletedForEveryone = true;
    msg.text = '';
    msg.attachments = [];
    await msg.save();
    return serializeMessage(msg, user._id);
  }

  const already = (msg.deletedFor || []).some((id) => String(id) === String(user._id));
  if (!already) {
    msg.deletedFor = [...(msg.deletedFor || []), user._id];
    await msg.save();
  }
  return {
    id: String(msg._id),
    conversationId: String(msg.conversationId),
    deleted: true,
    deletedForEveryone: false,
  };
};

export const searchMessaging = async (user, q) => {
  const query = String(q || '').trim();
  if (!query || query.length < 1) {
    return { conversations: [], messages: [] };
  }

  const conversations = await listConversationsForUser(user, { q: query, archived: false });
  const archived = await listConversationsForUser(user, { q: query, archived: true });

  const convIds = [
    ...conversations.map((c) => c.id),
    ...archived.map((c) => c.id),
  ];

  const msgRows = convIds.length
    ? await Message.find({
      conversationId: { $in: convIds },
      deletedForEveryone: { $ne: true },
      deletedFor: { $ne: user._id },
      text: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean()
    : [];

  return {
    conversations: [...conversations, ...archived],
    messages: msgRows
      .map((m) => serializeMessage(m, user._id))
      .filter(Boolean),
  };
};

export const createCallEventMessage = async (conversation, text) => {
  const msg = await Message.create({
    conversationId: conversation._id,
    senderId: null,
    senderRole: 'system',
    type: 'call_event',
    text,
    clientMsgId: `call-${conversation._id}-${Date.now()}`,
  });
  conversation.lastMessageAt = msg.createdAt;
  conversation.lastMessagePreview = text.slice(0, 160);
  await conversation.save();
  return serializeMessage(msg);
};

import crypto from 'crypto';
import CommunityGroup from '../models/CommunityGroup.js';
import CommunityMember from '../models/CommunityMember.js';
import CommunityMessage from '../models/CommunityMessage.js';
import CommunityInvite from '../models/CommunityInvite.js';
import User from '../models/User.js';

export const ROLE_RANK = {
  member: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

export const displayUserName = (user) => {
  if (!user) return 'Unknown member';
  if (user.role === 'employer') {
    return user.organizationName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Organization';
  }
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.name || user.username || user.email || 'Unknown member';
};

export const slugify = (name) => {
  const base = String(name || 'group')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'group';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
};

export const makeInviteCode = () => crypto.randomBytes(6).toString('hex');

export const attachmentTypeFromMime = (mime = '', filename = '') => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  const ext = String(filename).split('.').pop()?.toLowerCase() || '';
  if (/^(jpe?g|png|gif|webp)$/.test(ext)) return 'image';
  if (/^(mp3|wav|ogg|m4a|aac)$/.test(ext)) return 'audio';
  if (/^(mp4|webm|mov|avi)$/.test(ext)) return 'video';
  return 'file';
};

export async function getMembership(groupId, userId) {
  return CommunityMember.findOne({ groupId, userId });
}

export function isActiveMember(member) {
  return !!member && member.status === 'active';
}

export function canManageRoles(actorRole) {
  return ROLE_RANK[actorRole] >= ROLE_RANK.admin;
}

export function canModerate(actorRole) {
  return ROLE_RANK[actorRole] >= ROLE_RANK.moderator;
}

export function canPostSpecialKind(actorRole, kind) {
  if (!kind || kind === 'regular') return true;
  return canModerate(actorRole);
}

export function canChangeMember(actor, target) {
  if (!actor || !target) return false;
  if (String(actor.userId) === String(target.userId)) return false;
  if (target.role === 'owner') return false;
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') return ROLE_RANK[target.role] < ROLE_RANK.admin;
  if (actor.role === 'moderator') return target.role === 'member';
  return false;
}

export const serializeAuthor = (user) => {
  if (!user) return null;
  return {
    id: String(user._id),
    name: displayUserName(user),
    email: user.email || '',
    role: user.role,
    profilePicture: user.profilePicture || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    organizationName: user.organizationName || '',
  };
};

export const serializeMessage = (msg, author) => ({
  id: String(msg._id),
  groupId: String(msg.groupId),
  authorId: String(msg.authorId),
  author: serializeAuthor(author),
  kind: msg.kind || 'regular',
  body: msg.deletedAt ? '' : (msg.body || ''),
  attachments: msg.deletedAt ? [] : (msg.attachments || []),
  pinned: !!msg.pinned,
  deleted: !!msg.deletedAt,
  clientMsgId: msg.clientMsgId || '',
  createdAt: msg.createdAt,
  updatedAt: msg.updatedAt,
});

export const serializeMember = (member, user, onlineIds = new Set()) => {
  const userId = String(member.userId);
  return {
    id: String(member._id),
    groupId: String(member.groupId),
    userId,
    role: member.role,
    status: member.status,
    statusReason: member.statusReason || '',
    joinedAt: member.joinedAt,
    lastSeenAt: member.lastSeenAt,
    online: onlineIds.has(userId),
    user: serializeAuthor(user) || {
      id: userId,
      name: 'Account removed',
      email: '',
      role: '',
      profilePicture: '',
      firstName: '',
      lastName: '',
      organizationName: '',
      missing: true,
    },
  };
};

export const serializeGroup = (group, membership = null, extras = {}) => ({
  id: String(group._id),
  name: group.name,
  slug: group.slug,
  description: group.description || '',
  visibility: group.visibility,
  avatarPath: group.avatarPath || '',
  createdBy: String(group.createdBy),
  memberCount: group.memberCount || 0,
  lastMessageAt: group.lastMessageAt || null,
  lastMessagePreview: group.lastMessagePreview || '',
  moderationStatus: group.moderationStatus || 'active',
  moderationReason: group.moderationReason || '',
  reportCount: group.reportCount || 0,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
  myRole: membership?.role || null,
  myStatus: membership?.status || null,
  isMember: !!membership && membership.status === 'active',
  ...extras,
});

export const getGroupModerationBlock = (group, action = 'post') => {
  const status = group?.moderationStatus || 'active';
  if (status === 'active') return null;
  if (status === 'suspended') {
    return 'This group has been suspended by OPUS admin.';
  }
  if (status === 'restricted') {
    if (action === 'join') return 'This group is restricted and not accepting new members.';
    if (action === 'post') return 'This group is restricted. New messages are disabled.';
  }
  return null;
};

export const activeGroupsFilter = {
  moderationStatus: { $nin: ['restricted', 'suspended'] },
};

export async function ensureUniqueSlug(name) {
  let slug = slugify(name);
  // eslint-disable-next-line no-await-in-loop
  while (await CommunityGroup.exists({ slug })) {
    slug = slugify(name);
  }
  return slug;
}

export async function createInvite(groupId, userId, { expiresInDays = 30, maxUses = 0 } = {}) {
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  return CommunityInvite.create({
    groupId,
    code: makeInviteCode(),
    createdBy: userId,
    expiresAt,
    maxUses,
  });
}

export function inviteIsValid(invite) {
  if (!invite || invite.revoked) return false;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return false;
  if (invite.maxUses > 0 && invite.useCount >= invite.maxUses) return false;
  return true;
}

export async function loadAuthorsMap(userIds) {
  const ids = [...new Set(userIds.map(String))];
  const users = await User.find({ _id: { $in: ids } })
    .select('firstName lastName name username email role organizationName profilePicture')
    .lean();
  return Object.fromEntries(users.map((u) => [String(u._id), u]));
}

export async function createCommunityTextMessage({ groupId, user, text, kind = 'regular', clientMsgId = '' }) {
  const membership = await getMembership(groupId, user._id);
  if (!isActiveMember(membership)) {
    const err = new Error('Join the group to post messages');
    err.status = 403;
    throw err;
  }
  const resolvedKind = ['regular', 'alert', 'warning', 'notice'].includes(kind) ? kind : 'regular';
  if (!canPostSpecialKind(membership.role, resolvedKind)) {
    const err = new Error('Only moderators can post alerts, warnings, and notices');
    err.status = 403;
    throw err;
  }
  const body = String(text || '').trim();
  if (!body) {
    const err = new Error('Message cannot be empty');
    err.status = 400;
    throw err;
  }
  if (clientMsgId) {
    const existing = await CommunityMessage.findOne({ groupId, clientMsgId });
    if (existing) {
      return { message: serializeMessage(existing, user), duplicate: true, membership };
    }
  }
  const msg = await CommunityMessage.create({
    groupId,
    authorId: user._id,
    kind: resolvedKind,
    body: body.slice(0, 4000),
    clientMsgId: clientMsgId || '',
  });
  const group = await CommunityGroup.findById(groupId);
  if (group) {
    const preview = resolvedKind !== 'regular' ? `[${resolvedKind}] ${body}` : body;
    group.lastMessageAt = msg.createdAt;
    group.lastMessagePreview = preview.slice(0, 140);
    await group.save();
  }
  return { message: serializeMessage(msg, user), duplicate: false, membership };
}

export async function assertActiveCommunityMember(groupId, userId) {
  const membership = await getMembership(groupId, userId);
  if (!isActiveMember(membership)) return null;
  return membership;
}

export { CommunityGroup, CommunityMember, CommunityMessage, CommunityInvite };

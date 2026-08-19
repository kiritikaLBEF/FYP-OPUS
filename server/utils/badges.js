import UserBadge from '../models/UserBadge.js';

export const serializeAwardedBadge = (badge) => ({
  id: String(badge._id),
  key: badge.key,
  label: badge.label,
  description: badge.description || '',
  color: badge.color || '#0071e3',
});

export const loadBadgesForUsers = async (userIds) => {
  if (!userIds.length) return new Map();
  const awards = await UserBadge.find({ userId: { $in: userIds } }).populate('badgeId').lean();
  const map = new Map();
  awards.forEach((row) => {
    if (!row.badgeId || row.badgeId.active === false) return;
    const id = String(row.userId);
    const list = map.get(id) || [];
    list.push(serializeAwardedBadge(row.badgeId));
    map.set(id, list);
  });
  return map;
};

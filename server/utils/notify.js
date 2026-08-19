import Notification from '../models/Notification.js';

/**
 * Create an in-app notification for a user. Failures are logged, never thrown.
 */
export const notifyUser = async ({
  userId,
  type,
  title,
  message,
  link = '',
  meta = {},
}) => {
  if (!userId || !type || !title || !message) return null;
  try {
    return await Notification.create({
      userId,
      type,
      title,
      message,
      link,
      meta,
      read: false,
    });
  } catch (err) {
    console.error('notifyUser failed:', err.message);
    return null;
  }
};

export const listNotificationsForUser = async (userId, { limit = 40 } = {}) => {
  const items = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const unread = await Notification.countDocuments({ userId, read: false });
  return {
    notifications: items.map((n) => ({
      id: n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link || '',
      read: !!n.read,
      createdAt: n.createdAt,
      meta: n.meta || {},
    })),
    unread,
  };
};

export const markNotificationsRead = async (userId, { ids = null } = {}) => {
  const filter = { userId, read: false };
  if (Array.isArray(ids) && ids.length) {
    filter._id = { $in: ids };
  }
  await Notification.updateMany(filter, { $set: { read: true } });
  const unread = await Notification.countDocuments({ userId, read: false });
  return { unread };
};

import {
  listNotificationsForUser,
  markNotificationsRead,
} from '../utils/notify.js';

export const getMyNotifications = async (req, res) => {
  try {
    const data = await listNotificationsForUser(req.user._id);
    res.json(data);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: 'Failed to load notifications' });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const data = await listNotificationsForUser(req.user._id, { limit: 1 });
    res.json({ unread: data.unread });
  } catch (err) {
    console.error('Unread notification count error:', err);
    res.status(500).json({ message: 'Failed to load unread count' });
  }
};

export const markMyNotificationsRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    const data = await markNotificationsRead(req.user._id, { ids });
    res.json({ message: 'Notifications marked as read', ...data });
  } catch (err) {
    console.error('Mark notifications read error:', err);
    res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
};

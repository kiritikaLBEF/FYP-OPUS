import {
  listNotificationsForUser,
  markNotificationsRead,
  countUnreadByTypes,
} from '../utils/notify.js';

const WALLET_NOTIFY_TYPES = ['payment_confirmed', 'wallet_topup'];

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
    const walletUnread = await countUnreadByTypes(req.user._id, WALLET_NOTIFY_TYPES);
    res.json({ unread: data.unread, walletUnread });
  } catch (err) {
    console.error('Unread notification count error:', err);
    res.status(500).json({ message: 'Failed to load unread count' });
  }
};

export const markMyNotificationsRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    const types = Array.isArray(req.body?.types) ? req.body.types : null;
    const data = await markNotificationsRead(req.user._id, { ids, types });
    const walletUnread = await countUnreadByTypes(req.user._id, WALLET_NOTIFY_TYPES);
    res.json({ message: 'Notifications marked as read', ...data, walletUnread });
  } catch (err) {
    console.error('Mark notifications read error:', err);
    res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
};

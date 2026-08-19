import { Router } from 'express';
import { protect, requireOnboardingComplete } from '../middleware/auth.js';
import { uploadChatFiles } from '../middleware/upload.js';
import {
  getConversations,
  getConversationMessages,
  postConversationRead,
  postConversationArchive,
  postTextMessage,
  deleteMessage,
  createCallToken,
  getMessagingUnread,
  searchMyMessaging,
} from '../controllers/messagingController.js';

const router = Router();

router.use(protect, requireOnboardingComplete);

router.get('/conversations', getConversations);
router.get('/search', searchMyMessaging);
router.get('/unread-count', getMessagingUnread);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/read', postConversationRead);
router.post('/conversations/:id/archive', postConversationArchive);
router.post(
  '/conversations/:id/messages',
  (req, res, next) => {
    uploadChatFiles.array('files', 5)(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
      next();
    });
  },
  postTextMessage,
);
router.delete('/messages/:messageId', deleteMessage);
router.post('/calls/token', createCallToken);

export default router;

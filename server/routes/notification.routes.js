import { Router } from 'express';
import { protect, requireOnboardingComplete } from '../middleware/auth.js';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markMyNotificationsRead,
} from '../controllers/notificationController.js';

const router = Router();

router.use(protect, requireOnboardingComplete);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.post('/mark-read', markMyNotificationsRead);

export default router;

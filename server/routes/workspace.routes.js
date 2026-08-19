import { Router } from 'express';
import { protect, requireOnboardingComplete } from '../middleware/auth.js';
import { uploadWorkspaceFiles } from '../middleware/upload.js';
import {
  listMyWorkSessions,
  getWorkSession,
  startWorkSession,
  addProgressUpdate,
  attachProgressUpdateFiles,
  reviewProgressUpdate,
  revertProgressUpdateReview,
  toggleGuideline,
  proceedForFinalization,
  submitFinalDelivery,
  attachFinalDeliveryFiles,
  acceptFinalDelivery,
  requestFinalChanges,
  addWorkspaceMessage,
  confirmPayment,
  issueCertificate,
  downloadCertificate,
  addCertificateToProfile,
  sendStartReminder,
} from '../controllers/workspaceController.js';

const router = Router();

router.use(protect, requireOnboardingComplete);

router.get('/', listMyWorkSessions);
router.get('/:sessionId', getWorkSession);
router.get('/:sessionId/certificate', downloadCertificate);
router.post('/:sessionId/start', startWorkSession);
router.post('/:sessionId/remind-start', sendStartReminder);
router.post(
  '/:sessionId/updates',
  uploadWorkspaceFiles.array('files', 8),
  addProgressUpdate,
);
router.post(
  '/:sessionId/updates/:updateId/attachments',
  uploadWorkspaceFiles.array('files', 8),
  attachProgressUpdateFiles,
);
router.post('/:sessionId/updates/:updateId/review', reviewProgressUpdate);
router.post('/:sessionId/updates/:updateId/revert-review', revertProgressUpdateReview);
router.post('/:sessionId/guidelines/:guidelineId/toggle', toggleGuideline);
router.post('/:sessionId/proceed-finalization', proceedForFinalization);
router.post(
  '/:sessionId/final-delivery',
  uploadWorkspaceFiles.array('files', 8),
  submitFinalDelivery,
);
router.post(
  '/:sessionId/final-delivery/attachments',
  uploadWorkspaceFiles.array('files', 8),
  attachFinalDeliveryFiles,
);
router.post('/:sessionId/final-delivery/accept', acceptFinalDelivery);
router.post('/:sessionId/final-delivery/request-changes', requestFinalChanges);
router.post('/:sessionId/messages', addWorkspaceMessage);
router.post('/:sessionId/confirm-payment', confirmPayment);
router.post('/:sessionId/issue-certificate', issueCertificate);
router.post('/:sessionId/add-certificate', addCertificateToProfile);

export default router;

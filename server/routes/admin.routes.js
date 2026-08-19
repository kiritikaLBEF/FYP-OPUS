import { Router } from 'express';
import { protect, requireAdmin, requireOnboardingComplete, requireSuperAdmin } from '../middleware/auth.js';
import { uploadAdImage, handleUpload } from '../middleware/upload.js';
import {
  getAdminOverview,
  listUsers,
  getUserDetail,
  updateUser,
  deleteUser,
  flagUser,
  suspendUser,
  verificationQueue,
  getVerificationDetail,
  approveVerification,
  rejectVerification,
  listGigs,
  listNudgeTemplates,
  saveNudgeTemplate,
  sendNudge,
  retrySentNote,
  listUsersBySegment,
  getAnalytics,
  listAdmins,
  createAdmin,
  updateAdmin,
  deactivateAdmin,
  getAuditLogs,
  listJobPosts,
  getJobPostDetail,
  deleteJobPost,
  getAdminMeta,
} from '../controllers/adminController.js';
import {
  listAdminAds,
  createAdminAd,
  updateAdminAd,
  deleteAdminAd,
  getBadgeCandidates,
  listFeaturedPerformers,
  addFeaturedPerformer,
  removeFeaturedPerformer,
  listBadges,
  saveBadge,
  awardBadge,
  revokeBadge,
  listUserAwards,
} from '../controllers/homepageController.js';

const router = Router();

router.use(protect, requireOnboardingComplete, requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users/segment/:segment', listUsersBySegment);
router.get('/users', listUsers);
router.get('/users/:userId', getUserDetail);
router.put('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);
router.post('/users/:userId/flag', flagUser);
router.post('/users/:userId/suspend', suspendUser);

router.get('/verification-queue', verificationQueue);
router.get('/verification-queue/:userId', getVerificationDetail);
router.post('/verification-queue/:userId/approve', approveVerification);
router.post('/verification-queue/:userId/reject', rejectVerification);

router.get('/gigs', listGigs);
router.get('/jobs', listJobPosts);
router.get('/jobs/:jobId', getJobPostDetail);
router.delete('/jobs/:jobId', deleteJobPost);
router.get('/meta', getAdminMeta);
router.get('/email-templates', listNudgeTemplates);
router.post('/email-templates', saveNudgeTemplate);
router.post('/nudges/:userId', sendNudge);
router.post('/sent-notes/:sentNoteId/retry', retrySentNote);

router.get('/analytics', requireSuperAdmin, getAnalytics);
router.get('/audit-logs', requireSuperAdmin, getAuditLogs);

router.get('/admins', requireSuperAdmin, listAdmins);
router.post('/admins', requireSuperAdmin, createAdmin);
router.put('/admins/:adminId', requireSuperAdmin, updateAdmin);
router.post('/admins/:adminId/deactivate', requireSuperAdmin, deactivateAdmin);

router.get('/ads', listAdminAds);
router.post('/ads', handleUpload(uploadAdImage.single('image')), createAdminAd);
router.put('/ads/:adId', handleUpload(uploadAdImage.single('image')), updateAdminAd);
router.delete('/ads/:adId', deleteAdminAd);

router.get('/badge-candidates', getBadgeCandidates);
router.get('/featured', listFeaturedPerformers);
router.post('/featured', addFeaturedPerformer);
router.delete('/featured/:featuredId', removeFeaturedPerformer);

router.get('/badges', listBadges);
router.post('/badges', saveBadge);
router.get('/badge-awards', listUserAwards);
router.post('/badge-awards', awardBadge);
router.delete('/badge-awards/:awardId', revokeBadge);

export default router;

import { Router } from 'express';
import { protect, requireAdmin, requireOnboardingComplete, requireSuperAdmin, requireAdminPrivilege } from '../middleware/auth.js';
import { uploadAdImage, handleUpload } from '../middleware/upload.js';
import {
  getAdminOverview,
  getAdminNavBadges,
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
  listAdminCommunityGroups,
  getAdminCommunityGroup,
  listAdminCommunityGroupMembers,
  updateAdminCommunityGroupModeration,
  dismissAdminCommunityReports,
} from '../controllers/adminCommunityController.js';
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
router.get('/nav-badges', getAdminNavBadges);

router.get('/users/segment/:segment', requireAdminPrivilege('users'), listUsersBySegment);
router.get('/users', requireAdminPrivilege('users'), listUsers);
router.get('/users/:userId', requireAdminPrivilege('users'), getUserDetail);
router.put('/users/:userId', requireAdminPrivilege('users'), updateUser);
router.delete('/users/:userId', requireAdminPrivilege('users'), deleteUser);
router.post('/users/:userId/flag', requireAdminPrivilege('users'), flagUser);
router.post('/users/:userId/suspend', requireAdminPrivilege('users'), suspendUser);

router.get('/verification-queue', requireAdminPrivilege('verification'), verificationQueue);
router.get('/verification-queue/:userId', requireAdminPrivilege('verification'), getVerificationDetail);
router.post('/verification-queue/:userId/approve', requireAdminPrivilege('verification'), approveVerification);
router.post('/verification-queue/:userId/reject', requireAdminPrivilege('verification'), rejectVerification);

router.get('/gigs', requireAdminPrivilege('monitor'), listGigs);
router.get('/jobs', requireAdminPrivilege('jobs'), listJobPosts);
router.get('/jobs/:jobId', requireAdminPrivilege('jobs'), getJobPostDetail);
router.delete('/jobs/:jobId', requireAdminPrivilege('jobs'), deleteJobPost);
router.get('/meta', getAdminMeta);
router.get('/email-templates', requireSuperAdmin, listNudgeTemplates);
router.post('/email-templates', requireSuperAdmin, saveNudgeTemplate);
router.post('/nudges/:userId', requireAdminPrivilege('users'), sendNudge);
router.post('/sent-notes/:sentNoteId/retry', requireAdminPrivilege('users'), retrySentNote);

router.get('/analytics', requireSuperAdmin, getAnalytics);
router.get('/audit-logs', requireSuperAdmin, getAuditLogs);

router.get('/admins', requireSuperAdmin, listAdmins);
router.post('/admins', requireSuperAdmin, createAdmin);
router.put('/admins/:adminId', requireSuperAdmin, updateAdmin);
router.post('/admins/:adminId/deactivate', requireSuperAdmin, deactivateAdmin);

router.get('/ads', requireAdminPrivilege('homepageAds'), listAdminAds);
router.post('/ads', requireAdminPrivilege('homepageAds'), handleUpload(uploadAdImage.single('image')), createAdminAd);
router.put('/ads/:adId', requireAdminPrivilege('homepageAds'), handleUpload(uploadAdImage.single('image')), updateAdminAd);
router.delete('/ads/:adId', requireAdminPrivilege('homepageAds'), deleteAdminAd);

router.get('/badge-candidates', requireAdminPrivilege('featured'), getBadgeCandidates);
router.get('/featured', requireAdminPrivilege('featured'), listFeaturedPerformers);
router.post('/featured', requireAdminPrivilege('featured'), addFeaturedPerformer);
router.delete('/featured/:featuredId', requireAdminPrivilege('featured'), removeFeaturedPerformer);

router.get('/badges', requireAdminPrivilege('badges'), listBadges);
router.post('/badges', requireAdminPrivilege('badges'), saveBadge);
router.get('/badge-awards', requireAdminPrivilege('badges'), listUserAwards);
router.post('/badge-awards', requireAdminPrivilege('badges'), awardBadge);
router.delete('/badge-awards/:awardId', requireAdminPrivilege('badges'), revokeBadge);

router.get('/community/groups', requireAdminPrivilege('community'), listAdminCommunityGroups);
router.get('/community/groups/:groupId', requireAdminPrivilege('community'), getAdminCommunityGroup);
router.get('/community/groups/:groupId/members', requireAdminPrivilege('community'), listAdminCommunityGroupMembers);
router.patch('/community/groups/:groupId/moderation', requireAdminPrivilege('community'), updateAdminCommunityGroupModeration);
router.post('/community/groups/:groupId/dismiss-reports', requireAdminPrivilege('community'), dismissAdminCommunityReports);

export default router;

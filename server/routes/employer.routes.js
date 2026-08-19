import { Router } from 'express';
import { protect, requireOnboardingComplete, requireEmployer, requireEmployerVerified } from '../middleware/auth.js';
import { uploadJobCover } from '../middleware/upload.js';
import {
  getEmployerInit,
  getJobFeed,
  getEmployerOverview,
  getEmployerTransactions,
  getEmployerEStatement,
  getEmployerEStatementPdf,
  getEmployerNotifications,
  getMyJobs,
  createJob,
  getJobStatus,
  getEmployerMessages,
  getJobApplications,
  getApplicantProfile,
  acceptApplication,
  rejectApplication,
  deleteEmployerJob,
} from '../controllers/employerController.js';
import {
  acceptSquadBid,
  rejectSquadBid,
} from '../controllers/multiFreelancerController.js';

const router = Router();

router.use(protect, requireOnboardingComplete, requireEmployer);

router.get('/init', getEmployerInit);
router.get('/jobs/feed', getJobFeed);
router.get('/dashboard/overview', getEmployerOverview);
router.get('/transactions', getEmployerTransactions);
router.get('/estatement', getEmployerEStatement);
router.get('/estatement/pdf', getEmployerEStatementPdf);
router.get('/notifications', getEmployerNotifications);

router.get('/jobs', requireEmployerVerified, getMyJobs);
router.post('/jobs', requireEmployerVerified, uploadJobCover.single('coverImage'), createJob);
router.delete('/jobs/:jobId', requireEmployerVerified, deleteEmployerJob);
router.get('/status', requireEmployerVerified, getJobStatus);
router.get('/jobs/:jobId/applications', requireEmployerVerified, getJobApplications);
router.get('/applicants/:freelancerId/profile', requireEmployerVerified, getApplicantProfile);
router.post('/applications/:applicationId/accept', requireEmployerVerified, acceptApplication);
router.post('/applications/:applicationId/reject', requireEmployerVerified, rejectApplication);
router.post('/squad-bids/:squadId/accept', requireEmployerVerified, acceptSquadBid);
router.post('/squad-bids/:squadId/reject', requireEmployerVerified, rejectSquadBid);
router.get('/messages', requireEmployerVerified, getEmployerMessages);

export default router;

import { Router } from 'express';
import { protect, requireOnboardingComplete, requireFreelancer, optionalAuth } from '../middleware/auth.js';
import {
  listPublicJobs,
  getPublicJobDetail,
  applyToJob,
  getMyApplications,
} from '../controllers/jobsController.js';
import {
  searchFreelancers,
  createSquadBid,
  submitSquadBid,
  respondSquadInvite,
  getMySquadInvites,
  getMySquadBids,
} from '../controllers/multiFreelancerController.js';

const router = Router();

router.get('/', optionalAuth, listPublicJobs);
router.get('/mine/applications', protect, requireOnboardingComplete, requireFreelancer, getMyApplications);
router.get('/mine/squad-invites', protect, requireOnboardingComplete, requireFreelancer, getMySquadInvites);
router.get('/mine/squad-bids', protect, requireOnboardingComplete, requireFreelancer, getMySquadBids);
router.get('/freelancers/search', protect, requireOnboardingComplete, requireFreelancer, searchFreelancers);
router.get('/:jobId', optionalAuth, getPublicJobDetail);
router.post('/:jobId/apply', protect, requireOnboardingComplete, requireFreelancer, applyToJob);
router.post('/:jobId/squad-bids', protect, requireOnboardingComplete, requireFreelancer, createSquadBid);
router.post('/squad-bids/:squadId/submit', protect, requireOnboardingComplete, requireFreelancer, submitSquadBid);
router.post('/squad-bids/:squadId/respond', protect, requireOnboardingComplete, requireFreelancer, respondSquadInvite);

export default router;

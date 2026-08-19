import { Router } from 'express';
import { protect, requireOnboardingComplete, requireFreelancer } from '../middleware/auth.js';
import {
  getDashboardInit,
  getOverview,
  getAnalytics,
  getEarnings,
  getAcceptedProjects,
  getActivityFeed,
  getTasks,
  getTaskBoard,
  getBids,
  getTransactions,
  getEStatement,
  downloadEStatementPdf,
} from '../controllers/dashboardController.js';

const router = Router();
router.use(protect, requireOnboardingComplete, requireFreelancer);

router.get('/init', getDashboardInit);
router.get('/overview', getOverview);
router.get('/analytics', getAnalytics);
router.get('/earnings', getEarnings);
router.get('/accepted-projects', getAcceptedProjects);
router.get('/activity', getActivityFeed);
router.get('/tasks', getTasks);
router.get('/board', getTaskBoard);
router.get('/bids', getBids);
router.get('/transactions', getTransactions);
router.get('/estatement', getEStatement);
router.get('/estatement/pdf', downloadEStatementPdf);

export default router;

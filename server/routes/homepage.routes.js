import { Router } from 'express';
import { getPublicHomepage, getPublicFreelancerProfile } from '../controllers/homepageController.js';

const router = Router();
router.get('/', getPublicHomepage);
router.get('/freelancers/:userId', getPublicFreelancerProfile);

export default router;

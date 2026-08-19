import { Router } from 'express';
import { protect, requireOnboardingComplete } from '../middleware/auth.js';
import { uploadProfile, uploadCertificate, uploadProjectFields } from '../middleware/upload.js';
import {
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  changePassword,
  addCertification,
  updateCertification,
  deleteCertification,
  addProject,
  updateProject,
  deleteProject,
  deleteAccount,
} from '../controllers/profileController.js';

const router = Router();

router.use(protect, requireOnboardingComplete);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/photo', uploadProfile.single('photo'), uploadProfilePhoto);
router.put('/password', changePassword);

router.post('/certifications', uploadCertificate.single('file'), addCertification);
router.put('/certifications/:id', uploadCertificate.single('file'), updateCertification);
router.delete('/certifications/:id', deleteCertification);

router.post('/projects', uploadProjectFields, addProject);
router.put('/projects/:id', uploadProjectFields, updateProject);
router.delete('/projects/:id', deleteProject);

router.delete('/account', deleteAccount);

export default router;

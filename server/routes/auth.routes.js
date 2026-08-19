import { Router } from 'express';
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  googleAuth,
  forgotPassword,
  verifyResetOtp,
  resendResetOtp,
  resetPassword,
  setPassword,
  saveDegree,
  saveSkills,
  saveProfile,
  saveEmployerDocuments,
  saveEmployerBusinessType,
  getMe,
  getMeta,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { uploadProfile, uploadEmployerDocuments } from '../middleware/upload.js';

const router = Router();

router.get('/meta', getMeta);
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/resend-reset-otp', resendResetOtp);
router.post('/reset-password', resetPassword);

router.get('/me', protect, getMe);
router.post('/onboarding/password', protect, setPassword);
router.post('/onboarding/degree', protect, saveDegree);
router.post('/onboarding/skills', protect, saveSkills);
router.post('/onboarding/profile', protect, uploadProfile.single('photo'), saveProfile);
router.post('/onboarding/employer/documents', protect, uploadEmployerDocuments, saveEmployerDocuments);
router.post('/onboarding/employer/business-type', protect, saveEmployerBusinessType);

export default router;

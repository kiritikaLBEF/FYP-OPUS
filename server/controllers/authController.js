import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import PendingSignup from '../models/PendingSignup.js';
import { sendOtpEmail, sendPasswordResetOtpEmail } from '../utils/email.js';
import { signAccessToken, signOnboardingToken } from '../utils/jwt.js';
import {
  DEGREE_OPTIONS,
  BUSINESS_TYPES,
  getAvatarUrl,
  getRandomAvatarSeed,
  needsDegreeName,
} from '../utils/constants.js';
import { formatAuthResponse } from '../middleware/auth.js';

const getGoogleAudiences = () => {
  const ids = [
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.GOOGLE_WEB_CLIENT_ID?.trim(),
  ].filter((id) => id && id !== 'your_google_client_id_here');
  return [...new Set(ids)];
};

const getGoogleClient = () => {
  const audiences = getGoogleAudiences();
  if (!audiences.length) return null;
  return new OAuth2Client(audiences[0]);
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const resolveProfilePicture = (user, { avatarId }) => {
  if (avatarId) return getAvatarUrl(avatarId);
  if (user.profilePicture && user.profilePicture.startsWith('http')) return user.profilePicture;
  if (user.googlePicture) return user.googlePicture;
  const seed = getRandomAvatarSeed();
  user.avatarId = seed;
  return getAvatarUrl(seed);
};

const issueTokenForUser = (user) => {
  if (user.onboardingComplete) {
    return { token: signAccessToken(user._id), step: 'complete' };
  }
  return { token: signOnboardingToken(user._id), step: user.onboardingStep };
};

const nextStepAfterOtp = (user) => (user.role === 'employer' ? 'documents' : 'degree');
const nextStepAfterPassword = (user) => (user.role === 'employer' ? 'documents' : 'degree');
const safePublicRole = (role) => (role === 'employer' ? 'employer' : 'freelancer');

export const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      organizationName,
      email,
      password,
      confirmPassword,
      phone,
      role,
    } = req.body;

    const publicRole = safePublicRole(role);
    const isEmployer = publicRole === 'employer';

    if (isEmployer) {
      if (!organizationName?.trim() || !email || !password) {
        return res.status(400).json({ message: 'Please fill all required fields' });
      }
      if (!phone?.trim()) {
        return res.status(400).json({ message: 'Phone number is required' });
      }
    } else if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing?.isEmailVerified && existing.onboardingComplete) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }
    if (existing?.isEmailVerified && !existing.onboardingComplete) {
      return res.status(400).json({
        message: 'This email is already registered. Sign in to continue onboarding.',
      });
    }
    if (existing && !existing.isEmailVerified) {
      await User.deleteOne({ _id: existing._id });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const hashed = await User.hashPassword(password);

    const resolvedFirstName = isEmployer ? organizationName.trim() : firstName;
    const resolvedLastName = isEmployer ? 'Organization' : lastName;

    const pending = await PendingSignup.findOneAndUpdate(
      { email: normalizedEmail },
      {
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        organizationName: isEmployer ? organizationName.trim() : '',
        phone: phone || '',
        password: hashed,
        role: publicRole,
        otp,
        otpExpires,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await sendOtpEmail(pending.email, otp, resolvedFirstName);

    res.status(201).json({
      message: 'Verification code sent to your email',
      email: pending.email,
      onboardingStep: 'otp',
    });
  } catch (err) {
    console.error('Register error:', err);
    const msg = err.message?.includes('PLAIN') || err.message?.includes('not configured')
      ? 'Email service is not configured. Contact support or try again later.'
      : err.message || 'Registration failed';
    res.status(500).json({ message: msg });
  }
};

const verifyPendingOrLegacyOtp = async (normalizedEmail, otpCode) => {
  const pending = await PendingSignup.findOne({ email: normalizedEmail }).select('+otp +otpExpires +password');
  if (pending) {
    if (!pending.otp || pending.otp !== otpCode) {
      return { error: 'Invalid verification code' };
    }
    if (pending.otpExpires < new Date()) {
      return { error: 'Verification code has expired' };
    }

    const user = await User.create({
      firstName: pending.firstName,
      lastName: pending.lastName,
      organizationName: pending.organizationName || '',
      email: pending.email,
      phone: pending.phone || '',
      password: pending.password,
      role: pending.role,
      isEmailVerified: true,
      onboardingStep: nextStepAfterOtp({ role: pending.role }),
      authProvider: 'local',
    });
    await PendingSignup.deleteOne({ _id: pending._id });
    return { user };
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpires +password');
  if (!user) return { error: 'Account not found', status: 404 };

  if (!user.otp || user.otp !== otpCode) {
    return { error: 'Invalid verification code' };
  }
  if (user.otpExpires < new Date()) {
    return { error: 'Verification code has expired' };
  }

  user.isEmailVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.onboardingStep = nextStepAfterOtp(user);
  await user.save();
  return { user };
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const result = await verifyPendingOrLegacyOtp(email.toLowerCase(), otp.trim());
    if (result.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }

    const { user } = result;
    const token = signOnboardingToken(user._id);
    res.json({
      message: 'Email verified',
      token,
      user: user.toPublicJSON(),
      onboardingStep: user.onboardingStep,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase();
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const pending = await PendingSignup.findOne({ email: normalizedEmail });
    if (pending) {
      pending.otp = otp;
      pending.otpExpires = otpExpires;
      await pending.save();
      await sendOtpEmail(pending.email, otp, pending.firstName);
      return res.json({ message: 'New verification code sent' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await sendOtpEmail(user.email, otp, user.firstName);
    res.json({ message: 'New verification code sent' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resend code' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const identifier = String(email).trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        message: 'Your account has been suspended',
        accountStatus: user.accountStatus,
        suspensionReason: user.suspensionReason || '',
      });
    }

    if (!user.isEmailVerified && user.authProvider === 'local') {
      return res.status(401).json({ message: 'Please verify your email first', needsOtp: true, email: user.email });
    }

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

    const { token, step } = issueTokenForUser(user);
    res.json({
      ...formatAuthResponse(user, token),
      onboardingStep: step,
      needsOnboarding: !user.onboardingComplete,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { credential, role } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const googleClient = getGoogleClient();
    if (!googleClient) {
      return res.status(503).json({
        message: 'Google sign-in is not configured yet. Use email signup or ask the developer to add GOOGLE_CLIENT_ID.',
      });
    }

    const audiences = getGoogleAudiences();
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name, family_name, picture } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });
    let isNew = false;

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.googlePicture = picture;
        user.authProvider = user.password ? 'both' : 'google';
        user.isEmailVerified = true;
        await user.save();
      }
    } else {
      isNew = true;
      user = await User.create({
        firstName: given_name || 'User',
        lastName: family_name || '',
        email: email.toLowerCase(),
        googleId,
        googlePicture: picture,
        role: safePublicRole(role),
        authProvider: 'google',
        isEmailVerified: true,
        onboardingStep: 'password',
        profilePicture: picture || getAvatarUrl(getRandomAvatarSeed()),
      });
    }

    if (user.onboardingComplete) {
      if (user.accountStatus === 'suspended') {
        return res.status(403).json({
          message: 'Your account has been suspended',
          accountStatus: user.accountStatus,
          suspensionReason: user.suspensionReason || '',
        });
      }
      const token = signAccessToken(user._id);
      return res.json({
        ...formatAuthResponse(user, token),
        onboardingStep: 'complete',
        needsOnboarding: false,
        isNew: false,
        skipOtp: true,
      });
    }

    const token = signOnboardingToken(user._id);
    const step = user.onboardingStep === 'otp' ? 'password' : user.onboardingStep;
    if (user.onboardingStep === 'otp') {
      user.onboardingStep = 'password';
      await user.save();
    }

    res.json({
      ...formatAuthResponse(user, token),
      onboardingStep: step,
      needsOnboarding: true,
      isNew,
      skipOtp: true,
      googlePicture: picture,
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ message: err.message || 'Google sign-in failed' });
  }
};

export const setPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = req.user;
    user.password = await User.hashPassword(password);
    user.authProvider = user.googleId ? 'both' : 'local';
    user.onboardingStep = nextStepAfterPassword(user);
    await user.save();

    res.json({
      message: 'Password set',
      user: user.toPublicJSON(),
      onboardingStep: user.onboardingStep,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to set password' });
  }
};

export const saveDegree = async (req, res) => {
  try {
    if (req.user.role === 'employer') {
      return res.status(400).json({ message: 'Use employer onboarding endpoints' });
    }
    const { degree, degreeName, schoolName, passoutYear, stillRunning } = req.body;

    if (!degree || !DEGREE_OPTIONS.includes(degree)) {
      return res.status(400).json({ message: 'Please select a valid degree' });
    }
    if (!schoolName?.trim()) {
      return res.status(400).json({ message: 'School name is required' });
    }
    if (needsDegreeName(degree) && !degreeName?.trim()) {
      return res.status(400).json({ message: 'Degree name is required' });
    }
    if (!stillRunning && !passoutYear) {
      return res.status(400).json({ message: 'Passout year is required' });
    }

    const user = req.user;
    user.degree = degree;
    user.degreeName = needsDegreeName(degree) ? degreeName.trim() : '';
    user.schoolName = schoolName.trim();
    user.passoutYear = stillRunning ? undefined : Number(passoutYear);
    user.stillRunning = !!stillRunning;
    user.onboardingStep = 'skills';
    await user.save();

    res.json({ user: user.toPublicJSON(), onboardingStep: 'skills' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save degree' });
  }
};

export const saveSkills = async (req, res) => {
  try {
    if (req.user.role === 'employer') {
      return res.status(400).json({ message: 'Use employer onboarding endpoints' });
    }
    const { skills } = req.body;
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ message: 'Select at least one skill' });
    }

    const user = req.user;
    user.skills = [...new Set(skills.map((s) => s.trim()).filter(Boolean))];
    user.onboardingStep = 'profile';
    await user.save();

    res.json({ user: user.toPublicJSON(), onboardingStep: 'profile' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save skills' });
  }
};

export const saveProfile = async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'employer') {
      return res.status(400).json({ message: 'Use employer onboarding endpoints' });
    }
    const { avatarId, skip } = req.body;

    if (req.file) {
      user.profilePicture = `/uploads/profiles/${req.file.filename}`;
      user.avatarId = '';
    } else if (avatarId) {
      user.avatarId = avatarId;
      user.profilePicture = getAvatarUrl(avatarId);
    } else if (skip === 'true' || skip === true) {
      user.profilePicture = resolveProfilePicture(user, { avatarId: avatarId || user.avatarId });
      if (avatarId) user.avatarId = avatarId;
    } else {
      return res.status(400).json({ message: 'Upload a photo, select an avatar, or skip' });
    }

    user.onboardingStep = 'complete';
    user.onboardingComplete = true;
    await user.save();

    const token = signAccessToken(user._id);
    res.json({
      ...formatAuthResponse(user, token),
      onboardingStep: 'complete',
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save profile' });
  }
};

export const saveEmployerDocuments = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'employer') {
      return res.status(400).json({ message: 'Employer accounts only' });
    }

    const panFile = req.files?.panCard?.[0];
    const regFile = req.files?.businessRegistration?.[0];

    if (!panFile || !regFile) {
      return res.status(400).json({ message: 'PAN card and business registration documents are required' });
    }

    user.panCardDocument = `/uploads/employer-docs/${panFile.filename}`;
    user.businessRegistrationDocument = `/uploads/employer-docs/${regFile.filename}`;
    user.onboardingStep = 'business_type';
    await user.save();

    res.json({
      message: 'Documents uploaded',
      user: user.toPublicJSON(),
      onboardingStep: 'business_type',
    });
  } catch (err) {
    console.error('Employer documents error:', err);
    res.status(500).json({ message: err.message || 'Failed to upload documents' });
  }
};

export const saveEmployerBusinessType = async (req, res) => {
  try {
    const { businessType, businessTypeOther } = req.body;
    const user = req.user;

    if (user.role !== 'employer') {
      return res.status(400).json({ message: 'Employer accounts only' });
    }

    const validTypes = BUSINESS_TYPES.map((t) => t.value);
    if (!businessType || !validTypes.includes(businessType)) {
      return res.status(400).json({ message: 'Please select a valid business type' });
    }
    if (businessType === 'other' && !businessTypeOther?.trim()) {
      return res.status(400).json({ message: 'Please specify your business type' });
    }

    user.businessType = businessType;
    user.businessTypeOther = businessType === 'other' ? businessTypeOther.trim() : '';
    user.onboardingStep = 'complete';
    user.onboardingComplete = true;
    await user.save();

    const token = signAccessToken(user._id);
    res.json({
      ...formatAuthResponse(user, token),
      onboardingStep: 'complete',
    });
  } catch (err) {
    console.error('Employer business type error:', err);
    res.status(500).json({ message: 'Failed to save business type' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+otp +otpExpires');
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email' });
    }
    if (!user.isEmailVerified) {
      return res.status(400).json({
        message: 'Email is not verified yet. Sign in or complete signup verification first.',
        needsOtp: true,
        email: user.email,
      });
    }
    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ message: 'This account is suspended. Contact support.' });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendPasswordResetOtpEmail(user.email, otp, user.firstName);
    res.json({ message: 'Password reset code sent', email: user.email });
  } catch (err) {
    console.error('Forgot password error:', err);
    const msg = err.message?.includes('PLAIN') || err.message?.includes('not configured') || err.message?.includes('Email auth')
      ? 'Email service is not configured. Contact support or try again later.'
      : err.message || 'Failed to send reset code';
    res.status(500).json({ message: msg });
  }
};

export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otp +otpExpires');
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (!user.otp || user.otp !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    if (!user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    res.json({ message: 'Code verified', email: user.email });
  } catch (err) {
    console.error('Verify reset OTP error:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
};

export const resendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otp +otpExpires');
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (!user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is not verified yet' });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendPasswordResetOtpEmail(user.email, otp, user.firstName);
    res.json({ message: 'New password reset code sent' });
  } catch (err) {
    console.error('Resend reset OTP error:', err);
    res.status(500).json({ message: 'Failed to resend code' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;
    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+otp +otpExpires +password');
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (!user.otp || user.otp !== String(otp).trim()) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    if (!user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired. Request a new code.' });
    }

    user.password = await User.hashPassword(password);
    user.otp = undefined;
    user.otpExpires = undefined;
    if (user.authProvider === 'google') user.authProvider = 'both';
    else if (!user.authProvider) user.authProvider = 'local';
    await user.save();

    res.json({ message: 'Password updated successfully. You can sign in now.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

export const getMe = async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
};

export const getMeta = async (_req, res) => {
  const { DEFAULT_SKILLS, DEGREE_OPTIONS, AVATAR_SEEDS, getPassoutYears, getAvatarUrl } =
    await import('../utils/constants.js');
  res.json({
    degrees: DEGREE_OPTIONS,
    skills: DEFAULT_SKILLS,
    businessTypes: BUSINESS_TYPES,
    avatars: AVATAR_SEEDS.map((seed) => ({ id: seed, url: getAvatarUrl(seed) })),
    passoutYears: getPassoutYears(),
  });
};

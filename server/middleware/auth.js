import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { isSuperAdminUser } from '../utils/adminConfig.js';

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const decoded = verifyToken(header.split(' ')[1]);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    if (user.accountStatus === 'suspended' && !isSuperAdminUser(user)) {
      return res.status(403).json({
        message: 'Your account has been suspended',
        accountStatus: user.accountStatus,
        suspensionReason: user.suspensionReason || '',
      });
    }

    req.user = user;
    req.tokenScope = decoded.scope;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireOnboardingComplete = (req, res, next) => {
  if (!req.user.onboardingComplete) {
    return res.status(403).json({ message: 'Please complete onboarding before editing your profile' });
  }
  next();
};

export const requireEmployer = (req, res, next) => {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ message: 'Employer access only' });
  }
  next();
};

export const requireEmployerVerified = (req, res, next) => {
  if (req.user.verificationStatus !== 'verified') {
    return res.status(403).json({
      message: 'Your organization account must be verified by admin to access this feature',
      verificationStatus: req.user.verificationStatus,
    });
  }
  next();
};

export const requireFreelancer = (req, res, next) => {
  if (req.user.role !== 'freelancer') {
    return res.status(403).json({ message: 'Freelancer access only' });
  }
  next();
};

export const requireWalletUser = (req, res, next) => {
  if (req.user.role !== 'freelancer' && req.user.role !== 'employer') {
    return res.status(403).json({ message: 'Wallet is available for freelancers and organizations' });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access only' });
  }
  if (req.user.accountStatus === 'suspended') {
    return res.status(403).json({ message: 'Admin account suspended' });
  }
  next();
};

export const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' || !isSuperAdminUser(req.user)) {
    return res.status(403).json({ message: 'Super admin access only' });
  }
  next();
};

/** Attaches req.user when a valid token is present; never blocks. */
export const optionalAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();

    const decoded = verifyToken(header.split(' ')[1]);
    const user = await User.findById(decoded.userId);
    if (user && (user.accountStatus !== 'suspended' || isSuperAdminUser(user))) {
      req.user = user;
    }
  } catch {
    /* ignore invalid tokens for public routes */
  }
  next();
};

export const formatAuthResponse = (user, token) => ({
  token,
  user: user.toPublicJSON(),
});

export const loadUserWithPassword = async (userId) =>
  User.findById(userId).select('+password');

export const loadUserWithOtp = async (userId) =>
  User.findById(userId).select('+otp +otpExpires +password');

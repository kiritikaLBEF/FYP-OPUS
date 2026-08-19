import User from '../models/User.js';

export const getSuperAdminEmail = () =>
  (process.env.SUPER_ADMIN_EMAIL || 'root-admin@opus.local').trim().toLowerCase();

export const getSuperAdminPassword = () =>
  (process.env.SUPER_ADMIN_PASSWORD || 'ChangeMeSuperAdmin123!').trim();

export const isSuperAdminUser = (user) =>
  !!user
  && user.role === 'admin'
  && user.adminTier === 'super_admin'
  && user.email?.toLowerCase() === getSuperAdminEmail();

export const ensureSuperAdmin = async () => {
  const email = getSuperAdminEmail();
  const password = getSuperAdminPassword();

  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    user = await User.create({
      firstName: 'Root',
      lastName: 'Admin',
      email,
      role: 'admin',
      adminTier: 'super_admin',
      authProvider: 'local',
      isEmailVerified: true,
      onboardingComplete: true,
      onboardingStep: 'complete',
      accountStatus: 'active',
      password: await User.hashPassword(password),
      verificationStatus: 'verified',
    });
    return user;
  }

  let changed = false;
  if (user.role !== 'admin') { user.role = 'admin'; changed = true; }
  if (user.adminTier !== 'super_admin') { user.adminTier = 'super_admin'; changed = true; }
  if (!user.onboardingComplete) { user.onboardingComplete = true; user.onboardingStep = 'complete'; changed = true; }
  if (!user.isEmailVerified) { user.isEmailVerified = true; changed = true; }
  if (user.accountStatus !== 'active') {
    user.accountStatus = 'active';
    user.suspensionSource = '';
    user.suspensionReason = '';
    user.suspendedAt = undefined;
    user.suspendedBy = undefined;
    user.isAutoSuspended = false;
    changed = true;
  }
  if (changed) await user.save();
  return user;
};

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';

const ACTIVE_ONBOARDING_STEPS = new Set([
  'password',
  'degree',
  'skills',
  'profile',
  'documents',
  'business_type',
]);

export default function OnboardingResume() {
  const { isOnboarding, onboardingStep, loading, pendingEmail, user, setPendingEmail } = useAuth();
  const { modal, openOnboarding, openOtp } = useAuthModal();

  useEffect(() => {
    if (loading || modal) return;
    if (!isOnboarding) return;

    if (onboardingStep === 'otp') {
      const email = pendingEmail || user?.email || '';
      if (email && !pendingEmail) setPendingEmail(email);
      if (email) openOtp();
      return;
    }

    if (onboardingStep && ACTIVE_ONBOARDING_STEPS.has(onboardingStep)) {
      openOnboarding();
    }
  }, [loading, isOnboarding, onboardingStep, pendingEmail, user, modal, openOnboarding, openOtp, setPendingEmail]);

  return null;
}

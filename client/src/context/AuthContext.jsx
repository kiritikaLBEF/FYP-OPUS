import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getProfileUrl } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('opus_token'));
  const [loading, setLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(null);
  const [pendingEmail, setPendingEmailState] = useState(() => sessionStorage.getItem('opus_pending_email') || '');

  const setPendingEmail = useCallback((email) => {
    setPendingEmailState(email);
    if (email) sessionStorage.setItem('opus_pending_email', email);
    else sessionStorage.removeItem('opus_pending_email');
  }, []);

  const persistSession = useCallback((newToken, newUser) => {
    if (newToken) {
      localStorage.setItem('opus_token', newToken);
      setToken(newToken);
    }
    if (newUser) {
      setUser(newUser);
      if (!newUser.onboardingComplete) {
        setOnboardingStep(newUser.onboardingStep);
      } else {
        setOnboardingStep(null);
      }
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem('opus_token');
    setToken(null);
    setUser(null);
    setOnboardingStep(null);
    setPendingEmail('');
    sessionStorage.removeItem('opus_pending_email');
  }, [setPendingEmail]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await api.me();
        if (cancelled) return;
        setUser(me);
        if (!me.onboardingComplete) setOnboardingStep(me.onboardingStep);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        clearSession();
        setLoading(false);
      }
    }, 12000);

    init().finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [token, clearSession]);

  const handleAuthResponse = useCallback((data) => {
    persistSession(data.token, data.user);
    if (data.needsOnboarding || !data.user?.onboardingComplete) {
      setOnboardingStep(data.onboardingStep || data.user?.onboardingStep);
    }
    return data;
  }, [persistSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user && user.onboardingComplete,
      isOnboarding: !!user && !user.onboardingComplete,
      isEmployer: user?.role === 'employer',
      isFreelancer: user?.role === 'freelancer',
      isAdmin: user?.role === 'admin',
      isEmployerVerified: user?.verificationStatus === 'verified',
      onboardingStep,
      pendingEmail,
      setPendingEmail,
      setOnboardingStep,
      persistSession,
      handleAuthResponse,
      logout,
      profileUrl: user ? getProfileUrl(user.profilePicture) : '',
    }),
    [user, token, loading, onboardingStep, pendingEmail, persistSession, handleAuthResponse, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

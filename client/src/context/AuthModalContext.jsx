import { createContext, useContext, useState } from 'react';

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const openSignIn = () => setModal('signin');
  const openSignUp = () => setModal('signup');
  const openForgotPassword = () => setModal('forgot');
  const openOtp = () => setModal('otp');
  const openOnboarding = () => setModal('onboarding');
  const openLogoutConfirm = () => setModal('logout');
  const closeModal = () => setModal(null);

  return (
    <AuthModalContext.Provider
      value={{
        modal,
        openSignIn,
        openSignUp,
        openForgotPassword,
        openOtp,
        openOnboarding,
        openLogoutConfirm,
        closeModal,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}

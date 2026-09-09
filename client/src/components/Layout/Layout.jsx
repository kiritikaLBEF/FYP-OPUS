import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Footer from '../Footer/Footer';
import AuthModal from '../AuthModal/AuthModal';
import OnboardingModal from '../OnboardingModal/OnboardingModal';
import OnboardingResume from '../OnboardingResume';
import LogoutModal from '../LogoutModal/LogoutModal';
import WelcomeOverlay from '../WelcomeOverlay/WelcomeOverlay';
import MessagingOverlays from '../../features/messaging/MessagingOverlays';
import MessagesFab from '../../features/messaging/MessagesFab';
import { useAuth } from '../../context/AuthContext';
import {
  getCommunityBasePath,
  publicShellFallback,
  shouldLeavePublicShell,
} from '../../utils/rolePaths';

export default function Layout() {
  const { user, isFreelancer, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.body.style.overflow = '';
  }, []);

  if (!loading && isAuthenticated && user) {
    const path = location.pathname;

    if (user.role === 'employer' && (path === '/community' || path.startsWith('/community/'))) {
      const suffix = path.replace(/^\/community/, '') || '';
      return <Navigate to={`${getCommunityBasePath(user)}${suffix}${location.search}`} replace />;
    }

    if (shouldLeavePublicShell(user, path)) {
      return <Navigate to={publicShellFallback(user)} replace />;
    }
  }

  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
      <WelcomeOverlay />
      <AuthModal />
      <OnboardingModal />
      <OnboardingResume />
      <LogoutModal />
      {isAuthenticated && isFreelancer && (
        <>
          <MessagesFab messagesPath="/messages" />
          <MessagingOverlays />
        </>
      )}
    </>
  );
}

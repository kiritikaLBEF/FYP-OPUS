import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
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

export default function Layout() {
  const { isFreelancer, isAuthenticated } = useAuth();

  useEffect(() => {
    document.body.style.overflow = '';
  }, []);

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

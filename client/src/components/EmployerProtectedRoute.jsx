import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPostLoginPath } from '../utils/postLoginPath';
import OnboardingModal from './OnboardingModal/OnboardingModal';
import OnboardingResume from './OnboardingResume';
import LogoutModal from './LogoutModal/LogoutModal';

export default function EmployerProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="route-loading">
        <div className="route-loading__spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (user?.role !== 'employer') {
    return <Navigate to={getPostLoginPath(user)} replace />;
  }

  return (
    <>
      {children}
      <OnboardingModal />
      <OnboardingResume />
      <LogoutModal />
    </>
  );
}

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPostLoginPath } from '../utils/postLoginPath';
import { AdminProvider } from '../context/AdminContext';
import AdminActionModals from './admin/AdminActionModals';
import LogoutModal from './LogoutModal/LogoutModal';
import AuthModal from './AuthModal/AuthModal';

export default function AdminProtectedRoute({ children }) {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <div className="route-loading">
        <div className="route-loading__spinner" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.role !== 'admin') return <Navigate to={getPostLoginPath(user)} replace />;

  return (
    <AdminProvider>
      {children}
      <AdminActionModals />
      <LogoutModal />
      <AuthModal />
    </AdminProvider>
  );
}

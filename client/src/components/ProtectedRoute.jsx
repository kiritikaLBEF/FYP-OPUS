import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="route-loading">
        <div className="route-loading__spinner" />
        <p className="route-loading__label">Loading your account…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles?.length) {
    if (!user?.role || !allowedRoles.includes(user.role)) {
      if (user?.role === 'employer') return <Navigate to="/employer/dashboard" replace />;
      if (user?.role === 'admin') return <Navigate to="/admin/overview" replace />;
      return <Navigate to="/" replace />;
    }
  } else if (user?.role !== 'freelancer') {
    if (user?.role === 'employer') return <Navigate to="/employer/dashboard" replace />;
    if (user?.role === 'admin') return <Navigate to="/admin/overview" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

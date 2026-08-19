import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.adminTier !== 'super_admin') {
    return <Navigate to="/admin/overview" replace />;
  }
  return children;
}

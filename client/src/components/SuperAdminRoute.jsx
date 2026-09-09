import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/adminPrivileges';

export default function SuperAdminRoute({ children }) {
  const { user } = useAuth();
  if (!isSuperAdmin(user)) {
    return <Navigate to="/admin/overview" replace />;
  }
  return children;
}

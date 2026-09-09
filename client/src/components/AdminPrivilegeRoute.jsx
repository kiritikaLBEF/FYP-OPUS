import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasAdminPrivilege, isSuperAdmin } from '../utils/adminPrivileges';

export default function AdminPrivilegeRoute({ privilege, children }) {
  const { user } = useAuth();

  if (isSuperAdmin(user)) return children;
  if (privilege && !hasAdminPrivilege(user, privilege)) {
    return <Navigate to="/admin/overview" replace />;
  }
  return children;
}

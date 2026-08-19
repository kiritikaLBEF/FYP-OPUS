import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { api } from '../../services/api';
import { userName } from '../../pages/Admin/adminHelpers';

/**
 * @param {'full' | 'user' | 'employer-pending' | 'employer-verified'} variant
 */
export default function AdminQuickActions({
  user,
  compact = false,
  variant = 'full',
  onActionComplete,
}) {
  const { openSendNote, openFlag, openSuspend, openVerify } = useAdmin();
  const done = () => onActionComplete?.();

  if (!user?.id) return null;

  const wrap = (fn) => () => { fn(user, done); };

  const showVerifyModal = variant === 'employer-pending';
  const showModeration = variant === 'full' && user.accountStatus !== 'suspended';

  const quickApprove = async () => {
    const label = user.organizationName || userName(user);
    if (!window.confirm(`Approve verification for ${label}? They will be moved to Verified Employers and notified by email.`)) return;
    try {
      await api.approveVerification(user.id);
      done();
    } catch (err) {
      window.alert(err.message || 'Failed to approve employer');
    }
  };

  return (
    <div className={`admin-quick-actions ${compact ? 'admin-quick-actions--compact' : ''}`}>
      <Link to={`/admin/users/${user.id}`} className="admin-btn admin-btn--ghost">
        View profile
      </Link>
      {user.accountStatus !== 'suspended' && (
        <button type="button" className="admin-btn" onClick={wrap(openSendNote)}>
          Send note
        </button>
      )}
      {showVerifyModal && (
        <>
          <button type="button" className="admin-btn admin-btn--primary" onClick={quickApprove}>
            Approve
          </button>
          <button type="button" className="admin-btn admin-btn--danger" onClick={wrap(openVerify)}>
            Reject
          </button>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={wrap(openVerify)}>
            Review docs
          </button>
        </>
      )}
      {showModeration && variant === 'full' && (
        <>
          <button type="button" className="admin-btn admin-btn--warn" onClick={wrap(openFlag)}>Flag</button>
          <button type="button" className="admin-btn admin-btn--danger" onClick={wrap(openSuspend)}>Suspend</button>
        </>
      )}
    </div>
  );
}

export function AdminUserLink({ user, children }) {
  if (!user?.id) return <span>{children || userName(user)}</span>;
  return <Link to={`/admin/users/${user.id}`} className="admin-user-link">{children || userName(user)}</Link>;
}

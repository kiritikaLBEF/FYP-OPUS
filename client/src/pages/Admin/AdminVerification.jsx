import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAdmin } from '../../context/AdminContext';
import { AdminUserLink } from '../../components/admin/AdminQuickActions';
import { formatDate, userName } from './adminHelpers';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';

export default function AdminVerification() {
  const { openVerify } = useAdmin();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getVerificationQueue();
      setQueue(data.queue || []);
    } catch (err) {
      setError(err.message || 'Failed to load verification queue');
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, []);

  const quickApprove = async (item) => {
    const label = item.organizationName || userName(item);
    if (!window.confirm(`Approve verification for ${label}? They will move to Verified Employers and be notified by email.`)) return;
    setBusyId(item.id);
    setError('');
    try {
      await api.approveVerification(item.id);
      await loadQueue();
    } catch (err) {
      setError(err.message || 'Failed to approve employer');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Verification Queue</h1>
          <p className="admin-page-subtitle">
            {loading ? 'Loading…' : `${queue.length} employer${queue.length === 1 ? '' : 's'} awaiting review`}
          </p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-panel">
        <div className="admin-panel__head">Pending employers: approve or reject</div>
        <div className="admin-panel__body admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Contact</th>
                <th>Submitted</th>
                <th>Wait time</th>
                <th className="admin-table__actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="admin-muted">Loading…</td></tr>
              ) : queue.length === 0 ? (
                <tr><td colSpan={5} className="admin-muted admin-table__empty">No pending verifications. Queue is clear.</td></tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.organizationName || userName(item)}</strong></td>
                    <td>
                      <AdminUserLink user={item} />
                      <div className="admin-muted">{item.email}</div>
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td><span className="admin-badge admin-badge--pending">{item.waitHours}h</span></td>
                    <td className="admin-table__actions-col">
                      <div className="admin-quick-actions admin-quick-actions--compact">
                        <Link to={`/admin/users/${item.id}`} className="admin-btn admin-btn--ghost">View profile</Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary"
                          disabled={busyId === item.id}
                          onClick={() => quickApprove(item)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger"
                          onClick={() => openVerify(item, loadQueue)}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--secondary"
                          onClick={() => openVerify(item, loadQueue)}
                        >
                          Review docs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

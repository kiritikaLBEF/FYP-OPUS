import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import AdminQuickActions, { AdminUserLink } from '../../components/admin/AdminQuickActions';
import { formatDate, roleLabel, statusBadge } from './adminHelpers';
import '../../components/Layout/AdminLayout.css';

export default function AdminFlags() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getAdminUsers({ minFlags: 1, limit: 100 }),
      api.getAdminUsers({ status: 'suspended', limit: 100 }),
    ])
      .then(([flagged, suspended]) => {
        const merged = new Map();
        [...(flagged.users || []), ...(suspended.users || [])].forEach((u) => merged.set(u.id, u));
        setUsers([...merged.values()].sort((a, b) => (b.flagCount || 0) - (a.flagCount || 0)));
      })
      .catch((err) => {
        setError(err.message || 'Failed to load flagged accounts');
        setUsers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Flags & Suspensions</h1>
          <p className="admin-page-subtitle">Accounts with flags or suspension status</p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-panel">
        <div className="admin-panel__head">Flagged & suspended accounts</div>
        <div className="admin-panel__body admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Flags</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="admin-muted">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="admin-muted">No flagged or suspended accounts.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={u.accountStatus === 'suspended' ? 'admin-row--suspended' : ''}>
                    <td>
                      <AdminUserLink user={u} />
                      <div className="admin-muted">{u.email}</div>
                    </td>
                    <td>{roleLabel(u.role)}</td>
                    <td><span className={`admin-badge ${u.flagCount >= 3 ? 'admin-badge--suspended' : 'admin-badge--pending'}`}>{u.flagCount || 0}</span></td>
                    <td><span className={`admin-badge ${statusBadge(u.accountStatus)}`}>{u.accountStatus}</span></td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td><AdminQuickActions user={u} compact onActionComplete={load} /></td>
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

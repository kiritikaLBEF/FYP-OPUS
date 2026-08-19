import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { formatDate } from './adminHelpers';
import '../../components/Layout/AdminLayout.css';

export default function AdminGigs() {
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getAdminGigs()
      .then((data) => setGigs(data.gigs || []))
      .catch((err) => {
        setError(err.message || 'Failed to load gigs');
        setGigs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = gigs.filter((g) => {
    if (filter === 'overdue') return g.overdue;
    if (filter === 'ongoing') return !['completed', 'cancelled'].includes(g.status);
    if (filter === 'completed') return g.status === 'completed';
    return true;
  });

  const overdueCount = gigs.filter((g) => g.overdue).length;

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Gigs Monitoring</h1>
          <p className="admin-page-subtitle">
            {loading ? 'Loading…' : `${gigs.length} projects · ${overdueCount} overdue`}
          </p>
        </div>
        <select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All gigs</option>
          <option value="ongoing">Ongoing</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
        </select>
      </header>

      {error && <p className="admin-error">{error}</p>}

      {overdueCount > 0 && filter !== 'overdue' && (
        <div className="admin-alert admin-alert--warn">
          {overdueCount} gig{overdueCount === 1 ? '' : 's'} overdue with no recent activity. Send a nudge from the freelancer profile.
        </div>
      )}

      <div className="admin-panel">
        <div className="admin-panel__head">Work projects (read-only)</div>
        <div className="admin-panel__body admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Title</th>
                <th>Organization</th>
                <th>Freelancer</th>
                <th>Status</th>
                <th>Due</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="admin-muted">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="admin-muted">No gigs match this filter.</td></tr>
              ) : (
                filtered.map((g) => (
                  <tr key={g.id} className={g.overdue ? 'admin-row--overdue' : ''}>
                    <td className="admin-mono">{g.projectRef || '-'}</td>
                    <td><strong>{g.title}</strong></td>
                    <td>{g.organizationName || '-'}</td>
                    <td>
                      {g.userId ? (
                        <Link to={`/admin/users/${g.userId}`} className="admin-user-link">View</Link>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`admin-badge ${g.overdue ? 'admin-badge--overdue' : 'admin-badge--pending'}`}>
                        {g.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>{formatDate(g.expectedCompletionDate)}</td>
                    <td>{formatDate(g.updatedAt)}</td>
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

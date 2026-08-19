import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import '../../components/Layout/AdminLayout.css';
const LINKS = [
  { to: '/admin/users', label: 'Users & Employers', key: 'activeUsers' },
  { to: '/admin/verification', label: 'Verification Queue', key: 'pendingVerifications' },
  { to: '/admin/flags', label: 'Open Flags', key: 'openFlags' },
  { to: '/admin/gigs?filter=ongoing', label: 'Ongoing Gigs', key: 'ongoingGigs' },
  { to: '/admin/gigs?filter=overdue', label: 'Overdue Gigs', key: 'overdueGigs', warn: true },
];

export default function AdminOverview() {
  const { user } = useAuth();
  const isSuper = user?.adminTier === 'super_admin';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAdminOverview()
      .then(setStats)
      .catch((err) => {
        setStats(null);
        setError(err.message || 'Failed to load overview');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Overview</h1>
          <p className="admin-page-subtitle">Command center: operational status at a glance</p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-status-board">
        <div className="admin-stat">
          <div className="admin-stat__label">Active freelancers</div>
          <div className="admin-stat__value">{loading ? '-' : stats?.activeUsers ?? 0}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__label">Active employers</div>
          <div className="admin-stat__value">{loading ? '-' : stats?.activeEmployers ?? 0}</div>
        </div>
        {LINKS.slice(2).map((item) => (
          <Link key={item.key} to={item.to} className={`admin-stat admin-stat--link ${item.warn && stats?.[item.key] ? 'admin-stat--warn' : ''}`}>
            <div className="admin-stat__label">{item.label}</div>
            <div className="admin-stat__value">{loading ? '-' : stats?.[item.key] ?? 0}</div>
          </Link>
        ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel__head">Quick navigation</div>
        <div className="admin-panel__body admin-quick-nav">
          {LINKS.map((item) => (
            <Link key={item.to} to={item.to} className="admin-quick-nav__item">
              <span>{item.label}</span>
              <span className="admin-quick-nav__count">{loading ? '-' : stats?.[item.key] ?? 0}</span>
            </Link>
          ))}
          <Link to="/admin/jobs" className="admin-quick-nav__item">Job Posts</Link>
          {isSuper && <Link to="/admin/analytics" className="admin-quick-nav__item">Analytics</Link>}
        </div>
      </div>
    </>
  );
}

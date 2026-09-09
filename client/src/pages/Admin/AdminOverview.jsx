import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { hasAdminPrivilege, isSuperAdmin } from '../../utils/adminPrivileges';
import '../../components/Layout/AdminLayout.css';

const LINKS = [
  { to: '/admin/users', label: 'Users & Employers', key: 'activeUsers', privilege: 'users' },
  { to: '/admin/verification', label: 'Verification Queue', key: 'pendingVerifications', privilege: 'verification' },
  { to: '/admin/flags', label: 'Open Flags', key: 'openFlags', privilege: 'users' },
  { to: '/admin/gigs?filter=ongoing', label: 'Ongoing Gigs', key: 'ongoingGigs', privilege: 'monitor' },
  { to: '/admin/gigs?filter=overdue', label: 'Overdue Gigs', key: 'overdueGigs', privilege: 'monitor', warn: true },
  { to: '/admin/jobs', label: 'Job Posts', key: 'jobsPosted', privilege: 'jobs' },
];

export default function AdminOverview() {
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const visibleLinks = useMemo(
    () => LINKS.filter((item) => superAdmin || hasAdminPrivilege(user, item.privilege)),
    [user, superAdmin],
  );

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
        {visibleLinks.slice(1).map((item) => (
          <Link key={item.key} to={item.to} className={`admin-stat admin-stat--link ${item.warn && stats?.[item.key] ? 'admin-stat--warn' : ''}`}>
            <div className="admin-stat__label">{item.label}</div>
            <div className="admin-stat__value">{loading ? '-' : stats?.[item.key] ?? 0}</div>
          </Link>
        ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel__head">Quick navigation</div>
        <div className="admin-panel__body admin-quick-nav">
          {visibleLinks.map((item) => (
            <Link key={item.to} to={item.to} className="admin-quick-nav__item">
              <span>{item.label}</span>
              <span className="admin-quick-nav__count">{loading ? '-' : stats?.[item.key] ?? 0}</span>
            </Link>
          ))}
          {superAdmin && <Link to="/admin/analytics" className="admin-quick-nav__item">Analytics</Link>}
        </div>
      </div>
    </>
  );
}

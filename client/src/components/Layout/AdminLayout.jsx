import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import './admin-tokens.css';
import './AdminLayout.css';

const baseNavItems = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/users', label: 'Users & Employers' },
  { to: '/admin/verification', label: 'Verification Queue' },
  { to: '/admin/jobs', label: 'Job Posts' },
  { to: '/admin/gigs', label: 'Gigs Monitoring' },
  { to: '/admin/ads', label: 'Homepage Ads' },
  { to: '/admin/featured', label: 'Top Performers' },
  { to: '/admin/badges', label: 'Badges' },
  { to: '/admin/flags', label: 'Flags & Suspensions' },
  { to: '/admin/templates', label: 'Email Templates' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const { openLogoutConfirm } = useAuthModal();
  const isSuper = user?.adminTier === 'super_admin';

  const navItems = isSuper
    ? [...baseNavItems, { to: '/admin/analytics', label: 'Analytics' }]
    : baseNavItems;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand__title">OPUS Admin</span>
          <span className="admin-brand__tier">{isSuper ? 'Super Admin' : 'Admin'}</span>
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `admin-nav__link ${isActive ? 'admin-nav__link--active' : ''}`}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
          {isSuper && (
            <NavLink to="/admin/management" className={({ isActive }) => `admin-nav__link ${isActive ? 'admin-nav__link--active' : ''}`}>
              <span>Admin Management</span>
            </NavLink>
          )}
        </nav>
        <div className="admin-sidebar__footer">
          <button type="button" className="admin-nav__logout" onClick={openLogoutConfirm}>
            Log out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

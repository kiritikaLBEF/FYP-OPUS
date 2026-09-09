import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { ADMIN_PRIVILEGES, hasAdminPrivilege, isSuperAdmin } from '../../utils/adminPrivileges';
import './admin-tokens.css';
import './AdminLayout.css';

const NAV_ITEMS = [
  { to: '/admin/overview', label: 'Overview', always: true },
  { to: '/admin/users', label: 'Users & Employers', privilege: 'users' },
  { to: '/admin/verification', label: 'Verification Queue', privilege: 'verification' },
  { to: '/admin/jobs', label: 'Job Posts', privilege: 'jobs' },
  { to: '/admin/gigs', label: 'Gigs Monitoring', privilege: 'monitor' },
  { to: '/admin/ads', label: 'Homepage Ads', privilege: 'homepageAds' },
  { to: '/admin/featured', label: 'Top Performers', privilege: 'featured' },
  { to: '/admin/badges', label: 'Badges', privilege: 'badges' },
  { to: '/admin/flags', label: 'Flags & Suspensions', privilege: 'users' },
  { to: '/admin/community', label: 'Community', privilege: 'community' },
  { to: '/admin/templates', label: 'Email Templates', superOnly: true },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const { openLogoutConfirm } = useAuthModal();
  const superAdmin = isSuperAdmin(user);

  const navItems = [
    ...NAV_ITEMS.filter((item) => {
      if (item.superOnly) return superAdmin;
      if (item.always) return true;
      if (superAdmin) return true;
      return hasAdminPrivilege(user, item.privilege);
    }),
    ...(superAdmin ? [
      { to: '/admin/analytics', label: 'Analytics' },
      { to: '/admin/management', label: 'Admin Management' },
    ] : []),
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand__title">OPUS Admin</span>
          <span className="admin-brand__tier">{superAdmin ? 'Super Admin' : 'Admin'}</span>
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav__link ${isActive ? 'admin-nav__link--active' : ''}`}
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
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

export { ADMIN_PRIVILEGES };

export const ADMIN_PRIVILEGES = [
  { key: 'users', label: 'Users & Employers', path: '/admin/users' },
  { key: 'verification', label: 'Verification Queue', path: '/admin/verification' },
  { key: 'jobs', label: 'Job Posts', path: '/admin/jobs' },
  { key: 'monitor', label: 'Gigs Monitoring', path: '/admin/gigs' },
  { key: 'homepageAds', label: 'Homepage Ads', path: '/admin/ads' },
  { key: 'featured', label: 'Top Performers', path: '/admin/featured' },
  { key: 'badges', label: 'Badges', path: '/admin/badges' },
  { key: 'community', label: 'Community', path: '/admin/community' },
];

export const DEFAULT_ADMIN_PRIVILEGES = Object.fromEntries(
  ADMIN_PRIVILEGES.map(({ key }) => [key, false]),
);

export const isSuperAdmin = (user) =>
  user?.role === 'admin' && user?.adminTier === 'super_admin';

export const hasAdminPrivilege = (user, key) => {
  if (isSuperAdmin(user)) return true;
  if (user?.role !== 'admin' || user?.adminTier !== 'admin') return false;
  return !!user?.adminPrivileges?.[key];
};

export const countAdminPrivileges = (privileges = {}) =>
  ADMIN_PRIVILEGES.filter(({ key }) => privileges?.[key]).length;

export const privilegeLabel = (key) =>
  ADMIN_PRIVILEGES.find((item) => item.key === key)?.label || key;

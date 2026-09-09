import { isSuperAdminUser } from './adminConfig.js';

export const ADMIN_PRIVILEGE_KEYS = [
  'users',
  'verification',
  'jobs',
  'monitor',
  'homepageAds',
  'featured',
  'badges',
  'community',
];

export const ADMIN_PRIVILEGE_LABELS = {
  users: 'Users & Employers',
  verification: 'Verification Queue',
  jobs: 'Job Posts',
  monitor: 'Gigs Monitoring',
  homepageAds: 'Homepage Ads',
  featured: 'Top Performers',
  badges: 'Badges',
  community: 'Community',
};

export const normalizeAdminPrivileges = (input = {}) => {
  const out = {};
  ADMIN_PRIVILEGE_KEYS.forEach((key) => {
    out[key] = !!input?.[key];
  });
  return out;
};

export const hasAdminPrivilege = (user, key) => {
  if (!user || user.role !== 'admin') return false;
  if (isSuperAdminUser(user)) return true;
  if (user.adminTier !== 'admin') return false;
  return !!user.adminPrivileges?.[key];
};

export const serializeAdminPrivilegesForClient = (user) => {
  if (isSuperAdminUser(user)) {
    return Object.fromEntries(ADMIN_PRIVILEGE_KEYS.map((key) => [key, true]));
  }
  return normalizeAdminPrivileges(user?.adminPrivileges || {});
};

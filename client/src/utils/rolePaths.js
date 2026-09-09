import { getPostLoginPath } from './postLoginPath';

/** Base path for the chat Community UI (not admin moderation). */
export function getCommunityBasePath(user) {
  if (user?.role === 'employer') return '/employer/community';
  return '/community';
}

export function getCommunityGroupPath(user, groupId) {
  const base = getCommunityBasePath(user);
  return groupId ? `${base}/${groupId}` : base;
}

export function getCommunityInviteUrl(_user, code) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Always use public invite URL so any role can open it; Layout remaps employers.
  return `${origin}/community?invite=${code}`;
}

/** Public marketing / freelancer shell paths that dashboard roles should leave. */
export function shouldLeavePublicShell(user, pathname) {
  if (!user?.role) return false;
  if (user.role === 'freelancer') return false;

  const path = pathname || '/';

  if (user.role === 'admin') {
    if (path === '/' || path === '') return true;
    if (path === '/community' || path.startsWith('/community/')) return true;
    if (path === '/find-jobs' || path.startsWith('/jobs/')) return true;
    if (path.startsWith('/dashboard')) return true;
    if (path === '/wallet' || path.startsWith('/wallet/')) return true;
    if (path === '/messages' || path.startsWith('/messages/')) return true;
    if (path.startsWith('/profile')) return true;
    return false;
  }

  if (user.role === 'employer') {
    if (path === '/' || path === '') return true;
    if (path === '/find-jobs' || path.startsWith('/jobs/')) return true;
    if (path.startsWith('/dashboard')) return true;
    if (path === '/wallet' || path.startsWith('/wallet/')) return true;
    if (path === '/messages' || path.startsWith('/messages/')) return true;
    if (path.startsWith('/profile')) return true;
    // /community is remapped to employer community separately
    return false;
  }

  return false;
}

export function publicShellFallback(user) {
  return getPostLoginPath(user);
}

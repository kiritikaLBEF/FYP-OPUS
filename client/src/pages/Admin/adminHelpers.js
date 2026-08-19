export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function userName(user) {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Unknown';
}

export function statusBadge(status) {
  const map = {
    active: 'admin-badge--active',
    suspended: 'admin-badge--suspended',
    pending: 'admin-badge--pending',
    verified: 'admin-badge--active',
    rejected: 'admin-badge--suspended',
  };
  return map[status] || 'admin-badge--pending';
}

export function roleLabel(role) {
  if (role === 'freelancer') return 'Freelancer';
  if (role === 'employer') return 'Employer';
  if (role === 'admin') return 'Admin';
  return role || '-';
}

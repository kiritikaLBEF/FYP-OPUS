export const applyEmailPlaceholders = (text, context = {}) => {
  if (!text) return '';
  const map = {
    user_name: context.userName || '',
    first_name: context.firstName || '',
    last_name: context.lastName || '',
    email: context.email || '',
    organization_name: context.organizationName || '',
    gig_title: context.gigTitle || '',
    role: context.role || '',
    rejection_reason: context.rejectionReason || '',
  };
  return String(text).replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => map[key.toLowerCase()] ?? '');
};

export const buildEmailContext = (user, extras = {}) => ({
  userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  email: user.email || '',
  organizationName: user.organizationName || '',
  role: user.role || '',
  gigTitle: extras.gigTitle || '',
  rejectionReason: extras.rejectionReason || '',
});

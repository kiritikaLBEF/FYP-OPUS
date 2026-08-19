export function getPostLoginPath(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin/overview';
  if (user.role === 'employer') return '/employer/dashboard';
  if (user.role === 'freelancer') return '/dashboard';
  return '/';
}
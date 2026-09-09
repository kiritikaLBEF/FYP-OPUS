import { BUSINESS_TYPES } from './constants.js';

const businessTypeLabel = (type, other = '') => {
  if (!type) return 'Organization';
  if (type === 'other') return (other || '').trim() || 'Organization';
  return BUSINESS_TYPES.find((t) => t.value === type)?.label || type;
};

const formatLocation = (user) => {
  const parts = [user.city, user.stateProvince, user.country].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.join(', ') || '';
};

const initialsFromName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'OR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

export const serializePublicEmployer = (user, stats = {}) => {
  const name = user.organizationName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Organization';
  const publicEmail = String(user.publicEmail || '').trim();
  return {
    id: String(user._id),
    employerId: user.employerId || '',
    name,
    initials: initialsFromName(name),
    type: businessTypeLabel(user.businessType, user.businessTypeOther),
    businessType: user.businessType || '',
    location: formatLocation(user),
    joined: user.createdAt || null,
    verified: user.verificationStatus === 'verified',
    bio: user.bio || '',
    website: user.website || '',
    social: user.socialHandle || '',
    email: publicEmail,
    emailMaskedByDefault: true,
    profilePicture: user.profilePicture || '',
    rating: stats.rating ?? null,
    reviews: stats.reviews ?? 0,
    totalGigs: stats.totalGigs ?? 0,
    completedGigs: stats.completedGigs ?? 0,
    totalPayouts: stats.totalPayouts ?? 0,
  };
};

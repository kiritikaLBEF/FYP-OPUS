import User from '../models/User.js';

/** Employer IDs visible on public job surfaces (active + verified, not suspended). */
export const getPublicEmployerIds = async () => {
  const employers = await User.find({
    role: 'employer',
    accountStatus: 'active',
    verificationStatus: 'verified',
  }).select('_id').lean();
  return employers.map((e) => e._id);
};

/** Base filter for job posts shown to other users on the platform. */
export const publicJobFilter = async (excludeEmployerId = null) => {
  let employerIds = await getPublicEmployerIds();
  if (excludeEmployerId) {
    employerIds = employerIds.filter((id) => String(id) !== String(excludeEmployerId));
  }
  return {
    isRemoved: { $ne: true },
    status: 'open',
    publishStatus: { $ne: 'draft' },
    employerId: { $in: employerIds },
  };
};

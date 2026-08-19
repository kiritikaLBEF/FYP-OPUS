import User from '../models/User.js';

export const generateFreelancerId = async () => {
  const year = new Date().getFullYear();
  const prefix = `FLR-${year}-`;
  const latest = await User.findOne({ freelancerId: new RegExp(`^${prefix}`) })
    .sort({ freelancerId: -1 })
    .select('freelancerId')
    .lean();

  let seq = 1;
  if (latest?.freelancerId) {
    const part = latest.freelancerId.split('-').pop();
    seq = (parseInt(part, 10) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(6, '0')}`;
};

export const ensureFreelancerId = async (user) => {
  if (user.role !== 'freelancer' || user.freelancerId) return user.freelancerId;
  user.freelancerId = await generateFreelancerId();
  await user.save();
  return user.freelancerId;
};

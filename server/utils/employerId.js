import User from '../models/User.js';

export const generateEmployerId = async () => {
  const year = new Date().getFullYear();
  const prefix = `ORG-${year}-`;
  const latest = await User.findOne({ employerId: new RegExp(`^${prefix}`) })
    .sort({ employerId: -1 })
    .select('employerId')
    .lean();

  let seq = 1;
  if (latest?.employerId) {
    const part = latest.employerId.split('-').pop();
    seq = (parseInt(part, 10) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(6, '0')}`;
};

export const ensureEmployerId = async (user) => {
  if (user.role !== 'employer' || user.employerId) return user.employerId;
  user.employerId = await generateEmployerId();
  await user.save();
  return user.employerId;
};

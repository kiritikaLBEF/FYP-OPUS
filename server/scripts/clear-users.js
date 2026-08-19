import '../config/env.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import WorkProject from '../models/WorkProject.js';
import Bid from '../models/Bid.js';
import ActivityEvent from '../models/ActivityEvent.js';
import JobPosting from '../models/JobPosting.js';
import JobApplication from '../models/JobApplication.js';

const USER_ROLES = ['freelancer', 'employer'];

const run = async () => {
  await connectDB();

  const users = await User.find({ role: { $in: USER_ROLES } }).select('_id role').lean();
  const userIds = users.map((u) => u._id);
  const employerIds = users.filter((u) => u.role === 'employer').map((u) => u._id);

  if (!userIds.length) {
    console.log('No freelancer or employer accounts to delete.');
    process.exit(0);
  }

  const before = {
    users: userIds.length,
    freelancers: users.filter((u) => u.role === 'freelancer').length,
    employers: employerIds.length,
    jobs: await JobPosting.countDocuments({ employerId: { $in: employerIds } }),
    applications: await JobApplication.countDocuments({
      $or: [{ freelancerId: { $in: userIds } }, { employerId: { $in: userIds } }],
    }),
    transactions: await Transaction.countDocuments({ userId: { $in: userIds } }),
    workProjects: await WorkProject.countDocuments({ userId: { $in: userIds } }),
    bids: await Bid.countDocuments({ userId: { $in: userIds } }),
    activities: await ActivityEvent.countDocuments({ userId: { $in: userIds } }),
  };

  console.log('Deleting:', before);

  await Promise.all([
    JobApplication.deleteMany({
      $or: [{ freelancerId: { $in: userIds } }, { employerId: { $in: userIds } }],
    }),
    JobPosting.deleteMany({ employerId: { $in: employerIds } }),
    Transaction.deleteMany({ userId: { $in: userIds } }),
    WorkProject.deleteMany({ userId: { $in: userIds } }),
    Bid.deleteMany({ userId: { $in: userIds } }),
    ActivityEvent.deleteMany({ userId: { $in: userIds } }),
  ]);

  const result = await User.deleteMany({ role: { $in: USER_ROLES } });

  const adminsLeft = await User.countDocuments({ role: 'admin' });
  console.log(`Removed ${result.deletedCount} user(s). Admin accounts kept: ${adminsLeft}`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

import '../config/env.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import JobPosting from '../models/JobPosting.js';

const run = async () => {
  await connectDB();

  const systemUser = await User.findOne({ email: 'system-jobs@opus.local' });
  let removedJobs = 0;

  if (systemUser) {
    const result = await JobPosting.deleteMany({ employerId: systemUser._id });
    removedJobs = result.deletedCount;
    await User.deleteOne({ _id: systemUser._id });
    console.log('Removed system seed user and', removedJobs, 'sample job postings');
  }

  const txnResult = await Transaction.deleteMany({});
  console.log('Removed', txnResult.deletedCount, 'seed transactions');

  console.log('Seed data cleanup complete.');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

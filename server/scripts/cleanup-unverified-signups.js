import '../config/env.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import PendingSignup from '../models/PendingSignup.js';

const run = async () => {
  await connectDB();

  const unverified = await User.find({
    role: { $in: ['freelancer', 'employer'] },
    isEmailVerified: false,
    authProvider: 'local',
    onboardingStep: 'otp',
  }).select('email role createdAt');

  if (!unverified.length) {
    console.log('No abandoned unverified accounts to remove.');
  } else {
    const result = await User.deleteMany({
      _id: { $in: unverified.map((u) => u._id) },
    });
    console.log(`Removed ${result.deletedCount} unverified account(s):`);
    unverified.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
  }

  const pendingCount = await PendingSignup.countDocuments();
  console.log(`Pending signups awaiting OTP: ${pendingCount}`);

  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

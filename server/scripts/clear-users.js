import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import WorkProject from '../models/WorkProject.js';
import Bid from '../models/Bid.js';
import ActivityEvent from '../models/ActivityEvent.js';
import JobPosting from '../models/JobPosting.js';
import JobApplication from '../models/JobApplication.js';
import Wallet from '../models/Wallet.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import WorkSession from '../models/WorkSession.js';
import SquadBid from '../models/SquadBid.js';
import UserBadge from '../models/UserBadge.js';
import FeaturedPerformer from '../models/FeaturedPerformer.js';
import PaymentIntent from '../models/PaymentIntent.js';
import PendingSignup from '../models/PendingSignup.js';
import CommunityMember from '../models/CommunityMember.js';
import CommunityInvite from '../models/CommunityInvite.js';
import CommunityMessage from '../models/CommunityMessage.js';
import SentNote from '../models/SentNote.js';

const USER_ROLES = ['freelancer', 'employer'];

const countDel = async (label, promise) => {
  const result = await promise;
  const n = result?.deletedCount ?? 0;
  if (n) console.log(`  - ${label}: ${n}`);
  return n;
};

const run = async () => {
  await connectDB();

  const users = await User.find({ role: { $in: USER_ROLES } }).select('_id role email').lean();
  const userIds = users.map((u) => u._id);
  const employerIds = users.filter((u) => u.role === 'employer').map((u) => u._id);
  const freelancerIds = users.filter((u) => u.role === 'freelancer').map((u) => u._id);

  console.log('Found accounts to delete:', {
    freelancers: freelancerIds.length,
    employers: employerIds.length,
    total: userIds.length,
  });

  if (userIds.length) {
    const jobs = await JobPosting.find({ employerId: { $in: employerIds } }).select('_id').lean();
    const jobIds = jobs.map((j) => j._id);

    const conversations = await Conversation.find({
      $or: [{ employerId: { $in: userIds } }, { freelancerId: { $in: userIds } }],
    }).select('_id').lean();
    const conversationIds = conversations.map((c) => c._id);

    console.log('Cleaning related data…');

    await countDel('community invites', CommunityInvite.deleteMany({
      createdBy: { $in: userIds },
    }));
    await countDel('community messages', CommunityMessage.deleteMany({ authorId: { $in: userIds } }));
    await countDel('sent notes', SentNote.deleteMany({ userId: { $in: userIds } }));
    await countDel('job applications', JobApplication.deleteMany({
      $or: [
        { freelancerId: { $in: userIds } },
        { employerId: { $in: userIds } },
        { jobPostingId: { $in: jobIds } },
      ],
    }));
    await countDel('squad bids', SquadBid.deleteMany({
      $or: [
        { employerId: { $in: userIds } },
        { leaderId: { $in: userIds } },
        { jobPostingId: { $in: jobIds } },
        { 'members.freelancerId': { $in: userIds } },
      ],
    }));
    await countDel('payment intents', PaymentIntent.deleteMany({ userId: { $in: userIds } }));
    await countDel('work sessions', WorkSession.deleteMany({
      $or: [
        { employerId: { $in: userIds } },
        { freelancerId: { $in: userIds } },
        { jobPostingId: { $in: jobIds } },
      ],
    }));
    await countDel('notifications', Notification.deleteMany({ userId: { $in: userIds } }));
    await countDel('bids', Bid.deleteMany({ userId: { $in: userIds } }));
    await countDel('job postings', JobPosting.deleteMany({
      $or: [{ employerId: { $in: employerIds } }, { _id: { $in: jobIds } }],
    }));
    await countDel('transactions', Transaction.deleteMany({ userId: { $in: userIds } }));
    await countDel('wallets', Wallet.deleteMany({ userId: { $in: userIds } }));
    await countDel('work projects', WorkProject.deleteMany({ userId: { $in: userIds } }));
    await countDel('activity events', ActivityEvent.deleteMany({ userId: { $in: userIds } }));
    await countDel('user badges', UserBadge.deleteMany({ userId: { $in: userIds } }));
    await countDel('featured performers', FeaturedPerformer.deleteMany({ userId: { $in: userIds } }));
    await countDel('community members', CommunityMember.deleteMany({ userId: { $in: userIds } }));
    await countDel('messages', Message.deleteMany({
      $or: [
        { conversationId: { $in: conversationIds } },
        { senderId: { $in: userIds } },
      ],
    }));
    await countDel('conversations', Conversation.deleteMany({ _id: { $in: conversationIds } }));

    const result = await User.deleteMany({ role: { $in: USER_ROLES } });
    console.log(`Removed ${result.deletedCount} freelancer/employer user(s).`);
  } else {
    console.log('No freelancer or employer accounts in users collection.');
  }

  await countDel(
    'pending signups',
    PendingSignup.deleteMany({ role: { $in: USER_ROLES } }).catch(() => PendingSignup.deleteMany({})),
  );

  const adminsLeft = await User.countDocuments({ role: 'admin' });
  const leftover = await User.countDocuments({ role: { $in: USER_ROLES } });
  console.log(`Admins kept: ${adminsLeft}. Freelancer/employer remaining: ${leftover}`);

  const admin = mongoose.connection.db.admin();
  const { databases } = await admin.listDatabases();
  const keep = new Set(['admin', 'local', 'config', 'opus']);
  const droppable = databases
    .map((d) => d.name)
    .filter((name) => !keep.has(name));

  console.log('Databases on cluster:', databases.map((d) => d.name).join(', '));

  for (const name of droppable) {
    try {
      await mongoose.connection.client.db(name).dropDatabase();
      console.log(`Dropped old database: ${name}`);
    } catch (err) {
      console.warn(`Could not drop ${name}:`, err.message);
    }
  }

  const remainingUserIds = (await User.find({}).select('_id').lean()).map((u) => u._id);
  await countDel('orphan wallets', Wallet.deleteMany({ userId: { $nin: remainingUserIds } }));
  await countDel('orphan transactions', Transaction.deleteMany({ userId: { $nin: remainingUserIds } }));

  console.log('Cleanup complete.');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});

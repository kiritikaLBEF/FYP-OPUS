import User from '../models/User.js';
import WorkProject from '../models/WorkProject.js';
import JobPosting from '../models/JobPosting.js';
import Transaction from '../models/Transaction.js';
import ActivityEvent from '../models/ActivityEvent.js';
import AdminActionLog from '../models/AdminActionLog.js';
import EmailTemplate from '../models/EmailTemplate.js';
import SentNote from '../models/SentNote.js';
import { NUDGE_TEMPLATES, JOB_DELETE_REASONS, FLAG_REASONS, TEMPLATE_CATEGORIES, VERIFICATION_REJECT_REASONS, VERIFICATION_EMAIL } from '../utils/constants.js';
import { sendEmail } from '../utils/email.js';
import { applyEmailPlaceholders, buildEmailContext } from '../utils/emailPlaceholders.js';
import { isSuperAdminUser } from '../utils/adminConfig.js';
import { toJobPublic } from '../utils/jobSerializer.js';

const OVERDUE_INACTIVE_DAYS = Number(process.env.GIG_OVERDUE_DAYS || 7);
const AUTO_SUSPEND_FLAGS = 3;

const textToHtml = (text) => String(text)
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => `<p>${line}</p>`)
  .join('');

const sendVerificationDecisionEmail = async (user, decision, { rejectionReason = '' } = {}) => {
  const template = decision === 'approved' ? VERIFICATION_EMAIL.approved : VERIFICATION_EMAIL.rejected;
  const ctx = buildEmailContext(user, { rejectionReason });
  const subject = applyEmailPlaceholders(template.subject, ctx);
  const body = applyEmailPlaceholders(template.body, ctx);
  await sendEmail(user.email, subject, body, {
    fromName: 'OPUS Admin',
    html: textToHtml(body),
  });
};

const toUserLite = (u) => ({
  id: String(u._id),
  firstName: u.firstName || '',
  lastName: u.lastName || '',
  email: u.email || '',
  role: u.role,
  adminTier: u.adminTier || '',
  accountStatus: u.accountStatus || 'active',
  verificationStatus: u.verificationStatus || 'pending',
  verificationRejectionReason: u.verificationRejectionReason || '',
  organizationName: u.organizationName || '',
  phone: u.phone || '',
  flagCount: u.flagCount || 0,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const logAdminAction = async (admin, action, details = {}) => {
  await AdminActionLog.create({
    adminId: admin._id,
    adminEmail: admin.email,
    adminName: `${admin.firstName} ${admin.lastName}`.trim(),
    action,
    targetType: details.targetType || '',
    targetId: details.targetId || '',
    targetEmail: details.targetEmail || '',
    summary: details.summary || '',
    metadata: details.metadata || {},
    occurredAt: new Date(),
  });
};

const deliverAdminNote = async ({
  targetUser,
  template,
  customMessage = '',
  admin,
  extras = {},
  retryOf = null,
  preparedSubject = null,
  preparedBody = null,
}) => {
  const ctx = buildEmailContext(targetUser, extras);
  const subject = preparedSubject || applyEmailPlaceholders(template.subject, ctx);
  const body = preparedBody || applyEmailPlaceholders(customMessage?.trim() || template.body, ctx);

  const sentNote = await SentNote.create({
    userId: targetUser._id,
    templateId: template._id,
    templateKey: template.key,
    subject,
    body,
    sentByAdminId: admin._id,
    sentByAdminName: `${admin.firstName || ''} ${admin.lastName || ''}`.trim(),
    sentByAdminEmail: admin.email,
    recipientEmail: targetUser.email,
    status: 'failed',
    errorReason: '',
    retryOf: retryOf || undefined,
    sentAt: new Date(),
  });

  try {
    await sendEmail(targetUser.email, subject, body, { fromName: 'OPUS Admin' });
    sentNote.status = 'sent';
    sentNote.errorReason = '';
    await sentNote.save();

    await logAdminAction(admin, 'nudge_sent', {
      targetType: 'user',
      targetId: String(targetUser._id),
      targetEmail: targetUser.email,
      summary: `Note sent: ${template.label}`,
      metadata: { templateKey: template.key, sentNoteId: String(sentNote._id) },
    });

    return { success: true, sentNote: sentNote.toObject() };
  } catch (err) {
    sentNote.status = 'failed';
    sentNote.errorReason = err.message || 'Email delivery failed';
    await sentNote.save();
    return { success: false, sentNote: sentNote.toObject(), error: sentNote.errorReason };
  }
};

const ensureDefaultTemplates = async () => {
  for (const t of NUDGE_TEMPLATES) {
    // eslint-disable-next-line no-await-in-loop
    await EmailTemplate.updateOne(
      { key: t.key },
      { $setOnInsert: { ...t, isSystem: true, active: true } },
      { upsert: true },
    );
  }
};

const isOverdue = (gig) => {
  if (gig.status === 'completed') return false;
  const staleMs = Date.now() - new Date(gig.updatedAt || gig.createdAt).getTime();
  return staleMs > OVERDUE_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
};

export const getAdminOverview = async (_req, res) => {
  try {
    const [activeUsers, activeEmployers, pendingVerifications, openFlags, ongoingGigs, allOngoingGigs] = await Promise.all([
      User.countDocuments({ role: 'freelancer', accountStatus: 'active', isEmailVerified: true }),
      User.countDocuments({ role: 'employer', accountStatus: 'active', isEmailVerified: true }),
      User.countDocuments({
        role: 'employer',
        verificationStatus: 'pending',
        accountStatus: 'active',
        isEmailVerified: true,
      }),
      User.countDocuments({ flagCount: { $gt: 0 }, accountStatus: 'active' }),
      WorkProject.countDocuments({ status: { $in: ['awaiting_start', 'in_progress', 'review', 'on_hold'] } }),
      WorkProject.find({ status: { $in: ['awaiting_start', 'in_progress', 'review', 'on_hold'] } }).select('updatedAt status').lean(),
    ]);

    const overdueGigs = allOngoingGigs.filter(isOverdue).length;

    res.json({
      activeUsers,
      activeEmployers,
      pendingVerifications,
      openFlags,
      ongoingGigs,
      overdueGigs,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ message: 'Failed to load overview' });
  }
};

export const listUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const role = (req.query.role || '').trim();
    const status = (req.query.status || '').trim();
    const minFlags = Number(req.query.minFlags || 0);

    const filter = { role: { $ne: 'admin' }, isEmailVerified: true };
    if (role && ['freelancer', 'employer'].includes(role)) filter.role = role;
    if (status === 'suspended') filter.accountStatus = 'suspended';
    if (status === 'active') Object.assign(filter, NOT_SUSPENDED);
    if (status === 'pending_verification') {
      filter.role = 'employer';
      filter.verificationStatus = 'pending';
    }
    if (minFlags > 0) filter.flagCount = { $gte: minFlags };
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { organizationName: { $regex: search, $options: 'i' } },
        { freelancerId: { $regex: search, $options: 'i' } },
        { employerId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users: items.map(toUserLite),
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ message: 'Failed to load users' });
  }
};

const NOT_SUSPENDED = { $or: [{ accountStatus: 'active' }, { accountStatus: { $exists: false } }] };

const SEGMENT_FILTERS = {
  'users-active': { role: 'freelancer', isEmailVerified: true, ...NOT_SUSPENDED },
  'users-suspended': { role: 'freelancer', accountStatus: 'suspended' },
  'employers-active': { role: 'employer', verificationStatus: 'verified', isEmailVerified: true, ...NOT_SUSPENDED },
  'employers-suspended': { role: 'employer', accountStatus: 'suspended' },
  'employers-pending': { role: 'employer', verificationStatus: 'pending', isEmailVerified: true, ...NOT_SUSPENDED },
};

const buildSearchFilter = (search) => {
  if (!search) return {};
  return {
    $or: [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { organizationName: { $regex: search, $options: 'i' } },
      { freelancerId: { $regex: search, $options: 'i' } },
      { employerId: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
    ],
  };
};

export const listUsersBySegment = async (req, res) => {
  try {
    const segment = req.params.segment;
    const baseFilter = SEGMENT_FILTERS[segment];
    if (!baseFilter) return res.status(400).json({ message: 'Invalid segment' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.search || '').trim();

    const filter = { ...baseFilter, ...buildSearchFilter(search) };

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    let users = items.map(toUserLite);

    if (segment.startsWith('users-')) {
      const ids = items.map((u) => u._id);
      const [completedAgg, activeAgg] = await Promise.all([
        WorkProject.aggregate([
          { $match: { userId: { $in: ids }, status: 'completed' } },
          { $group: { _id: '$userId', count: { $sum: 1 } } },
        ]),
        WorkProject.aggregate([
          { $match: { userId: { $in: ids }, status: { $in: ['awaiting_start', 'in_progress', 'review', 'on_hold'] } } },
          { $group: { _id: '$userId', count: { $sum: 1 } } },
        ]),
      ]);
      const completedMap = Object.fromEntries(completedAgg.map((r) => [String(r._id), r.count]));
      const activeMap = Object.fromEntries(activeAgg.map((r) => [String(r._id), r.count]));
      users = users.map((u) => ({
        ...u,
        completedGigs: completedMap[u.id] || 0,
        activeGigs: activeMap[u.id] || 0,
      }));
    }

    if (segment.startsWith('employers-')) {
      const ids = items.map((u) => u._id);
      const jobCounts = await JobPosting.aggregate([
        { $match: { employerId: { $in: ids }, isRemoved: { $ne: true } } },
        { $group: { _id: '$employerId', count: { $sum: 1 } } },
      ]);
      const jobMap = Object.fromEntries(jobCounts.map((r) => [String(r._id), r.count]));
      users = users.map((u) => ({
        ...u,
        jobsPosted: jobMap[u.id] || 0,
      }));
    }

    res.json({
      segment,
      users,
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('List users by segment error:', err);
    res.status(500).json({ message: 'Failed to load accounts' });
  }
};

export const getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userId = user._id;
    const [
      activity,
      gigs,
      jobs,
      flagActions,
      nudgeHistory,
      adminHistory,
      txnAgg,
      completedGigs,
      activeGigs,
    ] = await Promise.all([
      ActivityEvent.find({ userId }).sort({ occurredAt: -1 }).limit(50).lean(),
      WorkProject.find({ userId }).sort({ updatedAt: -1 }).limit(50).lean(),
      JobPosting.find({ employerId: userId, isRemoved: { $ne: true } }).sort({ updatedAt: -1 }).limit(50).lean(),
      AdminActionLog.find({
        targetId: String(userId),
        action: { $in: ['user_flagged', 'user_auto_suspended', 'user_manually_suspended'] },
      }).sort({ occurredAt: -1 }).lean(),
      SentNote.find({ userId }).sort({ sentAt: -1 }).limit(50).lean(),
      AdminActionLog.find({ targetId: String(userId) }).sort({ occurredAt: -1 }).limit(100).lean(),
      Transaction.aggregate([
        { $match: { userId } },
        { $group: { _id: null, earned: { $sum: '$credit' }, spent: { $sum: '$debit' } } },
      ]),
      WorkProject.countDocuments({ userId, status: 'completed' }),
      WorkProject.countDocuments({ userId, status: { $in: ['awaiting_start', 'in_progress', 'review', 'on_hold'] } }),
    ]);

    const financial = txnAgg[0] || { earned: 0, spent: 0 };

    res.json({
      user: {
        ...toUserLite(user),
        username: user.username || '',
        freelancerId: user.freelancerId || '',
        employerId: user.employerId || '',
        bio: user.bio || '',
        professionalSummary: user.professionalSummary || '',
        skills: user.skills || [],
        profilePicture: user.profilePicture || '',
        avatarId: user.avatarId || '',
        degree: user.degree || '',
        schoolName: user.schoolName || '',
        address: user.address || '',
        country: user.country || '',
        city: user.city || '',
        timezone: user.timezone || '',
        businessType: user.businessType || '',
        businessTypeOther: user.businessTypeOther || '',
        panCardDocument: user.panCardDocument || '',
        businessRegistrationDocument: user.businessRegistrationDocument || '',
        onboardingComplete: user.onboardingComplete,
        suspendedAt: user.suspendedAt,
        suspensionSource: user.suspensionSource || '',
        suspensionReason: user.suspensionReason || '',
        isAutoSuspended: !!user.isAutoSuspended,
        certifications: user.certifications || [],
        projects: user.projects || [],
      },
      stats: {
        completedGigs,
        activeGigs,
        totalEarned: financial.earned,
        totalSpent: financial.spent,
        jobsPosted: jobs.length,
        flagCount: user.flagCount || 0,
        rating: null,
      },
      activity,
      gigs,
      jobs,
      reviews: [],
      flagHistory: user.flags || [],
      flagActions,
      sentNotes: nudgeHistory,
      adminHistory,
    });
  } catch (err) {
    console.error('User detail error:', err);
    res.status(500).json({ message: 'Failed to load user detail' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (isSuperAdminUser(user)) return res.status(400).json({ message: 'Super admin profile cannot be edited here' });

    const allowed = ['firstName', 'lastName', 'phone', 'organizationName', 'country', 'city', 'address'];
    for (const k of allowed) {
      if (req.body[k] !== undefined) user[k] = String(req.body[k] || '').trim();
    }
    await user.save();

    await logAdminAction(req.user, 'user_updated', {
      targetType: 'user',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: 'Account profile edited by admin',
      metadata: { updatedFields: allowed.filter((k) => req.body[k] !== undefined) },
    });

    res.json({ user: toUserLite(user.toObject()) });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (isSuperAdminUser(user)) return res.status(400).json({ message: 'Super admin cannot be deleted' });

    await Promise.all([
      WorkProject.deleteMany({ userId: user._id }),
      ActivityEvent.deleteMany({ userId: user._id }),
      JobPosting.deleteMany({ employerId: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);

    await logAdminAction(req.user, 'user_deleted', {
      targetType: 'user',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: 'Account deleted by admin',
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

export const flagUser = async (req, res) => {
  try {
    const { reason, note = '' } = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: 'Flag reason is required' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (isSuperAdminUser(user)) return res.status(400).json({ message: 'Super admin cannot be flagged' });

    user.flags.push({
      reason: reason.trim(),
      note: note.trim(),
      flaggedBy: req.user._id,
      flaggedByName: `${req.user.firstName} ${req.user.lastName}`.trim(),
      flaggedByEmail: req.user.email,
    });
    user.flagCount = user.flags.length;

    let autoSuspended = false;
    if (user.flagCount >= AUTO_SUSPEND_FLAGS && user.accountStatus !== 'suspended') {
      user.accountStatus = 'suspended';
      user.suspensionSource = 'auto_flags';
      user.suspensionReason = `Automatically suspended after reaching ${AUTO_SUSPEND_FLAGS} flags`;
      user.suspendedAt = new Date();
      user.suspendedBy = req.user._id;
      user.isAutoSuspended = true;
      autoSuspended = true;
    }

    await user.save();

    await logAdminAction(req.user, 'user_flagged', {
      targetType: 'user',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: `User flagged: ${reason.trim()}`,
      metadata: { reason: reason.trim(), note: note.trim(), flagCount: user.flagCount },
    });

    if (autoSuspended) {
      await logAdminAction(req.user, 'user_auto_suspended', {
        targetType: 'user',
        targetId: String(user._id),
        targetEmail: user.email,
        summary: `Automatic suspension after ${AUTO_SUSPEND_FLAGS} flags`,
      });
    }

    res.json({
      message: autoSuspended
        ? `User automatically suspended after ${AUTO_SUSPEND_FLAGS} flags`
        : 'User flagged',
      flagCount: user.flagCount,
      accountStatus: user.accountStatus,
      suspensionSource: user.suspensionSource || '',
    });
  } catch (err) {
    console.error('Flag user error:', err);
    res.status(500).json({ message: 'Failed to flag user' });
  }
};

export const suspendUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (isSuperAdminUser(user)) return res.status(400).json({ message: 'Super admin cannot be suspended' });
    if (user.isAutoSuspended) return res.status(400).json({ message: 'Automatically suspended accounts are permanent' });

    user.accountStatus = 'suspended';
    user.suspensionSource = 'manual';
    user.suspensionReason = reason?.trim() || 'Suspended by admin';
    user.suspendedAt = new Date();
    user.suspendedBy = req.user._id;
    await user.save();

    await logAdminAction(req.user, 'user_manually_suspended', {
      targetType: 'user',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: user.suspensionReason,
    });

    res.json({ message: 'User suspended', accountStatus: user.accountStatus });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ message: 'Failed to suspend user' });
  }
};

export const verificationQueue = async (_req, res) => {
  try {
    const users = await User.find({ role: 'employer', verificationStatus: 'pending' }).sort({ createdAt: 1 }).lean();
    const now = Date.now();
    res.json({
      queue: users.map((u) => ({
        ...toUserLite(u),
        waitHours: Math.floor((now - new Date(u.createdAt).getTime()) / (1000 * 60 * 60)),
      })),
    });
  } catch (err) {
    console.error('Verification queue error:', err);
    res.status(500).json({ message: 'Failed to load verification queue' });
  }
};

export const getVerificationDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user || user.role !== 'employer') return res.status(404).json({ message: 'Employer not found' });

    res.json({
      employer: {
        ...toUserLite(user),
        businessType: user.businessType || '',
        businessTypeOther: user.businessTypeOther || '',
        panCardDocument: user.panCardDocument || '',
        businessRegistrationDocument: user.businessRegistrationDocument || '',
      },
    });
  } catch (err) {
    console.error('Verification detail error:', err);
    res.status(500).json({ message: 'Failed to load verification detail' });
  }
};

export const approveVerification = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'employer') return res.status(404).json({ message: 'Employer not found' });
    if (user.verificationStatus === 'verified') {
      return res.status(400).json({ message: 'This employer is already verified' });
    }

    user.verificationStatus = 'verified';
    user.verificationRejectionReason = '';
    user.verifiedAt = new Date();
    await user.save();

    await logAdminAction(req.user, 'verification_approved', {
      targetType: 'employer',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: 'Employer verification approved',
    });

    let emailSent = true;
    try {
      await sendVerificationDecisionEmail(user, 'approved');
    } catch (emailErr) {
      emailSent = false;
      console.error('Verification approval email failed:', emailErr);
    }

    res.json({
      message: emailSent
        ? 'Employer verified and notified by email'
        : 'Employer verified, but the notification email could not be sent',
      verificationStatus: user.verificationStatus,
      emailSent,
    });
  } catch (err) {
    console.error('Approve verification error:', err);
    res.status(500).json({ message: 'Failed to approve employer' });
  }
};

export const rejectVerification = async (req, res) => {
  try {
    const { reasonCategory, reasonDetail, reason } = req.body;
    const category = reasonCategory || reason;
    if (!category?.trim()) return res.status(400).json({ message: 'Select a rejection reason' });

    const reasonMeta = VERIFICATION_REJECT_REASONS.find((r) => r.value === category);
    if (!reasonMeta) return res.status(400).json({ message: 'Invalid rejection reason' });

    const detail = (reasonDetail || '').trim();
    const reasonText = detail ? `${reasonMeta.label}: ${detail}` : reasonMeta.label;

    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'employer') return res.status(404).json({ message: 'Employer not found' });

    user.verificationStatus = 'rejected';
    user.verificationRejectionReason = reasonText;
    user.verifiedAt = null;
    await user.save();

    await logAdminAction(req.user, 'verification_rejected', {
      targetType: 'employer',
      targetId: String(user._id),
      targetEmail: user.email,
      summary: `Employer verification rejected: ${reasonText}`,
      metadata: { reasonCategory: category, reasonDetail: detail },
    });

    let emailSent = true;
    try {
      await sendVerificationDecisionEmail(user, 'rejected', { rejectionReason: reasonText });
    } catch (emailErr) {
      emailSent = false;
      console.error('Verification rejection email failed:', emailErr);
    }

    res.json({
      message: emailSent
        ? 'Employer rejected and notified by email'
        : 'Employer rejected, but the notification email could not be sent',
      verificationStatus: user.verificationStatus,
      emailSent,
    });
  } catch (err) {
    console.error('Reject verification error:', err);
    res.status(500).json({ message: 'Failed to reject employer' });
  }
};

export const listGigs = async (_req, res) => {
  try {
    const projects = await WorkProject.find({}).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({
      gigs: projects.map((g) => ({
        id: g._id,
        userId: g.userId,
        projectRef: g.projectRef,
        title: g.title,
        organizationName: g.organizationName,
        status: g.status,
        expectedCompletionDate: g.expectedCompletionDate,
        updatedAt: g.updatedAt,
        overdue: isOverdue(g),
      })),
    });
  } catch (err) {
    console.error('List gigs error:', err);
    res.status(500).json({ message: 'Failed to load gigs' });
  }
};

export const listNudgeTemplates = async (_req, res) => {
  try {
    await ensureDefaultTemplates();
    const templates = await EmailTemplate.find({ active: true }).sort({ isSystem: -1, label: 1 }).lean();
    res.json({ templates });
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ message: 'Failed to load templates' });
  }
};

export const saveNudgeTemplate = async (req, res) => {
  try {
    const { key, label, subject, body, category = 'General' } = req.body;
    if (!key?.trim() || !label?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'key, label, subject, and body are required' });
    }
    const template = await EmailTemplate.findOneAndUpdate(
      { key: key.trim() },
      {
        key: key.trim(),
        label: label.trim(),
        subject: subject.trim(),
        body: body.trim(),
        category: String(category || 'General').trim(),
        active: true,
      },
      { upsert: true, new: true },
    );
    await logAdminAction(req.user, 'nudge_template_saved', {
      targetType: 'template',
      targetId: String(template._id),
      summary: `Template saved: ${template.key}`,
    });
    res.json({ template });
  } catch (err) {
    console.error('Save template error:', err);
    res.status(500).json({ message: 'Failed to save template' });
  }
};

export const sendNudge = async (req, res) => {
  try {
    const { templateKey, customMessage = '', gigTitle = '' } = req.body;
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });
    const template = await EmailTemplate.findOne({ key: templateKey, active: true }).lean();
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const result = await deliverAdminNote({
      targetUser,
      template,
      customMessage,
      admin: req.user,
      extras: { gigTitle },
    });

    if (!result.success) {
      return res.status(502).json({
        message: `Email could not be delivered: ${result.error}`,
        sentNote: result.sentNote,
      });
    }

    res.json({ message: 'Note sent successfully', sentNote: result.sentNote });
  } catch (err) {
    console.error('Send nudge error:', err);
    res.status(500).json({ message: err.message || 'Failed to send note' });
  }
};

export const retrySentNote = async (req, res) => {
  try {
    const failedNote = await SentNote.findById(req.params.sentNoteId);
    if (!failedNote) return res.status(404).json({ message: 'Sent note record not found' });
    if (failedNote.status !== 'failed') {
      return res.status(400).json({ message: 'Only failed sends can be retried' });
    }

    const targetUser = await User.findById(failedNote.userId);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    const template = failedNote.templateId
      ? await EmailTemplate.findById(failedNote.templateId).lean()
      : await EmailTemplate.findOne({ key: failedNote.templateKey, active: true }).lean();

    if (!template) {
      return res.status(404).json({ message: 'Original template no longer exists' });
    }

    const result = await deliverAdminNote({
      targetUser,
      template,
      admin: req.user,
      retryOf: failedNote._id,
      preparedSubject: failedNote.subject,
      preparedBody: failedNote.body,
    });

    if (!result.success) {
      return res.status(502).json({
        message: `Retry failed: ${result.error}`,
        sentNote: result.sentNote,
      });
    }

    res.json({ message: 'Note resent successfully', sentNote: result.sentNote });
  } catch (err) {
    console.error('Retry sent note error:', err);
    res.status(500).json({ message: err.message || 'Failed to retry send' });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeUsers, activeEmployers, queueSize, activeGigs, completedGigs, flaggedUsers, jobRemovals, recentFlags] = await Promise.all([
      User.countDocuments({ role: 'freelancer', accountStatus: 'active' }),
      User.countDocuments({ role: 'employer', accountStatus: 'active' }),
      User.countDocuments({ role: 'employer', verificationStatus: 'pending', accountStatus: 'active' }),
      WorkProject.countDocuments({ status: { $in: ['awaiting_start', 'in_progress', 'review', 'on_hold'] } }),
      WorkProject.countDocuments({ status: 'completed' }),
      User.countDocuments({ flagCount: { $gt: 0 } }),
      JobPosting.countDocuments({ isRemoved: true }),
      AdminActionLog.countDocuments({ action: 'user_flagged', occurredAt: { $gte: thirtyDaysAgo } }),
    ]);

    const completionRate = activeGigs + completedGigs > 0
      ? Number(((completedGigs / (activeGigs + completedGigs)) * 100).toFixed(2))
      : 0;

    const payload = {
      operations: {
        activeUsers,
        activeEmployers,
        verificationQueueSize: queueSize,
        activeGigs,
        completionRate,
        flaggedUsers,
        jobPostRemovals: jobRemovals,
        flagTrend30d: recentFlags,
      },
    };

    if (isSuperAdminUser(req.user)) {
      const [creditAgg, debitAgg, feeAgg] = await Promise.all([
        Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$credit' } } }]),
        Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$debit' } } }]),
        Transaction.aggregate([
          { $match: { paymentType: 'platform_fee' } },
          { $group: { _id: null, total: { $sum: '$debit' } } },
        ]),
      ]);
      payload.financial = {
        totalTransactionVolume: Number((creditAgg[0]?.total || 0) + (debitAgg[0]?.total || 0)),
        platformRevenue: Number(feeAgg[0]?.total || 0),
        payoutTotals: Number(debitAgg[0]?.total || 0),
      };
    }

    res.json(payload);
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Failed to load analytics' });
  }
};

export const listAdmins = async (_req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).sort({ createdAt: 1 }).lean();
    res.json({
      admins: admins.map((a) => ({
        ...toUserLite(a),
        cannotDelete: isSuperAdminUser(a),
      })),
    });
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ message: 'Failed to load admins' });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password, adminTier } = req.body;
    if (!firstName?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: 'firstName, email and password are required' });
    }
    const tier = adminTier === 'super_admin' ? 'super_admin' : 'admin';
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const admin = await User.create({
      firstName: firstName.trim(),
      lastName: (lastName || '').trim(),
      email: normalizedEmail,
      password: await User.hashPassword(password),
      role: 'admin',
      adminTier: tier,
      isEmailVerified: true,
      onboardingComplete: true,
      onboardingStep: 'complete',
      accountStatus: 'active',
      authProvider: 'local',
    });

    await logAdminAction(req.user, 'admin_created', {
      targetType: 'admin',
      targetId: String(admin._id),
      targetEmail: admin.email,
      summary: `Admin account created (${tier})`,
    });

    res.status(201).json({ admin: toUserLite(admin.toObject()) });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ message: 'Failed to create admin' });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password, adminTier } = req.body;
    const admin = await User.findById(req.params.adminId).select('+password');
    if (!admin || admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found' });
    if (isSuperAdminUser(admin) && req.user._id.toString() !== admin._id.toString()) {
      return res.status(400).json({ message: 'Super admin account can only be edited by itself' });
    }

    if (firstName?.trim()) admin.firstName = firstName.trim();
    if (lastName !== undefined) admin.lastName = (lastName || '').trim();
    if (email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: admin._id } });
      if (existing) return res.status(400).json({ message: 'Email already in use' });
      admin.email = normalizedEmail;
    }
    if (password?.trim()) {
      admin.password = await User.hashPassword(password.trim());
    }
    if (adminTier && !isSuperAdminUser(admin)) {
      admin.adminTier = adminTier === 'super_admin' ? 'super_admin' : 'admin';
    }

    await admin.save();

    await logAdminAction(req.user, 'admin_updated', {
      targetType: 'admin',
      targetId: String(admin._id),
      targetEmail: admin.email,
      summary: 'Admin account updated',
    });

    res.json({ admin: toUserLite(admin.toObject()) });
  } catch (err) {
    console.error('Update admin error:', err);
    res.status(500).json({ message: 'Failed to update admin' });
  }
};

export const deactivateAdmin = async (req, res) => {
  try {
    const admin = await User.findById(req.params.adminId);
    if (!admin || admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found' });
    if (isSuperAdminUser(admin)) return res.status(400).json({ message: 'Super admin cannot be deactivated' });

    admin.accountStatus = 'suspended';
    admin.suspensionSource = 'manual';
    admin.suspensionReason = 'Deactivated by super admin';
    admin.suspendedAt = new Date();
    admin.suspendedBy = req.user._id;
    await admin.save();

    await logAdminAction(req.user, 'admin_deactivated', {
      targetType: 'admin',
      targetId: String(admin._id),
      targetEmail: admin.email,
      summary: 'Admin account deactivated',
    });

    res.json({ message: 'Admin deactivated' });
  } catch (err) {
    console.error('Deactivate admin error:', err);
    res.status(500).json({ message: 'Failed to deactivate admin' });
  }
};

export const getAuditLogs = async (_req, res) => {
  try {
    const logs = await AdminActionLog.find({}).sort({ occurredAt: -1 }).limit(300).lean();
    res.json({ logs });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ message: 'Failed to load audit logs' });
  }
};

const toJobLite = (j, employer = null) => ({
  ...toJobPublic(j),
  employerName: employer ? `${employer.firstName} ${employer.lastName}`.trim() : '',
  employerEmail: employer?.email || '',
  removeReason: j.removeReason || '',
  removeReasonCategory: j.removeReasonCategory || '',
});

export const listJobPosts = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();
    const includeRemoved = req.query.includeRemoved === 'true';

    const filter = {};
    if (!includeRemoved) filter.isRemoved = { $ne: true };
    if (status === 'draft') {
      filter.publishStatus = 'draft';
    } else if (status && ['open', 'closed', 'filled'].includes(status)) {
      filter.status = status;
      filter.publishStatus = { $ne: 'draft' };
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { organizationName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      JobPosting.find(filter).sort({ postedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      JobPosting.countDocuments(filter),
    ]);

    const employerIds = [...new Set(items.map((j) => String(j.employerId)))];
    const employers = await User.find({ _id: { $in: employerIds } }).select('firstName lastName email accountStatus').lean();
    const employerMap = Object.fromEntries(employers.map((e) => [String(e._id), e]));

    res.json({
      jobs: items.map((j) => toJobLite(j, employerMap[String(j.employerId)])),
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('List job posts error:', err);
    res.status(500).json({ message: 'Failed to load job posts' });
  }
};

export const getJobPostDetail = async (req, res) => {
  try {
    const job = await JobPosting.findById(req.params.jobId).lean();
    if (!job) return res.status(404).json({ message: 'Job post not found' });
    const employer = await User.findById(job.employerId).select('firstName lastName email organizationName accountStatus verificationStatus').lean();
    res.json({ job: toJobLite(job, employer), employer });
  } catch (err) {
    console.error('Job post detail error:', err);
    res.status(500).json({ message: 'Failed to load job post' });
  }
};

export const deleteJobPost = async (req, res) => {
  try {
    const { reasonCategory, reasonDetail = '' } = req.body;
    const validCategory = JOB_DELETE_REASONS.some((r) => r.value === reasonCategory);
    if (!validCategory) return res.status(400).json({ message: 'Valid removal reason is required' });

    const job = await JobPosting.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job post not found' });
    if (job.isRemoved) return res.status(400).json({ message: 'Job post already removed' });

    const reasonLabel = JOB_DELETE_REASONS.find((r) => r.value === reasonCategory)?.label || reasonCategory;
    const fullReason = reasonDetail?.trim()
      ? `${reasonLabel}: ${reasonDetail.trim()}`
      : reasonLabel;

    job.isRemoved = true;
    job.removedAt = new Date();
    job.removedBy = req.user._id;
    job.removeReason = fullReason;
    job.removeReasonCategory = reasonCategory;
    job.status = 'closed';
    await job.save();

    const employer = await User.findById(job.employerId);
    if (employer) {
      await sendEmail(
        employer.email,
        'Your job post was removed | OPUS',
        `Your job post "${job.title}" was removed.\n\nReason: ${fullReason}`,
        {
          fromName: 'OPUS Admin',
          html: `<p>Your job post <strong>${job.title}</strong> was removed.</p><p><strong>Reason:</strong> ${fullReason}</p>`,
        },
      );
    }

    await logAdminAction(req.user, 'job_post_removed', {
      targetType: 'job',
      targetId: String(job._id),
      targetEmail: employer?.email || '',
      summary: `Job post removed: ${job.title}`,
      metadata: { reasonCategory, reasonDetail: reasonDetail?.trim() || '', jobTitle: job.title },
    });

    res.json({ message: 'Job post removed and employer notified' });
  } catch (err) {
    console.error('Delete job post error:', err);
    res.status(500).json({ message: 'Failed to remove job post' });
  }
};

export const getAdminMeta = async (_req, res) => {
  res.json({
    flagReasons: FLAG_REASONS,
    jobDeleteReasons: JOB_DELETE_REASONS,
    verificationRejectReasons: VERIFICATION_REJECT_REASONS,
    templateCategories: TEMPLATE_CATEGORIES,
  });
};

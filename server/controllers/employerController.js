import Transaction from '../models/Transaction.js';
import JobPosting from '../models/JobPosting.js';
import JobApplication from '../models/JobApplication.js';
import SquadBid from '../models/SquadBid.js';
import { ensureWorkSessionForApplication } from './workspaceController.js';
import User from '../models/User.js';
import WorkSession from '../models/WorkSession.js';
import { publicJobFilter } from '../utils/publicVisibility.js';
import { ensureEmployerId } from '../utils/employerId.js';
import { generateEStatementPdf } from '../utils/estatementPdf.js';
import { toJobPublic } from '../utils/jobSerializer.js';
import { listNotificationsForUser, notifyUser } from '../utils/notify.js';
import {
  ensureConversationForApplication,
  serializeConversation,
  listConversationsForUser,
} from '../utils/messaging.js';
import { emitConversationCreated } from '../socket/index.js';
import { normalizeRolesInput, rolesBudgetOk, serializeSquadBid } from '../utils/multiFreelancer.js';
import { serializePublicFreelancer } from '../utils/publicFreelancer.js';
import { loadBadgesForUsers } from '../utils/badges.js';

const parseJsonField = (val, fallback = []) => {
  if (Array.isArray(val)) return val;
  if (!val) return fallback;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const getDateRange = (preset, customFrom, customTo) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'current_month':
      start.setDate(1); start.setHours(0, 0, 0, 0);
      return { start, end, label: `Current Month (${start.toLocaleString('en', { month: 'long', year: 'numeric' })})` };
    case 'previous_month':
      start.setMonth(now.getMonth() - 1, 1); start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0); end.setHours(23, 59, 59, 999);
      return { start, end, label: `Previous Month (${start.toLocaleString('en', { month: 'long', year: 'numeric' })})` };
    case 'last_3_months':
      start.setMonth(now.getMonth() - 3); start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 3 Months' };
    case 'last_6_months':
      start.setMonth(now.getMonth() - 6); start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 6 Months' };
    case 'current_year':
      start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
      return { start, end, label: `Current Year (${now.getFullYear()})` };
    case 'custom':
      return {
        start: customFrom ? new Date(customFrom) : new Date(now.getFullYear(), 0, 1),
        end: customTo ? new Date(customTo) : end,
        label: `Custom (${customFrom || '-'} to ${customTo || '-'})`,
      };
    default:
      return { start: new Date(0), end, label: 'All time' };
  }
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const getEmployerInit = async (req, res) => {
  try {
    const employerRef = await ensureEmployerId(req.user);

    res.json({
      employerId: employerRef,
      organizationName: req.user.organizationName,
      verificationStatus: req.user.verificationStatus,
      businessType: req.user.businessType,
      user: req.user.toPublicJSON(),
    });
  } catch (err) {
    console.error('Employer init error:', err);
    res.status(500).json({ message: 'Failed to load employer panel' });
  }
};

export const getJobFeed = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const skip = (page - 1) * limit;

    const filter = await publicJobFilter(req.user._id);
    const [jobs, total] = await Promise.all([
      JobPosting.find(filter).sort({ postedAt: -1 }).skip(skip).limit(limit).lean(),
      JobPosting.countDocuments(filter),
    ]);

    res.json({
      jobs: jobs.map(toJobPublic),
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('Job feed error:', err);
    res.status(500).json({ message: 'Failed to load jobs' });
  }
};

export const getEmployerOverview = async (req, res) => {
  try {
    const employerRef = await ensureEmployerId(req.user);

    const txns = await Transaction.find({ userId: req.user._id }).sort({ occurredAt: 1 }).lean();
    const totalSpent = txns.reduce((s, t) => s + t.debit, 0);
    const totalFunded = txns.reduce((s, t) => s + t.credit, 0);
    const last = txns[txns.length - 1];
    const walletBalance = last?.runningBalance ?? 0;

    const [openJobs, myJobs, pendingHires] = await Promise.all([
      JobPosting.countDocuments(await publicJobFilter(req.user._id)),
      JobPosting.countDocuments({ employerId: req.user._id, isRemoved: { $ne: true } }),
      JobPosting.countDocuments({ employerId: req.user._id, status: 'open', isRemoved: { $ne: true } }),
    ]);

    res.json({
      greeting: getGreeting(),
      user: {
        organizationName: req.user.organizationName,
        employerId: employerRef,
        verificationStatus: req.user.verificationStatus,
      },
      stats: {
        walletBalance,
        totalSpent,
        totalFunded,
        openMarketJobs: openJobs,
        jobsPosted: myJobs,
        activePostings: pendingHires,
      },
    });
  } catch (err) {
    console.error('Employer overview error:', err);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
};

export const getEmployerTransactions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const { preset = '', from = '', to = '' } = req.query;
    const range = getDateRange(preset, from, to);

    const filter = { userId: req.user._id };
    if (preset || from || to) {
      filter.occurredAt = { $gte: range.start, $lte: range.end };
    }

    const [txns, total] = await Promise.all([
      Transaction.find(filter).sort({ occurredAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      transactions: txns.map((t) => ({
        id: t._id,
        transactionId: t.transactionId,
        occurredAt: t.occurredAt,
        description: t.description,
        projectRef: t.projectRef,
        projectTitle: t.projectTitle,
        debit: t.debit,
        credit: t.credit,
        runningBalance: t.runningBalance,
        paymentType: t.paymentType,
        paymentStatus: t.paymentStatus,
      })),
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('Employer transactions error:', err);
    res.status(500).json({ message: 'Failed to load transactions' });
  }
};

const buildEStatement = async (user, preset, from, to) => {
  const employerRef = await ensureEmployerId(user);
  const range = getDateRange(preset || 'last_3_months', from, to);
  const filter = { userId: user._id, occurredAt: { $gte: range.start, $lte: range.end } };
  const txns = await Transaction.find(filter).sort({ occurredAt: 1 }).lean();

  const opening = txns.length
    ? txns[0].runningBalance - txns[0].credit + txns[0].debit
    : 0;
  const totalCredits = txns.reduce((s, t) => s + t.credit, 0);
  const totalDebits = txns.reduce((s, t) => s + t.debit, 0);
  const closing = txns.length ? txns[txns.length - 1].runningBalance : opening;

  return {
    user: user.toPublicJSON(),
    employerRef,
    period: range,
    summary: {
      openingBalance: opening,
      totalCredits,
      totalDebits,
      closingBalance: closing,
      availableBalance: closing,
    },
    transactions: txns,
  };
};

export const getEmployerEStatement = async (req, res) => {
  try {
    const data = await buildEStatement(req.user, req.query.preset, req.query.from, req.query.to);
    res.json(data);
  } catch (err) {
    console.error('Employer e-statement error:', err);
    res.status(500).json({ message: 'Failed to generate statement' });
  }
};

export const getEmployerEStatementPdf = async (req, res) => {
  try {
    const data = await buildEStatement(req.user, req.query.preset, req.query.from, req.query.to);
    const pdf = await generateEStatementPdf({
      ...data,
      freelancerId: data.employerRef,
      accountType: 'employer',
      accountHolder: data.user.organizationName || `${data.user.firstName} ${data.user.lastName}`,
      referenceLabel: 'Organization Reference',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="opus-estatement-${data.employerRef}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('Employer PDF error:', err);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
};

export const getEmployerNotifications = async (req, res) => {
  try {
    const data = await listNotificationsForUser(req.user._id);
    const notifications = [...data.notifications];
    let unread = data.unread;

    if (req.user.verificationStatus === 'pending') {
      notifications.unshift({
        id: 'verification-pending',
        type: 'verification',
        title: 'Verification pending',
        message: 'Your documents are under review. Post Jobs, Check Status, and Messages unlock after admin approval.',
        link: '',
        read: true,
        createdAt: req.user.updatedAt || req.user.createdAt,
        meta: {},
      });
    } else if (req.user.verificationStatus === 'rejected') {
      const reason = req.user.verificationRejectionReason?.trim();
      notifications.unshift({
        id: 'verification-rejected',
        type: 'verification',
        title: 'Verification rejected',
        message: reason
          ? `Your organization verification was not approved. Reason: ${reason}`
          : 'Your organization verification was not approved. Please contact support.',
        link: '',
        read: true,
        createdAt: req.user.updatedAt || req.user.createdAt,
        meta: {},
      });
    }

    res.json({ notifications, unread });
  } catch (err) {
    console.error('Employer notifications error:', err);
    res.status(500).json({ message: 'Failed to load notifications' });
  }
};

export const getMyJobs = async (req, res) => {
  try {
    const jobs = await JobPosting.find({ employerId: req.user._id }).sort({ postedAt: -1 }).lean();
    res.json({
      jobs: jobs.map((j) => ({
        id: j._id,
        title: j.title,
        status: j.status,
        budget: j.budget,
        postedAt: j.postedAt,
        applicants: 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load your jobs' });
  }
};

export const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      budget,
      hourlyRate,
      budgetType = 'fixed',
      location,
      skillsRequired,
      conditions,
      applicationDeadline,
      coverMode = 'none',
      coverText = '',
      publishStatus = 'published',
      projectMode = 'single',
      multiBidMode = 'both',
      roles,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: 'Job title is required' });

    const skills = parseJsonField(skillsRequired, []);
    const reqs = parseJsonField(conditions, []);
    const isDraft = publishStatus === 'draft';
    const resolvedCoverMode = coverMode === 'image' && req.file ? 'image' : coverMode === 'text' ? 'text' : 'none';

    const mode = projectMode === 'multi' ? 'multi' : 'single';
    let bidMode = ['role', 'squad', 'both'].includes(multiBidMode) ? multiBidMode : 'both';
    let normalizedRoles = [];

    if (mode === 'multi') {
      const rawRoles = typeof roles === 'string' ? parseJsonField(roles, []) : (Array.isArray(roles) ? roles : parseJsonField(roles, []));
      normalizedRoles = normalizeRolesInput(rawRoles, Number(budget) || 0);
      if (!normalizedRoles.length) {
        return res.status(400).json({ message: 'Multi-freelancer jobs need at least one role' });
      }
      if (!rolesBudgetOk(normalizedRoles)) {
        return res.status(400).json({ message: 'Role budget percentages must add up to 100%' });
      }
    } else {
      bidMode = 'both';
    }

    const employerRef = await ensureEmployerId(req.user);
    const job = await JobPosting.create({
      employerId: req.user._id,
      organizationName: req.user.organizationName,
      employerRef,
      title: title.trim(),
      description: (description || '').trim(),
      category: category || 'other',
      budgetType: budgetType === 'hourly' ? 'hourly' : 'fixed',
      budget: Number(budget) || 0,
      hourlyRate: Number(hourlyRate) || 0,
      location: (location || 'Remote').trim(),
      skillsRequired: skills.filter(Boolean),
      conditions: reqs.filter(Boolean),
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
      coverMode: resolvedCoverMode,
      coverImage: req.file ? `/uploads/job-covers/${req.file.filename}` : '',
      coverText: (coverText || '').trim(),
      publishStatus: isDraft ? 'draft' : 'published',
      status: isDraft ? 'closed' : 'open',
      postedAt: isDraft ? undefined : new Date(),
      projectMode: mode,
      multiBidMode: mode === 'multi' ? bidMode : 'both',
      roles: normalizedRoles,
    });

    if (!job.postedAt) job.postedAt = job.createdAt;

    res.status(201).json({
      job: toJobPublic(job.toObject()),
      message: isDraft ? 'Draft saved' : 'Job published to the explore feed',
    });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ message: 'Failed to post job' });
  }
};

export const getJobStatus = async (req, res) => {
  try {
    const jobs = await JobPosting.find({
      employerId: req.user._id,
      isRemoved: { $ne: true },
    }).sort({ postedAt: -1 }).lean();

    const jobIds = jobs.map((j) => j._id);
    const acceptedApps = await JobApplication.find({
      jobPostingId: { $in: jobIds },
      status: 'accepted',
    }).lean();
    await Promise.all(acceptedApps.map((a) => ensureWorkSessionForApplication(a)));

    const [pendingCounts, acceptedCounts, sessions] = await Promise.all([
      JobApplication.aggregate([
        { $match: { jobPostingId: { $in: jobIds }, status: 'pending' } },
        { $group: { _id: '$jobPostingId', count: { $sum: 1 } } },
      ]),
      JobApplication.aggregate([
        { $match: { jobPostingId: { $in: jobIds }, status: 'accepted' } },
        { $group: { _id: '$jobPostingId', count: { $sum: 1 } } },
      ]),
      WorkSession.find({ employerId: req.user._id, jobPostingId: { $in: jobIds } }).lean(),
    ]);
    const countMap = Object.fromEntries(pendingCounts.map((c) => [String(c._id), c.count]));
    const acceptedMap = Object.fromEntries(acceptedCounts.map((c) => [String(c._id), c.count]));
    const sessionByJob = Object.fromEntries(sessions.map((s) => [String(s.jobPostingId), s]));

    res.json({
      items: jobs.map((j) => {
        const hasAcceptedApplicant = (acceptedMap[String(j._id)] || 0) > 0 || j.status === 'filled';
        const ws = sessionByJob[String(j._id)];
        return {
        id: j._id,
        title: j.title,
        status: j.status,
        publishStatus: j.publishStatus || 'published',
        budget: j.budget,
        budgetType: j.budgetType || 'fixed',
        hourlyRate: j.hourlyRate || 0,
        budgetDisplay: j.budgetType === 'hourly'
          ? `रू ${Number(j.hourlyRate || 0).toLocaleString('en-IN')} /hr`
          : `रू ${Number(j.budget || 0).toLocaleString('en-IN')}`,
        postedAt: j.postedAt,
        applicationCount: countMap[String(j._id)] || 0,
        canDelete: !hasAcceptedApplicant,
        workspaceId: ws?._id || null,
        workspaceStatus: ws?.status || null,
        assignedFreelancerId: ws ? String(ws.freelancerId) : null,
        projectMode: j.projectMode || 'single',
        multiBidMode: j.multiBidMode || null,
        roles: j.roles || [],
        rolesFilled: (j.roles || []).filter((r) => r.status === 'filled').length,
        rolesTotal: (j.roles || []).length,
        isMulti: (j.projectMode || 'single') === 'multi',
        stage: j.publishStatus === 'draft'
          ? 'Draft'
          : j.status === 'open'
            ? (j.projectMode === 'multi'
              ? `Accepting bids · ${(j.roles || []).filter((r) => r.status === 'filled').length}/${(j.roles || []).length} roles filled`
              : 'Accepting applications')
            : j.status === 'filled'
              ? 'Position filled'
              : 'Closed',
      };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load job status' });
  }
};

export const getJobApplications = async (req, res) => {
  try {
    const job = await JobPosting.findOne({
      _id: req.params.jobId,
      employerId: req.user._id,
      isRemoved: { $ne: true },
    });
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const apps = await JobApplication.find({ jobPostingId: job._id })
      .sort({ appliedAt: -1 })
      .lean();

    await Promise.all(
      apps.filter((a) => a.status === 'accepted').map((a) => ensureWorkSessionForApplication(a, job)),
    );

    const sessions = await WorkSession.find({
      applicationId: { $in: apps.map((a) => a._id) },
    }).lean();
    const sessionMap = Object.fromEntries(sessions.map((s) => [String(s.applicationId), s]));

    const freelancerIds = apps.map((a) => a.freelancerId);
    const freelancers = await User.find({ _id: { $in: freelancerIds } })
      .select('firstName lastName email freelancerId skills profilePicture bio professionalSummary degree schoolName')
      .lean();
    const freelancerMap = Object.fromEntries(freelancers.map((f) => [String(f._id), f]));

    const squads = await SquadBid.find({
      jobPostingId: job._id,
      status: { $in: ['submitted', 'accepted', 'rejected'] },
    })
      .sort({ submittedAt: -1 })
      .lean();

    const squadUserIds = squads.flatMap((s) => s.members.map((m) => m.freelancerId));
    const squadUsers = await User.find({ _id: { $in: squadUserIds } })
      .select('firstName lastName email freelancerId skills profilePicture')
      .lean();
    const squadUserMap = Object.fromEntries(squadUsers.map((u) => [String(u._id), u]));

    const roles = (job.roles || []).map((r) => ({
      roleKey: r.roleKey,
      name: r.name,
      description: r.description || '',
      budgetPercent: r.budgetPercent || 0,
      budgetAmount: r.budgetAmount || 0,
      status: r.status || 'open',
      bidCount: apps.filter((a) => a.bidType === 'role' && a.roleKey === r.roleKey && a.status === 'pending').length,
      applications: apps
        .filter((a) => a.bidType === 'role' && a.roleKey === r.roleKey)
        .map((a) => {
          const f = freelancerMap[String(a.freelancerId)];
          const ws = sessionMap[String(a._id)];
          return {
            id: a._id,
            status: a.status,
            appliedAt: a.appliedAt,
            amount: a.amount || 0,
            message: a.message || '',
            estimatedDelivery: a.estimatedDelivery || '',
            bidType: a.bidType || 'role',
            roleKey: a.roleKey,
            roleName: a.roleName || r.name,
            workspaceId: ws?._id || null,
            workspaceStatus: ws?.status || null,
            freelancer: f
              ? {
                  id: f._id,
                  firstName: f.firstName,
                  lastName: f.lastName,
                  email: f.email,
                  freelancerId: f.freelancerId,
                  skills: f.skills || [],
                  profilePicture: f.profilePicture || '',
                  bio: f.bio || f.professionalSummary || '',
                  degree: f.degree || '',
                  schoolName: f.schoolName || '',
                }
              : null,
          };
        }),
    }));

    res.json({
      job: {
        id: job._id,
        title: job.title,
        projectMode: job.projectMode || 'single',
        multiBidMode: job.multiBidMode || null,
        roles,
        rolesFilled: roles.filter((r) => r.status === 'filled').length,
        rolesTotal: roles.length,
        budget: job.budget,
        budgetDisplay: toJobPublic(job.toObject ? job.toObject() : job).budgetDisplay,
      },
      applications: apps.map((a) => {
        const f = freelancerMap[String(a.freelancerId)];
        const ws = sessionMap[String(a._id)];
        return {
          id: a._id,
          status: a.status,
          appliedAt: a.appliedAt,
          amount: a.amount || 0,
          message: a.message || '',
          estimatedDelivery: a.estimatedDelivery || '',
          bidType: a.bidType || 'single',
          roleKey: a.roleKey || '',
          roleName: a.roleName || '',
          workspaceId: ws?._id || null,
          workspaceStatus: ws?.status || null,
          freelancer: f
            ? {
                id: f._id,
                firstName: f.firstName,
                lastName: f.lastName,
                email: f.email,
                freelancerId: f.freelancerId,
                skills: f.skills || [],
                profilePicture: f.profilePicture || '',
                bio: f.bio || f.professionalSummary || '',
                degree: f.degree || '',
                schoolName: f.schoolName || '',
              }
            : null,
        };
      }),
      squads: squads.map((s) => serializeSquadBid(s, squadUserMap)),
    });
  } catch (err) {
    console.error('Job applications error:', err);
    res.status(500).json({ message: 'Failed to load applications' });
  }
};

export const getApplicantProfile = async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const hasAccess = await JobApplication.exists({
      employerId: req.user._id,
      freelancerId,
    });
    if (!hasAccess) {
      return res.status(403).json({ message: 'You can only view applicants who applied to your jobs' });
    }

    const user = await User.findById(freelancerId).lean();
    if (!user || user.role !== 'freelancer') {
      return res.status(404).json({ message: 'Freelancer not found' });
    }

    const badgeMap = await loadBadgesForUsers([user._id]);
    res.json({
      user: serializePublicFreelancer(user, {
        includeEmail: true,
        badges: badgeMap.get(String(user._id)) || [],
      }),
    });
  } catch (err) {
    console.error('Applicant profile error:', err);
    res.status(500).json({ message: 'Failed to load applicant profile' });
  }
};

const reviewApplication = async (req, res, nextStatus) => {
  try {
    const application = await JobApplication.findById(req.params.applicationId);
    if (!application || String(application.employerId) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Application not found' });
    }
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Application has already been reviewed' });
    }

    // Role accepts go through dedicated handler (partial fill)
    if (nextStatus === 'accepted' && application.bidType === 'role' && application.roleKey) {
      req.params.applicationId = application._id;
      const { acceptRoleApplication } = await import('./multiFreelancerController.js');
      return acceptRoleApplication(req, res);
    }

    application.status = nextStatus;
    application.reviewedAt = new Date();
    await application.save();

    let workspaceId = null;
    if (nextStatus === 'accepted') {
      await JobPosting.findByIdAndUpdate(application.jobPostingId, { status: 'filled' });
      await JobApplication.updateMany(
        {
          jobPostingId: application.jobPostingId,
          _id: { $ne: application._id },
          status: 'pending',
        },
        { status: 'rejected', reviewedAt: new Date() },
      );
      await SquadBid.updateMany(
        {
          jobPostingId: application.jobPostingId,
          status: { $in: ['forming', 'submitted'] },
        },
        { status: 'rejected', reviewedAt: new Date() },
      );
      const session = await ensureWorkSessionForApplication(application);
      workspaceId = session?._id || null;

      const conversationResult = await ensureConversationForApplication(application, workspaceId);
      const conversation = conversationResult?.conversation || null;
      if (conversation) {
        await emitConversationCreated(conversation, serializeConversation);
        if (conversationResult.systemMessage) {
          const { getIO } = await import('../socket/index.js');
          const io = getIO();
          if (io) {
            io.to(`conversation:${conversation._id}`).emit('message:new', conversationResult.systemMessage);
            const updatePayload = {
              conversationId: String(conversation._id),
              lastMessageAt: conversation.lastMessageAt,
              lastMessagePreview: conversation.lastMessagePreview,
              unreadBy: conversation.unreadBy,
            };
            io.to(`user:${conversation.employerId}`).emit('conversation:updated', updatePayload);
            io.to(`user:${conversation.freelancerId}`).emit('conversation:updated', updatePayload);
          }
        }
      }

      const orgName = application.organizationName || 'An organization';
      const jobTitle = application.jobTitle || 'a job';
      await notifyUser({
        userId: application.freelancerId,
        type: 'bid_accepted',
        title: 'Bid accepted',
        message: `${orgName} accepted your bid for "${jobTitle}". You can start work from My Bids.`,
        link: workspaceId ? `/dashboard/workspace/${workspaceId}` : '/dashboard',
        meta: {
          workspaceId,
          jobId: application.jobPostingId,
          applicationId: application._id,
        },
      });

      if (conversation) {
        const reunited = !!conversationResult.reunited;
        const count = conversation.collaborationCount || 1;
        await notifyUser({
          userId: application.freelancerId,
          type: reunited ? 'collaboration_again' : 'conversation_started',
          title: reunited ? `Working together again (${count})` : 'Messaging connected',
          message: reunited
            ? `${orgName} accepted another bid. You're collaborating for the ${count} time — continue in the same Messages thread.`
            : `${orgName} is now connected with you in Messages. Start a conversation anytime.`,
          link: '/messages',
          meta: {
            conversationId: conversation._id,
            applicationId: application._id,
          },
        });
        await notifyUser({
          userId: application.employerId,
          type: reunited ? 'collaboration_again' : 'conversation_started',
          title: reunited ? `Working together again (${count})` : 'Messaging connected',
          message: reunited
            ? `You accepted this freelancer again for "${jobTitle}". Continue in your existing Messages thread.`
            : `You are now connected with the freelancer for "${jobTitle}" in Messages.`,
          link: '/employer/messages',
          meta: {
            conversationId: conversation._id,
            applicationId: application._id,
          },
        });
      }
    }

    res.json({
      message: nextStatus === 'accepted' ? 'Applicant accepted' : 'Applicant rejected',
      application: {
        id: application._id,
        status: application.status,
        workspaceId,
      },
    });
  } catch (err) {
    console.error('Review application error:', err);
    res.status(500).json({ message: 'Failed to update application' });
  }
};

export const acceptApplication = (req, res) => reviewApplication(req, res, 'accepted');
export const rejectApplication = (req, res) => reviewApplication(req, res, 'rejected');

export const deleteEmployerJob = async (req, res) => {
  try {
    const job = await JobPosting.findOne({
      _id: req.params.jobId,
      employerId: req.user._id,
      isRemoved: { $ne: true },
    });
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const hasAcceptedApplicant = await JobApplication.exists({
      jobPostingId: job._id,
      status: 'accepted',
    });
    if (hasAcceptedApplicant || job.status === 'filled') {
      return res.status(400).json({
        message: 'This job cannot be deleted after you have accepted a freelancer',
      });
    }

    job.isRemoved = true;
    job.removedAt = new Date();
    job.removedBy = req.user._id;
    job.removeReason = 'Deleted by employer';
    job.removeReasonCategory = 'other';
    job.status = 'closed';
    await job.save();

    await JobApplication.deleteMany({ jobPostingId: job._id, status: 'pending' });

    res.json({ message: 'Job post deleted successfully' });
  } catch (err) {
    console.error('Delete employer job error:', err);
    res.status(500).json({ message: 'Failed to delete job post' });
  }
};

export const getEmployerMessages = async (req, res) => {
  try {
    const conversations = await listConversationsForUser(req.user);
    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        freelancerName: c.peer?.name || 'Freelancer',
        lastMessage: c.lastMessagePreview || '',
        lastMessageAt: c.lastMessageAt,
        unread: c.unread || 0,
        peer: c.peer,
        jobTitle: c.jobTitle,
      })),
    });
  } catch (err) {
    console.error('Employer messages error:', err);
    res.status(500).json({ message: 'Failed to load messages' });
  }
};

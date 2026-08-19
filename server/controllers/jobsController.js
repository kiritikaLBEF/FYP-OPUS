import JobPosting from '../models/JobPosting.js';
import JobApplication from '../models/JobApplication.js';
import { publicJobFilter } from '../utils/publicVisibility.js';
import { toJobPublic } from '../utils/jobSerializer.js';
import { buildPublicJobQuery, jobSortFromParam } from '../utils/jobListFilters.js';
import { notifyUser } from '../utils/notify.js';

const enrichJobForUser = async (job, user) => {
  const base = toJobPublic(job);
  if (!user || user.role !== 'freelancer') {
    return { ...base, hasApplied: false, applicationStatus: null, myApplications: [], mySquadBid: null };
  }

  const apps = await JobApplication.find({
    jobPostingId: job._id,
    freelancerId: user._id,
  }).lean();

  const SquadBid = (await import('../models/SquadBid.js')).default;
  const mySquad = await SquadBid.findOne({
    jobPostingId: job._id,
    $or: [{ leaderId: user._id }, { 'members.freelancerId': user._id }],
    status: { $in: ['forming', 'submitted', 'accepted'] },
  }).lean();

  return {
    ...base,
    hasApplied: apps.length > 0,
    applicationStatus: apps[0]?.status || null,
    myApplications: apps.map((a) => ({
      id: a._id,
      status: a.status,
      bidType: a.bidType || 'single',
      roleKey: a.roleKey || '',
      roleName: a.roleName || '',
      amount: a.amount || 0,
    })),
    appliedRoleKeys: apps.map((a) => a.roleKey).filter(Boolean),
    mySquadBid: mySquad
      ? {
          id: mySquad._id,
          name: mySquad.name,
          status: mySquad.status,
          pendingInvites: (mySquad.members || []).filter((m) => m.inviteStatus === 'pending').length,
        }
      : null,
  };
};

export const listPublicJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const baseFilter = await publicJobFilter();
    const extraFilter = buildPublicJobQuery({
      search: req.query.search,
      category: req.query.category,
      skill: req.query.skill,
      location: req.query.location,
      budgetType: req.query.budgetType,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
    });

    const filter = extraFilter.$and
      ? { ...baseFilter, $and: [...(baseFilter.$and || []), ...extraFilter.$and] }
      : { ...baseFilter, ...extraFilter };

    const sort = jobSortFromParam(req.query.sort);

    const [jobs, total] = await Promise.all([
      JobPosting.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      JobPosting.countDocuments(filter),
    ]);

    const enriched = await Promise.all(jobs.map((j) => enrichJobForUser(j, req.user)));

    res.json({
      jobs: enriched,
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (err) {
    console.error('List public jobs error:', err);
    res.status(500).json({ message: 'Failed to load jobs' });
  }
};

export const getPublicJobDetail = async (req, res) => {
  try {
    const filter = await publicJobFilter();
    const job = await JobPosting.findOne({ ...filter, _id: req.params.jobId }).lean();
    if (!job) return res.status(404).json({ message: 'Job not found' });

    res.json({ job: await enrichJobForUser(job, req.user) });
  } catch (err) {
    console.error('Public job detail error:', err);
    res.status(500).json({ message: 'Failed to load job' });
  }
};

export const applyToJob = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can apply to jobs' });
    }

    const filter = await publicJobFilter();
    const job = await JobPosting.findOne({ ...filter, _id: req.params.jobId });
    if (!job) return res.status(404).json({ message: 'Job not found or no longer accepting applications' });

    const {
      roleKey = '',
      amount,
      message = '',
      estimatedDelivery = '',
    } = req.body || {};

    const isMulti = job.projectMode === 'multi';
    let bidType = 'single';
    let roleName = '';
    let resolvedRoleKey = '';

    if (isMulti) {
      if (!['role', 'both'].includes(job.multiBidMode || 'both')) {
        return res.status(400).json({ message: 'This job only accepts squad bids. Form a squad to apply.' });
      }
      if (!roleKey) {
        return res.status(400).json({ message: 'Select a role to bid on' });
      }
      const role = (job.roles || []).find((r) => r.roleKey === roleKey);
      if (!role) return res.status(400).json({ message: 'Role not found on this job' });
      if (role.status === 'filled') {
        return res.status(400).json({ message: 'This role is already filled' });
      }
      bidType = 'role';
      roleName = role.name;
      resolvedRoleKey = role.roleKey;
    }

    const existing = await JobApplication.findOne({
      jobPostingId: job._id,
      freelancerId: req.user._id,
      roleKey: resolvedRoleKey,
    });
    if (existing) {
      return res.status(400).json({
        message: resolvedRoleKey
          ? 'You have already applied for this role'
          : 'You have already applied to this job',
        applicationStatus: existing.status,
      });
    }

    const bidAmount = amount != null
      ? Number(amount)
      : (resolvedRoleKey
        ? (job.roles || []).find((r) => r.roleKey === resolvedRoleKey)?.budgetAmount || 0
        : job.budget || 0);

    const application = await JobApplication.create({
      jobPostingId: job._id,
      freelancerId: req.user._id,
      employerId: job.employerId,
      jobTitle: job.title,
      organizationName: job.organizationName,
      status: 'pending',
      bidType,
      roleKey: resolvedRoleKey,
      roleName,
      amount: bidAmount,
      message: String(message || '').trim(),
      estimatedDelivery: String(estimatedDelivery || '').trim(),
    });

    const bidderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ')
      || req.user.name
      || 'A freelancer';
    await notifyUser({
      userId: job.employerId,
      type: 'bid_received',
      title: resolvedRoleKey ? 'New role bid received' : 'New bid received',
      message: resolvedRoleKey
        ? `${bidderName} bid on "${roleName}" for "${job.title}".`
        : `${bidderName} applied to "${job.title}".`,
      link: '/employer/check-status',
      meta: {
        jobId: job._id,
        applicationId: application._id,
        roleKey: resolvedRoleKey || undefined,
      },
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        id: application._id,
        jobId: job._id,
        status: application.status,
        appliedAt: application.appliedAt,
        bidType,
        roleKey: resolvedRoleKey,
        roleName,
        amount: bidAmount,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'You have already applied to this role or job' });
    }
    console.error('Apply to job error:', err);
    res.status(500).json({ message: 'Failed to submit application' });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ message: 'Freelancer access only' });
    }

    const apps = await JobApplication.find({ freelancerId: req.user._id })
      .sort({ appliedAt: -1 })
      .limit(100)
      .lean();

    res.json({
      applications: apps.map((a) => ({
        id: a._id,
        jobId: a.jobPostingId,
        jobTitle: a.jobTitle,
        organizationName: a.organizationName,
        status: a.status,
        appliedAt: a.appliedAt,
      })),
    });
  } catch (err) {
    console.error('My applications error:', err);
    res.status(500).json({ message: 'Failed to load applications' });
  }
};

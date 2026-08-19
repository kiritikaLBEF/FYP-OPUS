import JobPosting from '../models/JobPosting.js';
import JobApplication from '../models/JobApplication.js';
import SquadBid from '../models/SquadBid.js';
import User from '../models/User.js';
import { publicJobFilter } from '../utils/publicVisibility.js';
import { notifyUser } from '../utils/notify.js';
import {
  allRolesFilled,
  recomputeSquadTotal,
  serializeSquadBid,
  squadReadyToSubmit,
} from '../utils/multiFreelancer.js';
import { ensureWorkSessionForApplication } from './workspaceController.js';
import {
  ensureConversationForApplication,
  serializeConversation,
} from '../utils/messaging.js';
import { emitConversationCreated } from '../socket/index.js';

const loadUserMap = async (ids) => {
  const unique = [...new Set(ids.map(String).filter(Boolean))];
  const users = await User.find({ _id: { $in: unique } })
    .select('firstName lastName email freelancerId skills profilePicture')
    .lean();
  return Object.fromEntries(users.map((u) => [String(u._id), u]));
};

const displayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || user?.email || 'A freelancer';

async function connectMessaging(application, workspaceId) {
  const conversationResult = await ensureConversationForApplication(application, workspaceId);
  const conversation = conversationResult?.conversation || null;
  if (!conversation) return null;

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
  return conversation;
}

export const searchFreelancers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ freelancers: [] });

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const freelancers = await User.find({
      role: 'freelancer',
      _id: { $ne: req.user._id },
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { freelancerId: regex },
      ],
    })
      .select('firstName lastName email freelancerId skills profilePicture')
      .limit(12)
      .lean();

    res.json({
      freelancers: freelancers.map((f) => ({
        id: f._id,
        firstName: f.firstName,
        lastName: f.lastName,
        email: f.email,
        freelancerId: f.freelancerId,
        skills: f.skills || [],
        profilePicture: f.profilePicture || '',
        name: displayName(f),
      })),
    });
  } catch (err) {
    console.error('Search freelancers error:', err);
    res.status(500).json({ message: 'Failed to search freelancers' });
  }
};

export const createSquadBid = async (req, res) => {
  try {
    const filter = await publicJobFilter();
    const job = await JobPosting.findOne({ ...filter, _id: req.params.jobId });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.projectMode !== 'multi' || !['squad', 'both'].includes(job.multiBidMode || 'both')) {
      return res.status(400).json({ message: 'This job does not accept squad bids' });
    }

    const { name, message = '', estimatedDelivery = '', members = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Squad name is required' });
    if (!Array.isArray(members) || members.length < 1) {
      return res.status(400).json({ message: 'Add at least one squad member for an open role' });
    }

    const roles = job.roles || [];
    if (!roles.length) return res.status(400).json({ message: 'Job has no roles defined' });

    const usedRoles = new Set();
    const builtMembers = [];

    for (const m of members) {
      const roleKey = String(m.roleKey || '');
      const role = roles.find((r) => r.roleKey === roleKey);
      if (!role) return res.status(400).json({ message: `Unknown role: ${roleKey}` });
      if (role.status === 'filled') {
        return res.status(400).json({ message: `Role "${role.name}" is already filled` });
      }
      if (usedRoles.has(roleKey)) {
        return res.status(400).json({ message: 'Each role can only be assigned once in a squad' });
      }
      usedRoles.add(roleKey);

      const freelancerId = m.isLeader ? req.user._id : m.freelancerId;
      if (!freelancerId) return res.status(400).json({ message: 'Each member needs a freelancer' });

      builtMembers.push({
        freelancerId,
        roleKey,
        roleName: role.name,
        splitAmount: Number(m.splitAmount) || role.budgetAmount || 0,
        inviteStatus: m.isLeader || String(freelancerId) === String(req.user._id) ? 'leader' : 'pending',
        respondedAt: m.isLeader || String(freelancerId) === String(req.user._id) ? new Date() : undefined,
      });
    }

    const leaderEntry = builtMembers.find((m) => String(m.freelancerId) === String(req.user._id));
    if (!leaderEntry) {
      return res.status(400).json({ message: 'You must include yourself as a squad member for one role' });
    }
    leaderEntry.inviteStatus = 'leader';
    leaderEntry.respondedAt = new Date();

    const existing = await SquadBid.findOne({
      jobPostingId: job._id,
      leaderId: req.user._id,
      status: { $in: ['forming', 'submitted'] },
    });
    if (existing) {
      return res.status(400).json({
        message: 'You already have an active squad bid for this job',
        squadId: existing._id,
      });
    }

    const squad = await SquadBid.create({
      jobPostingId: job._id,
      employerId: job.employerId,
      leaderId: req.user._id,
      name: name.trim(),
      message: String(message || '').trim(),
      estimatedDelivery: String(estimatedDelivery || '').trim(),
      members: builtMembers,
      combinedAmount: recomputeSquadTotal({ members: builtMembers }),
      status: 'forming',
      jobTitle: job.title,
      organizationName: job.organizationName,
    });

    const invitees = builtMembers.filter((m) => m.inviteStatus === 'pending');
    await Promise.all(
      invitees.map((m) =>
        notifyUser({
          userId: m.freelancerId,
          type: 'squad_invite',
          title: 'Squad invitation',
          message: `${displayName(req.user)} invited you to join "${squad.name}" for "${job.title}" (${m.roleName}).`,
          link: '/dashboard',
          meta: { squadId: squad._id, jobId: job._id, roleKey: m.roleKey },
        }),
      ),
    );

    const userMap = await loadUserMap(builtMembers.map((m) => m.freelancerId));
    res.status(201).json({
      message: invitees.length
        ? 'Squad created. Waiting for members to accept before you can submit.'
        : 'Squad ready to submit.',
      squad: serializeSquadBid(squad.toObject(), userMap),
    });
  } catch (err) {
    console.error('Create squad bid error:', err);
    res.status(500).json({ message: 'Failed to create squad bid' });
  }
};

export const submitSquadBid = async (req, res) => {
  try {
    const squad = await SquadBid.findById(req.params.squadId);
    if (!squad || String(squad.leaderId) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Squad not found' });
    }
    if (squad.status !== 'forming') {
      return res.status(400).json({ message: 'Squad bid already submitted or closed' });
    }
    if (!squadReadyToSubmit(squad)) {
      return res.status(400).json({ message: 'All invited members must accept before submitting' });
    }

    squad.combinedAmount = recomputeSquadTotal(squad);
    squad.status = 'submitted';
    squad.submittedAt = new Date();
    await squad.save();

    await notifyUser({
      userId: squad.employerId,
      type: 'squad_bid_received',
      title: 'New squad bid',
      message: `"${squad.name}" submitted a combined bid for "${squad.jobTitle}".`,
      link: '/employer/check-status',
      meta: { squadId: squad._id, jobId: squad.jobPostingId },
    });

    const userMap = await loadUserMap(squad.members.map((m) => m.freelancerId));
    res.json({ message: 'Squad bid submitted', squad: serializeSquadBid(squad.toObject(), userMap) });
  } catch (err) {
    console.error('Submit squad bid error:', err);
    res.status(500).json({ message: 'Failed to submit squad bid' });
  }
};

export const respondSquadInvite = async (req, res) => {
  try {
    const accept = !!req.body.accept;
    const squad = await SquadBid.findById(req.params.squadId);
    if (!squad || squad.status !== 'forming') {
      return res.status(404).json({ message: 'Invite not found or no longer active' });
    }

    const member = squad.members.find((m) => String(m.freelancerId) === String(req.user._id));
    if (!member || member.inviteStatus === 'leader') {
      return res.status(404).json({ message: 'You do not have a pending invite on this squad' });
    }
    if (member.inviteStatus !== 'pending') {
      return res.status(400).json({ message: 'Invite already responded to' });
    }

    member.inviteStatus = accept ? 'accepted' : 'declined';
    member.respondedAt = new Date();
    if (typeof req.body.splitAmount === 'number') {
      member.splitAmount = req.body.splitAmount;
    }

    if (!accept) {
      squad.status = 'withdrawn';
    } else {
      squad.combinedAmount = recomputeSquadTotal(squad);
    }
    await squad.save();

    await notifyUser({
      userId: squad.leaderId,
      type: accept ? 'squad_invite_accepted' : 'squad_invite_declined',
      title: accept ? 'Squad invite accepted' : 'Squad invite declined',
      message: accept
        ? `${displayName(req.user)} accepted their role on "${squad.name}".`
        : `${displayName(req.user)} declined their invite — squad bid was withdrawn.`,
      link: '/dashboard',
      meta: { squadId: squad._id, jobId: squad.jobPostingId },
    });

    const userMap = await loadUserMap(squad.members.map((m) => m.freelancerId));
    res.json({
      message: accept ? 'Invite accepted' : 'Invite declined',
      squad: serializeSquadBid(squad.toObject(), userMap),
    });
  } catch (err) {
    console.error('Respond squad invite error:', err);
    res.status(500).json({ message: 'Failed to respond to invite' });
  }
};

export const getMySquadInvites = async (req, res) => {
  try {
    const squads = await SquadBid.find({
      status: 'forming',
      members: {
        $elemMatch: { freelancerId: req.user._id, inviteStatus: 'pending' },
      },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const userMap = await loadUserMap(squads.flatMap((s) => s.members.map((m) => m.freelancerId)));
    res.json({ invites: squads.map((s) => serializeSquadBid(s, userMap)) });
  } catch (err) {
    console.error('My squad invites error:', err);
    res.status(500).json({ message: 'Failed to load invites' });
  }
};

export const getMySquadBids = async (req, res) => {
  try {
    const squads = await SquadBid.find({
      $or: [
        { leaderId: req.user._id },
        { 'members.freelancerId': req.user._id },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const userMap = await loadUserMap(squads.flatMap((s) => s.members.map((m) => m.freelancerId)));
    res.json({ squads: squads.map((s) => serializeSquadBid(s, userMap)) });
  } catch (err) {
    console.error('My squad bids error:', err);
    res.status(500).json({ message: 'Failed to load squad bids' });
  }
};

export const getJobSquadBids = async (req, res) => {
  try {
    const job = await JobPosting.findOne({
      _id: req.params.jobId,
      employerId: req.user._id,
      isRemoved: { $ne: true },
    });
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const squads = await SquadBid.find({
      jobPostingId: job._id,
      status: { $in: ['submitted', 'accepted', 'rejected'] },
    })
      .sort({ submittedAt: -1 })
      .lean();

    const userMap = await loadUserMap(squads.flatMap((s) => s.members.map((m) => m.freelancerId)));
    res.json({
      job: { id: job._id, title: job.title, roles: job.roles || [] },
      squads: squads.map((s) => serializeSquadBid(s, userMap)),
    });
  } catch (err) {
    console.error('Job squad bids error:', err);
    res.status(500).json({ message: 'Failed to load squad bids' });
  }
};

export const acceptSquadBid = async (req, res) => {
  try {
    const squad = await SquadBid.findById(req.params.squadId);
    if (!squad || String(squad.employerId) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Squad bid not found' });
    }
    if (squad.status !== 'submitted') {
      return res.status(400).json({ message: 'Only submitted squad bids can be accepted' });
    }

    const job = await JobPosting.findById(squad.jobPostingId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const workspaces = [];
    for (const member of squad.members) {
      let application = await JobApplication.findOne({
        jobPostingId: job._id,
        freelancerId: member.freelancerId,
        roleKey: member.roleKey,
      });

      if (!application) {
        application = await JobApplication.create({
          jobPostingId: job._id,
          freelancerId: member.freelancerId,
          employerId: job.employerId,
          jobTitle: job.title,
          organizationName: job.organizationName,
          status: 'accepted',
          bidType: 'role',
          roleKey: member.roleKey,
          roleName: member.roleName,
          amount: member.splitAmount,
          message: squad.message,
          estimatedDelivery: squad.estimatedDelivery,
          reviewedAt: new Date(),
        });
      } else {
        application.status = 'accepted';
        application.amount = member.splitAmount;
        application.reviewedAt = new Date();
        await application.save();
      }

      const role = (job.roles || []).find((r) => r.roleKey === member.roleKey);
      if (role) {
        role.status = 'filled';
        role.filledByApplicationId = application._id;
      }

      const session = await ensureWorkSessionForApplication(application, job);
      workspaces.push({ freelancerId: member.freelancerId, workspaceId: session?._id });
      await connectMessaging(application, session?._id);

      await notifyUser({
        userId: member.freelancerId,
        type: 'bid_accepted',
        title: 'Squad bid accepted',
        message: `${job.organizationName} accepted squad "${squad.name}" for "${job.title}". Your role: ${member.roleName}.`,
        link: session?._id ? `/dashboard/workspace/${session._id}` : '/dashboard',
        meta: { squadId: squad._id, jobId: job._id, applicationId: application._id },
      });
    }

    job.status = 'filled';
    await job.save();

    squad.status = 'accepted';
    squad.reviewedAt = new Date();
    await squad.save();

    await JobApplication.updateMany(
      { jobPostingId: job._id, status: 'pending' },
      { status: 'rejected', reviewedAt: new Date() },
    );
    await SquadBid.updateMany(
      {
        jobPostingId: job._id,
        _id: { $ne: squad._id },
        status: { $in: ['forming', 'submitted'] },
      },
      { status: 'rejected', reviewedAt: new Date() },
    );

    res.json({ message: 'Squad accepted — all roles filled', workspaces });
  } catch (err) {
    console.error('Accept squad bid error:', err);
    res.status(500).json({ message: 'Failed to accept squad bid' });
  }
};

export const rejectSquadBid = async (req, res) => {
  try {
    const squad = await SquadBid.findById(req.params.squadId);
    if (!squad || String(squad.employerId) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Squad bid not found' });
    }
    if (squad.status !== 'submitted') {
      return res.status(400).json({ message: 'Only submitted squad bids can be rejected' });
    }

    squad.status = 'rejected';
    squad.reviewedAt = new Date();
    await squad.save();

    await Promise.all(
      squad.members.map((m) =>
        notifyUser({
          userId: m.freelancerId,
          type: 'bid_rejected',
          title: 'Squad bid not selected',
          message: `Your squad "${squad.name}" was not selected for "${squad.jobTitle}".`,
          link: '/dashboard',
          meta: { squadId: squad._id, jobId: squad.jobPostingId },
        }),
      ),
    );

    res.json({ message: 'Squad bid rejected' });
  } catch (err) {
    console.error('Reject squad bid error:', err);
    res.status(500).json({ message: 'Failed to reject squad bid' });
  }
};

export const acceptRoleApplication = async (req, res) => {
  try {
    const application = await JobApplication.findById(req.params.applicationId);
    if (!application || String(application.employerId) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Application not found' });
    }
    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Application has already been reviewed' });
    }
    if (application.bidType !== 'role' || !application.roleKey) {
      return res.status(400).json({ message: 'Not a role-based application' });
    }

    const job = await JobPosting.findById(application.jobPostingId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const role = (job.roles || []).find((r) => r.roleKey === application.roleKey);
    if (!role) return res.status(400).json({ message: 'Role no longer exists on this job' });
    if (role.status === 'filled') {
      return res.status(400).json({ message: 'This role is already filled' });
    }

    application.status = 'accepted';
    application.reviewedAt = new Date();
    await application.save();

    role.status = 'filled';
    role.filledByApplicationId = application._id;

    await JobApplication.updateMany(
      {
        jobPostingId: job._id,
        roleKey: application.roleKey,
        _id: { $ne: application._id },
        status: 'pending',
      },
      { status: 'rejected', reviewedAt: new Date() },
    );

    const session = await ensureWorkSessionForApplication(application, job);
    await connectMessaging(application, session?._id);

    const filled = allRolesFilled(job);
    if (filled) {
      job.status = 'filled';
      await JobApplication.updateMany(
        { jobPostingId: job._id, status: 'pending' },
        { status: 'rejected', reviewedAt: new Date() },
      );
      await SquadBid.updateMany(
        { jobPostingId: job._id, status: { $in: ['forming', 'submitted'] } },
        { status: 'rejected', reviewedAt: new Date() },
      );
    }
    await job.save();

    await notifyUser({
      userId: application.freelancerId,
      type: 'bid_accepted',
      title: 'Role bid accepted',
      message: `${job.organizationName} selected you for "${application.roleName || role.name}" on "${job.title}".`,
      link: session?._id ? `/dashboard/workspace/${session._id}` : '/dashboard',
      meta: {
        workspaceId: session?._id,
        jobId: job._id,
        applicationId: application._id,
        roleKey: application.roleKey,
      },
    });

    res.json({
      message: filled ? 'Role filled — all roles complete, job filled' : 'Role filled',
      application: { id: application._id, status: 'accepted', workspaceId: session?._id },
      jobFilled: filled,
      rolesFilled: (job.roles || []).filter((r) => r.status === 'filled').length,
      rolesTotal: (job.roles || []).length,
    });
  } catch (err) {
    console.error('Accept role application error:', err);
    res.status(500).json({ message: 'Failed to accept role application' });
  }
};

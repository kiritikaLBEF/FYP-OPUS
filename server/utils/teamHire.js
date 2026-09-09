import JobApplication from '../models/JobApplication.js';
import JobPosting from '../models/JobPosting.js';
import SquadBid from '../models/SquadBid.js';
import TeamWorkspace from '../models/TeamWorkspace.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { allRolesFilled } from './multiFreelancer.js';
import { notifyUser } from './notify.js';
import { emitConversationCreated } from '../socket/index.js';
import { serializeConversation } from './messaging.js';
import { buildGuidelinesFromJob } from './workspaceGuidelines.js';

const displayName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  || user?.organizationName
  || user?.name
  || user?.email
  || 'Member';

export async function rejectCompetitorsForRoles(jobId, roleKeys, { exceptApplicationIds = [], exceptSquadId = null } = {}) {
  const keys = [...new Set((roleKeys || []).map(String).filter(Boolean))];
  if (!keys.length) return;

  await JobApplication.updateMany(
    {
      jobPostingId: jobId,
      roleKey: { $in: keys },
      status: 'pending',
      ...(exceptApplicationIds.length ? { _id: { $nin: exceptApplicationIds } } : {}),
    },
    { status: 'rejected', reviewedAt: new Date() },
  );

  const openSquads = await SquadBid.find({
    jobPostingId: jobId,
    status: { $in: ['forming', 'submitted'] },
    ...(exceptSquadId ? { _id: { $ne: exceptSquadId } } : {}),
  });

  for (const squad of openSquads) {
    const overlaps = (squad.members || []).some((m) => keys.includes(String(m.roleKey)));
    if (overlaps) {
      squad.status = 'rejected';
      squad.reviewedAt = new Date();
      await squad.save();
    }
  }
}

export async function ensureAcceptedRoleApplication({
  job,
  freelancerId,
  roleKey,
  roleName,
  amount,
  message = '',
  estimatedDelivery = '',
}) {
  let application = await JobApplication.findOne({
    jobPostingId: job._id,
    freelancerId,
    roleKey,
  });

  if (!application) {
    application = await JobApplication.create({
      jobPostingId: job._id,
      freelancerId,
      employerId: job.employerId,
      jobTitle: job.title,
      organizationName: job.organizationName,
      status: 'accepted',
      bidType: 'role',
      roleKey,
      roleName,
      amount: Number(amount) || 0,
      message: String(message || '').trim(),
      estimatedDelivery: String(estimatedDelivery || '').trim(),
      reviewedAt: new Date(),
    });
  } else {
    application.status = 'accepted';
    application.amount = Number(amount) || application.amount || 0;
    application.roleName = roleName || application.roleName;
    application.message = message || application.message;
    application.estimatedDelivery = estimatedDelivery || application.estimatedDelivery;
    application.reviewedAt = new Date();
    await application.save();
  }

  const role = (job.roles || []).find((r) => r.roleKey === roleKey);
  if (role) {
    role.status = 'filled';
    role.filledByApplicationId = application._id;
  }

  return application;
}

async function createGroupConversation({
  job,
  kind,
  participantIds,
  includeEmployer,
  teamWorkspaceId,
}) {
  const participants = [...new Set(participantIds.map(String))].map((id) => ({
    userId: id,
    role: includeEmployer && String(id) === String(job.employerId) ? 'employer' : 'freelancer',
  }));

  const unreadBy = {};
  for (const p of participants) unreadBy[String(p.userId)] = 0;

  const title = kind === 'freelancer_team'
    ? `${job.title} · Freelancer team`
    : `${job.title} · Project team`;

  const conversation = await Conversation.create({
    kind: 'group',
    groupType: kind,
    title,
    jobPostingId: job._id,
    teamWorkspaceId: teamWorkspaceId || undefined,
    employerId: includeEmployer ? job.employerId : undefined,
    freelancerId: undefined,
    participantIds: participants.map((p) => p.userId),
    participants,
    jobTitle: job.title,
    organizationName: job.organizationName || '',
    collaborationCount: 1,
    lastMessageAt: new Date(),
    lastMessagePreview: 'Group chat created',
    unreadByMap: unreadBy,
    unreadBy: { employer: 0, freelancer: 0 },
    archivedBy: { employer: false, freelancer: false },
  });

  const text = kind === 'freelancer_team'
    ? 'Private freelancer group created. Coordinate here without the employer.'
    : 'Project group created. Employer and all hired freelancers can message here.';

  const msg = await Message.create({
    conversationId: conversation._id,
    senderId: null,
    senderRole: 'system',
    type: 'system',
    text,
    clientMsgId: `system-group-${conversation._id}`,
  });

  conversation.lastMessageAt = msg.createdAt;
  conversation.lastMessagePreview = text;
  await conversation.save();

  try {
    await emitConversationCreated(conversation, serializeConversation);
  } catch {
  }

  return conversation;
}

export async function completeMultiHireIfReady(job) {
  if (job.projectMode !== 'multi') return null;
  if (!allRolesFilled(job)) {
    if (job.status !== 'open') {
      job.status = 'open';
      await job.save();
    }
    return null;
  }

  job.status = 'filled';
  await job.save();

  await JobApplication.updateMany(
    { jobPostingId: job._id, status: 'pending' },
    { status: 'rejected', reviewedAt: new Date() },
  );
  await SquadBid.updateMany(
    { jobPostingId: job._id, status: { $in: ['forming', 'submitted'] } },
    { status: 'rejected', reviewedAt: new Date() },
  );

  let team = await TeamWorkspace.findOne({ jobPostingId: job._id });
  if (team) return { team, created: false };

  const accepted = await JobApplication.find({
    jobPostingId: job._id,
    status: 'accepted',
    bidType: 'role',
  }).lean();

  if (!accepted.length) return null;

  const members = accepted.map((a) => ({
    freelancerId: a.freelancerId,
    applicationId: a._id,
    roleKey: a.roleKey,
    roleName: a.roleName || '',
    splitAmount: Number(a.amount) || 0,
    roleStatus: 'not_started',
  }));

  team = await TeamWorkspace.create({
    jobPostingId: job._id,
    employerId: job.employerId,
    title: job.title,
    organizationName: job.organizationName,
    description: job.description || '',
    category: job.category || 'other',
    deadline: job.applicationDeadline || null,
    guidelines: buildGuidelinesFromJob(job),
    members,
    status: 'not_started',
    progressUpdates: [],
    paymentRef: `OPUS-TEAM-${String(job._id).slice(-8).toUpperCase()}`,
  });

  const freelancerIds = members.map((m) => m.freelancerId);
  const freelancerGroup = await createGroupConversation({
    job,
    kind: 'freelancer_team',
    participantIds: freelancerIds,
    includeEmployer: false,
    teamWorkspaceId: team._id,
  });
  const projectGroup = await createGroupConversation({
    job,
    kind: 'project_team',
    participantIds: [...freelancerIds, job.employerId],
    includeEmployer: true,
    teamWorkspaceId: team._id,
  });

  team.freelancerGroupConversationId = freelancerGroup._id;
  team.projectGroupConversationId = projectGroup._id;
  await team.save();

  const users = await User.find({ _id: { $in: freelancerIds } })
    .select('firstName lastName')
    .lean();
  const nameById = Object.fromEntries(users.map((u) => [String(u._id), displayName(u)]));

  await Promise.all(
    members.map((m) =>
      notifyUser({
        userId: m.freelancerId,
        type: 'bid_accepted',
        title: 'Team hired — shared workspace ready',
        message: `All roles for "${job.title}" are filled. Open the shared workspace and group chats to start.`,
        link: `/dashboard/team-workspace/${team._id}`,
        meta: {
          teamWorkspaceId: team._id,
          jobId: job._id,
          freelancerGroupId: freelancerGroup._id,
          projectGroupId: projectGroup._id,
        },
      }),
    ),
  );

  await notifyUser({
    userId: job.employerId,
    type: 'job_filled',
    title: 'All roles filled',
    message: `"${job.title}" is fully staffed (${members.map((m) => `${m.roleName || 'Role'}: ${nameById[String(m.freelancerId)] || 'freelancer'}`).join(', ')}).`,
    link: `/employer/team-workspace/${team._id}`,
    meta: { teamWorkspaceId: team._id, jobId: job._id },
  });

  return {
    team,
    created: true,
    freelancerGroupId: freelancerGroup._id,
    projectGroupId: projectGroup._id,
  };
}

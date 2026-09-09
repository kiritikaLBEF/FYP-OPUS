import TeamWorkspace from '../models/TeamWorkspace.js';
import WorkSession from '../models/WorkSession.js';
import JobPosting from '../models/JobPosting.js';
import User from '../models/User.js';
import { notifyUser } from '../utils/notify.js';
import { settleTeamWorkspaceToWallets, splitJobPayment } from '../utils/walletLedger.js';
import { buildGuidelinesFromJob } from '../utils/workspaceGuidelines.js';

const CATEGORY_LABELS = {
  coding: 'Development & Tech',
  ui_ux: 'UI / UX Design',
  graphic_design: 'Graphic Design',
  video_editing: 'Video Editing',
  data_entry: 'Data Entry',
  marketing: 'Marketing',
  consulting: 'Consulting',
  content_writing: 'Content Writing',
  other: 'Other',
};

const displayName = (user) => {
  if (!user) return 'Member';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || user.email || 'Member';
};

const assertTeamAccess = (team, user) => {
  if (String(team.employerId) === String(user._id)) return 'employer';
  const member = (team.members || []).find((m) => String(m.freelancerId) === String(user._id));
  if (member) return 'freelancer';
  return null;
};

const hydrateTeamWorkspace = async (team) => {
  let changed = false;

  if (!Array.isArray(team.guidelines) || team.guidelines.length === 0) {
    const job = await JobPosting.findById(team.jobPostingId).select('conditions description category').lean();
    const fromJob = buildGuidelinesFromJob(job);
    if (fromJob.length) {
      team.guidelines = fromJob;
      changed = true;
    }
    if (!team.description && job?.description) {
      team.description = job.description;
      changed = true;
    }
  }

  const orphans = await WorkSession.find({ jobPostingId: team.jobPostingId });
  if (orphans.length) {
    for (const session of orphans) {
      const member = (team.members || []).find(
        (m) => String(m.freelancerId) === String(session.freelancerId),
      );
      if (!member) continue;

      for (const u of session.progressUpdates || []) {
        const dup = (team.progressUpdates || []).some((t) =>
          String(t.authorId) === String(u.authorId || session.freelancerId)
          && t.title === u.title
          && String(t.body || '') === String(u.body || '')
          && new Date(t.createdAt || 0).getTime() === new Date(u.createdAt || 0).getTime());
        if (dup) continue;
        team.progressUpdates.push({
          number: (team.progressUpdates?.length || 0) + 1,
          type: u.type || 'note',
          title: u.title,
          body: u.body || '',
          roleKey: member.roleKey,
          authorId: u.authorId || session.freelancerId,
          attachments: (u.attachments || []).map((a) => ({
            fileName: a.fileName,
            filePath: a.filePath,
            mimeType: a.mimeType,
            fileSize: a.fileSize,
          })),
          reviewStatus: u.reviewStatus || 'pending',
          reviewComment: u.reviewComment || '',
          reviewedAt: u.reviewedAt || undefined,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        });
        changed = true;
      }

      if (session.status !== 'not_started' || (session.progressUpdates || []).length) {
        if (member.roleStatus === 'not_started') {
          member.roleStatus = 'in_progress';
          member.startedAt = session.startedAt || new Date();
          changed = true;
        }
        if (team.status === 'not_started') {
          team.status = 'in_progress';
          changed = true;
        }
      }

      if ((!team.guidelines || !team.guidelines.length) && session.guidelines?.length) {
        team.guidelines = session.guidelines.map((g) => ({
          text: g.text,
          category: g.category || 'submission',
          checked: !!g.checked,
        }));
        changed = true;
      } else if (team.guidelines?.length && session.guidelines?.length) {
        for (const sg of session.guidelines) {
          const match = team.guidelines.find((g) => g.text === sg.text);
          if (match && sg.checked && !match.checked) {
            match.checked = true;
            changed = true;
          }
        }
      }
    }

    (team.progressUpdates || []).forEach((u, i) => {
      u.number = i + 1;
    });

    await WorkSession.deleteMany({ jobPostingId: team.jobPostingId });
    changed = true;
  }

  if (changed) await team.save();
  return team;
};

const serializeTeam = async (team, viewerRole, viewerId) => {
  const ids = [
    team.employerId,
    ...(team.members || []).map((m) => m.freelancerId),
  ];
  const users = await User.find({ _id: { $in: ids } })
    .select('firstName lastName organizationName profilePicture role')
    .lean();
  const map = Object.fromEntries(users.map((u) => [String(u._id), u]));

  const myMember = (team.members || []).find((m) => String(m.freelancerId) === String(viewerId));
  const allRolesFinalized = (team.members || []).every((m) =>
    ['role_finalized', 'paid', 'certified'].includes(m.roleStatus),
  );
  const bill = (team.members || []).map((m) => {
    const parts = splitJobPayment(m.splitAmount);
    return {
      roleKey: m.roleKey,
      roleName: m.roleName,
      freelancerId: String(m.freelancerId),
      freelancerName: displayName(map[String(m.freelancerId)]),
      ...parts,
    };
  });

  const guidelines = (team.guidelines || []).map((g) => ({
    id: g._id,
    text: g.text,
    category: g.category || 'submission',
    checked: !!g.checked,
  }));

  return {
    id: team._id,
    jobPostingId: team.jobPostingId,
    role: viewerRole,
    title: team.title,
    organizationName: team.organizationName,
    description: team.description || '',
    category: team.category,
    categoryLabel: CATEGORY_LABELS[team.category] || team.category || 'Multi-role',
    deadline: team.deadline,
    status: team.status,
    paymentRef: team.paymentRef,
    freelancerGroupConversationId: team.freelancerGroupConversationId || null,
    projectGroupConversationId: team.projectGroupConversationId || null,
    myRoleKey: myMember?.roleKey || null,
    myRoleName: myMember?.roleName || null,
    myRoleStatus: myMember?.roleStatus || null,
    allRolesFinalized,
    canStart: viewerRole === 'freelancer' && myMember?.roleStatus === 'not_started',
    canPostUpdate: viewerRole === 'freelancer'
      && myMember?.roleStatus === 'in_progress'
      && !['awaiting_payment', 'paid', 'certified'].includes(team.status),
    canToggleGuidelines: viewerRole === 'freelancer'
      && myMember?.roleStatus === 'in_progress'
      && team.status === 'in_progress',
    canFinalizeMyRole: viewerRole === 'employer'
      && team.status === 'in_progress'
      && (team.members || []).some((m) => m.roleStatus === 'in_progress'),
    canMarkComplete: viewerRole === 'employer' && allRolesFinalized && team.status === 'in_progress',
    canPay: viewerRole === 'employer' && team.status === 'awaiting_payment',
    rolesFinalizedCount: (team.members || []).filter((m) =>
      ['role_finalized', 'paid', 'certified'].includes(m.roleStatus)).length,
    rolesTotal: (team.members || []).length,
    guidelines,
    members: (team.members || []).map((m) => ({
      freelancerId: String(m.freelancerId),
      name: displayName(map[String(m.freelancerId)]),
      profilePicture: map[String(m.freelancerId)]?.profilePicture || '',
      roleKey: m.roleKey,
      roleName: m.roleName,
      splitAmount: m.splitAmount,
      roleStatus: m.roleStatus,
      certificateId: m.certificateId || '',
    })),
    bill,
    progressUpdates: (team.progressUpdates || []).map((u) => {
      const member = (team.members || []).find((m) => m.roleKey === u.roleKey);
      const reviewStatus = u.reviewStatus || 'pending';
      const canReviewDraft = viewerRole === 'employer'
        && team.status === 'in_progress'
        && reviewStatus === 'pending'
        && member
        && !['role_finalized', 'paid', 'certified'].includes(member.roleStatus);
      return {
        id: u._id,
        number: u.number,
        type: u.type,
        title: u.title,
        body: u.body || '',
        roleKey: u.roleKey || '',
        roleName: member?.roleName || '',
        authorId: String(u.authorId),
        authorName: displayName(map[String(u.authorId)]),
        attachments: (u.attachments || []).map((a) => ({
          id: a._id,
          fileName: a.fileName,
          filePath: a.filePath,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
        })),
        reviewStatus,
        reviewComment: u.reviewComment || '',
        reviewedAt: u.reviewedAt || null,
        createdAt: u.createdAt,
        canReviewDraft,
      };
    }),
    totalGross: bill.reduce((s, b) => s + (Number(b.gross) || 0), 0),
    totalFee: bill.reduce((s, b) => s + (Number(b.fee) || 0), 0),
    totalNet: bill.reduce((s, b) => s + (Number(b.net) || 0), 0),
    updatedAt: team.updatedAt,
  };
};

const loadTeamOr404 = async (req, res) => {
  const team = await TeamWorkspace.findById(req.params.teamId);
  if (!team) {
    res.status(404).json({ message: 'Team workspace not found' });
    return null;
  }
  const role = assertTeamAccess(team, req.user);
  if (!role) {
    res.status(403).json({ message: 'You do not have access to this team workspace' });
    return null;
  }
  return { team, role };
};

export const listMyTeamWorkspaces = async (req, res) => {
  try {
    const filter = req.user.role === 'employer'
      ? { employerId: req.user._id }
      : { 'members.freelancerId': req.user._id };
    const rows = await TeamWorkspace.find(filter).sort({ updatedAt: -1 });
    const sessions = [];
    for (const team of rows) {
      const role = assertTeamAccess(team, req.user);
      sessions.push(await serializeTeam(team, role, req.user._id));
    }
    res.json({ teams: sessions });
  } catch (err) {
    console.error('List team workspaces error:', err);
    res.status(500).json({ message: 'Failed to load team workspaces' });
  }
};

export const getTeamWorkspace = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const team = await hydrateTeamWorkspace(loaded.team);
    res.json({ team: await serializeTeam(team, loaded.role, req.user._id) });
  } catch (err) {
    console.error('Get team workspace error:', err);
    res.status(500).json({ message: 'Failed to load team workspace' });
  }
};

export const startTeamRole = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const { team, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can start their role' });
    }
    const member = team.members.find((m) => String(m.freelancerId) === String(req.user._id));
    if (!member) return res.status(404).json({ message: 'You are not on this team' });
    if (member.roleStatus !== 'not_started') {
      return res.status(400).json({ message: 'Your role already started' });
    }
    member.roleStatus = 'in_progress';
    member.startedAt = new Date();
    if (team.status === 'not_started') team.status = 'in_progress';
    await team.save();

    await notifyUser({
      userId: team.employerId,
      type: 'work_started',
      title: 'Team member started',
      message: `${displayName(req.user)} started their ${member.roleName || 'role'} on "${team.title}".`,
      link: `/employer/team-workspace/${team._id}`,
      meta: { teamWorkspaceId: team._id },
    });

    res.json({ message: 'Role started', team: await serializeTeam(team, role, req.user._id) });
  } catch (err) {
    console.error('Start team role error:', err);
    res.status(500).json({ message: 'Failed to start role' });
  }
};

export const addTeamProgressUpdate = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const { team, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can post shared drafts' });
    }
    const member = team.members.find((m) => String(m.freelancerId) === String(req.user._id));
    if (!member || member.roleStatus === 'not_started') {
      return res.status(400).json({ message: 'Start your role before posting updates' });
    }
    if (['awaiting_payment', 'paid', 'certified'].includes(team.status)) {
      return res.status(400).json({ message: 'Project is already closed for updates' });
    }

    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    const type = ['file', 'repo', 'preview', 'video', 'note'].includes(req.body.type) ? req.body.type : 'note';
    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files.map((f) => ({
      fileName: f.originalname,
      filePath: `/uploads/workspace/${f.filename}`,
      mimeType: f.mimetype || '',
      fileSize: f.size || 0,
    }));
    if (!title) return res.status(400).json({ message: 'Update title is required' });
    if (type === 'file' && !attachments.length) {
      return res.status(400).json({ message: 'Attach at least one file' });
    }
    if (type !== 'file' && !body) {
      return res.status(400).json({ message: 'Update content is required' });
    }

    team.progressUpdates.push({
      number: team.progressUpdates.length + 1,
      type,
      title,
      body,
      roleKey: member.roleKey,
      authorId: req.user._id,
      attachments,
      reviewStatus: 'pending',
    });
    await team.save();

    const others = team.members
      .filter((m) => String(m.freelancerId) !== String(req.user._id))
      .map((m) => m.freelancerId);
    await Promise.all([
      ...others.map((uid) =>
        notifyUser({
          userId: uid,
          type: 'draft_uploaded',
          title: 'New shared draft',
          message: `${displayName(req.user)} posted "${title}" in the shared workspace for "${team.title}".`,
          link: `/dashboard/team-workspace/${team._id}`,
          meta: { teamWorkspaceId: team._id },
        }),
      ),
      notifyUser({
        userId: team.employerId,
        type: 'draft_uploaded',
        title: 'New team draft',
        message: `${displayName(req.user)} (${member.roleName}) posted "${title}" on "${team.title}".`,
        link: `/employer/team-workspace/${team._id}`,
        meta: { teamWorkspaceId: team._id },
      }),
    ]);

    res.status(201).json({
      message: 'Shared update posted',
      team: await serializeTeam(team, role, req.user._id),
    });
  } catch (err) {
    console.error('Add team update error:', err);
    res.status(500).json({ message: err.message || 'Failed to post update' });
  }
};

export const reviewTeamUpdate = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const { team, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the employer can review drafts' });
    }
    if (team.status !== 'in_progress') {
      return res.status(400).json({ message: 'Draft review is only available while the project is in progress' });
    }

    const update = team.progressUpdates.id(req.params.updateId);
    if (!update) return res.status(404).json({ message: 'Draft not found' });
    if ((update.reviewStatus || 'pending') !== 'pending') {
      return res.status(400).json({ message: 'This draft already has a decision' });
    }

    const raw = String(req.body.decision || '').trim();
    const decisionMap = {
      approved_new_draft: 'approved_new_draft',
      approved_complete: 'approved_complete',
      changes_requested: 'changes_requested',
      approved: 'approved_new_draft',
      disapproved: 'changes_requested',
    };
    const decision = decisionMap[raw];
    if (!decision) return res.status(400).json({ message: 'Invalid review decision' });

    const comment = String(req.body.comment || req.body.note || '').trim();
    if (!comment) return res.status(400).json({ message: 'A comment is required' });

    const member = team.members.find((m) => m.roleKey === update.roleKey);
    if (!member) return res.status(400).json({ message: 'Role for this draft was not found' });
    if (['role_finalized', 'paid', 'certified'].includes(member.roleStatus)) {
      return res.status(400).json({ message: 'This role is already finalized' });
    }

    update.reviewStatus = decision;
    update.reviewComment = comment;
    update.reviewedAt = new Date();

    if (decision === 'approved_complete') {
      member.roleStatus = 'role_finalized';
      member.roleFinalizedAt = new Date();
    } else if (member.roleStatus === 'not_started') {
      member.roleStatus = 'in_progress';
    }

    await team.save();

    const allFinalized = team.members.every((m) =>
      ['role_finalized', 'paid', 'certified'].includes(m.roleStatus),
    );

    await notifyUser({
      userId: member.freelancerId,
      type: decision === 'approved_complete' ? 'project_finalized' : 'employer_feedback',
      title: decision === 'approved_complete'
        ? 'Your role was approved'
        : decision === 'changes_requested'
          ? 'Changes requested on your draft'
          : 'Draft approved — new draft needed',
      message: decision === 'approved_complete'
        ? `${team.organizationName} approved your ${member.roleName || 'role'} on "${team.title}".${allFinalized ? ' All roles are now finalized — project can move to payment.' : ' Waiting for other roles to finish.'}`
        : `${team.organizationName} reviewed draft #${update.number} on "${team.title}": ${comment}`,
      link: `/dashboard/team-workspace/${team._id}`,
      meta: { teamWorkspaceId: team._id, roleKey: member.roleKey, decision },
    });

    res.json({
      message: decision === 'approved_complete'
        ? (allFinalized
          ? 'Role finalized. All roles are complete — you can mark the project complete and pay.'
          : 'Role finalized. Other roles still need to finish.')
        : decision === 'changes_requested'
          ? 'Changes requested on this draft.'
          : 'Draft approved. A new draft is required for this role.',
      team: await serializeTeam(team, role, req.user._id),
      allRolesFinalized: allFinalized,
    });
  } catch (err) {
    console.error('Review team update error:', err);
    res.status(500).json({ message: err.message || 'Failed to review draft' });
  }
};

export const finalizeTeamRole = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const { team, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the employer can finalize a role' });
    }
    const roleKey = String(req.body.roleKey || '');
    const member = team.members.find((m) => m.roleKey === roleKey);
    if (!member) return res.status(404).json({ message: 'Role not found on this team' });
    if (member.roleStatus !== 'in_progress') {
      return res.status(400).json({ message: 'Role must be in progress to finalize' });
    }
    member.roleStatus = 'role_finalized';
    member.roleFinalizedAt = new Date();
    await team.save();

    await notifyUser({
      userId: member.freelancerId,
      type: 'project_finalized',
      title: 'Your role was finalized',
      message: `${team.organizationName} finalized your ${member.roleName || 'role'} on "${team.title}".`,
      link: `/dashboard/team-workspace/${team._id}`,
      meta: { teamWorkspaceId: team._id, roleKey },
    });

    res.json({
      message: `Role "${member.roleName}" finalized`,
      team: await serializeTeam(team, role, req.user._id),
    });
  } catch (err) {
    console.error('Finalize team role error:', err);
    res.status(500).json({ message: 'Failed to finalize role' });
  }
};

export const completeTeamProject = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const { team, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the employer can complete the project' });
    }
    const allFinalized = team.members.every((m) =>
      ['role_finalized', 'paid', 'certified'].includes(m.roleStatus),
    );
    if (!allFinalized) {
      return res.status(400).json({ message: 'Finalize every role before marking the project complete' });
    }
    team.status = 'awaiting_payment';
    await team.save();
    res.json({
      message: 'Project complete. Review the split bill and pay each freelancer.',
      team: await serializeTeam(team, role, req.user._id),
    });
  } catch (err) {
    console.error('Complete team project error:', err);
    res.status(500).json({ message: 'Failed to complete project' });
  }
};

export const payTeamWorkspace = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const { team, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the employer can pay the team' });
    }
    const result = await settleTeamWorkspaceToWallets(team);
    res.json({
      message: 'Split bill paid. Certificates issued to each freelancer.',
      ...result,
      team: await serializeTeam(result.team, role, req.user._id),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('Pay team workspace error:', err);
    res.status(status).json({
      message: err.message || 'Failed to pay team',
      code: err.code,
      availableBalance: err.availableBalance,
    });
  }
};

export const toggleTeamGuideline = async (req, res) => {
  try {
    const loaded = await loadTeamOr404(req, res);
    if (!loaded) return;
    const { team, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can check off guidelines' });
    }
    const member = team.members.find((m) => String(m.freelancerId) === String(req.user._id));
    if (!member || member.roleStatus !== 'in_progress' || team.status !== 'in_progress') {
      return res.status(400).json({ message: 'Guidelines can only be updated while your role is in progress' });
    }
    const guideline = team.guidelines.id(req.params.guidelineId);
    if (!guideline) return res.status(404).json({ message: 'Guideline not found' });
    const next = typeof req.body.checked === 'boolean' ? req.body.checked : !guideline.checked;
    guideline.checked = next;
    await team.save();
    res.json({ message: 'Guideline updated', team: await serializeTeam(team, role, req.user._id) });
  } catch (err) {
    console.error('Toggle team guideline error:', err);
    res.status(500).json({ message: 'Failed to update guideline' });
  }
};

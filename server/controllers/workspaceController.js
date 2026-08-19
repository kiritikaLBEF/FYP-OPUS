import WorkSession from '../models/WorkSession.js';
import JobApplication from '../models/JobApplication.js';
import JobPosting from '../models/JobPosting.js';
import User from '../models/User.js';
import { sendEmail } from '../utils/email.js';
import { generateCertificatePdf } from '../utils/certificatePdf.js';
import { notifyUser } from '../utils/notify.js';
import { settleJobToFreelancerWallet, splitJobPayment } from '../utils/walletLedger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certificatesDir = path.join(__dirname, '../uploads/certificates');

const ensureCertificatesDir = () => {
  if (!fs.existsSync(certificatesDir)) fs.mkdirSync(certificatesDir, { recursive: true });
};

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

const CONTENT_TYPES = new Set(['file', 'repo', 'preview', 'video', 'note']);

const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
};

const makeRef = (prefix, seed) =>
  `${prefix}-${Math.abs(hashStr(seed)).toString(36).toUpperCase().slice(0, 8)}`;

const amountFromJob = (job) =>
  (job?.budgetType === 'hourly' ? job?.hourlyRate : job?.budget) || 0;

const inferGuidelineCategory = (text = '') => {
  const t = text.toLowerCase();
  if (/\b(figma|design|ui|ux|visual|brand|layout|color|typography)\b/.test(t)) return 'design';
  if (/\b(code|api|test|react|node|database|ios|android|technical|integrate|unit)\b/.test(t)) {
    return 'technical';
  }
  return 'submission';
};

const buildGuidelinesFromJob = (jobDoc) => {
  const conditions = Array.isArray(jobDoc?.conditions) ? jobDoc.conditions.filter(Boolean) : [];
  return conditions.map((text) => ({
    text: String(text).trim(),
    category: inferGuidelineCategory(text),
    checked: false,
  }));
};

const normalizeLegacyStatus = (status) => {
  if (status === 'finalized') return 'final_submitted';
  return status;
};

export const ensureWorkSessionForApplication = async (application, job) => {
  if (!application || application.status !== 'accepted') return null;

  let session = await WorkSession.findOne({ applicationId: application._id });
  if (session) return session;

  const jobDoc = job || await JobPosting.findById(application.jobPostingId).lean();
  session = await WorkSession.create({
    applicationId: application._id,
    jobPostingId: application.jobPostingId,
    freelancerId: application.freelancerId,
    employerId: application.employerId,
    title: application.jobTitle || jobDoc?.title || 'Project',
    organizationName: application.organizationName || jobDoc?.organizationName || 'Organization',
    description: jobDoc?.description || '',
    category: jobDoc?.category || 'other',
    bidAmount: Number(application.amount) > 0 ? Number(application.amount) : amountFromJob(jobDoc),
    budgetType: jobDoc?.budgetType || 'fixed',
    deadline: jobDoc?.applicationDeadline || null,
    status: 'not_started',
    finalizationUnlocked: false,
    guidelines: buildGuidelinesFromJob(jobDoc),
    progressUpdates: [],
    feedbackLog: [],
    messages: [],
    deliveryRound: 0,
    paymentRef: makeRef('OPUS-PAY', `${application._id}-pay`),
    certificateId: makeRef('OPUS-CERT', `${application._id}-cert`),
  });
  return session;
};

const hydrateSessionFromJob = async (session) => {
  let changed = false;

  if (session.status === 'finalized') {
    session.status = 'final_submitted';
    changed = true;
  }

  const needsGuidelines = !Array.isArray(session.guidelines) || session.guidelines.length === 0;
  const needsDescription = !session.description;
  if (needsGuidelines || needsDescription) {
    const job = await JobPosting.findById(session.jobPostingId)
      .select('description conditions')
      .lean();
    if (job) {
      if (needsDescription && job.description) {
        session.description = job.description;
        changed = true;
      }
      if (needsGuidelines) {
        const fromJob = buildGuidelinesFromJob(job);
        const fromLegacy = Array.isArray(session.conditions)
          ? session.conditions.filter(Boolean).map((text) => ({
              text: String(text).trim(),
              category: inferGuidelineCategory(text),
              checked: false,
            }))
          : [];
        const next = fromJob.length ? fromJob : fromLegacy;
        if (next.length) {
          session.guidelines = next;
          changed = true;
        }
      }
    }
  }

  // Migrate legacy drafts → progress updates (one-time soft migration)
  if ((!session.progressUpdates || session.progressUpdates.length === 0) && session.drafts?.length) {
    session.progressUpdates = session.drafts.map((d, i) => ({
      number: d.number || i + 1,
      type: d.fileName ? 'file' : 'note',
      title: d.title || `Update ${i + 1}`,
      body: d.fileName || d.notes || '',
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
    changed = true;
  }

  if (changed) await session.save();
  return session;
};

const assertAccess = (session, user) => {
  const uid = String(user._id);
  if (String(session.freelancerId) === uid) return 'freelancer';
  if (String(session.employerId) === uid) return 'employer';
  return null;
};

const mapAttachment = (a) => ({
  id: a._id,
  fileName: a.fileName || '',
  filePath: a.filePath || '',
  mimeType: a.mimeType || '',
  fileSize: a.fileSize || 0,
});

const filesFromRequest = (req) => {
  const list = Array.isArray(req.files) ? req.files : [];
  return list.map((f) => ({
    fileName: f.originalname,
    filePath: `/uploads/workspace/${f.filename}`,
    mimeType: f.mimetype || '',
    fileSize: f.size || 0,
  }));
};

const displayUserName = (user) => {
  if (!user) return 'Freelancer';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.name || user.username || 'Freelancer';
};

const serializeSession = (session, role, extras = {}) => {
  const status = normalizeLegacyStatus(session.status);
  const guidelines = (session.guidelines || []).map((g) => ({
    id: g._id,
    text: g.text,
    category: g.category || 'submission',
    checked: !!g.checked,
  }));
  const allGuidelinesChecked =
    guidelines.length === 0 ? true : guidelines.every((g) => g.checked);
  const updates = session.progressUpdates || [];
  const unresolvedFeedback = (session.feedbackLog || []).filter((f) => !f.resolved).length;
  const finalizationUnlocked = !!session.finalizationUnlocked;
  const hasProgress = updates.length > 0;
  const latestUpdateNumber = updates.reduce((max, u) => Math.max(max, u.number || 0), 0);
  const freelancerName = extras.freelancerName || 'Freelancer';
  const startReminderSent = !!session.startReminderSentAt;

  return {
    id: session._id,
    applicationId: session.applicationId,
    jobPostingId: session.jobPostingId,
    role,
    title: session.title,
    organizationName: session.organizationName,
    freelancerName,
    description: session.description || '',
    category: session.category,
    categoryLabel: CATEGORY_LABELS[session.category] || session.category,
    bidAmount: session.bidAmount,
    paymentBreakdown: splitJobPayment(session.bidAmount),
    budgetType: session.budgetType,
    deadline: session.deadline,
    status,
    finalizationUnlocked,
    startReminderSent,
    startReminderSentAt: session.startReminderSentAt || null,
    canSendStartReminder: role === 'employer' && status === 'not_started',
    guidelines,
    allGuidelinesChecked,
    progressUpdates: updates.map((u) => {
      const reviewStatus = u.reviewStatus || 'pending';
      const isLatest = u.number === latestUpdateNumber;
      const canReviewDraft =
        role === 'employer'
        && status === 'in_progress'
        && reviewStatus === 'pending';
      const canRevertDraft =
        role === 'employer'
        && status === 'in_progress'
        && reviewStatus !== 'pending'
        && reviewStatus !== 'approved_complete'
        && isLatest;
      return {
        id: u._id,
        number: u.number,
        type: u.type,
        title: u.title,
        body: u.body || '',
        attachments: (u.attachments || []).map(mapAttachment),
        createdAt: u.createdAt,
        reviewStatus,
        reviewComment: u.reviewComment || '',
        reviewedAt: u.reviewedAt || null,
        canReviewDraft,
        canRevertDraft,
      };
    }),
    finalDelivery: session.finalDelivery
      ? {
          type: session.finalDelivery.type,
          body: session.finalDelivery.body || '',
          notes: session.finalDelivery.notes || '',
          techStack: session.finalDelivery.techStack || '',
          setupNotes: session.finalDelivery.setupNotes || '',
          attachments: (session.finalDelivery.attachments || []).map(mapAttachment),
          round: session.finalDelivery.round,
          submittedAt: session.finalDelivery.submittedAt,
        }
      : null,
    feedbackLog: (session.feedbackLog || []).map((f) => ({
      id: f._id,
      round: f.round,
      kind: f.kind || 'next_draft',
      text: f.text,
      resolved: !!f.resolved,
      createdAt: f.createdAt,
      relatedUpdateId: f.relatedUpdateId || null,
      relatedUpdateNumber: f.relatedUpdateNumber || null,
      relatedDelivery: f.relatedDelivery
        ? {
            type: f.relatedDelivery.type,
            body: f.relatedDelivery.body || '',
            notes: f.relatedDelivery.notes || '',
            techStack: f.relatedDelivery.techStack || '',
            setupNotes: f.relatedDelivery.setupNotes || '',
            submittedAt: f.relatedDelivery.submittedAt,
            attachments: (f.relatedDelivery.attachments || []).map(mapAttachment),
          }
        : null,
    })),
    messages: (session.messages || []).map((m) => ({
      id: m._id,
      authorRole: m.authorRole,
      text: m.text,
      createdAt: m.createdAt,
    })),
    deliveryRound: session.deliveryRound || 0,
    unresolvedFeedback,
    paymentRef: session.paymentRef,
    certificateId: session.certificateId,
    certificateFilePath: session.certificateFilePath || '',
    certificateAddedToProfile: !!session.certificateAddedToProfile,
    startedAt: session.startedAt,
    finalizedAt: session.finalizedAt,
    paidAt: session.paidAt,
    certifiedAt: session.certifiedAt,
    updatedAt: session.updatedAt,
    canPostUpdate: role === 'freelancer' && status === 'in_progress',
    canToggleGuidelines: role === 'freelancer' && status === 'in_progress',
    canProceedForFinalization:
      role === 'employer'
      && status === 'in_progress'
      && hasProgress
      && !finalizationUnlocked,
    canSubmitFinal:
      role === 'freelancer'
      && status === 'in_progress'
      && finalizationUnlocked
      && allGuidelinesChecked,
    finalDeliveryLocked:
      role === 'freelancer'
      && status === 'in_progress'
      && !finalizationUnlocked,
    canAcceptFinal: role === 'employer' && status === 'final_submitted',
    canRequestChanges: role === 'employer' && status === 'final_submitted',
    showEmployerDecisionPanel:
      role === 'employer'
      && (status === 'in_progress' || status === 'final_submitted'),
  };
};

const loadSessionOr404 = async (req, res) => {
  const session = await WorkSession.findById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ message: 'Workspace not found' });
    return null;
  }
  const role = assertAccess(session, req.user);
  if (!role) {
    res.status(403).json({ message: 'You do not have access to this workspace' });
    return null;
  }
  return { session, role };
};

const serializeSessionAsync = async (session, role) => {
  const freel = await User.findById(session.freelancerId)
    .select('name firstName lastName username')
    .lean();
  return serializeSession(session, role, { freelancerName: displayUserName(freel) });
};

export const listMyWorkSessions = async (req, res) => {
  try {
    const isFreelancer = req.user.role === 'freelancer';
    const filter = isFreelancer
      ? { freelancerId: req.user._id }
      : { employerId: req.user._id };

    const sessions = await WorkSession.find(filter).sort({ updatedAt: -1 });
    const serialized = [];
    for (const raw of sessions) {
      const session = await hydrateSessionFromJob(raw);
      serialized.push(await serializeSessionAsync(session, isFreelancer ? 'freelancer' : 'employer'));
    }
    res.json({
      sessions: serialized,
      acceptedCount: serialized.filter((s) => s.status !== 'certified').length,
    });
  } catch (err) {
    console.error('List work sessions error:', err);
    res.status(500).json({ message: 'Failed to load workspaces' });
  }
};

export const getWorkSession = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const session = await hydrateSessionFromJob(loaded.session);
    res.json({ session: await serializeSessionAsync(session, loaded.role) });
  } catch (err) {
    console.error('Get work session error:', err);
    res.status(500).json({ message: 'Failed to load workspace' });
  }
};

export const startWorkSession = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only the freelancer can start work' });
    }
    if (session.status !== 'not_started') {
      return res.status(400).json({ message: 'Work has already been started' });
    }
    session.status = 'in_progress';
    session.startedAt = new Date();
    await session.save();

    const freelancer = await User.findById(session.freelancerId).select('firstName lastName name');
    const freelancerName = displayUserName(freelancer) || 'Your freelancer';
    await notifyUser({
      userId: session.employerId,
      type: 'work_started',
      title: 'Work started',
      message: `${freelancerName} started work on "${session.title}".`,
      link: `/employer/workspace/${session._id}`,
      meta: { workspaceId: session._id, jobId: session.jobPostingId },
    });

    res.json({ message: 'Work started', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Start work session error:', err);
    res.status(500).json({ message: 'Failed to start work' });
  }
};

export const sendStartReminder = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can send a start reminder' });
    }
    if (session.status !== 'not_started') {
      return res.status(400).json({ message: 'The freelancer has already started this project' });
    }

    const freelancer = await User.findById(session.freelancerId).select('email name firstName lastName');
    if (!freelancer?.email) {
      return res.status(400).json({ message: 'Freelancer email is not available' });
    }

    const freelancerName = displayUserName(freelancer);
    const org = session.organizationName || 'The organization';
    const taskTitle = session.title || 'your project';
    const subject = `${org} sent you a reminder to start on OPUS`;
    const body =
      `Hi ${freelancerName},\n\n`
      + `${org} has sent you a reminder to start the project "${taskTitle}" on OPUS.\n\n`
      + `Your bid was accepted and the task workspace is ready. Please open your OPUS dashboard, `
      + `go to My Bids / Task Workspace, and click "Start working" when you are ready to begin.\n\n`
      + `Starting promptly helps the organization plan reviews and keeps the project on schedule. `
      + `If you have any questions before starting, you can message them from the workspace Discussion tab.\n\n`
      + `Thank you,\n`
      + `The OPUS team`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#14161F;">
        <h2 style="margin:0 0 12px;font-size:20px;color:#0071e3;">Reminder to start your project</h2>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hi ${freelancerName},</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
          <strong>${org}</strong> has sent you a reminder to start the project
          <strong>"${taskTitle}"</strong> on OPUS.
        </p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
          Your bid was accepted and the task workspace is ready. Please open your OPUS dashboard,
          go to <strong>My Bids → Task Workspace</strong>, and click <strong>Start working</strong>
          when you are ready to begin.
        </p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
          Starting promptly helps the organization plan reviews and keeps the project on schedule.
          If you have any questions before starting, you can message them from the workspace Discussion tab.
        </p>
        <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">Thank you,<br/>The OPUS team</p>
      </div>
    `;

    await sendEmail(freelancer.email, subject, body, {
      fromName: 'OPUS Projects',
      html,
    });

    session.startReminderSentAt = new Date();
    session.messages.push({
      authorId: req.user._id,
      authorRole: 'employer',
      text: `Sent a reminder to ${freelancerName} to start the project.`,
    });
    await session.save();

    await notifyUser({
      userId: session.freelancerId,
      type: 'start_reminder',
      title: 'Reminder to start',
      message: `${org} reminded you to start "${taskTitle}".`,
      link: `/dashboard/workspace/${session._id}`,
      meta: { workspaceId: session._id, jobId: session.jobPostingId },
    });

    res.json({
      message: 'Reminder sent',
      session: await serializeSessionAsync(session, role),
    });
  } catch (err) {
    console.error('Send start reminder error:', err);
    res.status(500).json({ message: err.message || 'Failed to send reminder email' });
  }
};

export const addProgressUpdate = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only the freelancer can post progress updates' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ message: 'Progress updates are only allowed while work is in progress' });
    }

    const type = CONTENT_TYPES.has(req.body.type) ? req.body.type : 'note';
    const title = (req.body.title || '').trim();
    const body = (req.body.body || '').trim();
    const attachments = filesFromRequest(req);

    if (!title) return res.status(400).json({ message: 'Update title is required' });
    if (type === 'file') {
      if (!attachments.length) {
        return res.status(400).json({ message: 'Attach at least one file' });
      }
    } else if (!body) {
      return res.status(400).json({ message: 'Update content is required' });
    }

    session.progressUpdates.push({
      number: session.progressUpdates.length + 1,
      type,
      title,
      body,
      attachments,
      reviewStatus: 'pending',
      reviewComment: '',
    });
    await session.save();

    const draftNumber = session.progressUpdates.length;
    await notifyUser({
      userId: session.employerId,
      type: 'draft_uploaded',
      title: 'New draft uploaded',
      message: `A new draft (#${draftNumber}: ${title}) was uploaded for "${session.title}".`,
      link: `/employer/workspace/${session._id}`,
      meta: { workspaceId: session._id, jobId: session.jobPostingId },
    });

    res.status(201).json({ message: 'Progress update posted', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Add progress update error:', err);
    res.status(500).json({ message: err.message || 'Failed to post progress update' });
  }
};

export const reviewProgressUpdate = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can review drafts' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ message: 'Draft review is only available while work is in progress' });
    }

    const update = session.progressUpdates.id(req.params.updateId);
    if (!update) return res.status(404).json({ message: 'Draft not found' });
    if ((update.reviewStatus || 'pending') !== 'pending') {
      return res.status(400).json({ message: 'This draft already has a decision. Revert it first to change.' });
    }

    const raw = String(req.body.decision || '').trim();
    const decisionMap = {
      approved_new_draft: 'approved_new_draft',
      approved_complete: 'approved_complete',
      changes_requested: 'changes_requested',
      // legacy aliases
      approved: 'approved_new_draft',
      disapproved: 'changes_requested',
    };
    const decision = decisionMap[raw];
    if (!decision) {
      return res.status(400).json({ message: 'Invalid review decision' });
    }

    const comment = (req.body.comment || req.body.note || '').trim();
    if (!comment) {
      return res.status(400).json({ message: 'A comment is required' });
    }

    update.reviewStatus = decision;
    update.reviewComment = comment;
    update.reviewedAt = new Date();

    const feedbackEntry = {
      round: update.number,
      kind: decision,
      text: comment,
      resolved: decision === 'approved_complete',
      relatedUpdateId: update._id,
      relatedUpdateNumber: update.number,
      relatedDelivery: {
        type: update.type,
        body: update.body || update.title || '',
        notes: '',
        techStack: '',
        setupNotes: '',
        submittedAt: update.createdAt,
        attachments: (update.attachments || []).map((a) => ({
          fileName: a.fileName,
          filePath: a.filePath,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
        })),
      },
    };
    session.feedbackLog.push(feedbackEntry);
    const savedFeedback = session.feedbackLog[session.feedbackLog.length - 1];
    update.reviewFeedbackId = savedFeedback._id;

    const labels = {
      approved_new_draft: `Approved draft ${update.number} and asked for a new draft.`,
      approved_complete: `Approved draft ${update.number} with no further drafts required. Project moved to payment.`,
      changes_requested: `Requested changes on draft ${update.number}.`,
    };
    session.messages.push({
      authorId: req.user._id,
      authorRole: 'employer',
      text: `${labels[decision]} See Feedback for the comment.`,
    });

    if (decision === 'approved_complete') {
      session.finalDelivery = {
        type: update.type || 'file',
        body: update.body || update.title || '',
        notes: comment,
        techStack: '',
        setupNotes: '',
        attachments: (update.attachments || []).map((a) => ({
          fileName: a.fileName,
          filePath: a.filePath,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
        })),
        round: (session.deliveryRound || 0) + 1,
        submittedAt: new Date(),
      };
      session.deliveryRound = (session.deliveryRound || 0) + 1;
      session.finalizationUnlocked = true;
      session.status = 'awaiting_payment';
      if (!session.paymentRef) {
        session.paymentRef = makeRef('OPUS-PAY', `${session._id}-pay`);
      }
      session.feedbackLog = (session.feedbackLog || []).map((f) => {
        f.resolved = true;
        return f;
      });
    }

    await session.save();

    const reviewNotices = {
      approved_new_draft: {
        title: 'Draft approved — new draft needed',
        message: `${session.organizationName || 'The organization'} approved draft ${update.number} for "${session.title}" and asked for another draft.`,
      },
      approved_complete: {
        title: 'Project finalized',
        message: `${session.organizationName || 'The organization'} approved draft ${update.number} as complete for "${session.title}". Payment is next.`,
      },
      changes_requested: {
        title: 'Feedback received',
        message: `${session.organizationName || 'The organization'} requested changes on draft ${update.number} for "${session.title}".`,
      },
    };
    const notice = reviewNotices[decision];
    if (notice) {
      await notifyUser({
        userId: session.freelancerId,
        type: decision === 'approved_complete' ? 'project_finalized' : 'employer_feedback',
        title: notice.title,
        message: notice.message,
        link: `/dashboard/workspace/${session._id}`,
        meta: { workspaceId: session._id, jobId: session.jobPostingId },
      });
    }

    const messages = {
      approved_new_draft: 'Draft approved. A new draft is required.',
      approved_complete: 'Draft approved as complete. Project moved to payment.',
      changes_requested: 'Changes requested on this draft.',
    };
    res.json({
      message: messages[decision],
      session: await serializeSessionAsync(session, role),
    });
  } catch (err) {
    console.error('Review progress update error:', err);
    res.status(500).json({ message: err.message || 'Failed to review draft' });
  }
};

export const revertProgressUpdateReview = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can revert a draft decision' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ message: 'Revert is only available while work is in progress' });
    }

    const update = session.progressUpdates.id(req.params.updateId);
    if (!update) return res.status(404).json({ message: 'Draft not found' });
    if ((update.reviewStatus || 'pending') === 'pending') {
      return res.status(400).json({ message: 'This draft has no decision to revert' });
    }
    if (update.reviewStatus === 'approved_complete') {
      return res.status(400).json({ message: 'Cannot revert a completed final approval' });
    }

    const latestNumber = (session.progressUpdates || []).reduce(
      (max, u) => Math.max(max, u.number || 0),
      0,
    );
    if (update.number !== latestNumber) {
      return res.status(400).json({
        message: 'Revert is only available on the latest draft. A newer draft was already uploaded.',
      });
    }

    if (update.reviewFeedbackId) {
      const fb = session.feedbackLog.id(update.reviewFeedbackId);
      if (fb) {
        session.feedbackLog.pull(fb._id);
      }
    } else {
      // Fallback: resolve matching feedback by related update
      session.feedbackLog = (session.feedbackLog || []).filter(
        (f) => String(f.relatedUpdateId || '') !== String(update._id),
      );
    }

    update.reviewStatus = 'pending';
    update.reviewComment = '';
    update.reviewedAt = undefined;
    update.reviewFeedbackId = undefined;

    session.messages.push({
      authorId: req.user._id,
      authorRole: 'employer',
      text: `Reverted the decision on draft ${update.number}.`,
    });

    await session.save();
    res.json({ message: 'Draft decision reverted', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Revert progress update review error:', err);
    res.status(500).json({ message: err.message || 'Failed to revert draft decision' });
  }
};

export const attachProgressUpdateFiles = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only the freelancer can attach files' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ message: 'Files can only be attached while work is in progress' });
    }

    const update = session.progressUpdates.id(req.params.updateId);
    if (!update) return res.status(404).json({ message: 'Progress update not found' });

    const attachments = filesFromRequest(req);
    if (!attachments.length) {
      return res.status(400).json({ message: 'Attach at least one file' });
    }

    update.attachments = [...(update.attachments || []), ...attachments];
    if (update.type === 'file') {
      const bodyLooksLikeName = /\.[a-z0-9]{2,5}$/i.test((update.body || '').trim())
        && !(update.body || '').includes(' ');
      if (bodyLooksLikeName) update.body = '';
    }

    await session.save();
    res.json({ message: 'Files attached', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Attach progress update files error:', err);
    res.status(500).json({ message: err.message || 'Failed to attach files' });
  }
};

export const attachFinalDeliveryFiles = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only the freelancer can attach files' });
    }
    if (!session.finalDelivery) {
      return res.status(400).json({ message: 'No final delivery to attach files to' });
    }
    if (!['in_progress', 'final_submitted'].includes(session.status)) {
      return res.status(400).json({ message: 'Cannot attach files in the current status' });
    }

    const attachments = filesFromRequest(req);
    if (!attachments.length) {
      return res.status(400).json({ message: 'Attach at least one file' });
    }

    session.finalDelivery.attachments = [
      ...(session.finalDelivery.attachments || []),
      ...attachments,
    ];
    if (session.finalDelivery.type === 'file') {
      const bodyLooksLikeName = /\.[a-z0-9]{2,5}$/i.test((session.finalDelivery.body || '').trim())
        && !(session.finalDelivery.body || '').includes(' ');
      if (bodyLooksLikeName) session.finalDelivery.body = '';
    }

    await session.save();
    res.json({ message: 'Files attached', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Attach final delivery files error:', err);
    res.status(500).json({ message: err.message || 'Failed to attach files' });
  }
};

export const toggleGuideline = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only the freelancer can check off guidelines' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ message: 'Guidelines can only be updated while work is in progress' });
    }

    const guideline = session.guidelines.id(req.params.guidelineId);
    if (!guideline) return res.status(404).json({ message: 'Guideline not found' });

    const next = typeof req.body.checked === 'boolean' ? req.body.checked : !guideline.checked;
    guideline.checked = next;
    await session.save();
    res.json({ message: 'Guideline updated', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Toggle guideline error:', err);
    res.status(500).json({ message: 'Failed to update guideline' });
  }
};

export const submitFinalDelivery = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only the freelancer can submit final delivery' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ message: 'Final delivery can only be submitted while work is in progress' });
    }
    if (!session.finalizationUnlocked) {
      return res.status(400).json({
        message: 'Final delivery is locked until the organization selects Proceed for finalization',
      });
    }

    const guidelines = session.guidelines || [];
    if (guidelines.length && !guidelines.every((g) => g.checked)) {
      return res.status(400).json({
        message: 'Check off every guideline before submitting final delivery',
      });
    }

    const type = CONTENT_TYPES.has(req.body.type) ? req.body.type : 'repo';
    const body = (req.body.body || '').trim();
    const attachments = filesFromRequest(req);
    if (type === 'file') {
      if (!attachments.length) {
        return res.status(400).json({ message: 'Attach at least one file for final delivery' });
      }
    } else if (!body) {
      return res.status(400).json({ message: 'Final delivery content is required' });
    }

    const nextRound = (session.deliveryRound || 0) + 1;
    session.finalDelivery = {
      type,
      body,
      notes: (req.body.notes || '').trim(),
      techStack: (req.body.techStack || '').trim(),
      setupNotes: (req.body.setupNotes || '').trim(),
      attachments,
      round: nextRound,
      submittedAt: new Date(),
    };
    session.deliveryRound = nextRound;
    session.status = 'final_submitted';
    session.finalizedAt = new Date();
    session.feedbackLog = (session.feedbackLog || []).map((f) => {
      f.resolved = true;
      return f;
    });
    await session.save();
    res.json({ message: 'Final delivery submitted', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Submit final delivery error:', err);
    res.status(500).json({ message: 'Failed to submit final delivery' });
  }
};

export const proceedForFinalization = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can unlock finalization' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ message: 'Work must be in progress to unlock finalization' });
    }
    if (!(session.progressUpdates || []).length) {
      return res.status(400).json({
        message: 'At least one progress update is required before unlocking finalization',
      });
    }

    session.finalizationUnlocked = true;
    await session.save();
    res.json({
      message: 'Finalization unlocked. The freelancer can now submit final delivery.',
      session: await serializeSessionAsync(session, role),
    });
  } catch (err) {
    console.error('Proceed for finalization error:', err);
    res.status(500).json({ message: 'Failed to unlock finalization' });
  }
};

export const acceptFinalDelivery = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can approve the work' });
    }

    const status = session.status;
    const hasProgress = (session.progressUpdates || []).length > 0;
    const canApprove =
      status === 'final_submitted'
      || status === 'finalized'
      || (status === 'in_progress' && hasProgress);

    if (!canApprove) {
      return res.status(400).json({ message: 'Nothing to approve yet. Wait for progress updates.' });
    }

    // If approving during in-progress without a formal final, snapshot latest update
    if (!session.finalDelivery && hasProgress) {
      const latest = session.progressUpdates[session.progressUpdates.length - 1];
      session.finalDelivery = {
        type: latest.type || 'note',
        body: latest.body || latest.title || '',
        notes: '',
        techStack: '',
        setupNotes: '',
        attachments: (latest.attachments || []).map((a) => ({
          fileName: a.fileName,
          filePath: a.filePath,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
        })),
        round: (session.deliveryRound || 0) + 1,
        submittedAt: latest.createdAt || new Date(),
      };
      session.deliveryRound = (session.deliveryRound || 0) + 1;
    }

    session.status = 'awaiting_payment';
    session.finalizationUnlocked = true;
    if (!session.paymentRef) {
      session.paymentRef = makeRef('OPUS-PAY', `${session._id}-pay`);
    }
    await session.save();
    res.json({ message: 'Work approved. Pay from your OPUS wallet or via eSewa / Khalti.', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Accept final delivery error:', err);
    res.status(500).json({ message: 'Failed to approve work' });
  }
};

export const requestFinalChanges = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can request changes' });
    }

    const status = session.status;
    const hasProgress = (session.progressUpdates || []).length > 0;
    const canRequest =
      status === 'final_submitted'
      || status === 'finalized'
      || (status === 'in_progress' && hasProgress);

    if (!canRequest) {
      return res.status(400).json({ message: 'Nothing to review yet. Wait for progress updates.' });
    }

    const text = (req.body.note || req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'A comment is required' });
    }

    const kind = req.body.kind === 'disapproved' ? 'disapproved' : 'next_draft';
    const round = session.finalDelivery?.round || session.deliveryRound || 1;

    let related;
    if (session.finalDelivery) {
      related = {
        type: session.finalDelivery.type,
        body: session.finalDelivery.body,
        notes: session.finalDelivery.notes || '',
        techStack: session.finalDelivery.techStack || '',
        setupNotes: session.finalDelivery.setupNotes || '',
        submittedAt: session.finalDelivery.submittedAt,
        attachments: (session.finalDelivery.attachments || []).map((a) => ({
          fileName: a.fileName,
          filePath: a.filePath,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
        })),
      };
    } else if (hasProgress) {
      const latest = session.progressUpdates[session.progressUpdates.length - 1];
      related = {
        type: latest.type || 'note',
        body: latest.body || latest.title || '',
        notes: '',
        techStack: '',
        setupNotes: '',
        submittedAt: latest.createdAt,
        attachments: (latest.attachments || []).map((a) => ({
          fileName: a.fileName,
          filePath: a.filePath,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
        })),
      };
    }

    session.feedbackLog.push({
      round,
      kind,
      text,
      resolved: false,
      relatedDelivery: related,
    });
    session.messages.push({
      authorId: req.user._id,
      authorRole: 'employer',
      text: kind === 'disapproved'
        ? 'Disapproved the work. See the Feedback tab for details.'
        : 'Requested the next draft. See the Feedback tab for details.',
    });
    session.status = 'in_progress';
    session.finalizationUnlocked = false;
    session.finalDelivery = undefined;
    session.markModified('finalDelivery');
    await session.save();
    res.json({
      message: kind === 'disapproved'
        ? 'Work disapproved. Feedback was added to the timeline.'
        : 'Next draft required. Feedback was added to the timeline.',
      session: await serializeSessionAsync(session, role),
    });
  } catch (err) {
    console.error('Request final changes error:', err);
    res.status(500).json({ message: 'Failed to request changes' });
  }
};

export const addWorkspaceMessage = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Message text is required' });

    session.messages.push({
      authorId: req.user._id,
      authorRole: role,
      text,
    });
    await session.save();
    res.status(201).json({ message: 'Message sent', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Add workspace message error:', err);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can pay from their OPUS wallet' });
    }
    if (session.status !== 'awaiting_payment') {
      return res.status(400).json({ message: 'Payment is not awaiting confirmation' });
    }

    await settleJobToFreelancerWallet({
      session,
      method: 'opus',
      employerPaidViaGateway: false,
    });

    res.json({
      message: 'Paid from OPUS wallet. Funds are now in the freelancer wallet.',
      session: await serializeSessionAsync(session, role),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('Confirm payment error:', err);
    res.status(status).json({
      message: err.message || 'Failed to confirm payment',
      code: err.code,
      availableBalance: err.availableBalance,
    });
  }
};

export const issueCertificate = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can issue a certificate' });
    }
    if (session.status !== 'paid') {
      return res.status(400).json({ message: 'Certificate can only be issued after payment' });
    }
    if (!session.certificateId) {
      session.certificateId = makeRef('OPUS-CERT', `${session._id}-cert`);
    }

    const freelancer = await User.findById(session.freelancerId);
    if (!freelancer) {
      return res.status(404).json({ message: 'Freelancer not found' });
    }
    const freelancerName = displayUserName(freelancer);
    const issuedAt = new Date();

    ensureCertificatesDir();
    const pdfBuffer = await generateCertificatePdf({
      certificateId: session.certificateId,
      freelancerName,
      taskTitle: session.title,
      organizationName: session.organizationName,
      issuedAt,
    });
    const safeId = String(session.certificateId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeId}.pdf`;
    const absolutePath = path.join(certificatesDir, fileName);
    fs.writeFileSync(absolutePath, pdfBuffer);
    session.certificateFilePath = `/uploads/certificates/${fileName}`;

    session.status = 'certified';
    session.certifiedAt = issuedAt;

    // Auto-add to freelancer profile
    const already = (freelancer.certifications || []).some(
      (c) => c.credentialId === session.certificateId,
    );
    if (!already) {
      freelancer.certifications.push({
        name: `Certificate of Completion: ${session.title}`,
        organization: session.organizationName,
        issueDate: issuedAt,
        credentialId: session.certificateId,
        credentialUrl: '',
        filePath: session.certificateFilePath,
      });
      await freelancer.save();
    } else {
      const cert = freelancer.certifications.find((c) => c.credentialId === session.certificateId);
      if (cert && !cert.filePath) {
        cert.filePath = session.certificateFilePath;
        await freelancer.save();
      }
    }
    session.certificateAddedToProfile = true;

    if (freelancer.email) {
      const org = session.organizationName || 'The organization';
      const subject = `Your OPUS certificate for "${session.title}"`;
      const body =
        `Hi ${freelancerName},\n\n`
        + `${org} has issued your Certificate of Completion for "${session.title}" on OPUS.\n\n`
        + `Certificate ID: ${session.certificateId}\n\n`
        + `The PDF is attached to this email. It has also been added to your OPUS profile under Certifications.\n\n`
        + `You can download it anytime from your Task Workspace or profile.\n\n`
        + `Congratulations,\nThe OPUS team`;
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#14161F;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#0284c7;">Certificate of Completion</h2>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Hi ${freelancerName},</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
            <strong>${org}</strong> has issued your Certificate of Completion for
            <strong>"${session.title}"</strong> on OPUS.
          </p>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#475569;">
            Certificate ID: <code>${session.certificateId}</code>
          </p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">
            The PDF is attached to this email and has also been added to your OPUS profile under Certifications.
            You can download it anytime from your Task Workspace or profile.
          </p>
          <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">Congratulations,<br/>The OPUS team</p>
        </div>
      `;
      try {
        await sendEmail(freelancer.email, subject, body, {
          fromName: 'OPUS Certificates',
          html,
          attachments: [
            {
              filename: `OPUS-Certificate-${safeId}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });
      } catch (emailErr) {
        console.error('Certificate email failed:', emailErr.message);
      }
    }

    session.messages.push({
      authorId: req.user._id,
      authorRole: 'employer',
      text: `Issued Certificate of Completion (${session.certificateId}) and emailed it to ${freelancerName}.`,
    });

    await session.save();

    await notifyUser({
      userId: session.freelancerId,
      type: 'certificate_issued',
      title: 'Certificate issued',
      message: `${session.organizationName || 'The organization'} issued your certificate for "${session.title}". Work is complete.`,
      link: `/dashboard/workspace/${session._id}`,
      meta: { workspaceId: session._id, jobId: session.jobPostingId },
    });
    res.json({
      message: 'Certificate issued, emailed to the freelancer, and added to their profile',
      session: await serializeSessionAsync(session, role),
    });
  } catch (err) {
    console.error('Issue certificate error:', err);
    res.status(500).json({ message: err.message || 'Failed to issue certificate' });
  }
};

export const downloadCertificate = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session } = loaded;
    if (session.status !== 'certified' || !session.certificateId) {
      return res.status(404).json({ message: 'Certificate is not available yet' });
    }

    let absolutePath = '';
    if (session.certificateFilePath) {
      absolutePath = path.join(__dirname, '..', session.certificateFilePath.replace(/^\//, ''));
    }
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      const freel = await User.findById(session.freelancerId).select('name firstName lastName');
      const pdfBuffer = await generateCertificatePdf({
        certificateId: session.certificateId,
        freelancerName: displayUserName(freel),
        taskTitle: session.title,
        organizationName: session.organizationName,
        issuedAt: session.certifiedAt || new Date(),
      });
      ensureCertificatesDir();
      const safeId = String(session.certificateId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeId}.pdf`;
      absolutePath = path.join(certificatesDir, fileName);
      fs.writeFileSync(absolutePath, pdfBuffer);
      session.certificateFilePath = `/uploads/certificates/${fileName}`;
      await session.save();
    }

    res.download(absolutePath, `OPUS-Certificate-${session.certificateId}.pdf`);
  } catch (err) {
    console.error('Download certificate error:', err);
    res.status(500).json({ message: 'Failed to download certificate' });
  }
};

export const addCertificateToProfile = async (req, res) => {
  try {
    const loaded = await loadSessionOr404(req, res);
    if (!loaded) return;
    const { session, role } = loaded;
    if (role !== 'freelancer') {
      return res.status(403).json({ message: 'Only the freelancer can add the certificate to their profile' });
    }
    if (session.status !== 'certified') {
      return res.status(400).json({ message: 'Certificate is not available yet' });
    }
    if (session.certificateAddedToProfile) {
      return res.json({ message: 'Already added to profile', session: await serializeSessionAsync(session, role) });
    }

    const user = await User.findById(req.user._id);
    const already = (user.certifications || []).some(
      (c) => c.credentialId === session.certificateId,
    );
    if (!already) {
      user.certifications.push({
        name: `Certificate of Completion: ${session.title}`,
        organization: session.organizationName,
        issueDate: session.certifiedAt || new Date(),
        credentialId: session.certificateId,
        credentialUrl: '',
        filePath: session.certificateFilePath || '',
      });
      await user.save();
    } else {
      const cert = user.certifications.find((c) => c.credentialId === session.certificateId);
      if (cert && session.certificateFilePath && !cert.filePath) {
        cert.filePath = session.certificateFilePath;
        await user.save();
      }
    }

    session.certificateAddedToProfile = true;
    await session.save();
    res.json({ message: 'Certificate added to your profile', session: await serializeSessionAsync(session, role) });
  } catch (err) {
    console.error('Add certificate to profile error:', err);
    res.status(500).json({ message: 'Failed to add certificate to profile' });
  }
};

export const syncAcceptedSessionsForUser = async (userId, role) => {
  const filter = role === 'freelancer'
    ? { freelancerId: userId, status: 'accepted' }
    : { employerId: userId, status: 'accepted' };
  const apps = await JobApplication.find(filter).lean();
  await Promise.all(apps.map((a) => ensureWorkSessionForApplication(a)));
};

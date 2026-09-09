import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, getProfileUrl } from '../../services/api';
import './TaskWorkspace.css';
import './TeamWorkspace.css';

const STEPS = ['Started', 'In progress', 'Final submitted', 'Awaiting payment', 'Paid', 'Certified'];

const CATEGORY_META = {
  technical: { label: 'Technical', accent: '#326d5c', soft: '#e5f0ec', icon: 'code' },
  design: { label: 'Design', accent: '#7c3aed', soft: '#f5f3ff', icon: 'palette' },
  submission: { label: 'Submission', accent: '#b45309', soft: '#fffbeb', icon: 'upload' },
};

const UPDATE_TYPES = {
  note: { label: 'Note', icon: 'note', placeholder: 'Write a quick progress note…' },
  file: { label: 'File', icon: 'paperclip', placeholder: 'Attach a file' },
  repo: { label: 'Repository', icon: 'github', placeholder: 'e.g. https://github.com/org/repo' },
  preview: { label: 'Live preview', icon: 'globe', placeholder: 'e.g. https://your-app.vercel.app' },
  video: { label: 'Demo video', icon: 'video', placeholder: 'e.g. Loom or YouTube link' },
};

const LINK_SHAPED = new Set(['repo', 'preview', 'video']);

const DRAFT_DECISION_LABEL = {
  pending: 'Pending review',
  approved_new_draft: 'Approved · new draft required',
  approved_complete: 'Approved · no further draft required',
  changes_requested: 'Changes requested',
};

const DRAFT_CONFIRM = {
  approved_new_draft: {
    title: 'Approve and request a new draft?',
    body: 'This marks the current draft as approved, but asks the freelancer to upload another draft with your comment.',
    confirmLabel: 'Yes, approve & request new draft',
  },
  approved_complete: {
    title: 'Approve role complete?',
    body: 'This finalizes this freelancer’s role. The project moves to payment only after every role is finalized.',
    confirmLabel: 'Yes, finalize this role',
  },
  changes_requested: {
    title: 'Request changes on this draft?',
    body: 'This tells the freelancer the draft needs changes. Your comment will appear in Feedback.',
    confirmLabel: 'Yes, request changes',
  },
};

const ROLE_STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  role_finalized: 'Role finalized',
  paid: 'Paid',
  certified: 'Certified',
};

const Icon = {
  back: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  send: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  paperclip: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  message: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  bank: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M12 4l9 6H3l9-6z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  list: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  github: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  globe: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
  video: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 10l6-3v10l-6-3v-4z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  note: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  bell: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  history: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 3v5h5M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  alertTri: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  code: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  palette: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2a10 10 0 00-1 19.95 2.5 2.5 0 003.5-2.3V18a2 2 0 012-2h1.1A5.9 5.9 0 0022 10.1 10 10 0 0012 2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  ),
  upload: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  circle: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
};

function fmt(n) {
  return `NPR ${Number(n || 0).toLocaleString('en-NP')}`;
}

function stepIndex(status, allRolesFinalized) {
  if (status === 'certified') return 5;
  if (status === 'paid') return 4;
  if (status === 'awaiting_payment') return 3;
  if (allRolesFinalized || status === 'final_submitted') return 2;
  if (status === 'in_progress') return 1;
  return 0;
}

function ConfirmModal({ icon, title, body, confirmLabel, onConfirm, onCancel, loading }) {
  return (
    <div className="tw-modal-overlay" role="dialog" aria-modal="true">
      <div className="tw-modal">
        <div className="tw-modal__head">
          <div className="tw-modal__icon">{icon}</div>
          <button type="button" className="tw-modal__close" onClick={onCancel} aria-label="Close">
            {Icon.close}
          </button>
        </div>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="tw-modal__actions">
          <button type="button" className="tw-btn tw-btn--ghost tw-btn--flex" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="tw-btn tw-btn--primary tw-btn--flex" onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttachmentSummary({ attachments }) {
  const list = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <div className="tw-attach-summary">
      {Icon.paperclip}
      <span>
        {list.length} file{list.length > 1 ? 's' : ''} attached · open for preview &amp; download
      </span>
    </div>
  );
}

function AttachmentList({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div className="tw-file-list">
      {attachments.map((a) => {
        const url = a.filePath ? getProfileUrl(a.filePath) : '';
        return (
          <a
            key={a.id || a.filePath}
            className="tw-file-chip"
            href={url || '#'}
            target="_blank"
            rel="noreferrer"
          >
            <em>{a.fileName || 'Attachment'}</em>
          </a>
        );
      })}
    </div>
  );
}

function BodyField({ type, value, files, onChange, onFilesChange, placeholders }) {
  if (type === 'note') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholders.note || 'Write a note…'}
        className="tw-input tw-textarea"
      />
    );
  }
  if (type === 'file') {
    return (
      <div className="tw-file-pick">
        <label className="tw-btn tw-btn--ghost tw-btn--compact">
          {Icon.paperclip} {files.length ? `${files.length} file(s) selected` : placeholders.file || 'Choose files'}
          <input
            type="file"
            hidden
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.mp4,.webm,.mov"
            onChange={(e) => {
              onFilesChange(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
        </label>
        {!!files.length && (
          <ul className="tw-file-pick__names">
            {files.map((f) => <li key={`${f.name}-${f.size}`}>{f.name}</li>)}
          </ul>
        )}
      </div>
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholders[type] || 'https://…'}
      className="tw-input"
    />
  );
}

export default function TeamWorkspacePage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployer = user?.role === 'employer';
  const role = isEmployer ? 'employer' : 'freelancer';
  const backPath = isEmployer ? '/employer/check-status' : '/dashboard';
  const messagesPath = isEmployer ? '/employer/messages' : '/messages';

  const [team, setTeam] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updateType, setUpdateType] = useState('note');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [updateFiles, setUpdateFiles] = useState([]);
  const [draftComments, setDraftComments] = useState({});
  const [draftConfirm, setDraftConfirm] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [sidebarTab, setSidebarTab] = useState('feedback');

  const load = async () => {
    try {
      const data = await api.getTeamWorkspace(teamId);
      setTeam(data.team);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load team workspace');
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [teamId]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const updates = useMemo(() => {
    const list = [...(team?.progressUpdates || [])];
    if (roleFilter === 'all') return list;
    return list.filter((u) => u.roleKey === roleFilter);
  }, [team, roleFilter]);

  const feedbackLog = useMemo(() => (
    [...(team?.progressUpdates || [])]
      .filter((u) => u.reviewStatus && u.reviewStatus !== 'pending' && u.reviewComment)
      .map((u) => ({
        id: u.id,
        kind: u.reviewStatus,
        text: u.reviewComment,
        roleName: u.roleName,
        authorName: u.authorName,
        createdAt: u.reviewedAt || u.createdAt,
        update: u,
      }))
  ), [team]);

  if (loading) {
    return <div className="tw-page"><div className="tw-loading">Loading workspace…</div></div>;
  }

  if (!team) {
    return (
      <div className="tw-page">
        <div className="tw-card tw-empty">
          <p>{error || 'Workspace not found'}</p>
          <Link to={backPath} className="tw-btn tw-btn--ghost">Go back</Link>
        </div>
      </div>
    );
  }

  const status = team.status;
  const idx = stepIndex(status, team.allRolesFinalized);
  const members = team.members || [];
  const notStartedMembers = members.filter((m) => m.roleStatus === 'not_started');
  const finalizedCount = team.rolesFinalizedCount || 0;
  const rolesTotal = team.rolesTotal || members.length || 1;
  const guidelines = team.guidelines || [];
  const checkedCount = guidelines.filter((g) => g.checked).length;
  const progressPct = guidelines.length
    ? Math.round((checkedCount / guidelines.length) * 100)
    : Math.round((finalizedCount / rolesTotal) * 100);
  const rolesPct = Math.round((finalizedCount / rolesTotal) * 100);
  const amountLabel = fmt(team.totalGross || members.reduce((s, m) => s + Number(m.splitAmount || 0), 0));
  const categoryLabel = team.categoryLabel || team.category || 'Multi-role';
  const orgInitials = (team.organizationName || 'OR')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const fmtDate = (d) => (d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-');
  const fmtTime = (d) =>
    new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const canPostUpdate = updateType === 'file'
    ? !!updateTitle.trim() && updateFiles.length > 0
    : !!updateTitle.trim() && !!updateBody.trim();

  const postUpdate = () => {
    if (!canPostUpdate || !team.canPostUpdate) return;
    run(async () => {
      const form = new FormData();
      form.append('type', updateType);
      form.append('title', updateTitle.trim());
      form.append('body', updateBody.trim());
      updateFiles.forEach((f) => form.append('files', f));
      await api.addTeamUpdate(teamId, form);
      setUpdateTitle('');
      setUpdateBody('');
      setUpdateFiles([]);
    });
  };

  const askReviewDraft = (updateId, decision) => {
    const comment = (draftComments[updateId] || '').trim();
    if (!comment) return;
    setDraftConfirm({ updateId, decision, comment });
  };

  const confirmReviewDraft = () => {
    if (!draftConfirm) return;
    const { updateId, decision, comment } = draftConfirm;
    run(async () => {
      await api.reviewTeamUpdate(teamId, updateId, { decision, comment });
      setDraftComments((prev) => {
        const next = { ...prev };
        delete next[updateId];
        return next;
      });
      setDraftConfirm(null);
      setSidebarTab('feedback');
    });
  };

  const freelancerNeedsStart = !isEmployer && team.canStart;
  const showInProgress = status === 'in_progress' || status === 'final_submitted';

  return (
    <div className="tw-page">
      <div className="tw-shell">
        <header className="tw-titlebar">
          <div className="tw-titlebar__label">
            {isEmployer ? 'Check Status: Task Workspace' : 'My Bids: Task Workspace'}
          </div>
        </header>

        <div className="tw-header">
          <button type="button" className="tw-back" onClick={() => navigate(backPath)}>
            <span className="tw-back__icon" aria-hidden="true">{Icon.back}</span>
            <span className="tw-back__text">
              {isEmployer ? 'Back to Check Status' : 'Back to My Bids'}
            </span>
          </button>

          <div className="tw-header__row">
            <div>
              <div className="tw-accepted">{Icon.check} Bid accepted</div>
              <h1>{team.title}</h1>
              <p>
                {team.organizationName}
                {' · '}{categoryLabel} · Deadline {fmtDate(team.deadline)}
              </p>
            </div>
            <div className="tw-amount">
              <span>Agreed amount</span>
              <strong>{amountLabel}</strong>
            </div>
          </div>

          <div className="tw-stepper">
            {STEPS.map((s, i) => (
              <div key={s} className="tw-step">
                <div className="tw-step__label">
                  <div className={`tw-step__dot ${i < idx ? 'is-done' : ''} ${i === idx ? 'is-current' : ''}`}>
                    {i < idx ? Icon.check : i + 1}
                  </div>
                  <span className={i <= idx ? 'is-active' : ''}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`tw-step__line ${i < idx ? 'is-done' : ''}`} />}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="tw-error">{error}</p>}

        <div className="tw-body">
          <main className="tw-main">
            {(status === 'not_started' || freelancerNeedsStart) && (
              isEmployer ? (
                <div className="tw-card tw-center">
                  <div className="tw-icon-circle">{Icon.clock}</div>
                  <h3>
                    {notStartedMembers.length === members.length
                      ? 'The team has not started the project yet'
                      : `${notStartedMembers.map((m) => m.name).join(', ') || 'Some freelancers'} ${notStartedMembers.length === 1 ? 'has' : 'have'} not started yet`}
                  </h3>
                  <p>
                    All roles are filled and the shared workspace is ready. Each freelancer starts their own role,
                    then posts drafts here for review. Payment happens once every role is finalized.
                  </p>
                  <ul className="tw-team-wait-list">
                    {members.map((m) => (
                      <li key={m.roleKey}>
                        <strong>{m.name}</strong>
                        <span>{m.roleName}</span>
                        <em>{ROLE_STATUS_LABEL[m.roleStatus] || m.roleStatus}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="tw-card tw-center">
                  <div className="tw-icon-circle">{Icon.clock}</div>
                  <h3>Ready to begin?</h3>
                  <p>
                    Your role: <strong>{team.myRoleName}</strong>. Once you start, you can post progress drafts for{' '}
                    <strong>{team.organizationName}</strong>. Teammates work in parallel on their roles in this same workspace.
                  </p>
                  <button
                    type="button"
                    className="tw-btn tw-btn--primary"
                    disabled={busy}
                    onClick={() => run(() => api.startTeamRole(teamId))}
                  >
                    Start working
                  </button>
                </div>
              )
            )}

            {showInProgress && !(status === 'not_started') && !freelancerNeedsStart && (
              <>
                {team.canMarkComplete && (
                  <div className="tw-card tw-cta">
                    <div className="tw-cta__icon">{Icon.shield}</div>
                    <div>
                      <p className="tw-cta__title">All roles finalized</p>
                      <p className="tw-cta__sub">
                        Every freelancer’s work is approved. Mark the project complete to generate the split bill.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="tw-btn tw-btn--primary"
                      disabled={busy}
                      onClick={() => run(() => api.completeTeamProject(teamId))}
                    >
                      Mark project complete
                    </button>
                  </div>
                )}

                <div className="tw-section-head">
                  <p className="tw-section-kicker">Drafts</p>
                  <span className="tw-section-hint">
                    Shared across the team · review each draft: approve with another draft, approve role complete, or request changes
                  </span>
                  <select
                    className="tw-input tw-role-filter"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    aria-label="Filter drafts by role"
                  >
                    <option value="all">All roles</option>
                    {members.map((m) => (
                      <option key={m.roleKey} value={m.roleKey}>{m.roleName}</option>
                    ))}
                  </select>
                </div>

                {team.canPostUpdate && (
                  <div className="tw-card tw-composer">
                    <p className="tw-composer__role">Posting as <strong>{team.myRoleName}</strong></p>
                    <div className="tw-type-chips">
                      {Object.entries(UPDATE_TYPES).map(([key, meta]) => (
                        <button
                          key={key}
                          type="button"
                          className={`tw-type-chip ${updateType === key ? 'is-active' : ''}`}
                          onClick={() => { setUpdateType(key); setUpdateBody(''); setUpdateFiles([]); }}
                        >
                          {Icon[meta.icon]} {meta.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={updateTitle}
                      onChange={(e) => setUpdateTitle(e.target.value)}
                      placeholder="What does this update cover?"
                      className="tw-input"
                    />
                    <BodyField
                      type={updateType}
                      value={updateBody}
                      files={updateFiles}
                      onChange={setUpdateBody}
                      onFilesChange={setUpdateFiles}
                      placeholders={{
                        note: UPDATE_TYPES.note.placeholder,
                        file: 'Attach photos, PDF, Word, PPT, and more',
                        repo: UPDATE_TYPES.repo.placeholder,
                        preview: UPDATE_TYPES.preview.placeholder,
                        video: UPDATE_TYPES.video.placeholder,
                      }}
                    />
                    <div className="tw-composer__foot tw-composer__foot--end">
                      <button
                        type="button"
                        className="tw-btn tw-btn--primary tw-btn--compact"
                        disabled={busy || !canPostUpdate}
                        onClick={postUpdate}
                      >
                        {Icon.send} Post update
                      </button>
                    </div>
                  </div>
                )}

                {!isEmployer && team.myRoleStatus === 'role_finalized' && (
                  <div className="tw-card tw-notice">
                    {Icon.shield}
                    <div>
                      <p className="tw-cta__title">Your role is finalized</p>
                      <p className="tw-cta__sub">Waiting for other roles to finish before the project moves to payment.</p>
                    </div>
                  </div>
                )}

                {!updates.length ? (
                  <p className="tw-muted-center tw-muted-center--tight">No progress updates posted yet.</p>
                ) : (
                  <div className="tw-updates">
                    {[...updates].reverse().map((u) => {
                      const meta = UPDATE_TYPES[u.type] || UPDATE_TYPES.note;
                      const reviewStatus = u.reviewStatus || 'pending';
                      const draftComment = draftComments[u.id] || '';
                      return (
                        <div key={u.id} className="tw-card tw-update-wrap">
                          <button
                            type="button"
                            className="tw-update tw-update--clickable"
                            onClick={() => setDetailView(u)}
                          >
                            <div className="tw-update__icon">{Icon[meta.icon] || Icon.note}</div>
                            <div className="tw-update__body">
                              <div className="tw-update__top">
                                <p className="tw-update__title">{u.title}</p>
                                <span className="tw-update__num">Draft {u.number}</span>
                                <span className="tw-update__type">{meta.label}</span>
                                <span className="tw-pill">{u.roleName || u.roleKey} · {u.authorName}</span>
                                {reviewStatus !== 'pending' && (
                                  <span className={`tw-pill tw-pill--decision tw-pill--${reviewStatus}`}>
                                    {DRAFT_DECISION_LABEL[reviewStatus] || reviewStatus}
                                  </span>
                                )}
                              </div>
                              <p className="tw-update__text">
                                {LINK_SHAPED.has(u.type) ? (
                                  <span className="tw-link">{u.body}</span>
                                ) : u.body}
                              </p>
                              {!!u.attachments?.length && (
                                <AttachmentSummary attachments={u.attachments} />
                              )}
                              <time>{fmtTime(u.createdAt)}</time>
                              <span className="tw-update__hint">Click to view full preview</span>
                            </div>
                          </button>

                          {reviewStatus !== 'pending' && u.reviewComment && (
                            <div className={`tw-draft-decision tw-draft-decision--${reviewStatus}`}>
                              <p className="tw-draft-decision__label">
                                {DRAFT_DECISION_LABEL[reviewStatus] || reviewStatus}
                                {u.reviewedAt ? ` · ${fmtTime(u.reviewedAt)}` : ''}
                              </p>
                              <p className="tw-draft-decision__comment">{u.reviewComment}</p>
                            </div>
                          )}

                          {u.canReviewDraft && (
                            <div className="tw-draft-review">
                              <label className="tw-field-label">
                                Comment for this draft
                                <textarea
                                  value={draftComment}
                                  onChange={(e) => setDraftComments((prev) => ({
                                    ...prev,
                                    [u.id]: e.target.value,
                                  }))}
                                  rows={2}
                                  placeholder="Write your comment, then choose an action…"
                                  className="tw-input tw-textarea"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </label>
                              <div className="tw-draft-review__actions">
                                <button
                                  type="button"
                                  className="tw-btn tw-btn--primary tw-btn--compact"
                                  disabled={busy || !draftComment.trim()}
                                  onClick={() => askReviewDraft(u.id, 'approved_new_draft')}
                                >
                                  Approved · new draft required
                                </button>
                                <button
                                  type="button"
                                  className="tw-btn tw-btn--green tw-btn--compact"
                                  disabled={busy || !draftComment.trim()}
                                  onClick={() => askReviewDraft(u.id, 'approved_complete')}
                                >
                                  Approved · no further draft required
                                </button>
                                <button
                                  type="button"
                                  className="tw-btn tw-btn--danger tw-btn--compact"
                                  disabled={busy || !draftComment.trim()}
                                  onClick={() => askReviewDraft(u.id, 'changes_requested')}
                                >
                                  Request changes
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isEmployer && team.canPostUpdate && (
                  <div className="tw-card tw-notice">
                    {Icon.shield}
                    <div>
                      <p className="tw-cta__title">Keep posting drafts until the organization decides</p>
                      <p className="tw-cta__sub">
                        {team.organizationName} reviews each draft with a comment. If they choose
                        &ldquo;Approved · no further draft required&rdquo;, your role is finalized.
                        The project pays out only when every role is done.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === 'awaiting_payment' && (
              <div className="tw-card tw-payment">
                <div className="tw-payment__head">
                  {Icon.bank}
                  <p>{isEmployer ? 'Pay split into each freelancer OPUS wallet' : 'Waiting for organization payment'}</p>
                </div>
                <div className="tw-payment__meta tw-payment__meta--full">
                  {(team.bill || []).map((b) => {
                    const feeRate = b.feeRate ?? 0.1;
                    return (
                      <div key={b.roleKey} className="tw-team-bill-block">
                        <div className="tw-row">
                          <span>{b.roleName} · {b.freelancerName}</span>
                          <strong>{fmt(b.gross)}</strong>
                        </div>
                        <div className="tw-row">
                          <span>OPUS service charge ({Math.round(feeRate * 100)}%)</span>
                          <strong>{fmt(b.fee)}</strong>
                        </div>
                        <div className="tw-row">
                          <span>{isEmployer ? 'Freelancer receives' : 'You receive'}</span>
                          <strong>{fmt(b.net)}</strong>
                        </div>
                      </div>
                    );
                  })}
                  <div className="tw-row">
                    <span>Total job amount (debit)</span>
                    <strong>{fmt(team.totalGross)}</strong>
                  </div>
                  <div className="tw-row">
                    <span>Total OPUS service charge</span>
                    <strong>{fmt(team.totalFee)}</strong>
                  </div>
                  <div className="tw-row">
                    <span>Total to freelancers</span>
                    <strong>{fmt(team.totalNet)}</strong>
                  </div>
                  <div className="tw-row">
                    <span>Reference</span>
                    <code>{team.paymentRef || '—'}</code>
                  </div>
                  {team.canPay && (
                    <button
                      type="button"
                      className="tw-btn tw-btn--primary tw-btn--block"
                      disabled={busy}
                      onClick={() => run(() => api.payTeamWorkspace(teamId))}
                    >
                      Pay from OPUS wallet + issue certificates
                    </button>
                  )}
                  {isEmployer ? (
                    <p className="tw-hint tw-hint--pad">
                      You pay the full job amount ({fmt(team.totalGross)}). OPUS keeps {fmt(team.totalFee)} as a service charge
                      and credits {fmt(team.totalNet)} split across freelancer wallets.
                    </p>
                  ) : (
                    <p className="tw-hint tw-hint--pad">
                      Waiting for the organization to pay. OPUS keeps a 10% service charge on each role; the rest lands in your wallet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {['paid', 'certified'].includes(status) && (
              <div className="tw-card tw-center">
                <div className="tw-icon-circle tw-icon-circle--ok">{Icon.check}</div>
                <h3>Paid & certified</h3>
                <p>Each freelancer received their share and a completion certificate for their role.</p>
                <ul className="tw-team-wait-list">
                  {members.map((m) => (
                    <li key={m.roleKey}>
                      <strong>{m.name}</strong>
                      <span>{m.roleName}</span>
                      <em>{ROLE_STATUS_LABEL[m.roleStatus] || m.roleStatus}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </main>

          <aside className="tw-side">
            <div className="tw-side__scroll">
              <div className="tw-card">
                <div className="tw-org">
                  <div className="tw-org__avatar">{orgInitials}</div>
                  <div>
                    <p className="tw-org__name">{team.organizationName}</p>
                    <p className="tw-org__sub">Verified organization</p>
                  </div>
                </div>
                <div className="tw-side-meta">
                  <div><span>Category</span><em>{categoryLabel}</em></div>
                  <div><span>Deadline</span><em>{fmtDate(team.deadline)}</em></div>
                  <div><span>Updates posted</span><em>{(team.progressUpdates || []).length}</em></div>
                  <div><span>Roles</span><em>{finalizedCount}/{rolesTotal} finalized</em></div>
                </div>
                {team.description?.trim() && (
                  <p className="tw-brief__text tw-brief__text--side">{team.description}</p>
                )}
              </div>

              <div className="tw-card tw-guidelines">
                <div className="tw-guidelines__head">
                  <p className="tw-side-title">{Icon.list} Guidelines</p>
                  <span className="tw-guidelines__pct">{guidelines.length ? progressPct : 0}%</span>
                </div>
                <div className="tw-guidelines__bar">
                  <div className="tw-guidelines__fill" style={{ width: `${guidelines.length ? progressPct : 0}%` }} />
                </div>

                {!guidelines.length ? (
                  <p className="tw-muted">No requirements listed for this task.</p>
                ) : (
                  Object.entries(CATEGORY_META).map(([catKey, meta]) => {
                    const items = guidelines.filter((g) => g.category === catKey);
                    if (!items.length) return null;
                    const done = items.filter((g) => g.checked).length;
                    return (
                      <div key={catKey} className="tw-cat">
                        <div className="tw-cat__head">
                          <span className="tw-cat__icon" style={{ background: meta.soft, color: meta.accent }}>
                            {Icon[meta.icon]}
                          </span>
                          <span className="tw-cat__label" style={{ color: meta.accent }}>{meta.label}</span>
                          <span className="tw-cat__count">{done}/{items.length}</span>
                        </div>
                        <div className="tw-cat__list">
                          {items.map((g) => {
                            const canToggle = team.canToggleGuidelines;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                className={`tw-guideline-row ${g.checked ? 'is-checked' : ''}`}
                                disabled={!canToggle || busy}
                                onClick={() => {
                                  if (!canToggle) return;
                                  run(() => api.toggleTeamGuideline(teamId, g.id, { checked: !g.checked }));
                                }}
                              >
                                <span className="tw-guideline-check" style={g.checked ? { color: meta.accent } : undefined}>
                                  {g.checked ? Icon.check : Icon.circle}
                                </span>
                                <span>{g.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                {guidelines.length > 0 && (
                  <p className="tw-guidelines__foot">
                    Set by {team.organizationName} at the start of the task. Shared across every role.
                  </p>
                )}
              </div>

              <div className="tw-card tw-guidelines">
                <div className="tw-guidelines__head">
                  <p className="tw-side-title">{Icon.list} Team roles</p>
                  <span className="tw-guidelines__pct">{rolesPct}%</span>
                </div>
                <div className="tw-guidelines__bar">
                  <div className="tw-guidelines__fill" style={{ width: `${rolesPct}%` }} />
                </div>
                <div className="tw-cat__list tw-team-role-list">
                  {members.map((m) => {
                    const done = ['role_finalized', 'paid', 'certified'].includes(m.roleStatus);
                    return (
                      <div key={m.roleKey} className={`tw-guideline-row ${done ? 'is-checked' : ''}`}>
                        <span className="tw-guideline-check" style={done ? { color: '#326d5c' } : undefined}>
                          {done ? Icon.check : Icon.circle}
                        </span>
                        <span className="tw-team-role-row">
                          <strong>{m.roleName}</strong>
                          <em>{m.name} · {fmt(m.splitAmount)}</em>
                          <small>{ROLE_STATUS_LABEL[m.roleStatus] || m.roleStatus}</small>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="tw-guidelines__foot">
                  Each role is reviewed independently. Project payment unlocks when every role is finalized.
                </p>
              </div>
            </div>

            <div className="tw-side-tabs">
              <div className="tw-side-tabs__nav">
                <button
                  type="button"
                  className={`tw-side-tab ${sidebarTab === 'feedback' ? 'is-active' : ''}`}
                  onClick={() => setSidebarTab('feedback')}
                >
                  {Icon.bell} Feedback
                  {feedbackLog.length > 0 && (
                    <span className="tw-side-tab__badge">{feedbackLog.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`tw-side-tab ${sidebarTab === 'discussion' ? 'is-active' : ''}`}
                  onClick={() => setSidebarTab('discussion')}
                >
                  {Icon.message} Discussion
                </button>
              </div>

              {sidebarTab === 'feedback' ? (
                <div className="tw-side-tabs__panel">
                  {!feedbackLog.length ? (
                    <div className="tw-feedback-empty">
                      {Icon.history}
                      <p>No feedback yet.</p>
                      <span>
                        Approve, next-draft, and change-request notes from the organization appear here.
                      </span>
                    </div>
                  ) : (
                    <div className="tw-feedback-timeline">
                      {[...feedbackLog].reverse().map((f, index) => (
                        <button
                          key={f.id}
                          type="button"
                          className="tw-feedback-card tw-feedback-card--clickable"
                          onClick={() => setDetailView(f.update)}
                        >
                          <span className="tw-feedback-card__dot" aria-hidden="true" />
                          {index < feedbackLog.length - 1 && (
                            <span className="tw-feedback-card__line" aria-hidden="true" />
                          )}
                          <div className="tw-feedback-card__head">
                            <span className={`tw-feedback-kind tw-feedback-kind--${f.kind}`}>
                              {DRAFT_DECISION_LABEL[f.kind] || f.kind}
                            </span>
                            <span>{f.roleName}</span>
                          </div>
                          <p>{f.text}</p>
                          <time>{fmtTime(f.createdAt)}</time>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="tw-side-tabs__panel tw-discussion">
                  <div className="tw-feedback-empty">
                    {Icon.message}
                    <p>Group chats</p>
                    <span>Use Messages for the shared team threads.</span>
                  </div>
                  <div className="tw-team-chat-links">
                    {!isEmployer && team.freelancerGroupConversationId && (
                      <Link
                        className="tw-btn tw-btn--ghost tw-btn--block"
                        to={`${messagesPath}?c=${team.freelancerGroupConversationId}`}
                      >
                        Freelancer-only group
                      </Link>
                    )}
                    {team.projectGroupConversationId && (
                      <Link
                        className="tw-btn tw-btn--ghost tw-btn--block"
                        to={`${messagesPath}?c=${team.projectGroupConversationId}`}
                      >
                        Project group (with employer)
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {draftConfirm && (
        <ConfirmModal
          icon={draftConfirm.decision === 'changes_requested' ? Icon.alertTri : Icon.check}
          title={DRAFT_CONFIRM[draftConfirm.decision]?.title || 'Confirm decision?'}
          body={DRAFT_CONFIRM[draftConfirm.decision]?.body || 'Please confirm this review decision.'}
          confirmLabel={DRAFT_CONFIRM[draftConfirm.decision]?.confirmLabel || 'Confirm'}
          loading={busy}
          onConfirm={confirmReviewDraft}
          onCancel={() => setDraftConfirm(null)}
        />
      )}

      {detailView && (
        <div className="tw-modal-overlay" role="dialog" aria-modal="true">
          <div className="tw-modal tw-modal--wide">
            <div className="tw-modal__head">
              <div className="tw-modal__icon">{Icon.note}</div>
              <button type="button" className="tw-modal__close" onClick={() => setDetailView(null)} aria-label="Close">
                {Icon.close}
              </button>
            </div>
            <h3>Progress update {detailView.number}</h3>
            <div className="tw-detail__meta-row">
              <span className="tw-update__type">{(UPDATE_TYPES[detailView.type] || UPDATE_TYPES.note).label}</span>
              <span className="tw-pill">{detailView.roleName} · {detailView.authorName}</span>
              <time>{fmtTime(detailView.createdAt)}</time>
            </div>
            <h4 className="tw-detail__subtitle">{detailView.title}</h4>
            {!!detailView.attachments?.length && (
              <div className="tw-detail__block">
                <span className="tw-detail__label">Attachments</span>
                <AttachmentList attachments={detailView.attachments} />
              </div>
            )}
            {detailView.body && (
              <div className="tw-detail__block">
                <span className="tw-detail__label">
                  {LINK_SHAPED.has(detailView.type) ? 'Link' : 'Comment / note'}
                </span>
                {LINK_SHAPED.has(detailView.type) ? (
                  <a href={detailView.body} target="_blank" rel="noreferrer" className="tw-link">{detailView.body}</a>
                ) : (
                  <p className="tw-detail__text">{detailView.body}</p>
                )}
              </div>
            )}
            {detailView.reviewStatus && detailView.reviewStatus !== 'pending' && (
              <div className={`tw-detail__block tw-draft-decision tw-draft-decision--${detailView.reviewStatus}`}>
                <span className="tw-detail__label">Organization decision</span>
                <p className="tw-draft-decision__label">
                  {DRAFT_DECISION_LABEL[detailView.reviewStatus] || detailView.reviewStatus}
                </p>
                {detailView.reviewComment && (
                  <p className="tw-draft-decision__comment">{detailView.reviewComment}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

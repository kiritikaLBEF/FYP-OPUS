import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { api, getProfileUrl } from '../../services/api';
import { formatDate, userName } from '../../pages/Admin/adminHelpers';
import AdminModal from './AdminModal';
import './AdminModal.css';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';

function DocPreview({ label, path }) {
  if (!path) {
    return (
      <div className="adm-modal-doc">
        <div className="adm-modal-doc__label">{label}</div>
        <div className="adm-modal-doc__frame admin-muted" style={{ padding: 20 }}>No document uploaded</div>
      </div>
    );
  }
  const url = getProfileUrl(path);
  const isPdf = path.toLowerCase().endsWith('.pdf');
  return (
    <div className="adm-modal-doc">
      <div className="adm-modal-doc__label">{label}</div>
      <div className="adm-modal-doc__frame">
        {isPdf ? (
          <iframe title={label} src={url} />
        ) : (
          <img src={url} alt={label} />
        )}
      </div>
    </div>
  );
}

export default function AdminActionModals() {
  const { modal, closeModal } = useAdmin();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [meta, setMeta] = useState({ flagReasons: [], jobDeleteReasons: [], verificationRejectReasons: [] });
  const [verifyDetail, setVerifyDetail] = useState(null);
  const [rejectReasonCategory, setRejectReasonCategory] = useState('');
  const [rejectReasonDetail, setRejectReasonDetail] = useState('');

  // Send note state
  const [templateKey, setTemplateKey] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [failedNoteId, setFailedNoteId] = useState('');

  // Flag state
  const [flagReason, setFlagReason] = useState('');
  const [flagNote, setFlagNote] = useState('');

  // Suspend state
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendConfirm, setSuspendConfirm] = useState(false);

  // Delete job state
  const [deleteCategory, setDeleteCategory] = useState('');
  const [deleteDetail, setDeleteDetail] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!modal) return;
    setError('');
    setBusy(false);
    setRejectReasonCategory('');
    setRejectReasonDetail('');
    setTemplateKey('');
    setCustomMessage('');
    setFailedNoteId('');
    setFlagReason('');
    setFlagNote('');
    setSuspendReason('');
    setSuspendConfirm(false);
    setDeleteCategory('');
    setDeleteDetail('');
    setDeleteConfirm(false);
    setVerifyDetail(null);

    if (['sendNote', 'flag', 'suspend', 'deleteJob', 'verify'].includes(modal.type)) {
      api.getAdminMeta().then(setMeta).catch(() => {});
    }
    if (modal.type === 'sendNote') {
      api.getAdminTemplates().then((d) => setTemplates(d.templates || [])).catch(() => {});
    }
    if (modal.type === 'verify' && modal.user?.id) {
      api.getVerificationDetail(modal.user.id)
        .then(setVerifyDetail)
        .catch((err) => setError(err.message || 'Failed to load documents'));
    }
  }, [modal]);

  if (!modal) return null;

  const user = modal.user;
  const selectedTemplate = templates.find((t) => t.key === templateKey);
  const previewBody = customMessage.trim() || selectedTemplate?.body || '';

  const finish = (result) => {
    modal.onComplete?.(result);
    closeModal();
  };

  const handleSendNote = async () => {
    if (!templateKey) { setError('Select a template'); return; }
    setBusy(true);
    setError('');
    setFailedNoteId('');
    try {
      await api.sendNudge(user.id, { templateKey, customMessage: customMessage.trim() });
      finish({ sent: true });
    } catch (err) {
      const msg = err.message || 'Failed to send note';
      setError(msg);
      if (err.data?.sentNote?._id) setFailedNoteId(err.data.sentNote._id);
    } finally {
      setBusy(false);
    }
  };

  const handleRetryNote = async () => {
    if (!failedNoteId) return;
    setBusy(true);
    setError('');
    try {
      await api.retrySentNote(failedNoteId);
      finish({ sent: true });
    } catch (err) {
      setError(err.message || 'Retry failed');
      if (err.data?.sentNote?._id) setFailedNoteId(err.data.sentNote._id);
    } finally {
      setBusy(false);
    }
  };

  const handleFlag = async () => {
    if (!flagReason) { setError('Select a reason'); return; }
    setBusy(true);
    try {
      const result = await api.flagAdminUser(user.id, { reason: flagReason, note: flagNote });
      finish(result);
    } catch (err) {
      setError(err.message || 'Failed to flag account');
    } finally {
      setBusy(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { setError('Suspension reason is required'); return; }
    if (!suspendConfirm) { setError('Confirm this suspension'); return; }
    setBusy(true);
    try {
      await api.suspendAdminUser(user.id, { reason: suspendReason.trim() });
      finish({ suspended: true });
    } catch (err) {
      setError(err.message || 'Failed to suspend account');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await api.approveVerification(user.id);
      finish({ approved: true });
    } catch (err) {
      setError(err.message || 'Failed to approve');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReasonCategory) { setError('Select a rejection reason from the dropdown'); return; }
    setBusy(true);
    setError('');
    try {
      await api.rejectVerification(user.id, {
        reasonCategory: rejectReasonCategory,
        reasonDetail: rejectReasonDetail.trim(),
      });
      finish({ rejected: true });
    } catch (err) {
      setError(err.message || 'Failed to reject employer');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteCategory) { setError('Select a removal reason'); return; }
    if (!deleteConfirm) { setError('Confirm deletion'); return; }
    setBusy(true);
    try {
      await api.deleteAdminJob(modal.job.id, { reasonCategory: deleteCategory, reasonDetail: deleteDetail });
      finish({ deleted: true });
    } catch (err) {
      setError(err.message || 'Failed to remove post');
    } finally {
      setBusy(false);
    }
  };

  if (modal.type === 'sendNote') {
    return (
      <AdminModal
        open
        title="Send Note"
        subtitle={userName(user)}
        onClose={closeModal}
        footer={(
          <>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={closeModal}>Cancel</button>
            {failedNoteId && (
              <button type="button" className="admin-btn admin-btn--warn" disabled={busy} onClick={handleRetryNote}>
                {busy ? 'Retrying…' : 'Retry send'}
              </button>
            )}
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={busy || !templateKey}
              onClick={handleSendNote}
            >
              {busy ? 'Sending…' : 'Send note'}
            </button>
          </>
        )}
      >
        {error && <p className="admin-error">{error}</p>}
        <div className="adm-modal-form">
          <div className="adm-modal-form__field">
            <label className="adm-modal-form__label" htmlFor="note-template">Email template</label>
            <select
              id="note-template"
              className="admin-select"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              <option value="">Select template…</option>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>{t.label} {t.category ? `(${t.category})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="adm-modal-form__field">
            <label className="adm-modal-form__label" htmlFor="note-message">Custom message (optional)</label>
            <textarea
              id="note-message"
              className="admin-textarea"
              placeholder="Overrides template body when provided"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
            />
          </div>
        </div>
        {selectedTemplate && (
          <div className="admin-panel adm-note-preview">
            <div className="admin-panel__head">Preview</div>
            <div className="admin-panel__body adm-note-preview__body">
              <div className="adm-note-preview__subject">
                <span className="adm-note-preview__label">Subject</span>
                <span>{selectedTemplate.subject}</span>
              </div>
              <div className="adm-note-preview__message">
                <span className="adm-note-preview__label">Body</span>
                <div className="adm-note-preview__text">{previewBody}</div>
              </div>
            </div>
          </div>
        )}
      </AdminModal>
    );
  }

  if (modal.type === 'flag') {
    return (
      <AdminModal
        open
        title="Flag Account"
        subtitle={`${userName(user)} · ${user.flagCount || 0} existing flag(s)`}
        onClose={closeModal}
        footer={(
          <>
            <button type="button" className="admin-btn" onClick={closeModal}>Cancel</button>
            <button type="button" className="admin-btn admin-btn--warn" disabled={busy} onClick={handleFlag}>
              {busy ? 'Submitting…' : 'Flag account'}
            </button>
          </>
        )}
      >
        {error && <p className="admin-error">{error}</p>}
        <p className="admin-muted" style={{ marginBottom: 10 }}>Accounts are automatically suspended at 3 flags.</p>
        <select className="admin-select" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          <option value="">Reason…</option>
          {meta.flagReasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <textarea className="admin-textarea" placeholder="Optional note" value={flagNote} onChange={(e) => setFlagNote(e.target.value)} />
      </AdminModal>
    );
  }

  if (modal.type === 'suspend') {
    return (
      <AdminModal
        open
        title="Suspend Account"
        subtitle={userName(user)}
        onClose={closeModal}
        footer={(
          <>
            <button type="button" className="admin-btn" onClick={closeModal}>Cancel</button>
            <button type="button" className="admin-btn admin-btn--danger" disabled={busy} onClick={handleSuspend}>
              {busy ? 'Suspending…' : 'Suspend account'}
            </button>
          </>
        )}
      >
        {error && <p className="admin-error">{error}</p>}
        <p className="admin-muted" style={{ marginBottom: 10 }}>
          Manual suspension for serious issues. The account will be immediately hidden from all public surfaces.
        </p>
        <textarea
          className="admin-textarea"
          placeholder="Required reason for suspension"
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.84rem' }}>
          <input type="checkbox" checked={suspendConfirm} onChange={(e) => setSuspendConfirm(e.target.checked)} />
          I confirm this manual suspension is warranted
        </label>
      </AdminModal>
    );
  }

  if (modal.type === 'verify') {
    const employer = verifyDetail?.employer || user;
    const isAlreadyVerified = employer?.verificationStatus === 'verified';
    const isRejected = employer?.verificationStatus === 'rejected';

    return (
      <AdminModal
        open
        wide
        title="Verify employer profile"
        subtitle={employer?.organizationName || userName(employer)}
        onClose={closeModal}
        footer={(
          <>
            <button type="button" className="admin-btn" onClick={closeModal}>Cancel</button>
            <Link to={`/admin/users/${user.id}`} className="admin-btn admin-btn--ghost" onClick={closeModal}>Open profile</Link>
            <div style={{ flex: 1 }} />
            {!isAlreadyVerified && (
              <>
                <button type="button" className="admin-btn admin-btn--danger" disabled={busy || !rejectReasonCategory} onClick={handleReject}>
                  {busy ? 'Processing…' : 'Reject profile'}
                </button>
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={handleApprove}>
                  {busy ? 'Processing…' : 'Approve profile'}
                </button>
              </>
            )}
          </>
        )}
      >
        {error && <p className="admin-error">{error}</p>}

        {isAlreadyVerified && (
          <div className="admin-alert admin-alert--success adm-verify-status">
            This employer is already verified. They can post jobs, message freelancers, and use all hiring features.
          </div>
        )}
        {isRejected && !isAlreadyVerified && (
          <div className="admin-alert admin-alert--warn adm-verify-status">
            Previously rejected
            {employer?.verificationRejectionReason ? `: ${employer.verificationRejectionReason}` : '.'}
            {' '}You can verify if documents are now acceptable.
          </div>
        )}

        {!isAlreadyVerified && (
          <p className="admin-muted adm-verify-intro">
            Review the submitted documents. <strong>Approve profile</strong> unlocks job posting, messaging, and other employer features. The employer receives a verification email. To reject, choose a reason below. They will receive a rejection email with that reason.
          </p>
        )}

        <div className="adm-modal-split">
          <div>
            <h3 className="adm-verify-section-title">{userName(employer)}</h3>
            <p className="admin-muted">{employer?.email}</p>
            <p className="admin-muted">Business type: {employer?.businessType || '-'}</p>
            <p className="admin-muted">Joined {formatDate(employer?.createdAt)}</p>

            {!isAlreadyVerified && (
              <div className="adm-verify-reject-box">
                <div className="adm-verify-reject-box__label">Rejection reason</div>
                <p className="admin-muted adm-verify-reject-box__hint">Required only when rejecting. Sent to the employer by email.</p>
                <select
                  className="admin-select"
                  value={rejectReasonCategory}
                  onChange={(e) => setRejectReasonCategory(e.target.value)}
                  style={{ width: '100%', marginBottom: 8 }}
                >
                  <option value="">Select reason…</option>
                  {meta.verificationRejectReasons.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <textarea
                  className="admin-textarea"
                  placeholder="Additional details (optional)"
                  value={rejectReasonDetail}
                  onChange={(e) => setRejectReasonDetail(e.target.value)}
                  rows={3}
                />
                <div className="adm-modal-verify-actions">
                  <button type="button" className="admin-btn admin-btn--danger" disabled={busy || !rejectReasonCategory} onClick={handleReject}>
                    {busy ? 'Processing…' : 'Reject profile'}
                  </button>
                  <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={handleApprove}>
                    {busy ? 'Processing…' : 'Approve profile'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="adm-modal-docs">
            <DocPreview label="PAN Card" path={employer?.panCardDocument} />
            <DocPreview label="Business Registration" path={employer?.businessRegistrationDocument} />
          </div>
        </div>
      </AdminModal>
    );
  }

  if (modal.type === 'deleteJob') {
    const job = modal.job;
    return (
      <AdminModal
        open
        title="Delete Job Post"
        subtitle={job?.title}
        onClose={closeModal}
        footer={(
          <>
            <button type="button" className="admin-btn" onClick={closeModal}>Cancel</button>
            <button type="button" className="admin-btn admin-btn--danger" disabled={busy} onClick={handleDeleteJob}>
              {busy ? 'Removing…' : 'Delete post'}
            </button>
          </>
        )}
      >
        {error && <p className="admin-error">{error}</p>}
        <select className="admin-select" value={deleteCategory} onChange={(e) => setDeleteCategory(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          <option value="">Removal reason…</option>
          {meta.jobDeleteReasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <textarea className="admin-textarea" placeholder="Additional details (optional)" value={deleteDetail} onChange={(e) => setDeleteDetail(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '0.84rem' }}>
          <input type="checkbox" checked={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.checked)} />
          I confirm this post should be permanently removed
        </label>
      </AdminModal>
    );
  }

  if (modal.type === 'viewJob') {
    const job = modal.job;
    return (
      <AdminModal open title={job?.title} subtitle={job?.organizationName} onClose={closeModal} wide>
        <div className="admin-muted" style={{ marginBottom: 12 }}>
          {job?.categoryLabel || job?.category} · {job?.location} · {job?.budgetDisplay || `NPR ${job?.budget?.toLocaleString?.() ?? job?.budget}`}
          {job?.publishStatus === 'draft' && ' · Draft'}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: '0.9rem' }}>{job?.description || 'No description.'}</div>
        {job?.skillsRequired?.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {job.skillsRequired.map((s) => <span key={s} className="admin-badge admin-badge--pending">{s}</span>)}
          </div>
        )}
        {job?.conditions?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="admin-muted" style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requirements</p>
            {job.conditions.map((c) => (
              <p key={c} style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>• {c}</p>
            ))}
          </div>
        )}
        {job?.applicationDeadline && (
          <p className="admin-muted" style={{ marginTop: 14, fontSize: '0.82rem' }}>
            Applications close {new Date(job.applicationDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
        {job?.id && (
          <p style={{ marginTop: 14 }}>
            <a href={`/jobs/${job.id}`} target="_blank" rel="noreferrer" className="admin-btn admin-btn--ghost">Open public view</a>
          </p>
        )}
      </AdminModal>
    );
  }

  return null;
}

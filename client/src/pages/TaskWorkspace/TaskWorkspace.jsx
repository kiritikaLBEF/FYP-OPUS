import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getProfileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { postGatewayForm } from '../Wallet/walletFormat';
import './TaskWorkspace.css';

const STEPS = ['Started', 'In progress', 'Final submitted', 'Awaiting payment', 'Paid', 'Certified'];

const CATEGORY_META = {
  technical: { label: 'Technical', accent: '#0284c7', soft: '#eff8ff', icon: 'code' },
  design: { label: 'Design', accent: '#7c3aed', soft: '#f5f3ff', icon: 'palette' },
  submission: { label: 'Submission', accent: '#b45309', soft: '#fffbeb', icon: 'upload' },
};

const LINK_SHAPED = new Set(['repo', 'preview', 'video']);

const UPDATE_TYPES = {
  note: { label: 'Note', icon: 'note', placeholder: 'Write a quick progress note…' },
  file: { label: 'File', icon: 'paperclip', placeholder: 'Attach a file' },
  repo: { label: 'Repository', icon: 'github', placeholder: 'e.g. https://github.com/org/repo' },
  preview: { label: 'Live preview', icon: 'globe', placeholder: 'e.g. https://your-app.vercel.app' },
  video: { label: 'Demo video', icon: 'video', placeholder: 'e.g. Loom or YouTube link' },
};

const FINAL_TYPE_ORDER = ['repo', 'preview', 'video', 'file', 'note'];

const LOCAL_URL_RE =
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d{1,5})?(\/|$)/i;

function isLocalUrl(v) {
  return LOCAL_URL_RE.test((v || '').trim());
}

function formatBytes(n) {
  const size = Number(n) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKindFromName(name = '', mime = '') {
  const lower = `${name} ${mime}`.toLowerCase();
  if (/image\/|\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(lower)) return 'image';
  if (/pdf|\.pdf(\?|$)/i.test(lower)) return 'pdf';
  if (/video\/|\.(mp4|webm|mov|m4v)(\?|$)/i.test(lower)) return 'video';
  if (/\.(docx?|odt)(\?|$)|word|msword|officedocument\.word/i.test(lower)) return 'word';
  if (/\.(pptx?|odp)(\?|$)|powerpoint|presentation/i.test(lower)) return 'ppt';
  if (/\.(xlsx?|ods|csv)(\?|$)|spreadsheet|excel/i.test(lower)) return 'sheet';
  if (/\.(zip|rar|7z)(\?|$)/i.test(lower)) return 'archive';
  return 'file';
}

const FILE_KIND_LABEL = {
  image: 'Image',
  pdf: 'PDF',
  video: 'Video',
  word: 'Word',
  ppt: 'PowerPoint',
  sheet: 'Spreadsheet',
  archive: 'Archive',
  file: 'File',
};

function AttachmentPreview({ attachment, compact = false }) {
  const [downloading, setDownloading] = useState(false);
  if (!attachment) return null;
  const fileName = attachment.fileName || attachment.name || 'Attachment';
  const mime = attachment.mimeType || attachment.type || '';
  const url = attachment.filePath
    ? getProfileUrl(attachment.filePath)
    : (attachment.previewUrl || '');
  const kind = fileKindFromName(fileName, mime);
  const sizeLabel = attachment.fileSize || attachment.size
    ? formatBytes(attachment.fileSize || attachment.size)
    : '';

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!url || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  const downloadBtn = url ? (
    <button
      type="button"
      className="tw-btn tw-btn--ghost tw-btn--compact tw-file-download"
      onClick={handleDownload}
      disabled={downloading}
    >
      {Icon.download} {downloading ? 'Downloading…' : `Download${sizeLabel ? ` · ${sizeLabel}` : ''}`}
    </button>
  ) : null;

  if (compact) {
    return (
      <div className="tw-file-chip" onClick={(e) => e.stopPropagation()} role="presentation">
        <span className="tw-file-chip__kind">{FILE_KIND_LABEL[kind] || 'File'}</span>
        <em>{fileName}</em>
      </div>
    );
  }

  return (
    <div
      className={`tw-file-preview tw-file-preview--${kind}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className="tw-file-preview__tag">
        <span>{FILE_KIND_LABEL[kind] || 'File'}</span>
        <em>{fileName}</em>
      </div>

      {kind === 'image' && url && (
        <div className="tw-file-preview__media">
          <img src={url} alt={fileName} />
        </div>
      )}

      {kind === 'pdf' && url && (
        <div className="tw-file-preview__media tw-file-preview__media--pdf">
          <iframe title={fileName} src={url} />
        </div>
      )}

      {kind === 'video' && url && (
        <div className="tw-file-preview__media">
          <video controls src={url} preload="metadata">
            <track kind="captions" />
          </video>
        </div>
      )}

      {!['image', 'pdf', 'video'].includes(kind) && (
        <div className="tw-file-preview__doc">
          <span className="tw-file-preview__badge">{FILE_KIND_LABEL[kind]}</span>
          <p>
            {kind === 'word' && 'Word document'}
            {kind === 'ppt' && 'PowerPoint presentation'}
            {kind === 'sheet' && 'Spreadsheet'}
            {kind === 'archive' && 'Compressed archive'}
            {kind === 'file' && 'Attached file'}
            {' · use Download to open in a compatible app'}
          </p>
        </div>
      )}

      {downloadBtn}
    </div>
  );
}

function AttachmentList({ attachments, compact = false }) {
  const list = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <div className={`tw-file-list ${compact ? 'tw-file-list--compact' : ''}`}>
      {list.map((a, i) => (
        <AttachmentPreview
          key={a.id || a.filePath || `${a.fileName || a.name}-${i}`}
          attachment={a}
          compact={compact}
        />
      ))}
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

function stepIndex(status) {
  const normalized = status === 'finalized' ? 'final_submitted' : status;
  return {
    not_started: 0,
    in_progress: 1,
    final_submitted: 2,
    awaiting_payment: 3,
    paid: 4,
    certified: 5,
  }[normalized] ?? 0;
}

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
  circle: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  clockSm: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  send: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sendMd: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
  award: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.2 13.5L7 22l5-3 5 3-1.2-8.5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  qr: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm14 3h3v3h-3v-3zm-3-3h3v3h-3v-3zm3 0h3v3h-3v-3z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  alert: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  alertTri: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  bank: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M12 4l9 6H3l9-6z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
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
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevronUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
};

function LocalUrlWarning({ organizationName }) {
  return (
    <div className="tw-local-warn">
      {Icon.alertTri}
      <p>
        This looks like a local address: {organizationName} won&apos;t be able to open it on their machine.
        Deploy a preview (Vercel, Netlify, Railway), share a temporary tunnel (ngrok, Cloudflare Tunnel), or attach a video walkthrough instead.
      </p>
    </div>
  );
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

function looksLikeFileName(value = '') {
  const v = String(value || '').trim();
  if (!v || v.includes(' ') || v.includes('\n')) return false;
  return /\.[a-z0-9]{2,5}$/i.test(v);
}

const FEEDBACK_KIND_LABEL = {
  next_draft: 'Next draft required',
  disapproved: 'Disapproved',
  approved: 'Approved',
  approved_new_draft: 'Approved · new draft required',
  approved_complete: 'Approved · no further draft',
  changes_requested: 'Changes requested',
};

const DRAFT_DECISION_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  disapproved: 'Disapproved',
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
    title: 'Approve with no further draft required?',
    body: 'This finalizes the project based on this draft and moves it to the payment stage. The freelancer will not need to upload another draft.',
    confirmLabel: 'Yes, finalize & proceed to payment',
  },
  changes_requested: {
    title: 'Request changes on this draft?',
    body: 'This tells the freelancer the draft needs changes. Your comment will appear in the Feedback timeline.',
    confirmLabel: 'Yes, request changes',
  },
};

function MissingFilePanel({
  fileHint,
  canUpload,
  loading,
  onUpload,
}) {
  return (
    <div className="tw-missing-file">
      <div className="tw-file-preview__tag">
        <span>File</span>
        <em>{fileHint || 'No file stored yet'}</em>
      </div>
      <p>
        Only the filename was saved earlier. Upload the real file to enable preview and download
        for both you and the organization.
      </p>
      {canUpload ? (
        <label className="tw-btn tw-btn--primary tw-btn--compact tw-missing-file__upload">
          {Icon.paperclip} {loading ? 'Uploading…' : 'Upload file for preview'}
          <input
            type="file"
            hidden
            multiple
            disabled={loading}
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.mp4,.webm,.mov"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              e.target.value = '';
              if (picked.length) onUpload(picked);
            }}
          />
        </label>
      ) : (
        <p className="tw-missing-file__wait">Waiting for the freelancer to upload the file.</p>
      )}
    </div>
  );
}

function DetailModal({
  view,
  onClose,
  fmtTime,
  role,
  canAttachFiles,
  attaching,
  onAttachFiles,
  canReviewFinal,
  changesNote,
  setChangesNote,
  onAcceptFinal,
  onRequestChanges,
  actionLoading,
}) {
  if (!view) return null;
  const { kind, data } = view;

  let title = 'Details';
  let body = null;
  let footerExtra = null;

  if (kind === 'update') {
    const meta = UPDATE_TYPES[data.type] || UPDATE_TYPES.note;
    const attachments = data.attachments || [];
    const legacyName = !attachments.length && looksLikeFileName(data.body) ? data.body : '';
    const commentText = legacyName ? '' : (data.body || '');
    title = `Progress update ${data.number}`;
    body = (
      <>
        <div className="tw-detail__meta-row">
          <span className="tw-update__type">{meta.label}</span>
          <time>{fmtTime(data.createdAt)}</time>
        </div>
        <h4 className="tw-detail__subtitle">{data.title}</h4>
        {attachments.length > 0 ? (
          <div className="tw-detail__block">
            <span className="tw-detail__label">Attachments</span>
            <AttachmentList attachments={attachments} />
          </div>
        ) : (data.type === 'file' || legacyName) ? (
          <div className="tw-detail__block">
            <span className="tw-detail__label">Attachments</span>
            <MissingFilePanel
              fileHint={legacyName}
              canUpload={canAttachFiles && role === 'freelancer'}
              loading={attaching}
              onUpload={(files) => onAttachFiles({ kind: 'update', id: data.id, files })}
            />
          </div>
        ) : null}
        {commentText && (
          <div className="tw-detail__block">
            <span className="tw-detail__label">
              {LINK_SHAPED.has(data.type) ? 'Link' : 'Comment / note'}
            </span>
            {LINK_SHAPED.has(data.type) ? (
              <a href={commentText} target="_blank" rel="noreferrer" className="tw-link">{commentText}</a>
            ) : (
              <p className="tw-detail__text">{commentText}</p>
            )}
          </div>
        )}
        {data.reviewStatus && data.reviewStatus !== 'pending' && (
          <div className={`tw-detail__block tw-draft-decision tw-draft-decision--${data.reviewStatus}`}>
            <span className="tw-detail__label">Organization decision</span>
            <p className="tw-draft-decision__label">
              {DRAFT_DECISION_LABEL[data.reviewStatus] || data.reviewStatus}
            </p>
            {data.reviewComment && (
              <p className="tw-draft-decision__comment">{data.reviewComment}</p>
            )}
          </div>
        )}
      </>
    );
  } else if (kind === 'final') {
    const meta = UPDATE_TYPES[data.type] || UPDATE_TYPES.note;
    const attachments = data.attachments || [];
    const legacyName = !attachments.length && looksLikeFileName(data.body) ? data.body : '';
    const commentText = legacyName ? '' : (data.body || '');
    title = `Final delivery · Round ${data.round || 1}`;
    body = (
      <>
        <div className="tw-detail__meta-row">
          <span className="tw-update__type">{meta.label}</span>
          {data.submittedAt && <time>{fmtTime(data.submittedAt)}</time>}
        </div>
        {attachments.length > 0 ? (
          <div className="tw-detail__block">
            <span className="tw-detail__label">Attachments</span>
            <AttachmentList attachments={attachments} />
          </div>
        ) : (data.type === 'file' || legacyName) ? (
          <div className="tw-detail__block">
            <span className="tw-detail__label">Attachments</span>
            <MissingFilePanel
              fileHint={legacyName}
              canUpload={canAttachFiles && role === 'freelancer'}
              loading={attaching}
              onUpload={(files) => onAttachFiles({ kind: 'final', files })}
            />
          </div>
        ) : null}
        {commentText && (
          <div className="tw-detail__block">
            <span className="tw-detail__label">
              {LINK_SHAPED.has(data.type) ? 'Delivery link' : 'Delivery'}
            </span>
            {LINK_SHAPED.has(data.type) ? (
              <a href={commentText} target="_blank" rel="noreferrer" className="tw-link">{commentText}</a>
            ) : (
              <p className="tw-detail__text">{commentText}</p>
            )}
          </div>
        )}
        {data.notes && (
          <div className="tw-detail__block">
            <span className="tw-detail__label">Notes for organization</span>
            <p className="tw-detail__text">{data.notes}</p>
          </div>
        )}
        {data.techStack && (
          <div className="tw-detail__block">
            <span className="tw-detail__label">Tech stack</span>
            <p className="tw-detail__text">{data.techStack}</p>
          </div>
        )}
        {data.setupNotes && (
          <div className="tw-detail__block">
            <span className="tw-detail__label">How to run it</span>
            <p className="tw-detail__text">{data.setupNotes}</p>
          </div>
        )}
      </>
    );
    if (canReviewFinal) {
      footerExtra = (
        <div className="tw-detail__review">
          <button
            type="button"
            className="tw-btn tw-btn--primary tw-btn--block"
            disabled={actionLoading}
            onClick={onAcceptFinal}
          >
            {Icon.check} Approve
          </button>
          <label className="tw-field-label">
            Comment (required for Next draft or Disapprove)
            <textarea
              value={changesNote}
              onChange={(e) => setChangesNote(e.target.value)}
              rows={3}
              placeholder="Explain what needs to change…"
              className="tw-input tw-textarea"
            />
          </label>
          <div className="tw-changes-row">
            <button
              type="button"
              className="tw-btn tw-btn--amber tw-btn--flex"
              disabled={actionLoading || !changesNote.trim()}
              onClick={() => onRequestChanges('next_draft')}
            >
              Next draft required
            </button>
            <button
              type="button"
              className="tw-btn tw-btn--danger tw-btn--flex"
              disabled={actionLoading || !changesNote.trim()}
              onClick={() => onRequestChanges('disapproved')}
            >
              Disapprove
            </button>
          </div>
        </div>
      );
    }
  } else if (kind === 'feedback') {
    const related = data.relatedDelivery;
    const relatedAttachments = related?.attachments || [];
    title = FEEDBACK_KIND_LABEL[data.kind] || 'Feedback';
    body = (
      <>
        <div className="tw-detail__meta-row">
          <span className={`tw-feedback-kind tw-feedback-kind--${data.kind || 'next_draft'}`}>
            {FEEDBACK_KIND_LABEL[data.kind] || 'Feedback'}
          </span>
          <span>Round {data.round}</span>
          <time>{fmtTime(data.createdAt)}</time>
        </div>
        <div className="tw-detail__block">
          <span className="tw-detail__label">Organization feedback</span>
          <p className="tw-detail__text">{data.text}</p>
        </div>
        {related && (
          <div className="tw-detail__block tw-detail__block--nested">
            <span className="tw-detail__label">Related final delivery</span>
            <p className="tw-detail__text">
              <strong>{(UPDATE_TYPES[related.type] || UPDATE_TYPES.note).label}</strong>
              {related.type !== 'file' && related.body && !looksLikeFileName(related.body)
                ? `: ${related.body}`
                : ''}
            </p>
            {relatedAttachments.length > 0 ? (
              <AttachmentList attachments={relatedAttachments} />
            ) : related.type === 'file' || looksLikeFileName(related.body) ? (
              <p className="tw-detail__text tw-detail__muted">
                File was not stored with this delivery ({related.body || 'missing file'}).
              </p>
            ) : null}
            {related.notes && (
              <p className="tw-detail__text tw-detail__muted">Notes: {related.notes}</p>
            )}
            {related.techStack && (
              <p className="tw-detail__text tw-detail__muted">Stack: {related.techStack}</p>
            )}
            {related.setupNotes && (
              <p className="tw-detail__text tw-detail__muted">Setup: {related.setupNotes}</p>
            )}
          </div>
        )}
        <p className="tw-detail__status">
          {data.resolved ? 'Addressed in a later submission' : 'Needs action from the freelancer'}
        </p>
      </>
    );
  }

  return (
    <div className="tw-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tw-modal tw-modal--detail" onClick={(e) => e.stopPropagation()}>
        <div className="tw-modal__head">
          <h3 className="tw-modal__title">{title}</h3>
          <button type="button" className="tw-modal__close" onClick={onClose} aria-label="Close">
            {Icon.close}
          </button>
        </div>
        <div className="tw-detail__body">{body}</div>
        {footerExtra}
        <div className="tw-modal__actions">
          <button type="button" className="tw-btn tw-btn--primary tw-btn--flex" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function PaymentCard({ role, status, paymentRef, amount, amountValue, paymentBreakdown, sessionId, onPaid, loading }) {
  const [wallet, setWallet] = useState(null);
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState('');
  const due = Number(amountValue || 0);
  const feeRate = paymentBreakdown?.feeRate ?? 0.1;
  const fee = Number(paymentBreakdown?.fee ?? roundMoney(due * feeRate));
  const net = Number(paymentBreakdown?.net ?? roundMoney(due - fee));
  const available = Number(wallet?.availableBalance || 0);
  const canWalletPay = available >= due && due > 0;
  const khaltiOn = !!wallet?.providers?.khalti?.collection;

  const money = (n) => `NPR ${Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    if (role !== 'employer' || status !== 'awaiting_payment') return undefined;
    let cancelled = false;
    api.getWallet()
      .then((data) => { if (!cancelled) setWallet(data); })
      .catch(() => { if (!cancelled) setWallet(null); });
    return () => { cancelled = true; };
  }, [role, status]);

  const payWallet = async () => {
    setBusy('wallet');
    setLocalError('');
    try {
      await onPaid(() => api.paySessionFromWallet(sessionId));
    } catch (err) {
      setLocalError(err.message || 'Could not pay from wallet');
    } finally {
      setBusy('');
    }
  };

  const payGateway = async (provider) => {
    setBusy(provider);
    setLocalError('');
    try {
      const data = await api.initiateWalletPayment({
        provider,
        kind: 'job_pay',
        sessionId,
        successRedirect: `/employer/workspace/${sessionId}`,
      });
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }
      if (data.form?.action) postGatewayForm(data.form.action, data.form.fields);
    } catch (err) {
      setLocalError(err.message || 'Could not start payment');
      setBusy('');
    }
  };

  return (
    <div className="tw-card tw-payment">
      <div className="tw-payment__head">
        {Icon.bank}
        <p>{status === 'awaiting_payment' ? 'Pay into the freelancer OPUS wallet' : 'Paid into OPUS wallet'}</p>
      </div>
      <div className="tw-payment__meta tw-payment__meta--full">
        <div className="tw-row"><span>Job amount</span><strong>{amount}</strong></div>
        {due > 0 && (
          <>
            <div className="tw-row"><span>OPUS service charge ({Math.round(feeRate * 100)}%)</span><strong>{money(fee)}</strong></div>
            <div className="tw-row">
              <span>{role === 'freelancer' ? 'You receive' : 'Freelancer receives'}</span>
              <strong>{money(net)}</strong>
            </div>
          </>
        )}
        <div className="tw-row"><span>Reference</span><code>{paymentRef}</code></div>
        <div className="tw-row">
          <span>Status</span>
          {status === 'awaiting_payment' ? (
            <em className="tw-status-amber">{Icon.alert} Awaiting payment</em>
          ) : (
            <em className="tw-status-green">{Icon.check} Paid</em>
          )}
        </div>
        {role === 'employer' && status === 'awaiting_payment' && (
          <>
            <div className="tw-row">
              <span>Your OPUS balance</span>
              <strong>NPR {available.toLocaleString('en-NP', { minimumFractionDigits: 2 })}</strong>
            </div>
            {localError ? <p className="tw-hint tw-hint--pad">{localError}</p> : null}
            <button
              type="button"
              className="tw-btn tw-btn--primary tw-btn--block"
              disabled={loading || !!busy || !canWalletPay}
              onClick={payWallet}
            >
              {busy === 'wallet' ? 'Paying…' : canWalletPay ? 'Pay from OPUS wallet' : 'Not enough OPUS balance'}
            </button>
            <div className="tw-payment__gateways">
              <button type="button" className="tw-btn tw-btn--block" disabled={loading || !!busy} onClick={() => payGateway('esewa')}>
                {busy === 'esewa' ? 'Opening eSewa…' : 'Pay with eSewa'}
              </button>
              <button type="button" className="tw-btn tw-btn--block" disabled={loading || !!busy || !khaltiOn} onClick={() => payGateway('khalti')}>
                {khaltiOn ? (busy === 'khalti' ? 'Opening Khalti…' : 'Pay with Khalti') : 'Khalti not configured'}
              </button>
            </div>
            <p className="tw-hint tw-hint--pad">
              You pay the full job amount. OPUS keeps {Math.round(feeRate * 100)}% as a service charge and credits the rest to the freelancer wallet.
            </p>
            <Link className="tw-text-link" to="/employer/wallet">Open organization wallet</Link>
          </>
        )}
        {role === 'freelancer' && status === 'awaiting_payment' && (
          <p className="tw-hint tw-hint--pad">
            Waiting for the organization to pay the job amount. OPUS will keep a {Math.round(feeRate * 100)}% service charge; the rest lands in your wallet.
          </p>
        )}
        {role === 'freelancer' && status !== 'awaiting_payment' && (
          <p className="tw-hint tw-hint--pad">
            This payment is in your OPUS wallet. <Link to="/wallet">Open Wallet</Link> to withdraw to eSewa or Khalti.
          </p>
        )}
      </div>
    </div>
  );
}

function Certificate({
  certificateId,
  taskTitle,
  organization,
  freelancerName,
  added,
  onAdd,
  onDownload,
  loading,
  role,
  issuedAt,
}) {
  const issued = issuedAt
    ? new Date(issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="tw-cert-wrap">
      <div className="tw-section-label">{Icon.shield} Certificate of Completion</div>
      <div id="opus-certificate" className="tw-certificate">
        <p className="tw-certificate__eyebrow">OPUS · Freelance Marketplace</p>
        <h2>Certificate of Completion</h2>
        <p className="tw-certificate__lead">This certifies that the freelancer has successfully completed</p>
        <p className="tw-certificate__title">&ldquo;{taskTitle}&rdquo;</p>
        {freelancerName && (
          <p className="tw-certificate__org">Awarded to <strong>{freelancerName}</strong></p>
        )}
        <p className="tw-certificate__org">
          commissioned by <strong>{organization}</strong>
        </p>
        <div className="tw-certificate__rule">{Icon.shield}</div>
        <div className="tw-certificate__foot">
          <div>
            <span>Issued</span>
            <p>{issued}</p>
          </div>
          <div>
            <span>Certificate ID</span>
            <p className="tw-mono">{certificateId}</p>
          </div>
        </div>
      </div>
      <div className="tw-cert-actions">
        <button type="button" className="tw-btn tw-btn--ghost" disabled={loading} onClick={onDownload}>
          {Icon.download} Download PDF
        </button>
        {role === 'freelancer' && (
          <button type="button" className="tw-btn tw-btn--primary" disabled={added || loading} onClick={onAdd}>
            {added ? <>{Icon.check} Added to profile</> : <>{Icon.award} Add to my profile</>}
          </button>
        )}
      </div>
      {role === 'freelancer' && added && (
        <p className="tw-hint">This certificate was emailed to you and added to your profile Certifications.</p>
      )}
      {role === 'employer' && (
        <p className="tw-hint">The PDF was emailed to the freelancer and added to their OPUS profile.</p>
      )}
    </div>
  );
}

function BodyField({ type, value, files, onChange, onFilesChange, placeholders, rose }) {
  const inputClass = rose ? 'tw-input tw-input--rose' : 'tw-input';

  if (type === 'note') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholders.note || 'Write a note…'}
        className={`${inputClass} tw-textarea`}
      />
    );
  }
  if (type === 'file') {
    return (
      <div className="tw-file-picker">
        <label className={rose ? 'tw-attach tw-attach--rose' : 'tw-attach tw-attach--dashed'}>
          {Icon.paperclip}
          {files?.length
            ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
            : (placeholders.file || 'Attach files')}
          <input
            type="file"
            hidden
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.mp4,.webm,.mov"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              onFilesChange?.(picked);
              e.target.value = '';
            }}
          />
        </label>
        {!!files?.length && (
          <div className="tw-file-picked">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="tw-file-chip">
                <span className="tw-file-chip__kind">{FILE_KIND_LABEL[fileKindFromName(f.name, f.type)]}</span>
                <em>{f.name}</em>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Add a comment about these files (optional)…"
          className={`${inputClass} tw-textarea`}
        />
      </div>
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholders[type] || 'Enter a URL'}
      className={inputClass}
    />
  );
}

export default function TaskWorkspace() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [updateType, setUpdateType] = useState('note');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateBody, setUpdateBody] = useState('');
  const [updateFiles, setUpdateFiles] = useState([]);

  const [finalType, setFinalType] = useState('repo');
  const [finalBody, setFinalBody] = useState('');
  const [finalFiles, setFinalFiles] = useState([]);
  const [finalNotes, setFinalNotes] = useState('');
  const [showSetupDetails, setShowSetupDetails] = useState(false);
  const [techStack, setTechStack] = useState('');
  const [setupNotes, setSetupNotes] = useState('');
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [changesNote, setChangesNote] = useState('');
  const [draftComments, setDraftComments] = useState({});
  const [draftConfirm, setDraftConfirm] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [attachingFiles, setAttachingFiles] = useState(false);

  const [messageDraft, setMessageDraft] = useState('');
  const [sidebarTab, setSidebarTab] = useState('feedback');
  const threadEndRef = useRef(null);

  // Prefer workspace role from API (who you are on this session)
  const role = session?.role
    || (user?.role === 'employer' ? 'employer' : 'freelancer');
  const backPath = role === 'employer' ? '/employer/check-status' : '/dashboard';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getWorkSession(sessionId);
      setSession(data.session);
    } catch (err) {
      setError(err.message || 'Failed to load workspace');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (sidebarTab === 'discussion') {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [session?.messages?.length, sidebarTab]);

  const run = async (fn) => {
    setActionLoading(true);
    setError('');
    try {
      const data = await fn();
      if (data?.session) setSession(data.session);
      else await load();
      return data;
    } catch (err) {
      setError(err.message || 'Action failed');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const fmt = (n) => `रू ${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = (d) => (d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-');
  const fmtTime = (d) =>
    new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return <div className="tw-page"><div className="tw-loading">Loading workspace…</div></div>;
  }

  if (!session) {
    return (
      <div className="tw-page">
        <div className="tw-card tw-empty">
          <p>{error || 'Workspace not found'}</p>
          <Link to={backPath} className="tw-btn tw-btn--ghost">Go back</Link>
        </div>
      </div>
    );
  }

  const status = session.status === 'finalized' ? 'final_submitted' : session.status;
  const idx = stepIndex(status);
  const guidelines = session.guidelines || [];
  const updates = session.progressUpdates || [];
  const feedbackLog = session.feedbackLog || [];
  const messages = session.messages || [];
  const unresolvedFeedback = session.unresolvedFeedback || 0;
  const checkedCount = guidelines.filter((g) => g.checked).length;
  const progressPct = guidelines.length
    ? Math.round((checkedCount / guidelines.length) * 100)
    : 100;
  const remainingGuidelines = guidelines.length - checkedCount;
  const amountLabel = session.budgetType === 'hourly'
    ? `${fmt(session.bidAmount)} / hr`
    : fmt(session.bidAmount);
  const orgInitials = (session.organizationName || 'OR')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const showFinalCard = !!session.finalDelivery && status !== 'in_progress' && status !== 'not_started';
  const finalMeta = UPDATE_TYPES[session.finalDelivery?.type] || UPDATE_TYPES.note;

  const canPostUpdate = updateType === 'file'
    ? !!updateTitle.trim() && updateFiles.length > 0
    : !!updateTitle.trim() && !!updateBody.trim();

  const canOpenFinalSubmit = finalType === 'file'
    ? finalFiles.length > 0 && session.canSubmitFinal
    : !!finalBody.trim() && session.canSubmitFinal;

  const postUpdate = () => {
    if (!canPostUpdate) return;
    run(async () => {
      const form = new FormData();
      form.append('type', updateType);
      form.append('title', updateTitle.trim());
      form.append('body', updateBody.trim());
      updateFiles.forEach((f) => form.append('files', f));
      const data = await api.addWorkUpdate(session.id, form);
      setUpdateTitle('');
      setUpdateBody('');
      setUpdateFiles([]);
      return data;
    });
  };

  const submitFinal = () => {
    run(async () => {
      const form = new FormData();
      form.append('type', finalType);
      form.append('body', finalBody.trim());
      form.append('notes', finalNotes.trim());
      form.append('techStack', techStack.trim());
      form.append('setupNotes', setupNotes.trim());
      finalFiles.forEach((f) => form.append('files', f));
      const data = await api.submitFinalDelivery(session.id, form);
      setShowFinalConfirm(false);
      setFinalBody('');
      setFinalFiles([]);
      setFinalNotes('');
      setTechStack('');
      setSetupNotes('');
      setShowSetupDetails(false);
      return data;
    });
  };

  const acceptFinal = () => {
    run(async () => {
      const data = await api.acceptFinalDelivery(session.id);
      setShowAcceptConfirm(false);
      return data;
    });
  };

  const attachFilesToDetail = ({ kind, id, files }) => {
    if (!files?.length) return;
    setAttachingFiles(true);
    setError('');
    run(async () => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      const data = kind === 'final'
        ? await api.attachFinalDeliveryFiles(session.id, form)
        : await api.attachWorkUpdateFiles(session.id, id, form);
      if (data?.session) {
        if (kind === 'final') {
          setDetailView({ kind: 'final', data: data.session.finalDelivery });
        } else {
          const next = (data.session.progressUpdates || []).find((u) => u.id === id);
          if (next) setDetailView({ kind: 'update', data: next });
        }
      }
      return data;
    }).finally(() => setAttachingFiles(false));
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
      const data = await api.reviewWorkUpdate(session.id, updateId, { decision, comment });
      setDraftComments((prev) => {
        const next = { ...prev };
        delete next[updateId];
        return next;
      });
      setDraftConfirm(null);
      setSidebarTab('feedback');
      return data;
    });
  };

  const revertDraftReview = (updateId) => {
    run(async () => api.revertWorkUpdateReview(session.id, updateId));
  };

  const requestChanges = (kind) => {
    if (!changesNote.trim()) return;
    run(async () => {
      const data = await api.requestFinalChanges(session.id, {
        note: changesNote.trim(),
        kind,
      });
      setChangesNote('');
      setSidebarTab('feedback');
      setDetailView(null);
      return data;
    });
  };

  const sendMessage = () => {
    if (!messageDraft.trim()) return;
    run(async () => {
      const data = await api.sendWorkMessage(session.id, { text: messageDraft.trim() });
      setMessageDraft('');
      return data;
    });
  };

  return (
    <div className="tw-page">
      <div className="tw-shell">
        <header className="tw-titlebar">
          <div className="tw-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="tw-titlebar__label">
            {role === 'employer' ? 'Check Status: Task Workspace' : 'My Bids: Task Workspace'}
          </div>
        </header>

        <div className="tw-header">
          <button type="button" className="tw-back" onClick={() => navigate(backPath)}>
            {Icon.back} {role === 'employer' ? 'Back to Check Status' : 'Back to My Bids'}
          </button>

          <div className="tw-header__row">
            <div>
              <div className="tw-accepted">{Icon.check} Bid accepted</div>
              <h1>{session.title}</h1>
              <p>
                {session.organizationName} · {session.categoryLabel} · Deadline {fmtDate(session.deadline)}
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
            {status === 'not_started' ? (
              role === 'employer' ? (
                <div className="tw-card tw-center">
                  <div className="tw-icon-circle">{Icon.clock}</div>
                  <h3>{session.freelancerName || 'Freelancer'} has not started the project yet</h3>
                  <p>
                    The bid is accepted and the workspace is ready. You can send {session.freelancerName || 'the freelancer'}{' '}
                    a reminder email asking them to open the task and click Start working.
                  </p>
                  {session.startReminderSent ? (
                    <p className="tw-reminder-sent">{Icon.check} Reminder sent</p>
                  ) : (
                    <button
                      type="button"
                      className="tw-btn tw-btn--primary"
                      disabled={actionLoading || !session.canSendStartReminder}
                      onClick={() => run(() => api.sendWorkStartReminder(session.id))}
                    >
                      Send them a reminder to start the project
                    </button>
                  )}
                  {session.startReminderSentAt && (
                    <p className="tw-hint">
                      Last reminder: {fmtTime(session.startReminderSentAt)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="tw-card tw-center">
                  <div className="tw-icon-circle">{Icon.clock}</div>
                  <h3>Ready to begin?</h3>
                  <p>
                    Once you start, you can post progress updates for{' '}
                    <strong>{session.organizationName}</strong> and check off the guidelines as you go.
                  </p>
                  <button
                    type="button"
                    className="tw-btn tw-btn--primary"
                    disabled={actionLoading}
                    onClick={() => run(() => api.startWorkSession(session.id))}
                  >
                    Start working
                  </button>
                </div>
              )
            ) : (
              <>
                {role === 'freelancer' && unresolvedFeedback > 0 && status === 'in_progress' && (
                  <button
                    type="button"
                    className="tw-banner tw-banner--amber tw-banner--btn"
                    onClick={() => setSidebarTab('feedback')}
                  >
                    {Icon.alertTri}
                    <div>
                      <p className="tw-banner__title">{session.organizationName} requested changes</p>
                      <p className="tw-banner__sub">
                        Open the Feedback tab in the sidebar for details, then re-submit as final when ready.
                      </p>
                    </div>
                  </button>
                )}

                {role === 'employer' && session.canAcceptFinal && (
                  <div className="tw-card tw-employer-review">
                    <div className="tw-employer-review__head">
                      {Icon.shield}
                      <div>
                        <p className="tw-cta__title">Final delivery review</p>
                        <p className="tw-cta__sub">
                          Approve the formal final delivery, or leave a comment to request the next draft / request changes.
                        </p>
                      </div>
                    </div>
                    {session.finalDelivery && (
                      <button
                        type="button"
                        className="tw-btn tw-btn--ghost tw-btn--block"
                        onClick={() => setDetailView({ kind: 'final', data: session.finalDelivery })}
                      >
                        Preview final delivery details
                      </button>
                    )}
                    <label className="tw-field-label">
                      Comment (required for Next draft / Request changes)
                      <textarea
                        value={changesNote}
                        onChange={(e) => setChangesNote(e.target.value)}
                        rows={3}
                        placeholder="Explain what needs to change…"
                        className="tw-input tw-textarea"
                      />
                    </label>
                    <div className="tw-employer-actions">
                      <button
                        type="button"
                        className="tw-btn tw-btn--primary"
                        disabled={actionLoading}
                        onClick={() => setShowAcceptConfirm(true)}
                      >
                        {Icon.check} Approve
                      </button>
                      <button
                        type="button"
                        className="tw-btn tw-btn--amber"
                        disabled={actionLoading || !changesNote.trim()}
                        onClick={() => requestChanges('next_draft')}
                      >
                        Next draft required
                      </button>
                      <button
                        type="button"
                        className="tw-btn tw-btn--danger"
                        disabled={actionLoading || !changesNote.trim()}
                        onClick={() => requestChanges('disapproved')}
                      >
                        Request changes
                      </button>
                    </div>
                  </div>
                )}

                <div className="tw-section-head">
                  <p className="tw-section-kicker">Drafts</p>
                  <span className="tw-section-hint">
                    Review each draft: approve with another draft, approve as complete, or request changes
                  </span>
                </div>

                {session.canPostUpdate && (
                  <div className="tw-card tw-composer">
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
                    {LINK_SHAPED.has(updateType) && isLocalUrl(updateBody) && (
                      <LocalUrlWarning organizationName={session.organizationName} />
                    )}
                    <div className="tw-composer__foot tw-composer__foot--end">
                      <button
                        type="button"
                        className="tw-btn tw-btn--primary tw-btn--compact"
                        disabled={actionLoading || !canPostUpdate}
                        onClick={postUpdate}
                      >
                        {Icon.send} Post update
                      </button>
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
                            onClick={() => setDetailView({ kind: 'update', data: u })}
                          >
                            <div className="tw-update__icon">{Icon[meta.icon] || Icon.note}</div>
                            <div className="tw-update__body">
                              <div className="tw-update__top">
                                <p className="tw-update__title">{u.title}</p>
                                <span className="tw-update__num">Draft {u.number}</span>
                                <span className="tw-update__type">{meta.label}</span>
                                {reviewStatus !== 'pending' && (
                                  <span className={`tw-pill tw-pill--decision tw-pill--${reviewStatus}`}>
                                    {DRAFT_DECISION_LABEL[reviewStatus] || reviewStatus}
                                  </span>
                                )}
                              </div>
                              <p className="tw-update__text">
                                {LINK_SHAPED.has(u.type) ? (
                                  <span className="tw-link">{u.body}</span>
                                ) : u.type === 'file' ? (
                                  u.body || null
                                ) : u.body}
                              </p>
                              {!!u.attachments?.length && (
                                <AttachmentSummary attachments={u.attachments} />
                              )}
                              {u.type === 'file' && !u.attachments?.length && (
                                <div className="tw-attach-summary tw-attach-summary--warn">
                                  {Icon.paperclip}
                                  <span>File not stored yet · open to upload</span>
                                </div>
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
                              {u.canRevertDraft && (
                                <button
                                  type="button"
                                  className="tw-btn tw-btn--ghost tw-btn--compact"
                                  disabled={actionLoading}
                                  onClick={() => revertDraftReview(u.id)}
                                >
                                  Revert decision
                                </button>
                              )}
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
                                  disabled={actionLoading || !draftComment.trim()}
                                  onClick={() => askReviewDraft(u.id, 'approved_new_draft')}
                                >
                                  Approved · new draft required
                                </button>
                                <button
                                  type="button"
                                  className="tw-btn tw-btn--green tw-btn--compact"
                                  disabled={actionLoading || !draftComment.trim()}
                                  onClick={() => askReviewDraft(u.id, 'approved_complete')}
                                >
                                  Approved · no further draft required
                                </button>
                                <button
                                  type="button"
                                  className="tw-btn tw-btn--danger tw-btn--compact"
                                  disabled={actionLoading || !draftComment.trim()}
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

                {role === 'freelancer' && status === 'in_progress' && (
                  <div className="tw-card tw-notice">
                    {Icon.shield}
                    <div>
                      <p className="tw-cta__title">Keep posting drafts until the organization decides</p>
                      <p className="tw-cta__sub">
                        {session.organizationName} reviews each draft with a comment. If they choose
                        &ldquo;Approved · no further draft required&rdquo;, the project moves to payment.
                      </p>
                    </div>
                  </div>
                )}

                {showFinalCard && (
                  <div className="tw-final">
                    <div className="tw-final__card-head">
                      <div className="tw-final__label">
                        {Icon.shield}
                        <p>Final delivery · Round {session.finalDelivery.round}</p>
                      </div>
                      {status === 'final_submitted' && (
                        <span className="tw-pill tw-pill--amber">{Icon.clockSm} Awaiting review</span>
                      )}
                      {idx > stepIndex('final_submitted') && (
                        <span className="tw-pill tw-pill--green">{Icon.check} Accepted</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="tw-final__content tw-final__content--clickable"
                      onClick={() => setDetailView({ kind: 'final', data: session.finalDelivery })}
                    >
                      <div className="tw-final__content-icon">{Icon[finalMeta.icon] || Icon.note}</div>
                      <div>
                        <p className="tw-final__body">
                          {LINK_SHAPED.has(session.finalDelivery.type) ? (
                            <span className="tw-link">{session.finalDelivery.body}</span>
                          ) : session.finalDelivery.type === 'file' ? (
                            session.finalDelivery.body || (session.finalDelivery.attachments?.length
                              ? `${session.finalDelivery.attachments.length} attachment${session.finalDelivery.attachments.length > 1 ? 's' : ''}`
                              : '')
                          ) : session.finalDelivery.body}
                        </p>
                        {!!session.finalDelivery.attachments?.length && (
                          <AttachmentSummary attachments={session.finalDelivery.attachments} />
                        )}
                        {session.finalDelivery.notes && (
                          <p className="tw-final__notes">{session.finalDelivery.notes}</p>
                        )}
                        {(session.finalDelivery.techStack || session.finalDelivery.setupNotes) && (
                          <div className="tw-final__meta">
                            {session.finalDelivery.techStack && (
                              <p><span>Stack:</span> {session.finalDelivery.techStack}</p>
                            )}
                            {session.finalDelivery.setupNotes && (
                              <p><span>Setup:</span> {session.finalDelivery.setupNotes}</p>
                            )}
                          </div>
                        )}
                        <time>Submitted {fmtTime(session.finalDelivery.submittedAt)}</time>
                        <span className="tw-update__hint">Click to view full details</span>
                      </div>
                    </button>

                    {role === 'freelancer' && status === 'final_submitted' && (
                      <p className="tw-hint tw-hint--pad">
                        Waiting for {session.organizationName} to Accept, request the next draft, or Reject with a comment.
                      </p>
                    )}
                  </div>
                )}

                {['awaiting_payment', 'paid', 'certified'].includes(status) && (
                  <PaymentCard
                    role={role}
                    status={status === 'awaiting_payment' ? 'awaiting_payment' : 'paid'}
                    paymentRef={session.paymentRef}
                    amount={amountLabel}
                    amountValue={session.bidAmount}
                    paymentBreakdown={session.paymentBreakdown}
                    sessionId={session.id}
                    loading={actionLoading}
                    onPaid={(fn) => run(fn)}
                  />
                )}

                {role === 'employer' && status === 'paid' && (
                  <div className="tw-card tw-cta">
                    <div className="tw-cta__with-icon">
                      {Icon.award}
                      <div>
                        <p className="tw-cta__title">Issue certificate of completion</p>
                        <p className="tw-cta__sub">
                          Creates a PDF, emails it to the freelancer, and adds it to their profile.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="tw-btn tw-btn--primary"
                      disabled={actionLoading}
                      onClick={() => run(() => api.issueWorkCertificate(session.id))}
                    >
                      Issue certificate
                    </button>
                  </div>
                )}

                {status === 'certified' && session.certificateId && (
                  <Certificate
                    certificateId={session.certificateId}
                    taskTitle={session.title}
                    organization={session.organizationName}
                    freelancerName={session.freelancerName}
                    added={session.certificateAddedToProfile}
                    issuedAt={session.certifiedAt}
                    loading={actionLoading}
                    role={role}
                    onAdd={() => run(() => api.addWorkCertificateToProfile(session.id))}
                    onDownload={() => run(async () => {
                      const { blob, filename } = await api.downloadWorkCertificate(session.id);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                      return { session };
                    })}
                  />
                )}
              </>
            )}
          </main>

          <aside className="tw-side">
            <div className="tw-side__scroll">
              <div className="tw-card">
                <div className="tw-org">
                  <div className="tw-org__avatar">{orgInitials}</div>
                  <div>
                    <p className="tw-org__name">{session.organizationName}</p>
                    <p className="tw-org__sub">Verified organization</p>
                  </div>
                </div>
                <div className="tw-side-meta">
                  <div><span>Category</span><em>{session.categoryLabel}</em></div>
                  <div><span>Deadline</span><em>{fmtDate(session.deadline)}</em></div>
                  <div><span>Updates posted</span><em>{updates.length}</em></div>
                </div>
                {session.description?.trim() && (
                  <p className="tw-brief__text tw-brief__text--side">{session.description}</p>
                )}
              </div>

              <div className="tw-card tw-guidelines">
                <div className="tw-guidelines__head">
                  <p className="tw-side-title">{Icon.list} Guidelines</p>
                  <span className="tw-guidelines__pct">{progressPct}%</span>
                </div>
                <div className="tw-guidelines__bar">
                  <div className="tw-guidelines__fill" style={{ width: `${progressPct}%` }} />
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
                            const canToggle = session.canToggleGuidelines;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                className={`tw-guideline-row ${g.checked ? 'is-checked' : ''}`}
                                disabled={!canToggle || actionLoading}
                                onClick={() => {
                                  if (!canToggle) return;
                                  run(() => api.toggleWorkGuideline(session.id, g.id, { checked: !g.checked }));
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
                    Set by {session.organizationName} at the start of the task. Visible at every stage.
                  </p>
                )}
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
                  {unresolvedFeedback > 0 && (
                    <span className="tw-side-tab__badge">{unresolvedFeedback}</span>
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
                        Accept, next-draft, and reject notes from the organization appear here in order.
                        Click any entry to open the full feedback and related delivery preview.
                      </span>
                    </div>
                  ) : (
                    <div className="tw-feedback-timeline">
                      {[...feedbackLog].reverse().map((f, index) => (
                        <button
                          key={f.id}
                          type="button"
                          className={`tw-feedback-card tw-feedback-card--clickable ${f.resolved ? 'is-resolved' : 'is-open'}`}
                          onClick={() => setDetailView({ kind: 'feedback', data: f })}
                        >
                          <span className="tw-feedback-card__dot" aria-hidden="true" />
                          {index < feedbackLog.length - 1 && (
                            <span className="tw-feedback-card__line" aria-hidden="true" />
                          )}
                          <div className="tw-feedback-card__head">
                            <span className={`tw-feedback-kind tw-feedback-kind--${f.kind || 'next_draft'}`}>
                              {FEEDBACK_KIND_LABEL[f.kind] || 'Feedback'}
                            </span>
                            <span>Round {f.round}</span>
                            {f.resolved ? (
                              <em className="tw-status-green">{Icon.check} Addressed</em>
                            ) : (
                              <em className="tw-status-amber">{Icon.clockSm} Needs action</em>
                            )}
                          </div>
                          <p>{f.text}</p>
                          <time>{fmtTime(f.createdAt)}</time>
                          <span className="tw-update__hint">Click to view full feedback</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="tw-side-tabs__panel tw-discussion">
                    {messages.map((m) => {
                      const mine = m.authorRole === role;
                      return (
                        <div key={m.id} className={`tw-bubble-row ${mine ? 'is-mine' : ''}`}>
                          <div className={`tw-bubble ${mine ? 'tw-bubble--mine' : 'tw-bubble--theirs'}`}>
                            <p>{m.text}</p>
                            <time>{fmtTime(m.createdAt)}</time>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>
                  <div className="tw-discussion-form">
                    <input
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendMessage();
                      }}
                      placeholder="Message the other side…"
                      className="tw-input"
                    />
                    <button
                      type="button"
                      className="tw-icon-btn"
                      disabled={actionLoading || !messageDraft.trim()}
                      onClick={sendMessage}
                      aria-label="Send message"
                    >
                      {Icon.sendMd}
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showFinalConfirm && (
        <ConfirmModal
          icon={Icon.lock}
          title="Submit as final delivery?"
          body={`This locks progress updates and sends the work to ${session.organizationName} for formal acceptance. You can still add more if they request changes.`}
          confirmLabel="Yes, submit as final"
          loading={actionLoading}
          onConfirm={submitFinal}
          onCancel={() => setShowFinalConfirm(false)}
        />
      )}
      {draftConfirm && (
        <ConfirmModal
          icon={draftConfirm.decision === 'changes_requested' ? Icon.alertTri : Icon.check}
          title={DRAFT_CONFIRM[draftConfirm.decision]?.title || 'Confirm decision?'}
          body={DRAFT_CONFIRM[draftConfirm.decision]?.body || 'Please confirm this review decision.'}
          confirmLabel={DRAFT_CONFIRM[draftConfirm.decision]?.confirmLabel || 'Confirm'}
          loading={actionLoading}
          onConfirm={confirmReviewDraft}
          onCancel={() => setDraftConfirm(null)}
        />
      )}
      {showAcceptConfirm && (
        <ConfirmModal
          icon={<span className="tw-modal__icon--green">{Icon.check}</span>}
          title="Approve this work?"
          body="This confirms the work and moves the task to payment. Use Next draft required or Disapprove with a comment instead if it's not ready."
          confirmLabel="Yes, approve"
          loading={actionLoading}
          onConfirm={acceptFinal}
          onCancel={() => setShowAcceptConfirm(false)}
        />
      )}
      {detailView && (
        <DetailModal
          view={detailView}
          onClose={() => setDetailView(null)}
          fmtTime={fmtTime}
          role={role}
          canAttachFiles={status === 'in_progress' || status === 'final_submitted'}
          attaching={attachingFiles || actionLoading}
          onAttachFiles={attachFilesToDetail}
          canReviewFinal={!!session.canAcceptFinal || !!session.canRequestChanges}
          changesNote={changesNote}
          setChangesNote={setChangesNote}
          onAcceptFinal={() => setShowAcceptConfirm(true)}
          onRequestChanges={requestChanges}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

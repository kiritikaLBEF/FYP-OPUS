import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { api, getProfileUrl } from '../../services/api';
import { budgetTypeLabel, fmtBudget, fmtDeadline, orgInitials } from '../../utils/jobUtils';
import { IconClose } from '../icons/Icons';
import MultiApplyPanel from './MultiApplyPanel';
import './JobDetailModal.css';

function JobCover({ job, className = '', textSize = 'job-cover__text--md' }) {
  const coverUrl = job?.coverImage ? getProfileUrl(job.coverImage) : job?.coverPreview || '';

  if (job?.coverMode === 'image' && coverUrl) {
    return (
      <div className={`job-cover job-cover--image ${className}`}>
        <img src={coverUrl} alt="" className="job-cover__img" />
      </div>
    );
  }

  if (job?.coverMode === 'text') {
    return (
      <div className={`job-cover job-cover--text ${className}`}>
        <p className={`job-cover__text ${textSize}`}>
          {job.coverText || job.title || 'Cover headline'}
        </p>
      </div>
    );
  }

  return <div className={`job-cover job-cover--placeholder ${className}`} />;
}

export default function JobDetailModal({
  job,
  organizationName,
  onClose,
  showApply = true,
  previewOnly = false,
  onApplied,
}) {
  const { isAuthenticated, user } = useAuth();
  const { openSignIn } = useAuthModal();
  const [applyPhase, setApplyPhase] = useState('idle');
  const [hasApplied, setHasApplied] = useState(!!job?.hasApplied);
  const [applyError, setApplyError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!job) return null;

  const org = organizationName || job.organizationName || 'Organization';
  const initials = orgInitials(org);
  const isMulti = job.isMulti || job.projectMode === 'multi';
  const applied = hasApplied || job.hasApplied || applyPhase === 'success';
  const canApply = showApply && !previewOnly && job.id;
  const showSimpleApply = canApply && !isMulti;

  const handleApply = async () => {
    if (!job.id) return;

    if (!isAuthenticated) {
      setToast('Sign in is required to apply.');
      openSignIn();
      return;
    }

    if (user?.role !== 'freelancer') {
      setApplyError('Only freelancer accounts can apply to jobs.');
      return;
    }

    if (applied) return;

    setApplyError('');
    setApplyPhase('applying');
    try {
      await api.applyToJob(job.id);
      setApplyPhase('success');
      setHasApplied(true);
      onApplied?.();
      setTimeout(() => setApplyPhase('applied'), 1200);
    } catch (err) {
      setApplyPhase('idle');
      if (err.status === 400 && err.message?.includes('already applied')) {
        setHasApplied(true);
        setApplyPhase('applied');
      } else {
        setApplyError(err.message || 'Failed to apply');
      }
    }
  };

  const renderApplyButton = () => {
    if (!canApply) return null;

    if (applied || applyPhase === 'applied') {
      return (
        <button type="button" className="job-modal__apply job-modal__apply--done" disabled>
          <span className="job-modal__apply-tick">✓</span> Applied
        </button>
      );
    }

    if (applyPhase === 'success') {
      return (
        <button type="button" className="job-modal__apply job-modal__apply--success" disabled>
          <span className="job-modal__apply-burst" /> Application sent!
        </button>
      );
    }

    return (
      <button
        type="button"
        className="job-modal__apply"
        onClick={handleApply}
        disabled={applyPhase === 'applying'}
      >
        {applyPhase === 'applying' ? 'Submitting…' : 'Apply now'}
      </button>
    );
  };

  return (
    <>
      {toast && (
        <div className="job-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    <div className="job-modal-backdrop" onClick={onClose} role="presentation">
      <div className="job-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="job-modal-title">
        <div className="job-modal__cover-wrap">
          <JobCover job={job} className="job-modal__cover" textSize="job-cover__text--lg" />
          <button type="button" className="job-modal__close" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        <div className="job-modal__body">
          <div className="job-modal__org">
            <div className="job-modal__org-avatar">{initials}</div>
            <div>
              <p className="job-modal__org-name">{org}</p>
              <p className="job-modal__org-meta">Verified organization</p>
            </div>
          </div>

          <h2 id="job-modal-title" className="job-modal__title">{job.title || 'Untitled role'}</h2>
          <p className="job-modal__meta">
            {job.categoryLabel || job.category} · {job.location || 'Remote'}
          </p>

          <div className="job-modal__budget-row">
            <p className="job-modal__budget-value">{fmtBudget(job)}</p>
            <p className="job-modal__budget-label">{budgetTypeLabel(job)}</p>
          </div>

          <p className="job-modal__description">{job.description || 'No description provided.'}</p>

          {job.skillsRequired?.length > 0 && (
            <div className="job-modal__tags">
              {job.skillsRequired.map((s) => (
                <span key={s} className="job-modal__tag">{s}</span>
              ))}
            </div>
          )}

          {job.conditions?.length > 0 && (
            <div className="job-modal__conditions">
              <p className="job-modal__conditions-title">Requirements</p>
              {job.conditions.map((c) => (
                <p key={c} className="job-modal__condition-item"><span>•</span>{c}</p>
              ))}
            </div>
          )}

          {job.applicationDeadline && (
            <p className="job-modal__deadline">
              Applications close {fmtDeadline(job.applicationDeadline)}
            </p>
          )}

          {isMulti && (job.roles || []).length > 0 && (
            <div className="job-modal__conditions">
              <p className="job-modal__conditions-title">
                Roles · {job.rolesFilled || 0}/{job.rolesTotal || job.roles.length} filled
              </p>
              {job.roles.map((r) => (
                <p key={r.roleKey || r.name} className="job-modal__condition-item">
                  <span>•</span>
                  {r.name}
                  {r.budgetPercent != null ? ` · ${r.budgetPercent}%` : ''}
                  {r.status === 'filled' ? ' (filled)' : ''}
                </p>
              ))}
            </div>
          )}

          {applyError && <p className="job-modal__apply-error">{applyError}</p>}

          {canApply && isMulti && isAuthenticated && user?.role === 'freelancer' && (
            <MultiApplyPanel
              job={job}
              onApplied={() => {
                setHasApplied(true);
                onApplied?.();
              }}
            />
          )}

          {canApply && isMulti && !isAuthenticated && (
            <button
              type="button"
              className="job-modal__apply"
              style={{ marginTop: 12 }}
              onClick={() => openSignIn()}
            >
              Sign in to bid
            </button>
          )}
        </div>

        {showSimpleApply && (
          <div className="job-modal__footer">
            {renderApplyButton()}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export function JobPreviewCard({ job, organizationName, onClick, className = '' }) {
  const org = organizationName || job?.organizationName || 'Organization';
  const initials = orgInitials(org);

  return (
    <button type="button" className={`job-preview-card ${className}`} onClick={onClick}>
      <JobCover job={job} className="job-preview-card__cover" />
      <div className="job-preview-card__body">
        <div className="job-modal__org job-modal__org--compact">
          <div className="job-modal__org-avatar job-modal__org-avatar--sm">{initials}</div>
          <div>
            <p className="job-modal__org-name">{org}</p>
            <p className="job-modal__org-meta">Verified organization</p>
          </div>
        </div>
        <h3 className="job-preview-card__title">{job?.title || 'Job title'}</h3>
        <p className="job-preview-card__desc">{job?.description || 'Description preview'}</p>
        <div className="job-preview-card__skills">
          {(job?.skillsRequired || []).slice(0, 4).map((s) => (
            <span key={s} className="job-modal__tag job-modal__tag--sm">{s}</span>
          ))}
        </div>
        <div className="job-preview-card__footer">
          <div>
            <p className="job-preview-card__budget-label">{budgetTypeLabel(job)}</p>
            <p className="job-preview-card__budget">{fmtBudget(job)}</p>
          </div>
          {job?.hasApplied ? (
            <span className="job-preview-card__cta job-preview-card__cta--applied">Applied ✓</span>
          ) : (
            <span className="job-preview-card__cta">Apply now</span>
          )}
        </div>
      </div>
    </button>
  );
}

export { JobCover };

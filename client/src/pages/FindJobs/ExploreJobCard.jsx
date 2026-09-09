import { useNavigate } from 'react-router-dom';
import { JobCover } from '../../components/jobs/JobDetailModal';
import { fmtBudget, fmtDeadline, orgInitials, categoryLabel } from '../../utils/jobUtils';

export default function ExploreJobCard({ job, onClick }) {
  const navigate = useNavigate();
  const org = job?.organizationName || 'Organization';
  const initials = orgInitials(org);
  const skills = Array.isArray(job?.skillsRequired) ? job.skillsRequired.filter(Boolean) : [];
  const extraSkills = Math.max(0, skills.length - 3);
  const employerUserId = job?.employerId ? String(job.employerId) : '';

  const openEmployer = (e) => {
    if (!employerUserId) return;
    e.stopPropagation();
    e.preventDefault();
    navigate(`/employers/${employerUserId}`, {
      state: { from: '/find-jobs', fromLabel: 'Back to job listing' },
    });
  };

  return (
    <button type="button" className="explore-job-card" onClick={onClick}>
      <div className="explore-job-card__cover">
        <JobCover job={job} className="explore-job-card__cover-inner" />
        <span className="explore-job-card__category">{categoryLabel(job?.category)}</span>
        {job?.isMulti && <span className="explore-job-card__team">Team</span>}
      </div>

      <div className="explore-job-card__body">
        <h3 className="explore-job-card__title">{job?.title || 'Job title'}</h3>

        <div
          className={`explore-job-card__org${employerUserId ? ' explore-job-card__org--link' : ''}`}
          onClick={openEmployer}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') openEmployer(e);
          }}
          role={employerUserId ? 'link' : undefined}
          tabIndex={employerUserId ? 0 : undefined}
        >
          <span className="explore-job-card__avatar" aria-hidden="true">{initials}</span>
          <span className="explore-job-card__org-name">{org}</span>
        </div>

        <p className="explore-job-card__desc">{job?.description || 'No description provided.'}</p>

        {skills.length > 0 ? (
          <div className="explore-job-card__skills">
            {skills.slice(0, 3).map((s) => (
              <span key={s}>{s}</span>
            ))}
            {extraSkills > 0 && <span className="explore-job-card__skills-more">+{extraSkills}</span>}
          </div>
        ) : (
          <div className="explore-job-card__skills explore-job-card__skills--empty" aria-hidden="true" />
        )}

        <div className="explore-job-card__foot">
          <div className="explore-job-card__pay">
            <strong>{fmtBudget(job)}</strong>
            <span>
              {[job?.location, job?.applicationDeadline ? `Closes ${fmtDeadline(job.applicationDeadline)}` : '']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          {job?.hasApplied ? (
            <span className="explore-job-card__cta explore-job-card__cta--applied">Applied</span>
          ) : (
            <span className="explore-job-card__cta">View</span>
          )}
        </div>
      </div>
    </button>
  );
}

export function ExploreJobCardSkeleton() {
  return (
    <div className="explore-job-card explore-job-card--skeleton" aria-hidden="true">
      <div className="explore-job-card__cover" />
      <div className="explore-job-card__body">
        <div className="explore-job-skel explore-job-skel--title" />
        <div className="explore-job-skel explore-job-skel--org" />
        <div className="explore-job-skel explore-job-skel--line" />
        <div className="explore-job-skel explore-job-skel--line explore-job-skel--short" />
      </div>
    </div>
  );
}

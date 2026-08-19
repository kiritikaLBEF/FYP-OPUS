import { JobCover } from '../../components/jobs/JobDetailModal';
import { fmtBudget, fmtDeadline, budgetTypeLabel, orgInitials, categoryLabel } from '../../utils/jobUtils';

export default function ExploreJobCard({ job, onClick }) {
  const org = job?.organizationName || 'Organization';
  const initials = orgInitials(org);

  return (
    <button type="button" className="explore-job-card" onClick={onClick}>
      <div className="explore-job-card__cover">
        <JobCover job={job} className="explore-job-card__cover-inner" />
      </div>

      <div className="explore-job-card__main">
        <div className="explore-job-card__top">
          <div className="explore-job-card__org">
            <span className="explore-job-card__avatar" aria-hidden="true">{initials}</span>
            <div>
              <span className="explore-job-card__org-name">{org}</span>
              <span className="explore-job-card__verified">Verified organization</span>
            </div>
          </div>
          <span className="explore-job-card__category">{categoryLabel(job?.category)}</span>
        </div>

        <h3 className="explore-job-card__title">{job?.title || 'Job title'}</h3>
        <p className="explore-job-card__desc">{job?.description || 'No description provided.'}</p>

        {(job?.skillsRequired?.length > 0) && (
          <div className="explore-job-card__skills">
            {job.skillsRequired.slice(0, 5).map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        )}

        <div className="explore-job-card__meta">
          {job?.location && <span>{job.location}</span>}
          {job?.applicationDeadline && (
            <span>Closes {fmtDeadline(job.applicationDeadline)}</span>
          )}
        </div>
      </div>

      <div className="explore-job-card__aside">
        <div className="explore-job-card__budget">
          <span className="explore-job-card__budget-label">{budgetTypeLabel(job)}</span>
          <strong>{fmtBudget(job)}</strong>
        </div>
        {job?.hasApplied ? (
          <span className="explore-job-card__cta explore-job-card__cta--applied">Applied</span>
        ) : (
          <span className="explore-job-card__cta">View & apply</span>
        )}
      </div>
    </button>
  );
}

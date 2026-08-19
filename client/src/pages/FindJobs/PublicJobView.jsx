import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import JobDetailModal from '../../components/jobs/JobDetailModal';
import './FindJobs.css';

export default function PublicJobView() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    api.getPublicJobDetail(jobId)
      .then((data) => setJob(data.job))
      .catch((err) => setError(err.message || 'Job not found'))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return <div className="find-jobs-page"><div className="find-jobs-empty">Loading job…</div></div>;
  }

  if (error || !job) {
    return (
      <div className="find-jobs-page">
        <div className="find-jobs-empty">
          <h2>Job not found</h2>
          <p>{error || 'This listing may have been removed or is no longer open.'}</p>
        </div>
      </div>
    );
  }

  return (
    <JobDetailModal
      job={job}
      onClose={() => window.history.length > 1 ? window.history.back() : (window.location.href = '/find-jobs')}
      showApply
    />
  );
}

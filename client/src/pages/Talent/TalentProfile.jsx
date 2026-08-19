import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import FreelancerProfileView from '../../components/jobs/FreelancerProfileView';
import PortfolioProjectPreview from '../../components/jobs/PortfolioProjectPreview';
import '../../components/jobs/FreelancerProfileModal.css';
import '../../components/jobs/PortfolioProjectPreview.css';
import './TalentProfile.css';

export default function TalentProfile() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewProject, setPreviewProject] = useState(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError('');
    api.getPublicFreelancerProfile(userId)
      .then((res) => setData(res.user))
      .catch((err) => setError(err.message || 'Profile not found'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <main className="talent-page">
      <Link to="/#performers" className="talent-page__back">← Back to OPUS</Link>

      {loading ? (
        <div className="talent-page__panel fl-profile-modal__loading">Loading profile…</div>
      ) : error ? (
        <div className="talent-page__panel fl-profile-modal__error">{error}</div>
      ) : (
        <div className="talent-page__panel">
          <FreelancerProfileView data={data} onPreviewProject={setPreviewProject} />
        </div>
      )}

      {previewProject && (
        <PortfolioProjectPreview project={previewProject} onClose={() => setPreviewProject(null)} />
      )}
    </main>
  );
}

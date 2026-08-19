import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { IconClose } from '../icons/Icons';
import PortfolioProjectPreview from './PortfolioProjectPreview';
import FreelancerProfileView from './FreelancerProfileView';
import './FreelancerProfileModal.css';
import './PortfolioProjectPreview.css';

export default function FreelancerProfileModal({ freelancerId, onClose, source = 'employer' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewProject, setPreviewProject] = useState(null);

  useEffect(() => {
    if (!freelancerId) return;
    setLoading(true);
    setError('');
    const load = source === 'public'
      ? api.getPublicFreelancerProfile(freelancerId)
      : api.getEmployerApplicantProfile(freelancerId);
    load
      .then((res) => setData(res.user))
      .catch((err) => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [freelancerId, source]);

  if (!freelancerId) return null;

  return (
    <>
      <div className="fl-profile-backdrop" onClick={onClose} role="presentation">
        <div className="fl-profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <button type="button" className="fl-profile-modal__close" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>

          {loading ? (
            <div className="fl-profile-modal__loading">Loading profile…</div>
          ) : error ? (
            <div className="fl-profile-modal__error">{error}</div>
          ) : (
            <FreelancerProfileView data={data} onPreviewProject={setPreviewProject} />
          )}
        </div>
      </div>

      {previewProject && (
        <PortfolioProjectPreview project={previewProject} onClose={() => setPreviewProject(null)} />
      )}
    </>
  );
}

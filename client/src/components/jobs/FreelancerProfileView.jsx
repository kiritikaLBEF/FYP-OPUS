import { getProfileUrl } from '../../services/api';
import { PROJECT_CATEGORIES } from '../../utils/profileCompletion';
import OpusBadge from '../badges/OpusBadge';
import '../badges/OpusBadge.css';

const categoryLabel = (value) => PROJECT_CATEGORIES.find((c) => c.value === value)?.label || value;

const normalizeUrl = (url) => {
  if (!url?.trim()) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function FreelancerProfileView({ data, onPreviewProject }) {
  if (!data) return null;
  const avatar = data.profilePicture ? getProfileUrl(data.profilePicture) : '';

  return (
    <>
      <header className="fl-profile-hero">
        <div className="fl-profile-hero__avatar">
          {avatar ? <img src={avatar} alt="" /> : <span>{data.firstName?.[0]}{data.lastName?.[0]}</span>}
        </div>
        <div>
          <h2>{data.firstName} {data.lastName}</h2>
          <p className="fl-profile-hero__id">{data.freelancerId}</p>
          {data.headline ? <p className="fl-profile-hero__meta">{data.headline}</p> : null}
          {data.schoolName ? <p className="fl-profile-hero__meta">{data.schoolName}</p> : null}
          <p className="fl-profile-hero__meta">
            {[data.degree, [data.city, data.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
          </p>
          {data.badges?.length > 0 && (
            <div className="fl-profile-hero__badges">
              {data.badges.map((badge) => (
                <OpusBadge key={badge.id} badge={badge} size="sm" />
              ))}
            </div>
          )}
        </div>
      </header>

      {(data.bio || data.professionalSummary) && (
        <section className="fl-profile-section">
          <h3>About</h3>
          <p>{data.bio || data.professionalSummary}</p>
        </section>
      )}

      {data.skills?.length > 0 && (
        <section className="fl-profile-section">
          <h3>Skills</h3>
          <div className="fl-profile-tags">
            {data.skills.map((s) => <span key={s}>{s}</span>)}
          </div>
        </section>
      )}

      {data.projects?.length > 0 && (
        <section className="fl-profile-section">
          <h3>Portfolio ({data.projects.length})</h3>
          <p className="fl-profile-section__hint">Click a project to preview screenshots, links, and files.</p>
          <div className="fl-profile-projects">
            {data.projects.map((p) => {
              const linkCount = p.links?.length || 0;
              const mediaCount = (p.screenshots?.length || 0) + (p.thumbnail ? 1 : 0);
              return (
                <button
                  key={p._id || p.title}
                  type="button"
                  className="fl-profile-project fl-profile-project--clickable"
                  onClick={() => onPreviewProject?.(p)}
                >
                  {p.thumbnail ? (
                    <img src={getProfileUrl(p.thumbnail)} alt="" />
                  ) : (
                    <div className="fl-profile-project__placeholder">{categoryLabel(p.category)?.[0] || 'P'}</div>
                  )}
                  <div className="fl-profile-project__content">
                    <strong>{p.title}</strong>
                    <span className="fl-profile-project__cat">{categoryLabel(p.category)}</span>
                    {p.description && <p>{p.description}</p>}
                    <div className="fl-profile-project__meta">
                      {linkCount > 0 && <span>{linkCount} link{linkCount !== 1 ? 's' : ''}</span>}
                      {mediaCount > 0 && <span>{mediaCount} image{mediaCount !== 1 ? 's' : ''}</span>}
                      <span className="fl-profile-project__preview-cta">Preview →</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {data.certifications?.length > 0 && (
        <section className="fl-profile-section">
          <h3>Certifications</h3>
          <ul className="fl-profile-certs">
            {data.certifications.map((c) => (
              <li key={c._id || c.name} className="fl-profile-cert">
                <div>
                  <strong>{c.name}</strong>
                  {c.organization && <span className="fl-profile-cert__org"> · {c.organization}</span>}
                </div>
                <div className="fl-profile-cert__actions">
                  {c.credentialUrl && (
                    <a href={normalizeUrl(c.credentialUrl)} target="_blank" rel="noopener noreferrer">View credential</a>
                  )}
                  {c.filePath && (
                    <a href={getProfileUrl(c.filePath)} target="_blank" rel="noopener noreferrer">View certificate</a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

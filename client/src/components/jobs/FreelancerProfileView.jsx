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

const formatLocation = (data) => {
  const parts = [data.city, data.stateProvince, data.country].filter(Boolean);
  return parts.join(', ');
};

const formatEducationYear = (data) => {
  if (data.stillRunning) return 'Currently studying';
  if (data.passoutYear) return `Class of ${data.passoutYear}`;
  return '';
};

const formatMemberSince = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

function ProfileSection({ title, children, empty, emptyText }) {
  return (
    <section className="fl-profile-section">
      <h3>{title}</h3>
      {empty ? <p className="fl-profile-empty">{emptyText}</p> : children}
    </section>
  );
}

export default function FreelancerProfileView({ data, onPreviewProject }) {
  if (!data) return null;

  const avatar = data.profilePicture ? getProfileUrl(data.profilePicture) : '';
  const location = formatLocation(data);
  const educationYear = formatEducationYear(data);
  const memberSince = formatMemberSince(data.memberSince);

  const aboutText = [data.bio, data.professionalSummary, data.careerObjectives]
    .find((text) => String(text || '').trim()) || '';

  const hasEducation = !!(data.schoolName || data.degree || data.degreeName || educationYear);
  const hasSkills = data.skills?.length > 0;
  const hasBadges = data.badges?.length > 0;
  const hasProjects = data.projects?.length > 0;
  const hasCerts = data.certifications?.length > 0;
  const hasInterests = data.interests?.length > 0;

  return (
    <>
      <header className="fl-profile-hero">
        <div className="fl-profile-hero__avatar">
          {avatar ? (
            <img src={avatar} alt="" />
          ) : (
            <span>{data.firstName?.[0]}{data.lastName?.[0]}</span>
          )}
        </div>
        <div className="fl-profile-hero__main">
          <h2>{data.firstName} {data.lastName}</h2>
          {data.headline && <p className="fl-profile-hero__headline">{data.headline}</p>}
          {data.freelancerId && <p className="fl-profile-hero__id">{data.freelancerId}</p>}
          <div className="fl-profile-hero__meta-row">
            {location && <span>{location}</span>}
            {memberSince && <span>Member since {memberSince}</span>}
          </div>
          {hasBadges && (
            <div className="fl-profile-hero__badges">
              {data.badges.map((badge) => (
                <OpusBadge key={badge.id} badge={badge} size="sm" />
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="fl-profile-stats" aria-label="Profile highlights">
        <div className="fl-profile-stat">
          <strong>{data.tasksCompleted ?? 0}</strong>
          <span>Tasks completed</span>
        </div>
        <div className="fl-profile-stat">
          <strong>{data.projects?.length ?? 0}</strong>
          <span>Projects</span>
        </div>
        <div className="fl-profile-stat">
          <strong>{data.certifications?.length ?? 0}</strong>
          <span>Certifications</span>
        </div>
        <div className="fl-profile-stat">
          <strong>{data.badges?.length ?? 0}</strong>
          <span>Badges</span>
        </div>
      </div>

      <ProfileSection
        title="About"
        empty={!aboutText}
        emptyText="This freelancer has not added a bio yet."
      >
        <p>{aboutText}</p>
      </ProfileSection>

      <ProfileSection
        title="Education"
        empty={!hasEducation}
        emptyText="Education details have not been added yet."
      >
        <dl className="fl-profile-education">
          {data.schoolName && (
            <div className="fl-profile-education__row">
              <dt>School / University</dt>
              <dd>{data.schoolName}</dd>
            </div>
          )}
          {data.degree && (
            <div className="fl-profile-education__row">
              <dt>Level</dt>
              <dd>{data.degree}</dd>
            </div>
          )}
          {data.degreeName && (
            <div className="fl-profile-education__row">
              <dt>Field of study</dt>
              <dd>{data.degreeName}</dd>
            </div>
          )}
          {educationYear && (
            <div className="fl-profile-education__row">
              <dt>Timeline</dt>
              <dd>{educationYear}</dd>
            </div>
          )}
        </dl>
      </ProfileSection>

      <ProfileSection
        title="Skills"
        empty={!hasSkills}
        emptyText="No skills listed yet."
      >
        <div className="fl-profile-tags">
          {data.skills.map((s) => <span key={s}>{s}</span>)}
        </div>
      </ProfileSection>

      <ProfileSection
        title="Badges"
        empty={!hasBadges}
        emptyText="No OPUS badges awarded yet."
      >
        <ul className="fl-profile-badge-list">
          {data.badges.map((badge) => (
            <li key={badge.id} className="fl-profile-badge-item">
              <OpusBadge badge={badge} size="md" />
              <div>
                <strong>{badge.label}</strong>
                {badge.description && <p>{badge.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection
        title={`Portfolio${hasProjects ? ` (${data.projects.length})` : ''}`}
        empty={!hasProjects}
        emptyText="No portfolio projects have been added yet."
      >
        <>
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
        </>
      </ProfileSection>

      <ProfileSection
        title="Certifications"
        empty={!hasCerts}
        emptyText="No certifications listed yet."
      >
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
      </ProfileSection>

      {hasInterests && (
        <ProfileSection title="Interests" empty={false}>
          <div className="fl-profile-tags">
            {data.interests.map((item) => <span key={item}>{item}</span>)}
          </div>
        </ProfileSection>
      )}
    </>
  );
}

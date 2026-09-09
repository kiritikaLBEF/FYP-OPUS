import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Building2, Briefcase, Eye, Flag, Globe, Link2,
  Mail, MapPin, MessageSquare, Star, Wallet,
} from 'lucide-react';
import { api, getProfileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import './EmployerProfile.css';

function maskEmail(value, keep = 2) {
  const raw = String(value || '');
  const at = raw.indexOf('@');
  if (at < 0) return raw;
  const name = raw.slice(0, at);
  const domain = raw.slice(at);
  return `${name.slice(0, keep)}${'•'.repeat(Math.max(name.length - keep, 3))}${domain}`;
}

function fmtJoined(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function fmtNPR(n) {
  return `NPR ${Number(n || 0).toLocaleString('en-IN')}`;
}

function websiteHref(site) {
  const s = String(site || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function websiteLabel(site) {
  return String(site || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export default function EmployerProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isFreelancer } = useAuth();
  const { openSignIn } = useAuthModal();
  const [employer, setEmployer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getPublicEmployerProfile(userId)
      .then((data) => {
        if (cancelled) return;
        setEmployer(data.employer || null);
        setShowEmail(!(data.employer?.emailMaskedByDefault));
      })
      .catch((err) => {
        if (cancelled) return;
        setEmployer(null);
        setError(err.message || 'Employer not found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const isOwn = useMemo(
    () => user?.role === 'employer' && employer?.id && String(user.id) === String(employer.id),
    [user, employer],
  );

  const backLabel = location.state?.fromLabel || 'Back';
  const goBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate('/find-jobs');
  };

  const handleMessage = () => {
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    if (isFreelancer) {
      navigate('/messages');
      return;
    }
    navigate('/employer/messages');
  };

  const handleReport = () => {
    window.alert('To report this organization, contact OPUS support with the employer name and reason.');
  };

  if (loading) {
    return (
      <div className="ep-root ep-root--page">
        <main className="ep-main"><p className="ep-status">Loading employer profile…</p></main>
      </div>
    );
  }

  if (error || !employer) {
    return (
      <div className="ep-root ep-root--page">
        <main className="ep-main">
          <button type="button" className="ep-back" onClick={goBack}>
            <ArrowLeft size={14} /> {backLabel}
          </button>
          <p className="ep-status ep-status--error">{error || 'Employer not found'}</p>
        </main>
      </div>
    );
  }

  const photo = employer.profilePicture ? getProfileUrl(employer.profilePicture) : '';
  const emailDisplay = showEmail ? employer.email : maskEmail(employer.email);
  const hasRating = Number(employer.reviews || 0) > 0 && employer.rating != null;

  return (
    <div className="ep-root ep-root--page">
      <main className="ep-main">
        <button type="button" className="ep-back" onClick={goBack}>
          <ArrowLeft size={14} /> {backLabel}
        </button>

        <section className="ep-header">
          <div className="ep-header-left">
            {photo ? (
              <img className="ep-mark ep-mark--img" src={photo} alt="" />
            ) : (
              <div className="ep-mark">{employer.initials || 'OR'}</div>
            )}
            <div>
              <div className="ep-name-row">
                <div className="ep-name">{employer.name}</div>
                {employer.verified && (
                  <span className="ep-verified"><BadgeCheck size={12} /> Verified</span>
                )}
              </div>
              <div className="ep-meta-row">
                {employer.location && (
                  <span className="ep-meta-item"><MapPin size={13} /> {employer.location}</span>
                )}
                {employer.joined && (
                  <span className="ep-meta-item">Joined {fmtJoined(employer.joined)}</span>
                )}
                {hasRating ? (
                  <span className="ep-meta-item ep-rating-row">
                    <Star size={13} fill="#f0b429" color="#f0b429" />
                    {employer.rating} ({employer.reviews})
                  </span>
                ) : (
                  <span className="ep-meta-item">New on OPUS</span>
                )}
              </div>
              {employer.type && <span className="ep-type-pill">{employer.type}</span>}
            </div>
          </div>
          <div className="ep-header-actions">
            {isOwn ? (
              <Link to="/employer/profile/edit" className="ep-btn ep-btn-primary">Edit profile</Link>
            ) : (
              <button type="button" className="ep-btn ep-btn-primary" onClick={handleMessage}>
                <MessageSquare size={14} /> Message
              </button>
            )}
            {!isOwn && (
              <button type="button" className="ep-report" onClick={handleReport}>
                <Flag size={12} /> Report profile
              </button>
            )}
          </div>
        </section>

        <div className="ep-grid">
          <div className="ep-col-main">
            <section className="ep-panel">
              <div className="ep-panel-pad">
                <div className="ep-panel-title">About</div>
                <p className="ep-bio">
                  {employer.bio?.trim() || 'This organization has not added a bio yet.'}
                </p>
              </div>
            </section>

            <section className="ep-panel">
              <div className="ep-panel-pad">
                <div className="ep-panel-title">Details</div>
                <div className="ep-info-row"><Building2 size={14} /> {employer.type || 'Organization'}</div>
                {employer.location && (
                  <div className="ep-info-row"><MapPin size={14} /> {employer.location}</div>
                )}
                <div className="ep-info-row">
                  <Briefcase size={14} />
                  {employer.completedGigs} of {employer.totalGigs} gigs completed
                </div>
                <div className="ep-info-row">
                  <Wallet size={14} /> {fmtNPR(employer.totalPayouts)} paid out lifetime
                </div>
              </div>
            </section>
          </div>

          <div className="ep-col-side">
            <section className="ep-panel">
              <div className="ep-stats">
                <div className="ep-stat">
                  <div className="ep-stat-value">{employer.totalGigs}</div>
                  <div className="ep-stat-label">Gigs posted</div>
                </div>
                <div className="ep-stat">
                  <div className="ep-stat-value ep-mono">{fmtNPR(employer.totalPayouts)}</div>
                  <div className="ep-stat-label">Total payouts</div>
                </div>
              </div>
            </section>

            <section className="ep-panel">
              <div className="ep-panel-pad">
                <div className="ep-panel-title">Contact</div>

                {employer.website ? (
                  <div className="ep-contact-row">
                    <div className="ep-contact-left">
                      <div className="ep-contact-icon"><Globe size={14} color="var(--text-muted)" /></div>
                      <div>
                        <div className="ep-contact-label">Website</div>
                        <a
                          className="ep-contact-value link"
                          href={websiteHref(employer.website)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {websiteLabel(employer.website)}
                        </a>
                      </div>
                    </div>
                  </div>
                ) : null}

                {employer.social ? (
                  <div className="ep-contact-row">
                    <div className="ep-contact-left">
                      <div className="ep-contact-icon"><Link2 size={14} color="var(--text-muted)" /></div>
                      <div>
                        <div className="ep-contact-label">Social</div>
                        <div className="ep-contact-value link">{employer.social}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {employer.email ? (
                  <div className="ep-contact-row">
                    <div className="ep-contact-left">
                      <div className="ep-contact-icon"><Mail size={14} color="var(--text-muted)" /></div>
                      <div>
                        <div className="ep-contact-label">Email</div>
                        <div className="ep-contact-value ep-mono">{emailDisplay}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ep-reveal-btn"
                      onClick={() => setShowEmail((v) => !v)}
                    >
                      <Eye size={12} /> {showEmail ? 'Hide' : 'Show'}
                    </button>
                  </div>
                ) : null}

                {!employer.website && !employer.social && !employer.email && (
                  <p className="ep-contact-note">No public contact details added yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

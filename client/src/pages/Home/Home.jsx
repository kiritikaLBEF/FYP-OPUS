import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthModal } from '../../context/AuthModalContext';
import { useAuth } from '../../context/AuthContext';
import { useReveal } from '../../hooks/useReveal';
import { api, getProfileUrl } from '../../services/api';
import AdSlide from '../../components/AdSlide/AdSlide';
import OpusBadge from '../../components/badges/OpusBadge';
import '../../components/AdSlide/AdSlide.css';
import '../../components/badges/OpusBadge.css';
import './Home.css';

const CATEGORIES = [
  { label: 'Design & creative', image: '/home/design.jpg' },
  { label: 'Development', image: '/home/code.jpg' },
  { label: 'Writing & content', image: '/home/write.jpg' },
  { label: 'Marketing', image: '/home/hire.jpg' },
  { label: 'Research & data', image: '/home/work.jpg' },
  { label: 'Video & photo', image: '/home/kathmandu.jpg' },
];

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal();
  const delayClass = delay ? `home-reveal--delay-${delay}` : '';

  return (
    <div
      ref={ref}
      className={`home-reveal ${visible ? 'home-reveal--visible' : ''} ${delayClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const { openSignUp } = useAuthModal();
  const { user, isFreelancer } = useAuth();
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [adIndex, setAdIndex] = useState(0);

  useEffect(() => {
    api.getHomepage()
      .then((data) => {
        setAds((data.ads || []).slice(0, 5));
        setFeatured(data.featured || []);
        setAdIndex(0);
      })
      .catch(() => {
        setAds([]);
        setFeatured([]);
      });
  }, []);

  useEffect(() => {
    if (ads.length < 2) return undefined;
    const id = window.setInterval(() => {
      setAdIndex((i) => (i + 1) % ads.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [ads, adIndex]);

  const ad = ads[adIndex] || null;
  const goAd = (dir) => {
    if (!ads.length) return;
    setAdIndex((i) => (i + dir + ads.length) % ads.length);
  };

  const performerAvatar = (person) => {
    if (person?.profilePicture) return getProfileUrl(person.profilePicture);
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${person?.id || 'opus'}`;
  };

  const openPerformer = (person) => {
    const selfId = String(user?.id || user?._id || '');
    if (isFreelancer && selfId && selfId === String(person.id)) {
      navigate('/profile/edit');
      return;
    }
    navigate(`/talent/${person.id}`);
  };

  return (
    <main className="home">
      <section id="home" className="home-hero" aria-label="OPUS introduction">
        <div className="home-hero__media" aria-hidden="true">
          <img
            className="home-hero__photo"
            src="/home/hero.jpg"
            alt=""
            width="2400"
            height="1600"
            fetchPriority="high"
            decoding="async"
          />
          <div className="home-hero__shade" />
        </div>

        <div className="home-hero__stage">
          <p className="home-hero__brand">OPUS</p>
          <h1 className="home-hero__title">
            Hire student talent.
            <br />
            Build your craft.
          </h1>
          <p className="home-hero__lede">
            Nepal&apos;s freelance platform for students and employers. Local payments,
            completion QR, and certificates you can actually show.
          </p>
          <div className="home-hero__actions">
            <Link to="/find-jobs" className="opus-btn opus-btn--primary">
              Find work
            </Link>
            <button type="button" className="opus-btn opus-btn--glass" onClick={openSignUp}>
              Hire talent
            </button>
          </div>
        </div>
      </section>

      <section id="ads" className="home-section home-ads">
        <Reveal>
          <div className="home-section__head">
            <h2 className="home-section__title">Our partners</h2>
            <p className="home-section__desc">
              Organizations working with student talent on OPUS.
            </p>
          </div>
        </Reveal>
        {ad ? (
          <div className="home-ad-carousel">
            <AdSlide
              key={`${ad.id}-${adIndex}-${ad.animation}`}
              ad={ad}
              imageSrc={ad.imagePath ? getProfileUrl(ad.imagePath) : ''}
              animation={ad.animation}
            >
              {ads.length > 1 && (
                <div className="home-ad__nav">
                  <button type="button" className="home-ad__arrow" onClick={() => goAd(-1)} aria-label="Previous">‹</button>
                  <span className="home-ad__dots">
                    {ads.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`home-ad__dot ${i === adIndex ? 'home-ad__dot--on' : ''}`}
                        onClick={() => setAdIndex(i)}
                        aria-label={`Slide ${i + 1}`}
                      />
                    ))}
                  </span>
                  <button type="button" className="home-ad__arrow" onClick={() => goAd(1)} aria-label="Next">›</button>
                </div>
              )}
            </AdSlide>
          </div>
        ) : (
          <div className="home-empty">Partner banners will appear here.</div>
        )}
      </section>

      <section id="categories" className="home-section home-categories">
        <Reveal>
          <div className="home-section__head">
            <h2 className="home-section__title">Browse work by craft</h2>
            <p className="home-section__desc">
              Jump into categories employers post most, then filter on the job board.
            </p>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <ul className="home-cat-grid">
            {CATEGORIES.map((cat) => (
              <li key={cat.label}>
                <Link to="/find-jobs" className="home-cat-card">
                  <img src={cat.image} alt="" loading="lazy" decoding="async" />
                  <span className="home-cat-card__label">{cat.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section id="performers" className="home-section home-performers">
        <Reveal>
          <div className="home-section__head">
            <h2 className="home-section__title">Top performers</h2>
            <p className="home-section__desc">
              Freelancers featured by OPUS admin. This stays blank until someone is selected.
            </p>
          </div>
        </Reveal>
        {featured.length === 0 ? (
          <div className="home-empty">No featured talent yet.</div>
        ) : (
          <ul className="home-performer-grid">
            {featured.map((person) => (
              <li key={person.id}>
                <article className="home-performer-card">
                  <img className="home-performer-card__avatar" src={performerAvatar(person)} alt="" />
                  {person.badges?.length > 0 && (
                    <div className="home-performer-card__badges opus-badge-row opus-badge-row--center">
                      {person.badges.slice(0, 3).map((b) => (
                        <OpusBadge key={b.id} badge={b} size="sm" />
                      ))}
                    </div>
                  )}
                  <strong className="home-performer-card__name">{person.firstName} {person.lastName}</strong>
                  {person.schoolName && <span className="home-performer-card__school">{person.schoolName}</span>}
                  {person.headline && <span className="home-performer-card__role">{person.headline}</span>}
                  {person.skills?.length > 0 && (
                    <span className="home-performer-card__skills">{person.skills.slice(0, 4).join(' · ')}</span>
                  )}
                  <button
                    type="button"
                    className="home-performer-card__view"
                    onClick={() => openPerformer(person)}
                  >
                    View profile
                  </button>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="paths" className="home-section home-paths">
        <div className="home-paths__grid">
          <Reveal>
            <article className="home-path-card">
              <div className="home-path-card__media">
                <img src="/home/work.jpg" alt="" loading="lazy" decoding="async" />
              </div>
              <div className="home-path-card__body">
                <p className="home-path-card__kicker">For freelancers</p>
                <h2 className="home-path-card__title">Earn while you study</h2>
                <p className="home-path-card__desc">
                  Pick gigs that fit your semester. Deliver work, unlock payment QR,
                  and collect a certificate for every completed task.
                </p>
                <Link to="/find-jobs" className="opus-text-link">
                  Explore open jobs
                </Link>
              </div>
            </article>
          </Reveal>

          <Reveal delay={1}>
            <article className="home-path-card">
              <div className="home-path-card__media">
                <img src="/home/hire.jpg" alt="" loading="lazy" decoding="async" />
              </div>
              <div className="home-path-card__body">
                <p className="home-path-card__kicker">For employers</p>
                <h2 className="home-path-card__title">Hire Nepal&apos;s student talent</h2>
                <p className="home-path-card__desc">
                  Post a brief, review applications, and pay locally when the work is done,
                  with an e-statement for your records.
                </p>
                <button type="button" className="opus-text-link" onClick={openSignUp}>
                  Post a job
                </button>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      <section id="how-it-works" className="home-how">
        <div className="home-how__inner">
          <Reveal>
            <header className="home-how__header">
              <p className="home-how__eyebrow">Simple path</p>
              <h2 className="home-how__title">How OPUS works</h2>
              <p className="home-how__lede">
                Three clear moves. No marketplace maze.
              </p>
            </header>
          </Reveal>

          <ol className="home-how__track">
            {[
              {
                title: 'Create your profile',
                desc: 'Join as a freelancer or employer. Show skills, portfolio, or the work you need done.',
              },
              {
                title: 'Match on real briefs',
                desc: 'Browse jobs or post one. Chat, agree scope, and start with a clear timeline.',
              },
              {
                title: 'Deliver, prove, get paid',
                desc: 'Finish the task, generate a unique completion QR, download your certificate, and settle locally.',
              },
            ].map((step, i) => (
              <Reveal key={step.title} delay={i + 1}>
                <li className="home-how__step">
                  <div className="home-how__marker" aria-hidden="true">
                    <span className="home-how__num">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="home-how__body">
                    <h3 className="home-how__step-title">{step.title}</h3>
                    <p className="home-how__step-desc">{step.desc}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-close" aria-label="Get started">
        <div className="home-close__media" aria-hidden="true">
          <img src="/home/hero.jpg" alt="" loading="lazy" decoding="async" />
          <div className="home-close__shade" />
        </div>
        <Reveal>
          <div className="home-close__inner">
            <p className="home-close__brand">OPUS</p>
            <h2 className="home-close__title">Ready when you are</h2>
            <p className="home-close__desc">
              Whether you need a designer in Lalitpur or a first paid brief before finals,
              start on the same floor.
            </p>
            <div className="home-hero__actions home-close__actions">
              <Link to="/find-jobs" className="opus-btn opus-btn--primary">
                Browse jobs
              </Link>
              <button type="button" className="opus-btn opus-btn--glass" onClick={openSignUp}>
                Create account
              </button>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

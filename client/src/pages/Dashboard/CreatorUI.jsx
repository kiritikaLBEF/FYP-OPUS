import { fmtNPR } from './dashboardUtils';

const SW = 1.75;

export function ActivityIcon({ type }) {
  const icons = {
    proposal_accepted: <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />,
    payment_received: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />,
    project_invitation: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />,
    project_completed: <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />,
    certificate_added: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth={SW} />,
    portfolio_viewed: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth={SW} /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={SW} /></>,
    profile_viewed: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth={SW} />,
    review_received: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />,
    withdrawal_completed: <><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth={SW} /><path d="M2 10h20" stroke="currentColor" strokeWidth={SW} /></>,
    statement_generated: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth={SW} /><path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {icons[type] || icons.payment_received}
    </svg>
  );
}

const ACTIVITY_COLORS = {
  proposal_accepted: 'green',
  payment_received: 'blue',
  project_invitation: 'purple',
  project_completed: 'green',
  certificate_added: 'orange',
  portfolio_viewed: 'teal',
  profile_viewed: 'indigo',
  review_received: 'gold',
  withdrawal_completed: 'slate',
  statement_generated: 'blue',
};

export function WelcomeHero({ greeting, user, profileUrl, stats, freelancerId }) {
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';
  return (
    <section className="db-hero">
      <div className="db-hero__glow" aria-hidden="true" />
      <div className="db-hero__inner">
        <div className="db-hero__left">
          <div className="db-hero__avatar">
            {profileUrl ? <img src={profileUrl} alt="" /> : <span>{initials}</span>}
          </div>
          <div>
            <p className="db-hero__greeting">{greeting}</p>
            <h2 className="db-hero__name">{user?.firstName} {user?.lastName}</h2>
            <p className="db-hero__tagline">
              {stats.activeProjects > 0
                ? `${stats.activeProjects} active project${stats.activeProjects > 1 ? 's' : ''} · ${stats.bidsWon} bids won`
                : 'Your professional journey starts here'}
            </p>
          </div>
        </div>
        <div className="db-hero__right">
          <div className="db-hero__highlight">
            <span className="db-hero__highlight-label">This month</span>
            <strong>{fmtNPR(stats.performanceThisMonth ?? 0)}</strong>
            {stats.earningsGrowthPct !== undefined && (
              <span className={`db-trend ${stats.earningsGrowthPct >= 0 ? 'db-trend--up' : 'db-trend--down'}`}>
                {stats.earningsGrowthPct >= 0 ? '↑' : '↓'} {Math.abs(stats.earningsGrowthPct)}%
              </span>
            )}
          </div>
          {freelancerId && <span className="db-hero__id">{freelancerId}</span>}
        </div>
      </div>
    </section>
  );
}

export function MetricCard({ label, value, sub, trend, variant = 'default', icon: Icon, delay = 0 }) {
  return (
    <article className={`db-metric db-metric--${variant}`} style={{ '--delay': `${delay}ms` }}>
      <div className="db-metric__top">
        {Icon && <span className="db-metric__icon"><Icon /></span>}
        {trend !== undefined && (
          <span className={`db-trend ${trend >= 0 ? 'db-trend--up' : 'db-trend--down'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="db-metric__value">{value}</p>
      <p className="db-metric__label">{label}</p>
      {sub && <p className="db-metric__sub">{sub}</p>}
    </article>
  );
}

export function ProgressRing({ value, label, size = 72 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="db-ring-card">
      <div className="db-ring" style={{ width: size, height: size, '--progress': value }}>
        <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle className="db-ring__track" cx={size / 2} cy={size / 2} r={r} />
          <circle className="db-ring__fill" cx={size / 2} cy={size / 2} r={r} strokeDasharray={circ} strokeDashoffset={circ - (circ * value) / 100} />
        </svg>
        <span className="db-ring__value">{value}%</span>
      </div>
      <p className="db-ring-card__label">{label}</p>
    </div>
  );
}

export function SparkAreaChart({ data, valueKey = 'amount', labelKey = 'month' }) {
  const values = data.map((d) => d[valueKey]);
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * 100 : 50;
    const y = 100 - (v / max) * 85;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,100 ${points} 100,100`;

  return (
    <div className="db-spark">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="db-spark__svg">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#sparkGrad)" className="db-spark__area" />
        <polyline points={points} fill="none" stroke="var(--accent-blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" className="db-spark__line" />
      </svg>
      <div className="db-spark__labels">
        {data.map((d) => <span key={d[labelKey]}>{d[labelKey]}</span>)}
      </div>
    </div>
  );
}

export function AnimatedBarChart({ data, valueKey = 'amount', labelKey = 'month', animated = true }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="db-bars">
      {data.map((d, i) => (
        <div key={d[labelKey]} className="db-bars__col" title={fmtNPR(d[valueKey])}>
          <div className="db-bars__value">{d[valueKey] >= 1000 ? `${Math.round(d[valueKey] / 1000)}k` : d[valueKey]}</div>
          <div className="db-bars__track">
            <div
              className={`db-bars__bar ${animated ? 'db-bars__bar--animate' : ''}`}
              style={{ height: `${(d[valueKey] / max) * 100}%`, '--i': i }}
            />
          </div>
          <span className="db-bars__label">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityTimeline({ items }) {
  return (
    <div className="db-timeline">
      {items.map((item, i) => (
        <article key={item._id || i} className="db-timeline__item" style={{ '--i': i }}>
          <div className={`db-timeline__icon db-timeline__icon--${ACTIVITY_COLORS[item.type] || 'blue'}`}>
            <ActivityIcon type={item.type} />
          </div>
          <div className="db-timeline__line" aria-hidden="true" />
          <div className="db-timeline__body">
            <p className="db-timeline__title">{item.title}</p>
            {item.subtitle && <p className="db-timeline__sub">{item.subtitle}</p>}
            <time className="db-timeline__time">{formatRelativeTime(item.occurredAt)}</time>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AchievementStrip({ achievements }) {
  const unlocked = achievements.filter((a) => a.unlocked);
  return (
    <div className="db-achievements">
      {achievements.map((a) => (
        <div key={a.id} className={`db-achievement ${a.unlocked ? 'db-achievement--unlocked' : ''}`} title={a.desc}>
          <div className="db-achievement__ring" style={{ '--progress': Math.round(a.progress * 100) }}>
            <AchievementIcon name={a.icon} />
          </div>
          <span className="db-achievement__title">{a.title}</span>
        </div>
      ))}
      {unlocked.length > 0 && (
        <p className="db-achievements__count">{unlocked.length} of {achievements.length} unlocked</p>
      )}
    </div>
  );
}

function AchievementIcon({ name }) {
  const paths = {
    rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2z',
    gem: 'M6 3h12l4 6-10 13L2 9l4-6z',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[name] || paths.star} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InsightCards({ insights, onAction }) {
  if (!insights?.length) return null;
  return (
    <div className="db-insights">
      {insights.map((ins, i) => (
        <button key={i} type="button" className={`db-insight db-insight--${ins.type}`} onClick={() => onAction?.(ins.action)}>
          <span className="db-insight__dot" />
          <p>{ins.message}</p>
        </button>
      ))}
    </div>
  );
}

export function CategoryDonut({ data }) {
  const colors = ['#0071e3', '#34c759', '#ff9500', '#af52de', '#5ac8fa', '#ff2d55'];
  let offset = 0;
  const segments = data.map((d, i) => {
    const seg = { ...d, color: colors[i % colors.length], offset };
    offset += d.pct;
    return seg;
  });
  const gradient = segments.map((s) => `${s.color} ${s.offset}% ${s.offset + s.pct}%`).join(', ');

  return (
    <div className="db-donut-chart">
      <div className="db-donut-chart__ring" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="db-donut-chart__hole" />
      </div>
      <ul className="db-donut-chart__legend">
        {segments.map((s) => (
          <li key={s.category}>
            <span className="db-dot" style={{ background: s.color }} />
            {s.category.replace(/_/g, ' ')} · {s.pct}%
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatRelativeTime(date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const MetricIcons = {
  earnings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>,
  wallet: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" /><path d="M2 10h20" stroke="currentColor" strokeWidth="1.75" /></svg>,
  projects: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>,
  active: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" /><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>,
  bids: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.75" /></svg>,
  orgs: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>,
  rating: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" /></svg>,
};

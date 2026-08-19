import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import './dashboard-tokens.css';
import './DashboardOverview.css';

export interface StatTrend {
  value: number;
  direction: 'up' | 'down' | 'neutral';
}

export interface DashboardOverviewStats {
  totalEarnings: number;
  availableBalance: number;
  activeProjects: number;
  completedProjects: number;
  bidsWon: number;
  profileStrength: number;
  trends: {
    totalEarnings?: StatTrend;
    availableBalance?: StatTrend;
    activeProjects?: StatTrend;
    completedProjects?: StatTrend;
    bidsWon?: StatTrend;
  };
}

export interface DashboardOverviewProps {
  userName: string;
  stats: DashboardOverviewStats;
  loading?: boolean;
  theme?: 'dark' | 'light';
  embedded?: boolean;
}

const SW = 1.5;

function useCountUp(target: number, active: boolean, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return value;
}

function formatCurrency(amount: number) {
  return `NPR ${amount.toLocaleString('en-NP')}`;
}

function TrendBadge({ trend }: { trend?: StatTrend }) {
  if (!trend || trend.direction === 'neutral') return null;
  const isUp = trend.direction === 'up';
  return (
    <span className={`dov-trend ${isUp ? 'dov-trend--up' : 'dov-trend--down'}`}>
      {isUp ? '↑' : '↓'} {Math.abs(trend.value)}%
    </span>
  );
}

type StatVariant = 'primary' | 'secondary' | 'highlight' | 'profile';

function ProgressRing({ value }: { value: number }) {
  const size = 48;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * Math.min(value, 100)) / 100;
  const isComplete = value >= 100;
  const isMilestone = value >= 80;

  return (
    <div className="dov-ring" style={{ width: size, height: size }} aria-label={`Profile strength ${value}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="dov-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={`dov-ring__fill ${isComplete ? 'dov-ring__fill--milestone' : isMilestone ? 'dov-ring__fill--complete' : ''}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="dov-ring__value">{value}%</span>
    </div>
  );
}

function StatIcon({ children }: { children: ReactNode }) {
  return (
    <span className="dov-stat__icon-wrap" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        {children}
      </svg>
    </span>
  );
}

const ICONS = {
  earnings: (
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
  ),
  wallet: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth={SW} />
      <path d="M2 10h20" stroke="currentColor" strokeWidth={SW} />
    </>
  ),
  active: (
    <>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={SW} />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </>
  ),
  completed: (
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
  ),
  bids: (
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
  ),
};

interface StatCardProps {
  label: string;
  displayValue: string;
  trend?: StatTrend;
  icon: ReactNode;
  ring?: number;
  delay?: number;
  variant?: StatVariant;
}

function StatCard({ label, displayValue, trend, icon, ring, delay = 0, variant = 'primary' }: StatCardProps) {
  return (
    <article
      className={`dov-stat dov-stat--${variant}`}
      style={{ '--dov-delay': `${delay}ms` } as CSSProperties}
    >
      <div className="dov-stat__header">
        <StatIcon>{icon}</StatIcon>
        <TrendBadge trend={trend} />
      </div>
      {ring !== undefined ? (
        <div className="dov-stat__ring-row">
          <ProgressRing value={ring} />
          <div>
            <p className="dov-stat__value dov-stat__value--ring">{ring}%</p>
            <p className="dov-stat__label">{label}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="dov-stat__value">{displayValue}</p>
          <p className="dov-stat__label">{label}</p>
        </>
      )}
    </article>
  );
}

export default function DashboardOverview({
  userName,
  stats,
  loading = false,
  theme = 'light',
  embedded = false,
}: DashboardOverviewProps) {
  const animate = !loading;
  const earnings = useCountUp(stats.totalEarnings, animate);
  const balance = useCountUp(stats.availableBalance, animate);
  const active = useCountUp(stats.activeProjects, animate);
  const completed = useCountUp(stats.completedProjects, animate);
  const bids = useCountUp(stats.bidsWon, animate);

  return (
    <section
      className={`dashboard-token-scope dov ${embedded ? 'dov--embedded' : ''}`}
      data-theme={theme}
      aria-label="Dashboard overview"
    >
      <div className="dov-welcome-wrap">
        <header className="dov-welcome">
          <div className="dov-welcome__content">
            <p className="dov-welcome__caption">Dashboard</p>
            <h1 className="dov-welcome__title">Welcome back, {userName}</h1>
            <p className="dov-welcome__body">
              Here&apos;s how your freelance journey is performing today.
            </p>
          </div>
        </header>
      </div>

      {loading ? (
        <div className="dov-loading" role="status" aria-label="Loading stats" />
      ) : (
        <div className="dov-stats">
          <StatCard
            label="Total Earnings"
            displayValue={formatCurrency(earnings)}
            trend={stats.trends.totalEarnings}
            icon={ICONS.earnings}
            variant="primary"
            delay={0}
          />
          <StatCard
            label="Available Balance"
            displayValue={formatCurrency(balance)}
            trend={stats.trends.availableBalance}
            icon={ICONS.wallet}
            variant="primary"
            delay={50}
          />
          <StatCard
            label="Active Projects"
            displayValue={String(active)}
            trend={stats.trends.activeProjects}
            icon={ICONS.active}
            variant="secondary"
            delay={100}
          />
          <StatCard
            label="Completed Projects"
            displayValue={String(completed)}
            trend={stats.trends.completedProjects}
            icon={ICONS.completed}
            variant="secondary"
            delay={150}
          />
          <StatCard
            label="Bids Won"
            displayValue={String(bids)}
            trend={stats.trends.bidsWon}
            icon={ICONS.bids}
            variant="highlight"
            delay={200}
          />
          <StatCard
            label="Profile Strength"
            displayValue={`${stats.profileStrength}%`}
            ring={stats.profileStrength}
            icon={ICONS.completed}
            variant="profile"
            delay={250}
          />
        </div>
      )}
    </section>
  );
}

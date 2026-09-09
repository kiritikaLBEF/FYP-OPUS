import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart2,
  Briefcase,
  Clock,
  FileText,
  Hourglass,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Target,
} from 'lucide-react';
import { api, getProfileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DashboardTaskBoard from './DashboardTaskBoard';
import DashboardMyBids from './DashboardMyBids';
import DashboardActivitySection from './DashboardActivitySection';
import DashboardWorkCalendar from './DashboardWorkCalendar';
import OpusBadge from '../../components/badges/OpusBadge';
import '../../components/badges/OpusBadge.css';
import './DashboardFreelancer.css';

const SECTION_NAV = [
  { key: 'Overview', icon: LayoutDashboard },
  { key: 'Task board', icon: LayoutGrid },
  { key: 'Performance', icon: BarChart2 },
  { key: 'My bids', icon: FileText },
  { key: 'Activity', icon: Activity },
];

function welcomeSub(work) {
  if (!work || !work.totalSessions) {
    return 'When a bid is accepted, your task board and analytics will show up here.';
  }
  const parts = [];
  parts.push(`${work.activeTasks} active task${work.activeTasks === 1 ? '' : 's'}`);
  parts.push(work.overdue ? `${work.overdue} overdue` : 'nothing overdue');
  if (work.awaitingYourMove) {
    parts.push(`${work.awaitingYourMove} awaiting your move`);
  }
  return parts.join(', ');
}

function PerformancePanels({
  workStartedByDay,
  bidStats,
  loading,
}) {
  const circumference = 2 * Math.PI * 46;
  const total = Math.max(1, bidStats.total || (bidStats.accepted + bidStats.pending + bidStats.rejected));
  const acceptedOffset = circumference * (1 - (bidStats.accepted || 0) / total);
  const rate = bidStats.successRate ?? 0;

  return (
    <section className="fd-perf" aria-label="Performance">
      <div className="fd-panel fd-chart-panel">
        <div className="fd-panel-pad">
          <div className="fd-panel-title">Work started</div>
          <div className="fd-panel-sub">
            Projects that moved into your workspace, by day
          </div>
          <DashboardWorkCalendar days={workStartedByDay} loading={loading} />
        </div>
      </div>

      <div className="fd-panel fd-donut-panel">
        <div className="fd-panel-pad">
          <div className="fd-panel-title">Bid acceptance</div>
          <div className="fd-panel-sub">How often your proposals win</div>
          <div className="fd-donut-wrap">
            <div style={{ position: 'relative', width: 104, height: 104 }}>
              <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
                <circle cx="52" cy="52" r="46" fill="none" stroke="#eef0f3" strokeWidth="11" />
                <circle
                  cx="52"
                  cy="52"
                  r="46"
                  fill="none"
                  stroke="var(--fd-positive)"
                  strokeWidth="11"
                  strokeDasharray={circumference}
                  strokeDashoffset={acceptedOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 52 52)"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div className="fd-donut-center-value">{rate}%</div>
                <div className="fd-donut-center-label">Success</div>
              </div>
            </div>
            <div className="fd-legend">
              <div className="fd-legend-row">
                <span className="fd-dot" style={{ background: 'var(--fd-positive)' }} />
                Accepted
                <span className="n">{bidStats.accepted || 0}</span>
              </div>
              <div className="fd-legend-row">
                <span className="fd-dot" style={{ background: 'var(--fd-amber)' }} />
                Pending
                <span className="n">{bidStats.pending || 0}</span>
              </div>
              <div className="fd-legend-row">
                <span className="fd-dot" style={{ background: '#d64545' }} />
                Declined
                <span className="n">{bidStats.rejected || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function DashboardHome() {
  const navigate = useNavigate();
  const { user, profileUrl } = useAuth();
  const [section, setSection] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(true);

  const [greeting, setGreeting] = useState('Welcome back');
  const [subtitle, setSubtitle] = useState('Your freelance workspace for projects and analytics.');
  const [activeTasks, setActiveTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [awaitingYourMove, setAwaitingYourMove] = useState(0);
  const [activeEngagements, setActiveEngagements] = useState(0);
  const [bidStats, setBidStats] = useState({
    successRate: 0,
    accepted: 0,
    pending: 0,
    rejected: 0,
    total: 0,
  });
  const [workStartedByDay, setWorkStartedByDay] = useState([]);
  const [boardColumns, setBoardColumns] = useState({
    todo: [],
    progress: [],
    review: [],
    done: [],
  });
  const [badges, setBadges] = useState([]);
  const [bidsFilter, setBidsFilter] = useState('submitted');
  const [bidsFilterKey, setBidsFilterKey] = useState(0);

  const openMyBids = (filterId = 'submitted') => {
    setBidsFilter(filterId);
    setBidsFilterKey((k) => k + 1);
    setSection('My bids');
  };

  const displayName = useMemo(() => {
    const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return full || user?.firstName || 'Freelancer';
  }, [user]);

  const initial = (user?.firstName || displayName || 'F').charAt(0).toUpperCase();
  const avatarSrc = user?.profilePicture ? (profileUrl || getProfileUrl(user.profilePicture)) : '';
  const primaryBadge = badges[0] || null;

  const weekDone = completedTasks;
  const weekTotal = Math.max(1, completedTasks + activeTasks);
  const ringOffset = 2 * Math.PI * 18 * (1 - Math.min(1, weekDone / weekTotal));

  useEffect(() => {
    let cancelled = false;

    api.getDashboardOverview()
      .then((data) => {
        if (cancelled) return;
        const s = data.stats || {};
        const work = data.work || {};
        setGreeting(data.greeting || 'Welcome back');
        setSubtitle(welcomeSub({
          totalSessions: work.totalSessions ?? 0,
          activeTasks: work.activeTasks ?? s.activeTasks ?? 0,
          overdue: work.overdue ?? s.overdue ?? 0,
          awaitingYourMove: work.awaitingYourMove ?? s.awaitingYourMove ?? 0,
        }));
        setActiveTasks(work.activeTasks ?? s.activeTasks ?? 0);
        setCompletedTasks(work.completedTasks ?? s.completedProjects ?? 0);
        setAwaitingYourMove(work.awaitingYourMove ?? s.awaitingYourMove ?? 0);
        setBadges(Array.isArray(data.badges) ? data.badges : []);
      })
      .catch(() => {
        if (!cancelled) {
          setActiveTasks(0);
          setCompletedTasks(0);
          setAwaitingYourMove(0);
          setBadges([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    api.getDashboardAnalytics()
      .then((data) => {
        if (cancelled) return;
        setBidStats(data.bidStats || {
          successRate: 0, accepted: 0, pending: 0, rejected: 0, total: 0,
        });
        setWorkStartedByDay(data.workStartedByDay || []);
        setActiveEngagements(data.productivity?.activeEngagements ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkStartedByDay([]);
          setActiveEngagements(0);
        }
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    api.getDashboardBoard()
      .then((data) => {
        if (cancelled) return;
        setBoardColumns(data.columns || { todo: [], progress: [], review: [], done: [] });
      })
      .catch(() => {
        if (!cancelled) setBoardColumns({ todo: [], progress: [], review: [], done: [] });
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="fd-root">
      <div className="fd-body">
        <aside className="fd-sidebar" aria-label="Dashboard sections">
          <div className="fd-mini-profile">
            <div className="fd-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
              {avatarSrc ? <img src={avatarSrc} alt="" /> : initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="fd-mini-name">{displayName}</div>
              <div className="fd-mini-meta">
                {primaryBadge ? (
                  <span className="fd-mini-badges" title={primaryBadge.description || primaryBadge.label}>
                    <OpusBadge badge={primaryBadge} size="xs" />
                    <span className="fd-mini-badge-label">{primaryBadge.label}</span>
                    {badges.length > 1 && (
                      <span className="fd-mini-badge-label">+{badges.length - 1}</span>
                    )}
                  </span>
                ) : (
                  'Freelancer'
                )}
              </div>
            </div>
          </div>

          <div className="fd-sidebar-label">Dashboard</div>
          <div className="fd-sidebar-nav">
            {SECTION_NAV.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`fd-navitem${section === key ? ' active' : ''}`}
                onClick={() => setSection(key)}
              >
                <Icon />
                {key}
              </button>
            ))}
          </div>

          <div className="fd-sidebar-spacer" aria-hidden="true" />
          <div className="fd-sidebar-foot">
            <button
              type="button"
              className={`fd-navitem${section === 'Settings' ? ' active' : ''}`}
              onClick={() => setSection('Settings')}
            >
              <Settings />
              Settings
            </button>
          </div>
        </aside>

        <main className="fd-main">
          {section === 'Overview' && (
            <>
              <section className="fd-hero">
                <div>
                  <div className="fd-hero-title">
                    {greeting}, {user?.firstName || displayName}
                  </div>
                  <div className="fd-hero-sub">{loading ? 'Loading your workspace…' : subtitle}</div>
                </div>
                <div className="fd-progress-ring">
                  <div className="fd-ring-label">
                    <div className="fd-ring-title">
                      {completedTasks} of {completedTasks + activeTasks} done
                    </div>
                    <div className="fd-ring-sub">Your sessions</div>
                  </div>
                  <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#d3e8e2" strokeWidth="5" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="none"
                      stroke="var(--fd-brand)"
                      strokeWidth="5"
                      strokeDasharray={2 * Math.PI * 18}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 22 22)"
                    />
                  </svg>
                </div>
              </section>

              <section className="fd-stats" aria-label="Key stats">
                <div className="fd-stat">
                  <div className="fd-stat-icon" style={{ background: '#e5f0ec' }}>
                    <Clock size={15} color="var(--fd-blue)" />
                  </div>
                  <div>
                    <div className="fd-stat-value">{activeTasks}</div>
                    <div className="fd-stat-label">Active tasks</div>
                  </div>
                </div>
                <div className="fd-stat">
                  <div className="fd-stat-icon" style={{ background: 'var(--fd-amber-soft)' }}>
                    <Hourglass size={15} color="var(--fd-amber)" />
                  </div>
                  <div>
                    <div className="fd-stat-value">{awaitingYourMove}</div>
                    <div className="fd-stat-label">Awaiting your move</div>
                  </div>
                </div>
                <div className="fd-stat">
                  <div className="fd-stat-icon" style={{ background: 'var(--fd-positive-soft)' }}>
                    <Target size={15} color="var(--fd-positive)" />
                  </div>
                  <div>
                    <div className="fd-stat-value">{bidStats.successRate || 0}%</div>
                    <div className="fd-stat-label">Bid acceptance</div>
                  </div>
                </div>
                <div className="fd-stat">
                  <div className="fd-stat-icon" style={{ background: 'var(--fd-brand-soft)' }}>
                    <Briefcase size={15} color="var(--fd-brand)" />
                  </div>
                  <div>
                    <div className="fd-stat-value">{activeEngagements || activeTasks}</div>
                    <div className="fd-stat-label">Active engagements</div>
                  </div>
                </div>
              </section>

              <DashboardTaskBoard
                columns={boardColumns}
                loading={boardLoading}
                onOpenMyBids={openMyBids}
              />
              <PerformancePanels
                workStartedByDay={workStartedByDay}
                bidStats={bidStats}
                loading={analyticsLoading}
              />
              <DashboardMyBids initialFilter={bidsFilter} filterKey={bidsFilterKey} />
              <DashboardActivitySection />
            </>
          )}

          {section === 'Task board' && (
            <DashboardTaskBoard
              columns={boardColumns}
              loading={boardLoading}
              onOpenMyBids={openMyBids}
            />
          )}

          {section === 'Performance' && (
            <PerformancePanels
              workStartedByDay={workStartedByDay}
              bidStats={bidStats}
              loading={analyticsLoading}
            />
          )}

          {section === 'My bids' && (
            <DashboardMyBids initialFilter={bidsFilter} filterKey={bidsFilterKey} />
          )}

          {section === 'Activity' && <DashboardActivitySection />}

          {section === 'Settings' && (
            <section className="fd-panel">
              <div className="fd-panel-pad">
                <div className="fd-panel-title">Settings</div>
                <div className="fd-panel-sub">
                  Profile and account preferences stay in your freelancer profile editor.
                </div>
                <button
                  type="button"
                  className="fd-navitem active"
                  style={{ width: 'fit-content', borderLeft: 'none' }}
                  onClick={() => navigate('/profile/edit')}
                >
                  <Settings size={16} />
                  Open edit profile
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

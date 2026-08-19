import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import DashboardWelcome from './DashboardWelcome';
import DashboardStatCards from './DashboardStatCards';
import DashboardAnalyticsMetrics, { type AnalyticsMetricsData } from './DashboardAnalyticsMetrics';
import DashboardAnalytics from './DashboardAnalytics';
import DashboardActivitySection from './DashboardActivitySection';
import DashboardMyBids from './DashboardMyBids';
import DashboardTaskBoard from './DashboardTaskBoard';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './dashboard-theme.css';
import './DashboardHome.css';

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
  return parts.join(' · ');
}

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(true);
  const [userName, setUserName] = useState('there');
  const [greeting, setGreeting] = useState('Welcome back');
  const [subtitle, setSubtitle] = useState('Your freelance workspace for projects and analytics.');
  const [activeTasks, setActiveTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [awaitingYourMove, setAwaitingYourMove] = useState(0);
  const [onTimeRate, setOnTimeRate] = useState(null);
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetricsData | null>(null);
  const [monthlyWork, setMonthlyWork] = useState<{ month: string; count: number }[]>([]);
  const [completionTrend, setCompletionTrend] = useState<{ month: string; count: number }[]>([]);
  const [bidStats, setBidStats] = useState({
    successRate: 0,
    accepted: 0,
    pending: 0,
    rejected: 0,
    total: 0,
  });
  const [boardColumns, setBoardColumns] = useState({ todo: [], progress: [], review: [], done: [] });

  useEffect(() => {
    let cancelled = false;

    api.getDashboardOverview()
      .then((data) => {
        if (cancelled) return;
        const s = data.stats || {};
        const work = data.work || {};
        setUserName(data.user?.firstName || 'there');
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
        setOnTimeRate(work.onTimeRate ?? s.onTimeRate ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setUserName('there');
          setActiveTasks(0);
          setCompletedTasks(0);
          setAwaitingYourMove(0);
          setOnTimeRate(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    api.getDashboardAnalytics()
      .then((data) => {
        if (cancelled) return;
        setMonthlyWork(data.monthlyWork || []);
        setCompletionTrend(data.completionTrend || []);
        setBidStats(data.bidStats || {
          successRate: 0, accepted: 0, pending: 0, rejected: 0, total: 0,
        });
        setAnalyticsMetrics({
          tasksThisMonth: data.productivity?.tasksThisMonth ?? 0,
          bidSuccessRate: data.bidStats?.successRate ?? 0,
          completionRate: data.productivity?.completionRate ?? 0,
          activeEngagements: data.productivity?.activeEngagements ?? 0,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAnalyticsMetrics(null);
          setMonthlyWork([]);
          setCompletionTrend([]);
        }
      })
      .finally(() => { if (!cancelled) setAnalyticsLoading(false); });

    api.getDashboardBoard()
      .then((data) => {
        if (cancelled) return;
        setBoardColumns(data.columns || { todo: [], progress: [], review: [], done: [] });
      })
      .catch(() => {
        if (!cancelled) setBoardColumns({ todo: [], progress: [], review: [], done: [] });
      })
      .finally(() => { if (!cancelled) setBoardLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="dashboard-token-scope dash-single">
      <DashboardWelcome userName={userName} greeting={greeting} subtitle={subtitle} />

      <DashboardStatCards
        activeTasks={activeTasks}
        completedTasks={completedTasks}
        awaitingYourMove={awaitingYourMove}
        onTimeRate={onTimeRate}
        loading={loading}
      />

      <DashboardTaskBoard columns={boardColumns} loading={boardLoading} />

      <DashboardAnalyticsMetrics data={analyticsMetrics} loading={analyticsLoading} />

      <DashboardAnalytics
        monthlyWork={monthlyWork}
        completionTrend={completionTrend}
        bidStats={bidStats}
        loading={analyticsLoading}
      />

      <DashboardMyBids />

      <DashboardActivitySection />
    </div>
  );
}

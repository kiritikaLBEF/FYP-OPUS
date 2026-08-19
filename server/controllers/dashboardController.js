import Transaction from '../models/Transaction.js';
import WorkProject from '../models/WorkProject.js';
import Bid from '../models/Bid.js';
import JobApplication from '../models/JobApplication.js';
import JobPosting from '../models/JobPosting.js';
import ActivityEvent from '../models/ActivityEvent.js';
import WorkSession from '../models/WorkSession.js';
import { ensureWorkSessionForApplication } from './workspaceController.js';
import { ensureFreelancerId } from '../utils/freelancerId.js';
import { ensureDashboardData, purgeDemoDashboardData } from '../utils/dashboardSeed.js';
import { calculateProfileCompletion } from '../utils/profileCompletion.js';
import { generateEStatementPdf } from '../utils/estatementPdf.js';

const ACTIVE_SESSION_STATUSES = ['not_started', 'in_progress', 'final_submitted', 'awaiting_payment'];
const DONE_SESSION_STATUSES = ['paid', 'certified'];

const mapSessionToTask = (s, completed) => {
  let status = 'in_progress';
  if (completed) status = 'completed';
  else if (s.status === 'not_started') status = 'awaiting_start';
  else if (s.status === 'final_submitted' || s.status === 'awaiting_payment') status = 'review';
  const daysLeft = s.deadline
    ? Math.ceil((new Date(s.deadline).getTime() - Date.now()) / 86400000)
    : null;
  return {
    _id: s._id,
    workspaceId: s._id,
    projectRef: s.paymentRef || '',
    title: s.title,
    organizationName: s.organizationName,
    status,
    sessionStatus: s.status,
    paymentAmount: s.bidAmount || 0,
    deadline: s.deadline || null,
    daysLeft,
    occurredAt: completed
      ? (s.paidAt || s.certifiedAt || s.updatedAt)
      : (s.startedAt || s.createdAt),
  };
};

export const getFreelancerSessionStats = async (userId) => {
  const sessions = await WorkSession.find({ freelancerId: userId }).lean();
  const now = new Date();
  const active = sessions.filter((s) => ACTIVE_SESSION_STATUSES.includes(s.status));
  const completed = sessions.filter((s) => DONE_SESSION_STATUSES.includes(s.status));
  const awaitingYourMove = sessions.filter((s) => (
    s.status === 'not_started'
    || (s.status === 'in_progress' && s.finalizationUnlocked)
  ));
  const overdue = active.filter((s) => s.deadline && new Date(s.deadline) < now);
  const withDeadlineDone = completed.filter((s) => s.deadline);
  const onTimeCount = withDeadlineDone.filter((s) => {
    const doneAt = s.paidAt || s.certifiedAt || s.updatedAt;
    return doneAt && new Date(doneAt) <= new Date(s.deadline);
  }).length;
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const tasksThisMonth = sessions.filter((s) => new Date(s.updatedAt || s.createdAt) >= thisMonthStart).length;

  const monthlyWorkMap = {};
  sessions.forEach((s) => {
    const d = s.startedAt || s.createdAt;
    if (!d) return;
    const key = new Date(d).toLocaleString('en', { month: 'short' });
    monthlyWorkMap[key] = (monthlyWorkMap[key] || 0) + 1;
  });
  const completionMap = {};
  completed.forEach((s) => {
    const d = s.paidAt || s.certifiedAt || s.updatedAt;
    if (!d) return;
    const key = new Date(d).toLocaleString('en', { month: 'short' });
    completionMap[key] = (completionMap[key] || 0) + 1;
  });

  return {
    totalSessions: sessions.length,
    activeTasks: active.length,
    completedTasks: completed.length,
    awaitingYourMove: awaitingYourMove.length,
    overdue: overdue.length,
    onTimeRate: withDeadlineDone.length ? Math.round((onTimeCount / withDeadlineDone.length) * 100) : null,
    tasksThisMonth,
    completionRate: sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0,
    monthlyWork: Object.entries(monthlyWorkMap).map(([month, count]) => ({ month, count })),
    completionTrend: Object.entries(completionMap).map(([month, count]) => ({ month, count })),
    sessions,
  };
};

const getDateRange = (preset, customFrom, customTo) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'current_month':
      start.setDate(1); start.setHours(0, 0, 0, 0);
      return { start, end, label: `Current Month (${start.toLocaleString('en', { month: 'long', year: 'numeric' })})` };
    case 'previous_month':
      start.setMonth(now.getMonth() - 1, 1); start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0); end.setHours(23, 59, 59, 999);
      return { start, end, label: `Previous Month (${start.toLocaleString('en', { month: 'long', year: 'numeric' })})` };
    case 'last_3_months':
      start.setMonth(now.getMonth() - 3); start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 3 Months' };
    case 'last_6_months':
      start.setMonth(now.getMonth() - 6); start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 6 Months' };
    case 'current_year':
      start.setMonth(0, 1); start.setHours(0, 0, 0, 0);
      return { start, end, label: `Current Year (${now.getFullYear()})` };
    case 'previous_year':
      start.setFullYear(now.getFullYear() - 1, 0, 1); start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear() - 1, 11, 31); end.setHours(23, 59, 59, 999);
      return { start, end, label: `Previous Year (${now.getFullYear() - 1})` };
    case 'custom':
      return {
        start: customFrom ? new Date(customFrom) : new Date(now.getFullYear(), 0, 1),
        end: customTo ? new Date(customTo) : end,
        label: `Custom (${customFrom || '-'} to ${customTo || '-'})`,
      };
    default:
      start.setMonth(now.getMonth() - 3); start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 3 Months' };
  }
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const monthEarnings = (txns, year, month) =>
  txns.filter((t) => {
    const d = new Date(t.occurredAt);
    return d.getFullYear() === year && d.getMonth() === month && t.credit > 0;
  }).reduce((s, t) => s + t.credit, 0);

const buildAchievements = (stats) => {
  const items = [
    { id: 'first_project', title: 'First Project', desc: 'Complete your first project', icon: 'rocket', unlocked: stats.completedProjects >= 1, progress: Math.min(stats.completedProjects, 1) },
    { id: 'five_projects', title: 'Rising Star', desc: 'Complete 5 projects', icon: 'star', unlocked: stats.completedProjects >= 5, progress: Math.min(stats.completedProjects / 5, 1) },
    { id: 'earnings_50k', title: 'NPR 50K Club', desc: 'Earn NPR 50,000 total', icon: 'trophy', unlocked: stats.totalEarnings >= 50000, progress: Math.min(stats.totalEarnings / 50000, 1) },
    { id: 'earnings_100k', title: 'Century Earner', desc: 'Earn NPR 100,000 total', icon: 'gem', unlocked: stats.totalEarnings >= 100000, progress: Math.min(stats.totalEarnings / 100000, 1) },
    { id: 'bid_master', title: 'Bid Master', desc: 'Win 3 accepted bids', icon: 'target', unlocked: stats.bidsWon >= 3, progress: Math.min(stats.bidsWon / 3, 1) },
    { id: 'org_network', title: 'Network Builder', desc: 'Work with 3 organizations', icon: 'users', unlocked: stats.organizationsWorkedWith >= 3, progress: Math.min(stats.organizationsWorkedWith / 3, 1) },
    { id: 'profile_pro', title: 'Profile Pro', desc: 'Reach 80% profile strength', icon: 'shield', unlocked: stats.profileCompletion >= 80, progress: Math.min(stats.profileCompletion / 80, 1) },
    { id: 'top_rated', title: 'Top Rated', desc: 'Maintain 4.5+ average rating', icon: 'award', unlocked: stats.averageRating >= 4.5, progress: Math.min(stats.averageRating / 4.5, 1) },
  ];
  return items;
};

const buildInsights = (stats, performance) => {
  const insights = [];
  if (stats.profileCompletion < 80) {
    insights.push({ type: 'profile', message: `Your profile is ${stats.profileCompletion}% complete. Strengthen it to attract more clients.`, action: 'edit_profile' });
  }
  if (performance.changePct > 0) {
    insights.push({ type: 'growth', message: `Earnings up ${performance.changePct}% this month. Great momentum!`, action: 'analytics' });
  } else if (performance.changePct < 0) {
    insights.push({ type: 'tip', message: 'Earnings dipped this month. Explore new project invitations.', action: 'projects' });
  }
  if (stats.activeProjects > 0) {
    insights.push({ type: 'active', message: `You have ${stats.activeProjects} active project${stats.activeProjects > 1 ? 's' : ''} in progress.`, action: 'projects' });
  }
  if (stats.bidSuccessRate >= 50) {
    insights.push({ type: 'success', message: `${stats.bidSuccessRate}% bid acceptance rate, above average performance.`, action: 'analytics' });
  }
  return insights.slice(0, 4);
};

const initDashboard = async (user) => {
  const freelancerId = await ensureFreelancerId(user);
  if (process.env.DASHBOARD_SEED_DEMO === 'true') {
    await ensureDashboardData(user._id, freelancerId);
  } else {
    await purgeDemoDashboardData(user._id);
  }
  return freelancerId;
};

/** Exclude seeded demo rows unless explicit demo mode is enabled. */
const realDataFilter = () => (
  process.env.DASHBOARD_SEED_DEMO === 'true' ? {} : { isDemo: { $ne: true } }
);

const getBidStats = async (userId) => {
  const jobApps = await JobApplication.find({ freelancerId: userId }).lean();
  if (jobApps.length > 0) {
    const won = jobApps.filter((a) => a.status === 'accepted').length;
    return {
      total: jobApps.length,
      won,
      pending: jobApps.filter((a) => a.status === 'pending').length,
      rejected: jobApps.filter((a) => a.status === 'rejected').length,
      successRate: Math.round((won / jobApps.length) * 100),
    };
  }

  const bids = await Bid.find({ userId, ...realDataFilter() }).lean();
  const won = bids.filter((b) => b.status === 'accepted').length;
  return {
    total: bids.length,
    won,
    pending: bids.filter((b) => b.status === 'pending').length,
    rejected: bids.filter((b) => b.status === 'rejected').length,
    successRate: bids.length ? Math.round((won / bids.length) * 100) : 0,
  };
};

const walletFromTransactions = async (userId) => {
  const txns = await Transaction.find({ userId, ...realDataFilter() }).sort({ occurredAt: 1 }).lean();
  const totalCredits = txns.reduce((s, t) => s + t.credit, 0);
  const totalDebits = txns.reduce((s, t) => s + t.debit, 0);
  const pending = await Transaction.aggregate([
    { $match: { userId, paymentStatus: 'pending', ...realDataFilter() } },
    { $group: { _id: null, amount: { $sum: '$credit' } } },
  ]);
  const withdrawn = txns.filter((t) => t.paymentType === 'withdrawal').reduce((s, t) => s + t.debit, 0);
  const platformFees = txns.filter((t) => t.paymentType === 'platform_fee').reduce((s, t) => s + t.debit, 0);
  const last = txns[txns.length - 1];
  const available = last?.runningBalance || 0;
  const pendingAmount = pending[0]?.amount || 0;

  return {
    totalEarnings: totalCredits,
    availableBalance: available,
    pendingPayments: pendingAmount,
    withdrawnAmount: withdrawn,
    platformFees,
    netEarnings: totalCredits - platformFees,
  };
};

export const getDashboardInit = async (req, res) => {
  try {
    const freelancerId = await initDashboard(req.user);
    res.json({
      freelancerId,
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        profilePicture: req.user.profilePicture || '',
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    await initDashboard(req.user);
    const wallet = await walletFromTransactions(userId);
    const allTxns = await Transaction.find({ userId, ...realDataFilter() }).sort({ occurredAt: 1 }).lean();
    const projectFilter = { userId, ...realDataFilter() };
    const work = await getFreelancerSessionStats(userId);
    const [completed, active, acceptedProjects, bidStats, orgs, pendingTasks] = await Promise.all([
      WorkProject.countDocuments({ ...projectFilter, status: 'completed' }),
      WorkProject.countDocuments({ ...projectFilter, status: { $in: ['in_progress', 'review'] } }),
      WorkProject.countDocuments({ ...projectFilter, status: { $in: ['awaiting_start', 'in_progress', 'review'] } }),
      getBidStats(userId),
      WorkProject.distinct('organizationRef', projectFilter),
      WorkProject.countDocuments({ ...projectFilter, status: { $in: ['awaiting_start', 'in_progress', 'review', 'on_hold'] } }),
    ]);
    const completion = calculateProfileCompletion(req.user);

    const now = new Date();
    const thisMonth = monthEarnings(allTxns, now.getFullYear(), now.getMonth());
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = monthEarnings(allTxns, lastMonthDate.getFullYear(), lastMonthDate.getMonth());
    const changePct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : (thisMonth > 0 ? 100 : 0);

    const monthlyMap = {};
    allTxns.filter((t) => t.credit > 0).forEach((t) => {
      const key = new Date(t.occurredAt).toLocaleString('en', { month: 'short' });
      monthlyMap[key] = (monthlyMap[key] || 0) + t.credit;
    });
    const earningsTrend = Object.entries(monthlyMap).slice(-6).map(([month, amount]) => ({ month, amount }));

    const stats = {
      totalEarnings: wallet.totalEarnings,
      walletBalance: wallet.availableBalance,
      completedProjects: work.totalSessions ? work.completedTasks : completed,
      activeProjects: work.totalSessions ? work.activeTasks : active,
      pendingTasks: work.totalSessions ? work.activeTasks : pendingTasks,
      acceptedProjects: work.totalSessions ? work.activeTasks : acceptedProjects,
      pendingAcceptedProjects: work.totalSessions ? work.activeTasks : acceptedProjects,
      totalBids: bidStats.total,
      bidsWon: bidStats.won,
      bidSuccessRate: bidStats.successRate,
      organizationsWorkedWith: work.totalSessions
        ? new Set(work.sessions.map((s) => s.organizationName).filter(Boolean)).size
        : orgs.length,
      averageRating: 0,
      profileCompletion: completion.percentage,
      pendingPayments: wallet.pendingPayments,
      earningsGrowthPct: changePct,
      activeTasks: work.activeTasks,
      awaitingYourMove: work.awaitingYourMove,
      overdue: work.overdue,
      onTimeRate: work.onTimeRate,
      tasksThisMonth: work.tasksThisMonth,
    };

    const [activityFeed, spotlightProjects] = await Promise.all([
      ActivityEvent.find({ userId, ...realDataFilter() }).sort({ occurredAt: -1 }).limit(12).lean(),
      WorkProject.find({ ...projectFilter, status: { $ne: 'completed' } }).sort({ bidAcceptedAt: -1 }).limit(3).lean(),
    ]);

    res.json({
      greeting: getGreeting(),
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        profilePicture: req.user.profilePicture || '',
      },
      stats,
      achievements: buildAchievements(stats),
      insights: buildInsights(stats, { thisMonth, lastMonth, changePct }),
      activityFeed,
      earningsTrend,
      performance: { thisMonth, lastMonth, changePct },
      spotlightProjects,
      freelancerId: req.user.freelancerId,
      work: {
        totalSessions: work.totalSessions,
        activeTasks: work.activeTasks,
        completedTasks: work.completedTasks,
        awaitingYourMove: work.awaitingYourMove,
        overdue: work.overdue,
        onTimeRate: work.onTimeRate,
        tasksThisMonth: work.tasksThisMonth,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    await initDashboard(req.user);

    const txns = await Transaction.find({ userId, ...realDataFilter() }).sort({ occurredAt: 1 }).lean();
    const creditTxns = txns.filter((t) => t.credit > 0);
    const monthlyMap = {};
    creditTxns.forEach((t) => {
      const key = new Date(t.occurredAt).toLocaleString('en', { month: 'short', year: '2-digit' });
      monthlyMap[key] = (monthlyMap[key] || 0) + t.credit;
    });
    const monthlyEarnings = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));

    const sessions = await WorkSession.find({ freelancerId: userId }).lean();
    const sessionStats = sessions.length ? await getFreelancerSessionStats(userId) : null;

    const projectFilter = { userId, ...realDataFilter() };
    const projects = await WorkProject.find(projectFilter).lean();
    const byStatus = {};
    projects.forEach((p) => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
    const projectStats = Object.entries(byStatus).map(([status, count]) => ({ status, count }));

    let completionTrend = [];
    if (sessionStats) {
      completionTrend = sessionStats.completionTrend;
    } else {
      const completedByMonth = {};
      projects.filter((p) => p.status === 'completed').forEach((p) => {
        const d = p.completedDate || p.expectedCompletionDate;
        if (!d) return;
        const key = new Date(d).toLocaleString('en', { month: 'short' });
        completedByMonth[key] = (completedByMonth[key] || 0) + 1;
      });
      completionTrend = Object.entries(completedByMonth).map(([month, count]) => ({ month, count }));
    }

    const categoryMap = {};
    projects.forEach((p) => {
      categoryMap[p.category] = (categoryMap[p.category] || 0) + p.paymentAmount;
    });
    const earningsByCategory = Object.entries(categoryMap).map(([category, amount]) => ({ category, amount }));
    const categoryTotal = earningsByCategory.reduce((s, c) => s + c.amount, 0) || 1;

    const bidStats = await getBidStats(userId);

    const orgActivity = await WorkProject.aggregate([
      { $match: { userId, ...(process.env.DASHBOARD_SEED_DEMO === 'true' ? {} : { isDemo: { $ne: true } }) } },
      { $group: { _id: '$organizationName', projects: { $sum: 1 }, earnings: { $sum: '$paymentAmount' } } },
      { $sort: { earnings: -1 } },
      { $limit: 6 },
    ]);

    const now = new Date();
    const thisMonthEarn = monthEarnings(txns, now.getFullYear(), now.getMonth());
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEarn = monthEarnings(txns, lastMonthDate.getFullYear(), lastMonthDate.getMonth());
    const earningsComparison = {
      thisMonth: thisMonthEarn,
      lastMonth: lastMonthEarn,
      changePct: lastMonthEarn > 0 ? Math.round(((thisMonthEarn - lastMonthEarn) / lastMonthEarn) * 100) : (thisMonthEarn > 0 ? 100 : 0),
    };

    const productivity = {
      avgProjectValue: projects.length ? Math.round(projects.reduce((s, p) => s + p.paymentAmount, 0) / projects.length) : 0,
      completionRate: sessionStats
        ? sessionStats.completionRate
        : (projects.length ? Math.round((byStatus.completed || 0) / projects.length * 100) : 0),
      activeEngagements: sessionStats
        ? sessionStats.activeTasks
        : ((byStatus.in_progress || 0) + (byStatus.review || 0)),
      clientRetention: orgActivity.length > 1 ? Math.round((orgActivity.filter((o) => o.projects > 1).length / orgActivity.length) * 100) : 0,
      tasksThisMonth: sessionStats?.tasksThisMonth ?? 0,
    };

    const engagement = {
      profileViews: 0,
      portfolioViews: 0,
      invitations: bidStats.pending,
      reviews: 0,
    };

    res.json({
      monthlyEarnings,
      completionTrend,
      projectStats,
      earningsByCategory: earningsByCategory.map((c) => ({ ...c, pct: Math.round((c.amount / categoryTotal) * 100) })),
      bidStats: {
        total: bidStats.total,
        accepted: bidStats.won,
        pending: bidStats.pending,
        rejected: bidStats.rejected,
        successRate: bidStats.successRate,
      },
      orgActivity,
      earningsComparison,
      productivity,
      engagement,
      monthlyWork: sessionStats?.monthlyWork || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getEarnings = async (req, res) => {
  try {
    await initDashboard(req.user);
    const wallet = await walletFromTransactions(req.user._id);
    const monthly = await Transaction.aggregate([
      { $match: { userId: req.user._id, credit: { $gt: 0 }, ...(process.env.DASHBOARD_SEED_DEMO === 'true' ? {} : { isDemo: { $ne: true } }) } },
      {
        $group: {
          _id: { y: { $year: '$occurredAt' }, m: { $month: '$occurredAt' } },
          total: { $sum: '$credit' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    res.json({ wallet, monthlyBreakdown: monthly });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAcceptedProjects = async (req, res) => {
  try {
    await initDashboard(req.user);
    const projects = await WorkProject.find({
      userId: req.user._id,
      ...realDataFilter(),
      status: { $ne: 'completed' },
    }).sort({ bidAcceptedAt: -1 }).lean();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getActivityFeed = async (req, res) => {
  try {
    await initDashboard(req.user);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 4);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ActivityEvent.find({ userId: req.user._id, ...realDataFilter() }).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityEvent.countDocuments({ userId: req.user._id, ...realDataFilter() }),
    ]);

    res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const PENDING_STATUSES = ['awaiting_start', 'in_progress', 'review', 'on_hold'];

export const getTasks = async (req, res) => {
  try {
    await initDashboard(req.user);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 4);
    const skip = (page - 1) * limit;
    const status = req.query.status === 'completed' ? 'completed' : 'pending';

    const sessions = await WorkSession.find({ freelancerId: req.user._id }).sort({ updatedAt: -1 }).lean();
    if (sessions.length) {
      const filtered = sessions.filter((s) => (
        status === 'completed'
          ? DONE_SESSION_STATUSES.includes(s.status)
          : ACTIVE_SESSION_STATUSES.includes(s.status)
      ));
      const slice = filtered.slice(skip, skip + limit);
      return res.json({
        items: slice.map((s) => mapSessionToTask(s, status === 'completed')),
        total: filtered.length,
        page,
        pages: Math.ceil(filtered.length / limit) || 1,
        status,
      });
    }

    const q = { userId: req.user._id, ...realDataFilter() };
    if (status === 'completed') {
      q.status = 'completed';
    } else {
      q.status = { $in: PENDING_STATUSES };
    }

    const sortField = status === 'completed' ? { completedDate: -1, updatedAt: -1 } : { bidAcceptedAt: -1 };

    const [items, total] = await Promise.all([
      WorkProject.find(q).sort(sortField).skip(skip).limit(limit).lean(),
      WorkProject.countDocuments(q),
    ]);

    res.json({
      items: items.map((p) => ({
        _id: p._id,
        projectRef: p.projectRef,
        title: p.title,
        organizationName: p.organizationName,
        status: p.status,
        paymentAmount: p.paymentAmount,
        occurredAt: status === 'completed' ? (p.completedDate || p.updatedAt) : (p.bidAcceptedAt || p.createdAt),
      })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      status,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTaskBoard = async (req, res) => {
  try {
    await initDashboard(req.user);
    const sessions = await WorkSession.find({ freelancerId: req.user._id }).sort({ updatedAt: -1 }).lean();
    const columns = { todo: [], progress: [], review: [], done: [] };
    sessions.forEach((s) => {
      const item = mapSessionToTask(s, DONE_SESSION_STATUSES.includes(s.status));
      if (s.status === 'not_started') columns.todo.push(item);
      else if (s.status === 'in_progress') columns.progress.push(item);
      else if (s.status === 'final_submitted') columns.review.push(item);
      else columns.done.push(item);
    });
    const stats = await getFreelancerSessionStats(req.user._id);
    res.json({
      columns,
      stats: {
        activeTasks: stats.activeTasks,
        overdue: stats.overdue,
        awaitingYourMove: stats.awaitingYourMove,
        total: sessions.length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getBids = async (req, res) => {
  try {
    await initDashboard(req.user);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 4);
    const skip = (page - 1) * limit;

    const [jobApps, jobAppTotal] = await Promise.all([
      JobApplication.find({ freelancerId: req.user._id }).sort({ appliedAt: -1 }).skip(skip).limit(limit).lean(),
      JobApplication.countDocuments({ freelancerId: req.user._id }),
    ]);

    if (jobAppTotal > 0) {
      const jobs = await JobPosting.find({ _id: { $in: jobApps.map((a) => a.jobPostingId) } }).lean();
      const jobMap = Object.fromEntries(jobs.map((j) => [String(j._id), j]));

      await Promise.all(
        jobApps
          .filter((a) => a.status === 'accepted')
          .map((a) => ensureWorkSessionForApplication(a, jobMap[String(a.jobPostingId)])),
      );

      const sessions = await WorkSession.find({
        applicationId: { $in: jobApps.map((a) => a._id) },
      }).lean();
      const sessionMap = Object.fromEntries(sessions.map((s) => [String(s.applicationId), s]));

      const acceptedTotal = await JobApplication.countDocuments({
        freelancerId: req.user._id,
        status: 'accepted',
      });

      return res.json({
        items: jobApps.map((a) => {
          const job = jobMap[String(a.jobPostingId)];
          const ws = sessionMap[String(a._id)];
          return {
            _id: a._id,
            projectRef: job?.employerRef || '',
            title: a.jobTitle || job?.title || 'Job application',
            organizationName: a.organizationName || job?.organizationName || '',
            amount: job?.budgetType === 'hourly' ? job?.hourlyRate : job?.budget,
            status: a.status,
            occurredAt: a.appliedAt,
            workspaceId: ws?._id || null,
            workspaceStatus: ws?.status || null,
            category: job?.category || 'other',
            deadline: job?.applicationDeadline || null,
          };
        }),
        total: jobAppTotal,
        acceptedCount: acceptedTotal,
        page,
        pages: Math.ceil(jobAppTotal / limit) || 1,
      });
    }

    const [items, total] = await Promise.all([
      Bid.find({ userId: req.user._id, ...realDataFilter() }).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
      Bid.countDocuments({ userId: req.user._id, ...realDataFilter() }),
    ]);

    res.json({
      items: items.map((b) => ({
        _id: b._id,
        projectRef: b.projectRef,
        title: b.projectTitle,
        organizationName: b.organizationName,
        amount: b.amount,
        status: b.status,
        occurredAt: b.submittedAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    await initDashboard(req.user);
    const { search = '', sort = 'date_desc', page = 1, limit = 15, preset, from, to } = req.query;
    const q = { userId: req.user._id, ...realDataFilter() };
    if (search) {
      const re = new RegExp(search, 'i');
      q.$or = [
        { description: re }, { transactionId: re }, { projectTitle: re },
        { organizationName: re }, { organizationRef: re }, { projectRef: re },
      ];
    }
    if (preset || from || to) {
      const period = getDateRange(preset || 'custom', from, to);
      q.occurredAt = { $gte: period.start, $lte: period.end };
    }
    const sortMap = {
      date_desc: { occurredAt: -1 },
      date_asc: { occurredAt: 1 },
      amount_desc: { credit: -1 },
      amount_asc: { credit: 1 },
    };
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
      Transaction.find(q).sort(sortMap[sort] || sortMap.date_desc).skip(skip).limit(Number(limit)).lean(),
      Transaction.countDocuments(q),
    ]);
    res.json({ transactions, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getEStatement = async (req, res) => {
  try {
    const freelancerId = await initDashboard(req.user);
    const { preset = 'last_3_months', from, to } = req.query;
    const period = getDateRange(preset, from, to);

    const before = await Transaction.findOne({
      userId: req.user._id,
      ...realDataFilter(),
      occurredAt: { $lt: period.start },
    }).sort({ occurredAt: -1 }).lean();

    const transactions = await Transaction.find({
      userId: req.user._id,
      ...realDataFilter(),
      occurredAt: { $gte: period.start, $lte: period.end },
    }).sort({ occurredAt: 1 }).lean();

    const openingBalance = before?.runningBalance || 0;
    const totalCredits = transactions.reduce((s, t) => s + t.credit, 0);
    const totalDebits = transactions.reduce((s, t) => s + t.debit, 0);
    const closingBalance = transactions.length
      ? transactions[transactions.length - 1].runningBalance
      : openingBalance;

    const wallet = await walletFromTransactions(req.user._id);

    const summary = {
      openingBalance,
      closingBalance,
      totalCredits,
      totalDebits,
      availableBalance: wallet.availableBalance,
    };

    res.json({
      freelancerId,
      user: { firstName: req.user.firstName, lastName: req.user.lastName, email: req.user.email },
      period,
      summary,
      transactions,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const downloadEStatementPdf = async (req, res) => {
  try {
    const freelancerId = await initDashboard(req.user);
    const { preset = 'last_3_months', from, to } = req.query;
    const period = getDateRange(preset, from, to);

    const before = await Transaction.findOne({
      userId: req.user._id,
      ...realDataFilter(),
      occurredAt: { $lt: period.start },
    }).sort({ occurredAt: -1 }).lean();

    const transactions = await Transaction.find({
      userId: req.user._id,
      ...realDataFilter(),
      occurredAt: { $gte: period.start, $lte: period.end },
    }).sort({ occurredAt: 1 }).lean();

    const wallet = await walletFromTransactions(req.user._id);
    const summary = {
      openingBalance: before?.runningBalance || 0,
      closingBalance: transactions.length ? transactions[transactions.length - 1].runningBalance : (before?.runningBalance || 0),
      totalCredits: transactions.reduce((s, t) => s + t.credit, 0),
      totalDebits: transactions.reduce((s, t) => s + t.debit, 0),
      availableBalance: wallet.availableBalance,
    };

    const pdf = await generateEStatementPdf({
      user: req.user,
      freelancerId,
      period,
      summary,
      transactions,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OPUS-E-Statement-${freelancerId}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

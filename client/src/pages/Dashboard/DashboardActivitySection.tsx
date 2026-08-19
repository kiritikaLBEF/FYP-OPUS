import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { api } from '../../services/api';
import { fmtDate, fmtNPR, STATUS_LABELS } from './dashboardUtils';
import DashboardPagination, { HOME_PAGE_SIZE } from './DashboardPagination';
import type { ActivityFeedItem } from './DashboardActivityFeed';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardActivitySection.css';

type ActivityTab = 'recent' | 'pending' | 'completed' | 'bids';

const TABS: { id: ActivityTab; label: string }[] = [
  { id: 'recent', label: 'Recent Activity' },
  { id: 'pending', label: 'Pending Tasks' },
  { id: 'completed', label: 'Completed Tasks' },
  { id: 'bids', label: 'Bids Submitted' },
];

interface TaskItem {
  _id?: string;
  title: string;
  organizationName?: string;
  status?: string;
  paymentAmount?: number;
  amount?: number;
  occurredAt: string | Date;
  projectRef?: string;
}

function formatRelativeTime(date: string | Date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function bidStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  };
  return map[status] || status;
}

export default function DashboardActivitySection() {
  const [tab, setTab] = useState<ActivityTab>('recent');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [activityItems, setActivityItems] = useState<ActivityFeedItem[]>([]);
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const [bidItems, setBidItems] = useState<TaskItem[]>([]);

  const load = useCallback(async (activeTab: ActivityTab, activePage: number) => {
    setLoading(true);
    try {
      if (activeTab === 'recent') {
        const data = await api.getActivityFeed({ page: activePage, limit: HOME_PAGE_SIZE });
        setActivityItems(data.items || []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setPage(data.page ?? activePage);
      } else if (activeTab === 'bids') {
        const data = await api.getBids({ page: activePage, limit: HOME_PAGE_SIZE });
        setBidItems(data.items || []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setPage(data.page ?? activePage);
      } else {
        const status = activeTab === 'completed' ? 'completed' : 'pending';
        const data = await api.getTasks({ status, page: activePage, limit: HOME_PAGE_SIZE });
        setTaskItems(data.items || []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setPage(data.page ?? activePage);
      }
    } catch {
      setActivityItems([]);
      setTaskItems([]);
      setBidItems([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab, 1);
  }, [tab, load]);

  const handleTab = (next: ActivityTab) => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
  };

  const handlePage = (n: number) => {
    setPage(n);
    load(tab, n);
  };

  const renderContent = () => {
    if (loading) {
      return <div className="das-loading" role="status" aria-label="Loading" />;
    }

    if (tab === 'recent') {
      if (activityItems.length === 0) {
        return (
          <div className="das-empty">
            <p className="das-empty__title">No activity yet</p>
            <p className="das-empty__sub">Updates from your projects will appear here.</p>
          </div>
        );
      }
      return (
        <ul className="das-list">
          {activityItems.map((item) => (
            <li key={item._id ?? `${item.type}-${item.occurredAt}`} className="das-item">
              <div className="das-item__main">
                <p className="das-item__title">{item.title}</p>
                {item.subtitle && <p className="das-item__sub">{item.subtitle}</p>}
              </div>
              <time className="das-item__time" dateTime={new Date(item.occurredAt).toISOString()}>
                {formatRelativeTime(item.occurredAt)}
              </time>
            </li>
          ))}
        </ul>
      );
    }

    if (tab === 'bids') {
      if (bidItems.length === 0) {
        return (
          <div className="das-empty">
            <p className="das-empty__title">No bids submitted</p>
            <p className="das-empty__sub">Your submitted bids will show up here.</p>
          </div>
        );
      }
      return (
        <ul className="das-list">
          {bidItems.map((item) => (
            <li key={item._id ?? item.projectRef} className="das-item">
              <div className="das-item__main">
                <p className="das-item__title">{item.title}</p>
                <p className="das-item__sub">
                  {item.organizationName && <span>{item.organizationName} · </span>}
                  <span>{fmtNPR(item.amount)}</span>
                </p>
              </div>
              <div className="das-item__meta">
                <span className={`das-pill das-pill--${item.status}`}>{bidStatusLabel(item.status || '')}</span>
                <time className="das-item__time" dateTime={new Date(item.occurredAt).toISOString()}>
                  {fmtDate(item.occurredAt)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      );
    }

    if (taskItems.length === 0) {
      return (
        <div className="das-empty">
          <p className="das-empty__title">{tab === 'completed' ? 'No completed tasks' : 'No pending tasks'}</p>
          <p className="das-empty__sub">
            {tab === 'completed' ? 'Finished projects will appear here.' : 'Active projects will appear here.'}
          </p>
        </div>
      );
    }

    return (
      <ul className="das-list">
        {taskItems.map((item) => (
          <li key={item._id ?? item.projectRef} className="das-item">
            <div className="das-item__main">
              <p className="das-item__title">{item.title}</p>
              <p className="das-item__sub">
                {item.organizationName && <span>{item.organizationName} · </span>}
                <span>{fmtNPR(item.paymentAmount)}</span>
              </p>
            </div>
            <div className="das-item__meta">
              {item.status && (
                <span className="das-pill das-pill--task">{STATUS_LABELS[item.status] || item.status}</span>
              )}
              <time className="das-item__time" dateTime={new Date(item.occurredAt).toISOString()}>
                {fmtDate(item.occurredAt)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="glass-surface das" aria-label="Activity and tasks" style={{ '--glass-delay': '400ms' } as CSSProperties}>
      <header className="das__head">
        <h2 className="das__title">Activity</h2>
        <div className="das-tabs" role="tablist" aria-label="Activity filters">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`das-tab ${tab === t.id ? 'das-tab--active' : ''}`}
              onClick={() => handleTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {renderContent()}

      {!loading && pages > 1 && (
        <DashboardPagination page={page} pages={pages} onPageChange={handlePage} label="Activity pages" />
      )}
    </section>
  );
}

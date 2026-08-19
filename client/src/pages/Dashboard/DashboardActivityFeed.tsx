import { type CSSProperties, type ReactNode } from 'react';
import DashboardPagination from './DashboardPagination';
import './dashboard-tokens.css';
import './DashboardActivityFeed.css';

export type ActivityType =
  | 'proposal_accepted'
  | 'payment_received'
  | 'project_invitation'
  | 'project_completed'
  | 'certificate_added'
  | 'portfolio_viewed'
  | 'profile_viewed'
  | 'review_received'
  | 'withdrawal_completed'
  | 'statement_generated';

export interface ActivityFeedItem {
  _id?: string;
  type: ActivityType;
  title: string;
  subtitle?: string;
  occurredAt: string | Date;
}

export interface DashboardActivityFeedProps {
  items: ActivityFeedItem[];
  loading?: boolean;
  theme?: 'dark' | 'light';
  title?: string;
  subtitle?: string;
  page?: number;
  pages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

const SW = 1.5;
const ICON_SIZE = 16;

const SUCCESS_TYPES: ActivityType[] = [
  'proposal_accepted',
  'payment_received',
  'project_completed',
  'review_received',
  'withdrawal_completed',
];

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

function ActivityFeedIcon({ type }: { type: ActivityType }) {
  const icons: Record<ActivityType, ReactNode> = {
    proposal_accepted: (
      <path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    ),
    payment_received: (
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    ),
    project_invitation: (
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    ),
    project_completed: (
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    ),
    certificate_added: (
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth={SW} />
    ),
    portfolio_viewed: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth={SW} />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={SW} />
      </>
    ),
    profile_viewed: (
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth={SW} />
    ),
    review_received: (
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" />
    ),
    withdrawal_completed: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth={SW} />
        <path d="M2 10h20" stroke="currentColor" strokeWidth={SW} />
      </>
    ),
    statement_generated: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth={SW} />
        <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      </>
    ),
  };

  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {icons[type]}
    </svg>
  );
}

function TimelineItem({ item, index, isLast }: { item: ActivityFeedItem; index: number; isLast: boolean }) {
  const isSuccess = SUCCESS_TYPES.includes(item.type);

  return (
    <article
      className="daf-item"
      style={{ '--daf-delay': `${index * 60}ms` } as CSSProperties}
    >
      <div className="daf-item__rail" aria-hidden="true">
        <span className={`daf-item__icon ${isSuccess ? 'daf-item__icon--success' : ''}`}>
          <ActivityFeedIcon type={item.type} />
        </span>
        {!isLast && <span className="daf-item__line" />}
      </div>
      <div className="daf-item__body">
        <p className="daf-item__title">{item.title}</p>
        {item.subtitle && <p className="daf-item__sub">{item.subtitle}</p>}
        <time className="daf-item__time" dateTime={new Date(item.occurredAt).toISOString()}>
          {formatRelativeTime(item.occurredAt)}
        </time>
      </div>
    </article>
  );
}

export default function DashboardActivityFeed({
  items,
  loading = false,
  theme = 'light',
  title = 'Recent Activity',
  subtitle = 'Your latest updates and milestones',
  page = 1,
  pages = 1,
  total = 0,
  onPageChange,
}: DashboardActivityFeedProps) {
  return (
    <aside className="dashboard-token-scope daf" data-theme={theme} aria-label="Recent activity feed">
      <header className="daf__head">
        <h2 className="daf__title">{title}</h2>
        <p className="daf__sub">
          {total > 0
            ? `${total} update${total === 1 ? '' : 's'} on your account`
            : subtitle}
        </p>
      </header>

      {loading ? (
        <div className="daf-loading" role="status" aria-label="Loading activity" />
      ) : items.length === 0 ? (
        <div className="daf-empty">
          <p className="daf-empty__title">No activity yet</p>
          <p className="daf-empty__sub">Updates from your projects and profile will appear here.</p>
        </div>
      ) : (
        <div className="daf-timeline" role="list">
          {items.map((item, index) => (
            <TimelineItem
              key={item._id ?? `${item.type}-${item.occurredAt}`}
              item={item}
              index={index}
              isLast={index === items.length - 1}
            />
          ))}
        </div>
      )}

      {!loading && pages > 1 && onPageChange && (
        <DashboardPagination
          page={page}
          pages={pages}
          onPageChange={onPageChange}
          label="Activity pages"
        />
      )}
    </aside>
  );
}

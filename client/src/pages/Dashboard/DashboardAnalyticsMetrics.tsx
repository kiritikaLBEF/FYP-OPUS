import { type CSSProperties } from 'react';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardAnalyticsMetrics.css';

export interface AnalyticsMetricsData {
  tasksThisMonth: number;
  bidSuccessRate: number;
  completionRate: number;
  activeEngagements: number;
}

interface DashboardAnalyticsMetricsProps {
  data: AnalyticsMetricsData | null;
  loading?: boolean;
}

export default function DashboardAnalyticsMetrics({ data, loading = false }: DashboardAnalyticsMetricsProps) {
  if (loading || !data) {
    return (
      <section className="dam" aria-label="Analytics overview">
        <div className="dam-loading" role="status" aria-label="Loading analytics" />
      </section>
    );
  }

  const cards = [
    {
      id: 'month',
      label: 'Tasks this month',
      value: String(data.tasksThisMonth),
      extra: <span className="dam-meta">updated engagements</span>,
      tint: 'blue',
    },
    {
      id: 'bids',
      label: 'Bid success',
      value: `${data.bidSuccessRate}%`,
      extra: <span className="dam-meta">acceptance rate</span>,
      tint: 'green',
    },
    {
      id: 'completion',
      label: 'Completion rate',
      value: `${data.completionRate}%`,
      extra: <span className="dam-meta">projects delivered</span>,
      tint: 'purple',
    },
    {
      id: 'active',
      label: 'Active engagements',
      value: String(data.activeEngagements),
      extra: <span className="dam-meta">in motion now</span>,
      tint: 'orange',
    },
  ];

  return (
    <section className="dam" aria-label="Analytics overview">
      <header className="dam__head">
        <h2 className="glass-section-title">Analytics</h2>
        <p className="glass-section-sub">How your work is moving, not what you have earned</p>
      </header>
      <div className="dam-grid">
        {cards.map((card, i) => (
          <article
            key={card.id}
            className={`glass-surface glass-surface--interactive dam-card dam-card--${card.tint}`}
            style={{ '--glass-delay': `${80 + i * 70}ms` } as CSSProperties}
          >
            <p className="dam-card__label">{card.label}</p>
            <div className="dam-card__row">
              <p className="dam-card__value">{card.value}</p>
              {card.extra}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

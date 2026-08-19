import { useEffect, useState, type CSSProperties } from 'react';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardStatCards.css';

export interface DashboardStatCardsProps {
  activeTasks: number;
  completedTasks: number;
  awaitingYourMove: number;
  onTimeRate: number | null;
  loading?: boolean;
}

function useCountUp(target: number, active: boolean, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) ** 4;
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);
  return value;
}

export default function DashboardStatCards({
  activeTasks,
  completedTasks,
  awaitingYourMove,
  onTimeRate,
  loading = false,
}: DashboardStatCardsProps) {
  const animate = !loading;
  const activeVal = useCountUp(activeTasks, animate);
  const completedVal = useCountUp(completedTasks, animate);
  const awaitVal = useCountUp(awaitingYourMove, animate);
  const onTimeVal = useCountUp(onTimeRate ?? 0, animate && onTimeRate != null);

  const cards = [
    {
      id: 'active',
      label: 'Active tasks',
      value: String(activeVal),
      icon: (
        <path d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ),
    },
    {
      id: 'completed',
      label: 'Completed',
      value: String(completedVal),
      icon: (
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ),
    },
    {
      id: 'awaiting',
      label: 'Awaiting your move',
      value: String(awaitVal),
      icon: (
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ),
    },
    {
      id: 'ontime',
      label: 'On-time delivery',
      value: onTimeRate == null ? '—' : `${onTimeVal}%`,
      icon: (
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ),
    },
  ];

  return (
    <section className="dsc" aria-label="Summary">
      {loading ? (
        <div className="dsc-loading" role="status" aria-label="Loading summary" />
      ) : (
        <div className="dsc-row">
          {cards.map((card, i) => (
            <article
              key={card.id}
              className={`glass-surface glass-surface--interactive dsc-card dsc-card--${card.id}`}
              style={{ '--glass-delay': `${120 + i * 80}ms` } as CSSProperties}
            >
              <span className="dsc-card__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">{card.icon}</svg>
              </span>
              <p className="dsc-card__value">{card.value}</p>
              <p className="dsc-card__label">{card.label}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

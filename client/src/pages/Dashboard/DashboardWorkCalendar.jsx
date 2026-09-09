import { useMemo } from 'react';
import './DashboardWorkCalendar.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildWeeks(daysBack = 126) {
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - daysBack);
  // Align to Monday
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);

  const weeks = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return { weeks, start, today };
}

function monthLabels(weeks) {
  const labels = [];
  let last = '';
  weeks.forEach((week, wi) => {
    const mid = week[0];
    const label = mid.toLocaleString('en', { month: 'short' });
    if (label !== last) {
      labels.push({ index: wi, label });
      last = label;
    }
  });
  return labels;
}

function levelFor(count, max) {
  if (!count) return 0;
  if (max <= 1) return 3;
  const r = count / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

/**
 * GitHub-style contribution calendar for work-started days.
 * @param {{ date: string, count: number }[]} days
 */
export default function DashboardWorkCalendar({ days = [], loading = false }) {
  const countMap = useMemo(() => {
    const map = {};
    days.forEach((d) => {
      if (d?.date) map[d.date] = Number(d.count) || 0;
    });
    return map;
  }, [days]);

  const { weeks, today } = useMemo(() => buildWeeks(126), []);
  const labels = useMemo(() => monthLabels(weeks), [weeks]);
  const max = useMemo(() => Math.max(0, ...Object.values(countMap)), [countMap]);
  const total = useMemo(() => Object.values(countMap).reduce((s, n) => s + n, 0), [countMap]);

  if (loading) {
    return <div className="fd-cal fd-cal--loading" role="status" aria-label="Loading work calendar" />;
  }

  return (
    <div className="fd-cal">
      <div className="fd-cal__grid-wrap">
        <div className="fd-cal__wdays">
          {WEEKDAYS.map((d, i) => (
            <span key={d} className={i % 2 === 0 ? 'is-show' : ''}>{i % 2 === 0 ? d : ''}</span>
          ))}
        </div>
        <div className="fd-cal__scroll">
          <div className="fd-cal__month-row">
            {labels.map((m) => (
              <span
                key={`${m.label}-${m.index}`}
                className="fd-cal__month"
                style={{ left: `${m.index * 15}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div
            className="fd-cal__grid"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, 12px)` }}
          >
            {weeks.map((week, wi) => week.map((day, di) => {
              const key = toKey(day);
              const count = countMap[key] || 0;
              const future = day > today;
              const lvl = future ? 0 : levelFor(count, max);
              const title = future
                ? ''
                : `${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${count} started`;
              return (
                <span
                  key={`${wi}-${di}`}
                  className={`fd-cal__cell fd-cal__cell--l${lvl}${future ? ' is-future' : ''}`}
                  title={title}
                />
              );
            }))}
          </div>
        </div>
      </div>
      <div className="fd-cal__foot">
        <span className="fd-cal__total">{total} work session{total === 1 ? '' : 's'} started in this period</span>
        <div className="fd-cal__legend" aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`fd-cal__cell fd-cal__cell--l${l}`} />)}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

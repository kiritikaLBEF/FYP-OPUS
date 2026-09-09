import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './DashboardTaskBoard.css';

const STAGE_TO_BIDS_FILTER = {
  todo: 'todo',
  progress: 'progress',
  review: 'review',
  done: 'completed',
};

function daysChip(daysLeft) {
  if (daysLeft == null) return null;
  if (daysLeft < 0) return { label: `${Math.abs(daysLeft)}d overdue`, kind: 'urgent' };
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, kind: 'mid' };
  return { label: `${daysLeft}d left`, kind: 'ok' };
}

function summaryLabel(title, count) {
  const n = count;
  const plural = n === 1 ? 'task' : 'tasks';
  if (title === 'To do') return `${n} ${plural} to do`;
  if (title === 'In progress') return `${n} ${plural} in progress`;
  if (title === 'In review') return `${n} ${plural} in review`;
  return `${n} ${plural} completed`;
}

function Column({ title, dot, stageKey, items, empty, onOpenTask }) {
  const [expanded, setExpanded] = useState(false);
  const count = items.length;

  return (
    <div className="dtb-col">
      <div className="dtb-col__head">
        <span>
          <i className={`dtb-dot dtb-dot--${dot}`} />
          {title}
        </span>
        <span className="dtb-col__count">{count}</span>
      </div>
      <div className="dtb-col__body">
        {count === 0 ? (
          <div className="dtb-empty">{empty}</div>
        ) : (
          <div className={`dtb-dropdown${expanded ? ' is-open' : ''}`}>
            <button
              type="button"
              className="dtb-summary"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              <span className="dtb-summary__text">{summaryLabel(title, count)}</span>
              <ChevronDown
                className={`dtb-summary__chev${expanded ? ' is-open' : ''}`}
                size={16}
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </button>
            {expanded && (
              <ul className="dtb-compact-list">
                {items.map((task) => {
                  const chip = daysChip(task.daysLeft);
                  return (
                    <li key={task._id}>
                      <button
                        type="button"
                        className="dtb-compact-row"
                        onClick={() => onOpenTask(STAGE_TO_BIDS_FILTER[stageKey] || 'submitted')}
                      >
                        <span className="dtb-compact-row__title">{task.title}</span>
                        {chip ? (
                          <span className={`dtb-chip dtb-chip--${chip.kind}`}>{chip.label}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardTaskBoard({ columns, loading, onOpenMyBids }) {
  const openTask = (filterId) => {
    if (typeof onOpenMyBids === 'function') onOpenMyBids(filterId);
  };

  if (loading) {
    return (
      <section className="dtb" aria-label="Task board">
        <div className="dtb-loading" role="status" aria-label="Loading task board" />
      </section>
    );
  }

  const cols = columns || { todo: [], progress: [], review: [], done: [] };

  return (
    <section className="dtb" aria-label="Task board">
      <header className="dtb__head">
        <div>
          <h2 className="dtb__title">Task board</h2>
          <p className="dtb__sub">Work from accepted bids, grouped by stage</p>
        </div>
      </header>
      <div className="dtb-rail">
        <Column
          title="To do"
          dot="todo"
          stageKey="todo"
          items={cols.todo || []}
          empty="Nothing waiting to start"
          onOpenTask={openTask}
        />
        <Column
          title="In progress"
          dot="progress"
          stageKey="progress"
          items={cols.progress || []}
          empty="No active drafts"
          onOpenTask={openTask}
        />
        <Column
          title="In review"
          dot="review"
          stageKey="review"
          items={cols.review || []}
          empty="Nothing with the client"
          onOpenTask={openTask}
        />
        <Column
          title="Done"
          dot="done"
          stageKey="done"
          items={cols.done || []}
          empty="Completed work lands here"
          onOpenTask={openTask}
        />
      </div>
    </section>
  );
}

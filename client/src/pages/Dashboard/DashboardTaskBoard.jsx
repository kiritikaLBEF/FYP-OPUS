import { useNavigate } from 'react-router-dom';
import './dashboard-tokens.css';
import './dashboard-glass.css';
import './DashboardTaskBoard.css';

function daysChip(daysLeft) {
  if (daysLeft == null) return null;
  if (daysLeft < 0) return { label: `${Math.abs(daysLeft)}d overdue`, kind: 'urgent' };
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, kind: 'mid' };
  return { label: `${daysLeft}d left`, kind: 'ok' };
}

function Column({ title, dot, items, empty, onOpen }) {
  return (
    <div className="dtb-col">
      <div className="dtb-col__head">
        <span>
          <i className={`dtb-dot dtb-dot--${dot}`} />
          {title}
        </span>
        <span className="dtb-col__count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="dtb-empty">{empty}</div>
      ) : (
        items.map((task) => {
          const chip = daysChip(task.daysLeft);
          return (
            <button
              type="button"
              key={task._id}
              className="dtb-card"
              onClick={() => onOpen(task)}
            >
              {task.organizationName ? <p className="dtb-card__org">{task.organizationName}</p> : null}
              <p className="dtb-card__title">{task.title}</p>
              <div className="dtb-card__foot">
                {chip ? <span className={`dtb-chip dtb-chip--${chip.kind}`}>{chip.label}</span> : <span />}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

export default function DashboardTaskBoard({ columns, loading }) {
  const navigate = useNavigate();
  const open = (task) => {
    if (task.workspaceId) navigate(`/dashboard/workspace/${task.workspaceId}`);
  };

  if (loading) {
    return (
      <section className="glass-surface dtb" aria-label="Task board">
        <div className="dtb-loading" role="status" aria-label="Loading task board" />
      </section>
    );
  }

  const cols = columns || { todo: [], progress: [], review: [], done: [] };

  return (
    <section className="glass-surface dtb" aria-label="Task board">
      <header className="dtb__head">
        <div>
          <h2 className="glass-section-title">Task board</h2>
          <p className="glass-section-sub">Work from accepted bids, grouped by stage</p>
        </div>
      </header>
      <div className="dtb-rail">
        <Column title="To do" dot="todo" items={cols.todo || []} empty="Nothing waiting to start" onOpen={open} />
        <Column title="In progress" dot="progress" items={cols.progress || []} empty="No active drafts" onOpen={open} />
        <Column title="In review" dot="review" items={cols.review || []} empty="Nothing with the client" onOpen={open} />
        <Column title="Done" dot="done" items={cols.done || []} empty="Completed work lands here" onOpen={open} />
      </div>
    </section>
  );
}

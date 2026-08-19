export const fmtNPR = (n) => `NPR ${Number(n || 0).toLocaleString('en-NP', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const fmtDate = (d) => new Date(d).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export const STATUS_LABELS = {
  in_progress: 'In Progress',
  review: 'Under Review',
  awaiting_start: 'Awaiting Start',
  completed: 'Completed',
  on_hold: 'On Hold',
};

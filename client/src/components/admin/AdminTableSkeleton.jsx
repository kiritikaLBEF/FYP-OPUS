export default function AdminTableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="admin-skeleton-wrap" aria-hidden="true">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="admin-skeleton-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <div key={col} className="admin-skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}

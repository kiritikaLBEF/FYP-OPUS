import './DashboardPagination.css';

interface DashboardPaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export default function DashboardPagination({
  page,
  pages,
  onPageChange,
  label = 'Pages',
}: DashboardPaginationProps) {
  if (pages <= 1) return null;

  return (
    <nav className="dash-pager" aria-label={label}>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`dash-pager__btn ${n === page ? 'dash-pager__btn--active' : ''}`}
          onClick={() => onPageChange(n)}
          aria-label={`Page ${n}`}
          aria-current={n === page ? 'page' : undefined}
        >
          {n}
        </button>
      ))}
    </nav>
  );
}

export const HOME_PAGE_SIZE = 4;

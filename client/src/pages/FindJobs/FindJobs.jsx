import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import JobDetailModal from '../../components/jobs/JobDetailModal';
import JobFilters, { EMPTY_JOB_FILTERS, countActiveFilters } from './JobFilters';
import ExploreJobCard from './ExploreJobCard';
import './FindJobs.css';

const SORT_LABELS = {
  newest: 'Newest first',
  budget_high: 'Highest budget',
  budget_low: 'Lowest budget',
  deadline: 'Closing soon',
};

export default function FindJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(EMPTY_JOB_FILTERS);
  const [applied, setApplied] = useState(EMPTY_JOB_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const loadJobs = useCallback(() => {
    setLoading(true);
    setError('');
    api.getPublicJobs({ page, limit: 12, ...applied })
      .then((data) => {
        setJobs(data.jobs || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load jobs');
        setJobs([]);
      })
      .finally(() => setLoading(false));
  }, [page, applied]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const applyFilters = () => {
    setApplied(filters);
    setPage(1);
    setMobileFiltersOpen(false);
  };

  const clearFilters = () => {
    setFilters(EMPTY_JOB_FILTERS);
    setApplied(EMPTY_JOB_FILTERS);
    setPage(1);
    setMobileFiltersOpen(false);
  };

  const activeCount = countActiveFilters(applied);

  const handleApplied = () => {
    if (selected) {
      setSelected((j) => ({ ...j, hasApplied: true }));
    }
    setJobs((prev) => prev.map((j) => (j.id === selected?.id ? { ...j, hasApplied: true } : j)));
  };

  return (
    <div className="find-jobs-page">
      <div className="find-jobs-shell">
        <header className="find-jobs-hero">
          <div className="find-jobs-hero__copy">
            <p className="find-jobs-eyebrow">Opportunities</p>
            <h1>Explore Jobs</h1>
            <p className="find-jobs-sub">
              Discover roles from verified organizations across Nepal: design, development, content, and more.
            </p>
          </div>
          <div className="find-jobs-hero__stat" aria-live="polite">
            <span className="find-jobs-hero__stat-value">{loading ? '-' : total}</span>
            <span className="find-jobs-hero__stat-label">Open roles</span>
          </div>
        </header>

        <div className="find-jobs-layout">
          <JobFilters
            filters={filters}
            onChange={setFilters}
            onApply={applyFilters}
            onClear={clearFilters}
            activeCount={countActiveFilters(filters)}
            mobileOpen={mobileFiltersOpen}
            onMobileClose={() => setMobileFiltersOpen(false)}
          />

          <main className="find-jobs-results">
            <div className="find-jobs-results-bar">
              <div>
                <h2 className="find-jobs-results-bar__title">
                  {loading ? 'Loading…' : `${total} job${total === 1 ? '' : 's'} found`}
                </h2>
                {activeCount > 0 && (
                  <p className="find-jobs-results-bar__hint">{activeCount} filter{activeCount === 1 ? '' : 's'} active</p>
                )}
              </div>
              <div className="find-jobs-results-bar__actions">
                <span className="find-jobs-results-bar__sort">
                  Sorted by {SORT_LABELS[applied.sort] || SORT_LABELS.newest}
                </span>
                <button
                  type="button"
                  className="find-jobs-mobile-filter-btn"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                </button>
              </div>
            </div>

            {error && <p className="find-jobs-error">{error}</p>}

            {loading ? (
              <div className="find-jobs-empty">
                <div className="find-jobs-empty__spinner" aria-hidden="true" />
                <p>Loading opportunities…</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="find-jobs-empty">
                <h2>No jobs match your filters</h2>
                <p>Try adjusting your search, category, or price range, or clear filters to browse all open roles.</p>
                {activeCount > 0 && (
                  <button type="button" className="find-jobs-clear-btn" onClick={clearFilters}>Clear filters</button>
                )}
              </div>
            ) : (
              <>
                <div className="find-jobs-list">
                  {jobs.map((job) => (
                    <ExploreJobCard key={job.id} job={job} onClick={() => setSelected(job)} />
                  ))}
                </div>

                {pages > 1 && (
                  <div className="find-jobs-pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span>Page {page} of {pages}</span>
                    <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {selected && (
        <JobDetailModal job={selected} onClose={() => setSelected(null)} onApplied={handleApplied} />
      )}
    </div>
  );
}

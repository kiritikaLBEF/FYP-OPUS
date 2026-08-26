import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import JobDetailModal from '../../components/jobs/JobDetailModal';
import JobFilters, { EMPTY_JOB_FILTERS, countActiveFilters } from './JobFilters';
import ExploreJobCard, { ExploreJobCardSkeleton } from './ExploreJobCard';
import { JOB_CATEGORIES } from '../../utils/jobUtils';
import './FindJobs.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'budget_high', label: 'Highest pay' },
  { value: 'budget_low', label: 'Lowest pay' },
  { value: 'deadline', label: 'Closing soon' },
];

function filterChips(applied) {
  const chips = [];
  if (applied.search?.trim()) chips.push({ key: 'search', label: applied.search.trim() });
  if (applied.category) {
    chips.push({
      key: 'category',
      label: JOB_CATEGORIES.find((c) => c.value === applied.category)?.label || applied.category,
    });
  }
  if (applied.skill?.trim()) chips.push({ key: 'skill', label: applied.skill.trim() });
  if (applied.location?.trim()) chips.push({ key: 'location', label: applied.location.trim() });
  if (applied.budgetType === 'fixed') chips.push({ key: 'budgetType', label: 'Fixed' });
  if (applied.budgetType === 'hourly') chips.push({ key: 'budgetType', label: 'Hourly' });
  if (applied.minPrice !== '' && applied.minPrice != null) {
    chips.push({ key: 'minPrice', label: `Min ${applied.minPrice}` });
  }
  if (applied.maxPrice !== '' && applied.maxPrice != null) {
    chips.push({ key: 'maxPrice', label: `Max ${applied.maxPrice}` });
  }
  return chips;
}

export default function FindJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(EMPTY_JOB_FILTERS);
  const [query, setQuery] = useState(EMPTY_JOB_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const loadJobs = useCallback(() => {
    setLoading(true);
    setError('');
    api.getPublicJobs({ page, limit: 12, ...query })
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
  }, [page, query]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery((prev) => {
        const same =
          prev.search === filters.search
          && prev.category === filters.category
          && prev.skill === filters.skill
          && prev.location === filters.location
          && prev.budgetType === filters.budgetType
          && prev.minPrice === filters.minPrice
          && prev.maxPrice === filters.maxPrice
          && prev.sort === filters.sort;
        if (same) return prev;
        setPage(1);
        return filters;
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [filters]);

  const clearFilters = () => {
    setFilters(EMPTY_JOB_FILTERS);
    setQuery(EMPTY_JOB_FILTERS);
    setPage(1);
    setMobileFiltersOpen(false);
  };

  const removeChip = (key) => {
    setFilters({ ...filters, [key]: EMPTY_JOB_FILTERS[key] });
  };

  const activeCount = countActiveFilters(query);
  const chips = filterChips(query);

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
          <div>
            <h1>Explore jobs</h1>
            <p className="find-jobs-sub">Browse open roles and apply in one click.</p>
          </div>
          <p className="find-jobs-hero__count" aria-live="polite">
            {loading ? 'Loading' : `${total} open`}
          </p>
        </header>

        <div className="find-jobs-layout">
          <JobFilters
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            activeCount={countActiveFilters(filters)}
            mobileOpen={mobileFiltersOpen}
            onMobileClose={() => setMobileFiltersOpen(false)}
          />

          <main className="find-jobs-results">
            <div className="find-jobs-toolbar">
              <label className="find-jobs-toolbar__search" htmlFor="explore-search">
                <span className="sr-only">Search jobs</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  id="explore-search"
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search jobs"
                />
              </label>
              <select
                className="find-jobs-toolbar__sort"
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                aria-label="Sort jobs"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="find-jobs-mobile-filter-btn"
                onClick={() => setMobileFiltersOpen(true)}
              >
                Filter{activeCount > 0 ? ` (${activeCount})` : ''}
              </button>
            </div>

            {chips.length > 0 && (
              <div className="find-jobs-chips">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="find-jobs-chip"
                    onClick={() => removeChip(chip.key)}
                  >
                    {chip.label}
                    <span aria-hidden="true">x</span>
                  </button>
                ))}
              </div>
            )}

            {error && <p className="find-jobs-error">{error}</p>}

            {loading ? (
              <div className="find-jobs-grid" aria-busy="true" aria-label="Loading jobs">
                {Array.from({ length: 6 }, (_, i) => (
                  <ExploreJobCardSkeleton key={i} />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="find-jobs-empty">
                <h2>No matching jobs</h2>
                <p>Widen the search or reset filters.</p>
                {activeCount > 0 && (
                  <button type="button" className="find-jobs-clear-btn" onClick={clearFilters}>Reset filters</button>
                )}
              </div>
            ) : (
              <>
                <div className="find-jobs-grid">
                  {jobs.map((job) => (
                    <ExploreJobCard key={job.id} job={job} onClick={() => setSelected(job)} />
                  ))}
                </div>

                {pages > 1 && (
                  <div className="find-jobs-pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <span>{page} / {pages}</span>
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

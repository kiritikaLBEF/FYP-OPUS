import { JOB_CATEGORIES } from '../../utils/jobUtils';

export const EMPTY_JOB_FILTERS = {
  search: '',
  category: '',
  skill: '',
  location: '',
  budgetType: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
};

export const countActiveFilters = (filters) => {
  let n = 0;
  if (filters.search?.trim()) n += 1;
  if (filters.category) n += 1;
  if (filters.skill?.trim()) n += 1;
  if (filters.location?.trim()) n += 1;
  if (filters.budgetType) n += 1;
  if (filters.minPrice !== '' && filters.minPrice != null) n += 1;
  if (filters.maxPrice !== '' && filters.maxPrice != null) n += 1;
  return n;
};

export default function JobFilters({
  filters,
  onChange,
  onClear,
  activeCount = 0,
  mobileOpen = false,
  onMobileClose,
}) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <>
      <aside className={`job-filters ${mobileOpen ? 'job-filters--mobile-open' : ''}`}>
        <div className="job-filters__panel">
          <div className="job-filters__head">
            <h2>Filter</h2>
            {activeCount > 0 ? (
              <button type="button" className="job-filters__clear" onClick={onClear}>
                Reset
              </button>
            ) : (
              <span className="job-filters__head-spacer" aria-hidden="true" />
            )}
          </div>

          <label className="job-filters__group">
            <span className="job-filters__label">Category</span>
            <select value={filters.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">All</option>
              {JOB_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className="job-filters__group">
            <span className="job-filters__label">Skill</span>
            <input
              type="text"
              value={filters.skill}
              onChange={(e) => set('skill', e.target.value)}
              placeholder="React, Figma"
            />
          </label>

          <label className="job-filters__group">
            <span className="job-filters__label">Location</span>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Remote, Kathmandu"
            />
          </label>

          <div className="job-filters__group">
            <span className="job-filters__label">Pay type</span>
            <div className="job-filters__segment" role="group" aria-label="Pay type">
              {[
                { value: '', label: 'Any' },
                { value: 'fixed', label: 'Fixed' },
                { value: 'hourly', label: 'Hourly' },
              ].map((opt) => (
                <button
                  key={opt.value || 'any'}
                  type="button"
                  className={filters.budgetType === opt.value ? 'is-on' : ''}
                  onClick={() => set('budgetType', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="job-filters__group">
            <span className="job-filters__label">Budget (NPR)</span>
            <div className="job-filters__range">
              <input
                type="number"
                min="0"
                value={filters.minPrice}
                onChange={(e) => set('minPrice', e.target.value)}
                placeholder="Min"
                aria-label="Minimum budget"
              />
              <input
                type="number"
                min="0"
                value={filters.maxPrice}
                onChange={(e) => set('maxPrice', e.target.value)}
                placeholder="Max"
                aria-label="Maximum budget"
              />
            </div>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          type="button"
          className="job-filters__mobile-backdrop"
          onClick={onMobileClose}
          aria-label="Close filters"
        />
      )}
    </>
  );
}

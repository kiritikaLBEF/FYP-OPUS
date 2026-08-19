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
  if (filters.sort && filters.sort !== 'newest') n += 1;
  return n;
};

export default function JobFilters({
  filters,
  onChange,
  onApply,
  onClear,
  activeCount = 0,
  mobileOpen = false,
  onMobileClose,
}) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  const panel = (
    <div className="job-filters__panel">
      <div className="job-filters__head">
        <h2>Filters</h2>
        {activeCount > 0 && (
          <button type="button" className="job-filters__clear" onClick={onClear}>
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <div className="job-filters__group">
        <label className="job-filters__label" htmlFor="jf-search">Search</label>
        <input
          id="jf-search"
          type="search"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Title, organization, keywords…"
        />
      </div>

      <div className="job-filters__group">
        <label className="job-filters__label" htmlFor="jf-category">Category</label>
        <select id="jf-category" value={filters.category} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="job-filters__group">
        <label className="job-filters__label" htmlFor="jf-skill">Skills</label>
        <input
          id="jf-skill"
          type="text"
          value={filters.skill}
          onChange={(e) => set('skill', e.target.value)}
          placeholder="e.g. React, Figma, Photoshop"
        />
      </div>

      <div className="job-filters__group">
        <label className="job-filters__label" htmlFor="jf-location">Location</label>
        <input
          id="jf-location"
          type="text"
          value={filters.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="e.g. Remote, Kathmandu"
        />
      </div>

      <div className="job-filters__group">
        <span className="job-filters__label">Budget type</span>
        <div className="job-filters__chips">
          {[
            { value: '', label: 'Any' },
            { value: 'fixed', label: 'Fixed' },
            { value: 'hourly', label: 'Hourly' },
          ].map((opt) => (
            <button
              key={opt.value || 'any'}
              type="button"
              className={`job-filters__chip ${filters.budgetType === opt.value ? 'job-filters__chip--active' : ''}`}
              onClick={() => set('budgetType', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="job-filters__group">
        <span className="job-filters__label">Price range (NPR)</span>
        <div className="job-filters__range">
          <input
            type="number"
            min="0"
            value={filters.minPrice}
            onChange={(e) => set('minPrice', e.target.value)}
            placeholder="Min"
            aria-label="Minimum price"
          />
          <span>to</span>
          <input
            type="number"
            min="0"
            value={filters.maxPrice}
            onChange={(e) => set('maxPrice', e.target.value)}
            placeholder="Max"
            aria-label="Maximum price"
          />
        </div>
      </div>

      <div className="job-filters__group">
        <label className="job-filters__label" htmlFor="jf-sort">Sort by</label>
        <select id="jf-sort" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="budget_high">Highest budget</option>
          <option value="budget_low">Lowest budget</option>
          <option value="deadline">Closing soon</option>
        </select>
      </div>

      <button
        type="button"
        className="job-filters__apply"
        onClick={onApply}
        onKeyDown={(e) => { if (e.key === 'Enter') onApply(); }}
      >
        Apply filters
      </button>
    </div>
  );

  return (
    <>
      <aside className={`job-filters ${mobileOpen ? 'job-filters--mobile-open' : ''}`}>
        {panel}
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

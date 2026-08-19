import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAdmin } from '../../context/AdminContext';
import { AdminUserLink } from '../../components/admin/AdminQuickActions';
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton';
import { formatDate } from './adminHelpers';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';

export default function AdminJobPosts() {
  const { openViewJob, openDeleteJob } = useAdmin();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminJobs({ page, search, status });
      setJobs(data.jobs || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load job posts');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (page === 1) loadJobs();
    else setPage(1);
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Job Posts</h1>
          <p className="admin-page-subtitle">
            {loading ? 'Loading…' : `${total} post${total === 1 ? '' : 's'} on platform`}
          </p>
        </div>
      </header>

      <div className="admin-toolbar">
        <form className="admin-toolbar__form" onSubmit={handleSearch}>
          <input
            className="admin-input admin-input--search"
            placeholder="Search title, organization, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="admin-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="filled">Filled</option>
          <option value="draft">Draft</option>
          </select>
          <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
        </form>
      </div>
      {error && <p className="admin-error" style={{ marginTop: -8, marginBottom: 16 }}>{error}</p>}

      <div className="admin-panel">
        <div className="admin-panel__head">All job posts</div>
        <div className="admin-panel__body admin-table-wrap">
          {loading ? (
            <AdminTableSkeleton cols={5} />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Employer</th>
                  <th>Status</th>
                  <th>Posted</th>
                  <th className="admin-table__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={5} className="admin-muted admin-table__empty">No job posts found.</td></tr>
                ) : (
                  jobs.map((j) => (
                    <tr key={j.id}>
                      <td><strong>{j.title}</strong></td>
                      <td>
                        <AdminUserLink user={{ id: j.employerId, firstName: j.employerName, email: j.employerEmail }} />
                      </td>
                      <td>
                        <span className={`admin-badge ${j.isRemoved ? 'admin-badge--suspended' : j.publishStatus === 'draft' ? 'admin-badge--pending' : 'admin-badge--active'}`}>
                          {j.isRemoved ? 'removed' : j.publishStatus === 'draft' ? 'draft' : j.status}
                        </span>
                      </td>
                      <td>{formatDate(j.postedAt)}</td>
                      <td className="admin-table__actions-col">
                        <div className="admin-quick-actions admin-quick-actions--compact">
                          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openViewJob(j)}>View</button>
                          {!j.isRemoved && (
                            <button type="button" className="admin-btn admin-btn--danger" onClick={() => openDeleteJob(j, loadJobs)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        {!loading && pages > 1 && (
          <div className="admin-panel__footer admin-pagination">
            <button type="button" className="admin-btn admin-btn--secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="admin-muted">Page {page} of {pages}</span>
            <button type="button" className="admin-btn admin-btn--secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}

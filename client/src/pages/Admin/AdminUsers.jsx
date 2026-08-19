import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import AdminQuickActions, { AdminUserLink } from '../../components/admin/AdminQuickActions';
import AdminTableSkeleton from '../../components/admin/AdminTableSkeleton';
import { formatDate, statusBadge } from './adminHelpers';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';

const ACCOUNT_TYPES = [
  { id: 'freelancer', label: 'Freelancers' },
  { id: 'employer', label: 'Employers' },
];

const FREELANCER_SEGMENTS = [
  { id: 'users-active', label: 'Active freelancers' },
  { id: 'users-suspended', label: 'Suspended freelancers' },
];

const EMPLOYER_SEGMENTS = [
  { id: 'employers-active', label: 'Verified employers' },
  { id: 'employers-suspended', label: 'Suspended employers' },
  { id: 'employers-pending', label: 'Pending verification' },
];

export default function AdminUsers() {
  const [accountType, setAccountType] = useState('freelancer');
  const [segment, setSegment] = useState('users-active');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchByTab, setSearchByTab] = useState({});
  const [pageByTab, setPageByTab] = useState({});
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [tabAnim, setTabAnim] = useState('in');

  const segments = accountType === 'freelancer' ? FREELANCER_SEGMENTS : EMPLOYER_SEGMENTS;
  const page = pageByTab[segment] || 1;
  const search = searchByTab[segment] || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminUsersSegment({ segment, page, search });
      setUsers(data.users || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load accounts');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [segment, page, search]);

  useEffect(() => { load(); }, [load]);

  const switchAccountType = (type) => {
    if (type === accountType) return;
    const nextSegment = type === 'freelancer' ? 'users-active' : 'employers-pending';
    setAccountType(type);
    setSegment(nextSegment);
    setTabAnim('in');
  };

  const switchTab = (id) => {
    if (id === segment) return;
    setTabAnim('out');
    window.setTimeout(() => {
      setSegment(id);
      setTabAnim('in');
    }, 120);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setPageByTab((prev) => ({ ...prev, [segment]: 1 }));
    load();
  };

  const current = segments.find((s) => s.id === segment);
  const isFreelancer = accountType === 'freelancer';
  const isEmployer = accountType === 'employer';

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users & Employers</h1>
          <p className="admin-page-subtitle">
            {loading ? 'Loading…' : `${total} ${isFreelancer ? 'freelancer' : 'employer'}${total === 1 ? '' : 's'} in this view`}
          </p>
        </div>
      </header>

      <nav className="admin-account-type-tabs" role="tablist" aria-label="Account type">
        {ACCOUNT_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={accountType === t.id}
            className={`admin-account-type-tab ${accountType === t.id ? 'admin-account-type-tab--active' : ''}`}
            onClick={() => switchAccountType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <nav className="admin-segment-tabs" role="tablist" aria-label="List filter">
        {segments.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={segment === s.id}
            className={`admin-segment-tab ${segment === s.id ? 'admin-segment-tab--active' : ''}`}
            onClick={() => switchTab(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="admin-toolbar admin-search-bar">
        <form className="admin-form-row admin-toolbar__form" onSubmit={submitSearch}>
          <input
            className="admin-input admin-input--search"
            placeholder={isFreelancer ? 'Search freelancers by name, email, or ID…' : 'Search employers by name, email, org, or ID…'}
            value={search}
            onChange={(e) => setSearchByTab((prev) => ({ ...prev, [segment]: e.target.value }))}
          />
          <button type="submit" className="admin-btn admin-btn--secondary">Search</button>
        </form>
        {error && <p className="admin-error" style={{ width: '100%', margin: 0 }}>{error}</p>}
      </div>

      <div className={`admin-panel admin-tab-panel admin-tab-panel--${tabAnim}`}>
        <div className="admin-panel__head">
          {isFreelancer ? 'Freelancer accounts' : 'Employer accounts'} · {current?.label}
        </div>
        <div className="admin-panel__body admin-table-wrap">
          {loading ? (
            <AdminTableSkeleton cols={7} />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Account</th>
                  {isFreelancer && <th>Completed gigs</th>}
                  {isFreelancer && <th>Active gigs</th>}
                  {isEmployer && <th>Verification</th>}
                  {isEmployer && <th>Job posts</th>}
                  <th>Flags</th>
                  <th>Joined</th>
                  <th className="admin-table__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="admin-muted admin-table__empty">No accounts in this view.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className={u.accountStatus === 'suspended' ? 'admin-row--suspended' : ''}>
                      <td>
                        <AdminUserLink user={u} />
                        <div className="admin-muted">{u.email}</div>
                        {u.organizationName && <div className="admin-muted">{u.organizationName}</div>}
                      </td>
                      {isFreelancer && <td className="admin-table__num">{u.completedGigs ?? 0}</td>}
                      {isFreelancer && <td className="admin-table__num">{u.activeGigs ?? 0}</td>}
                      {isEmployer && (
                        <td>
                          <span className={`admin-badge ${statusBadge(u.verificationStatus === 'verified' ? 'active' : 'pending')}`}>
                            {u.verificationStatus}
                          </span>
                        </td>
                      )}
                      {isEmployer && <td className="admin-table__num">{u.jobsPosted ?? 0}</td>}
                      <td className="admin-table__num">{u.flagCount || 0}</td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td className="admin-table__actions-col">
                        <AdminQuickActions
                          user={u}
                          compact
                          variant={segment === 'employers-pending' ? 'employer-pending' : isFreelancer ? 'user' : 'full'}
                          onActionComplete={load}
                        />
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
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              disabled={page <= 1}
              onClick={() => setPageByTab((prev) => ({ ...prev, [segment]: page - 1 }))}
            >
              Previous
            </button>
            <span className="admin-muted">Page {page} of {pages}</span>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              disabled={page >= pages}
              onClick={() => setPageByTab((prev) => ({ ...prev, [segment]: page + 1 }))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronDown, Check, Eye, Search, X } from 'lucide-react';
import { api, getProfileUrl } from '../../services/api';
import { categoryLabel } from '../../utils/jobUtils';
import EmployerLockedGate from './EmployerLockedGate';
import FreelancerProfileModal from '../../components/jobs/FreelancerProfileModal';
import OpusBadge from '../../components/badges/OpusBadge';
import '../../components/Layout/EmployerLayout.css';
import '../../components/jobs/FreelancerProfileModal.css';
import '../../components/badges/OpusBadge.css';
import './EmployerCheckStatus.css';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n) => `रू ${Number(n || 0).toLocaleString('en-IN')}`;

const timeAgo = (date) => {
  if (!date) return '';
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(date);
};

const CATEGORY_ICONS = {
  coding: '</>',
  ui_ux: 'Ui',
  graphic_design: 'Gd',
  content_writing: 'Wr',
  marketing: 'Mk',
  data_entry: 'Ad',
  video_editing: 'Vi',
  consulting: 'Co',
};

const SECTIONS = [
  { key: 'pending', label: 'Pending Bids' },
  { key: 'in_progress', label: 'Work In Progress' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All Statuses' },
  { key: 'has_bids', label: 'Has Bids' },
  { key: 'no_bids', label: 'No Bids Yet' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

function BidActionButtons({ app, actionLoading, onViewProfile, onAccept, onReject, variant = 'default' }) {
  const loadingAccept = actionLoading === app.id + 'accept';
  const loadingReject = actionLoading === app.id + 'reject';
  const isPending = app.status === 'pending';
  const isRow = variant === 'row';

  return (
    <div className={`ecs-bid-actions${isRow ? ' ecs-bid-actions--row' : ''}`}>
      <button
        type="button"
        className="ecs-bid-actions__btn ecs-bid-actions__btn--ghost"
        title="View profile"
        onClick={() => onViewProfile(app.freelancer?.id)}
      >
        <Eye size={14} />
        {!isRow && 'View Profile'}
      </button>
      {isPending ? (
        <>
          <button
            type="button"
            className="ecs-bid-actions__btn ecs-bid-actions__btn--primary"
            title="Select freelancer"
            disabled={!!actionLoading}
            onClick={() => onAccept(app.id)}
          >
            <Check size={14} />
            {loadingAccept ? '…' : 'Select'}
          </button>
          <button
            type="button"
            className="ecs-bid-actions__btn ecs-bid-actions__btn--reject"
            title="Reject bid"
            disabled={!!actionLoading}
            onClick={() => onReject(app.id)}
          >
            <X size={14} />
            {loadingReject ? '…' : 'Reject'}
          </button>
        </>
      ) : (
        <span className={`ecs-bid-status ecs-bid-status--${app.status}`}>{app.status}</span>
      )}
    </div>
  );
}

function FreelancerBidRow({ app, actionLoading, onViewProfile, onAccept, onReject }) {
  const f = app.freelancer;
  if (!f) return null;
  const avatar = f.profilePicture ? getProfileUrl(f.profilePicture) : '';
  const name = `${f.firstName || ''} ${f.lastName || ''}`.trim() || 'Freelancer';
  const badges = f.badges || [];
  const primaryBadge = badges[0];

  return (
    <article className="ecs-bid-item">
      <div className="ecs-bid-item__lead">
        <div className="ecs-bid-item__avatar">
          {avatar ? <img src={avatar} alt="" /> : <span>{f.firstName?.[0]}{f.lastName?.[0]}</span>}
        </div>
        <div className="ecs-bid-item__meta">
          <strong title={name}>{name}</strong>
          <span>{f.tasksCompleted ?? 0} tasks completed</span>
        </div>
      </div>

      <div className="ecs-bid-item__badge">
        {primaryBadge ? (
          <>
            <OpusBadge badge={primaryBadge} size="sm" />
            <span className="ecs-bid-item__badge-label" title={primaryBadge.description || primaryBadge.label}>
              {primaryBadge.label}
            </span>
            {badges.length > 1 && <em className="ecs-bid-item__badge-more">+{badges.length - 1}</em>}
          </>
        ) : (
          <span className="ecs-bid-item__badge-empty">No badge</span>
        )}
      </div>

      <div className="ecs-bid-item__quote">
        <strong>{app.amount ? fmtMoney(app.amount) : '—'}</strong>
        <time dateTime={app.appliedAt} title={fmtDate(app.appliedAt)}>{timeAgo(app.appliedAt)}</time>
      </div>

      <BidActionButtons
        app={app}
        actionLoading={actionLoading}
        onViewProfile={onViewProfile}
        onAccept={onAccept}
        onReject={onReject}
        variant="row"
      />
    </article>
  );
}

function BidTable({ apps, actionLoading, onViewProfile, onAccept, onReject }) {
  if (!apps?.length) return null;
  return (
    <div className="ecs-bid-stack">
      {apps.map((app) => (
        <FreelancerBidRow
          key={app.id}
          app={app}
          actionLoading={actionLoading}
          onViewProfile={onViewProfile}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </div>
  );
}

function AssignedWorkerRow({ freelancer, actionCount, onCheckStatus, preview = false, completed = false }) {
  if (!freelancer) return null;
  const avatar = freelancer.profilePicture ? getProfileUrl(freelancer.profilePicture) : '';
  const name = `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() || 'Freelancer';

  return (
    <div className={`ecs-assigned${preview ? ' ecs-assigned--preview' : ''}`}>
      <div className="ecs-assigned__profile">
        <div className="ecs-assigned__avatar">
          {avatar ? <img src={avatar} alt="" /> : <span>{name.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div>
          <strong>{name}</strong>
          <p>{freelancer.headline || freelancer.freelancerId || 'Assigned freelancer'}</p>
        </div>
      </div>
      {!preview && (
        completed ? (
          <span className="emp-completed-badge">Completed</span>
        ) : (
          <button type="button" className="ecs-check-status-btn" onClick={onCheckStatus}>
            Check Status
            {actionCount > 0 && <span className="ecs-check-status-btn__badge">{actionCount > 9 ? '9+' : actionCount}</span>}
          </button>
        )
      )}
    </div>
  );
}

function JobCard({
  item,
  section,
  expanded,
  onToggle,
  appsLoading,
  jobMeta,
  applications,
  roles,
  squads,
  reviewMode,
  setReviewMode,
  actionLoading,
  onViewProfile,
  onAccept,
  onReject,
  onSquadReview,
  navigate,
}) {
  const bidCount = item.bidCount || 0;
  const isPending = section === 'pending';
  const pendingApps = applications.filter((a) => a.status === 'pending');

  const statusPill = () => {
    if (item.phase === 'completed') return { label: 'Completed', tone: 'completed' };
    if (!isPending) return { label: 'In Progress', tone: 'progress' };
    if (bidCount > 0) return { label: `${bidCount} Bid${bidCount === 1 ? '' : 's'} Received`, tone: 'bids' };
    return { label: 'No bids yet', tone: 'empty' };
  };

  const pill = statusPill();
  const catIcon = CATEGORY_ICONS[item.category] || 'Jb';

  return (
    <article className={`ecs-job-card ${expanded ? 'is-expanded' : ''}`}>
      <button type="button" className="ecs-job-card__header" onClick={onToggle}>
        <div className="ecs-job-card__icon" aria-hidden="true">{catIcon}</div>
        <div className="ecs-job-card__info">
          <div className="ecs-job-card__title-row">
            <h3>{item.title}</h3>
            {item.isMulti && <span className="ecs-job-card__multi">Multi</span>}
            <span className="ecs-job-card__category">{categoryLabel(item.category)}</span>
          </div>
          <div className="ecs-job-card__meta">
            <span>Posted {fmtDate(item.postedAt)}</span>
            <span>{item.location || 'Remote'}</span>
            <span>{item.budgetDisplay}</span>
          </div>
          {item.description && <p className="ecs-job-card__desc">{item.description}</p>}
        </div>

        {!isPending && item.assignedFreelancer && (
          <div className="ecs-job-card__assigned-preview" onClick={(e) => e.stopPropagation()} role="presentation">
            <AssignedWorkerRow freelancer={item.assignedFreelancer} preview />
          </div>
        )}

        <div className="ecs-job-card__status">
          <span className={`ecs-status-pill ecs-status-pill--${pill.tone}`}>{pill.label}</span>
          <ChevronDown size={18} className={`ecs-job-card__chevron ${expanded ? 'is-open' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="ecs-job-card__body">
          {isPending ? (
            <>
              <div className="ecs-bids-head">
                <span className="ecs-bids-head__label">
                  {pendingApps.length || bidCount} {(pendingApps.length || bidCount) === 1 ? 'applicant' : 'applicants'}
                </span>
              </div>

              {appsLoading ? (
                <p className="ecs-muted">Loading bids…</p>
              ) : jobMeta?.projectMode === 'multi' ? (
                <>
                  <div className="ecs-multi-progress">
                    Roles filled: {jobMeta.rolesFilled || 0} of {jobMeta.rolesTotal || 0}
                  </div>
                  <div className="emp-review-tabs">
                    <button type="button" className={reviewMode === 'role' ? 'is-active' : ''} onClick={() => setReviewMode('role')}>Role-based bidding</button>
                    <button type="button" className={reviewMode === 'squad' ? 'is-active' : ''} onClick={() => setReviewMode('squad')}>Squad bidding</button>
                  </div>
                  {reviewMode === 'role' ? (
                    roles.map((role) => (
                      <div key={role.roleKey} className="ecs-role-block">
                        <div className="ecs-role-block__head">
                          <strong>{role.name}</strong>
                          <span>{role.bidCount || 0} bids · {fmtMoney(role.budgetAmount)}</span>
                        </div>
                        {(role.applications || []).filter((a) => a.status === 'pending').length === 0 ? (
                          <p className="ecs-muted">No bids yet for this role.</p>
                        ) : (
                          <BidTable
                            apps={(role.applications || []).filter((a) => a.status === 'pending')}
                            actionLoading={actionLoading}
                            onViewProfile={onViewProfile}
                            onAccept={onAccept}
                            onReject={onReject}
                          />
                        )}
                      </div>
                    ))
                  ) : squads.length === 0 ? (
                    <p className="ecs-muted">No submitted squad bids yet.</p>
                  ) : (
                    squads.map((sq) => (
                      <div key={sq.id} className="emp-squad-card">
                        <div className="emp-squad-card__top">
                          <div>
                            <strong>{sq.name}</strong>
                            <p>{(sq.members || []).length} members</p>
                          </div>
                          <div className="emp-squad-card__price">
                            <em>{fmtMoney(sq.combinedAmount)}</em>
                            <span>{sq.status}</span>
                          </div>
                        </div>
                        {sq.status === 'submitted' && (
                          <div className="emp-squad-card__actions">
                            <button type="button" className="emp-btn emp-btn--primary" disabled={!!actionLoading} onClick={() => onSquadReview(sq.id, 'accept')}>Accept squad</button>
                            <button type="button" className="emp-btn emp-btn--danger" disabled={!!actionLoading} onClick={() => onSquadReview(sq.id, 'reject')}>Reject</button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </>
              ) : pendingApps.length === 0 ? (
                <p className="ecs-muted">No bids yet for this job.</p>
              ) : (
                <BidTable
                  apps={pendingApps}
                  actionLoading={actionLoading}
                  onViewProfile={onViewProfile}
                  onAccept={onAccept}
                  onReject={onReject}
                />
              )}
            </>
          ) : (
            <>
              {item.assignedFreelancer ? (
                <AssignedWorkerRow
                  freelancer={item.assignedFreelancer}
                  actionCount={item.actionRequiredCount || 0}
                  completed={item.workspaceStatus === 'certified'}
                  onCheckStatus={() => item.workspaceId && navigate(`/employer/workspace/${item.workspaceId}`)}
                />
              ) : (
                <p className="ecs-muted">Freelancer assignment pending.</p>
              )}
              {item.workspaceStatus && item.workspaceStatus !== 'certified' && (
                <p className="ecs-muted">Workspace status: {String(item.workspaceStatus).replace(/_/g, ' ')}</p>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default function EmployerCheckStatus() {
  const navigate = useNavigate();
  const { refreshStatusCount } = useOutletContext() || {};
  const [section, setSection] = useState('pending');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ pendingBidTotal: 0, progressActionTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [jobMeta, setJobMeta] = useState(null);
  const [applications, setApplications] = useState([]);
  const [roles, setRoles] = useState([]);
  const [squads, setSquads] = useState([]);
  const [reviewMode, setReviewMode] = useState('role');
  const [appsLoading, setAppsLoading] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadStatus = useCallback(() => {
    setLoading(true);
    api.getEmployerJobStatus()
      .then((data) => {
        setItems(data.items || []);
        setSummary(data.summary || { pendingBidTotal: 0, progressActionTotal: 0 });
      })
      .catch(() => {
        setItems([]);
        setSummary({ pendingBidTotal: 0, progressActionTotal: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
    refreshStatusCount?.();
  }, [loadStatus, refreshStatusCount]);

  const pendingItems = items.filter((item) => item.phase === 'pending' || item.publishStatus === 'draft');
  const progressItems = items.filter((item) => item.phase === 'in_progress' || item.phase === 'completed');

  const visibleItems = useMemo(() => {
    const base = section === 'pending' ? pendingItems : progressItems;
    return base.filter((item) => {
      const q = search.trim().toLowerCase();
      if (q && !item.title?.toLowerCase().includes(q)) return false;
      if (statusFilter === 'has_bids') return (item.bidCount || 0) > 0;
      if (statusFilter === 'no_bids') return (item.bidCount || 0) === 0 && item.phase === 'pending';
      if (statusFilter === 'in_progress') return item.phase === 'in_progress';
      if (statusFilter === 'completed') return item.phase === 'completed';
      return true;
    });
  }, [section, pendingItems, progressItems, search, statusFilter]);

  const toggleJob = async (jobId) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    setAppsLoading(true);
    try {
      const data = await api.getEmployerJobApplications(jobId);
      setJobMeta(data.job || null);
      setApplications(data.applications || []);
      setRoles(data.job?.roles || []);
      setSquads(data.squads || []);
      setReviewMode(data.job?.projectMode === 'multi' ? 'role' : 'single');
    } catch {
      setApplications([]);
      setRoles([]);
      setSquads([]);
      setJobMeta(null);
    } finally {
      setAppsLoading(false);
    }
  };

  const refreshExpanded = async () => {
    if (!expandedJobId) return;
    const data = await api.getEmployerJobApplications(expandedJobId);
    setJobMeta(data.job || null);
    setApplications(data.applications || []);
    setRoles(data.job?.roles || []);
    setSquads(data.squads || []);
  };

  const handleReview = async (applicationId, action) => {
    setActionLoading(applicationId + action);
    try {
      if (action === 'accept') await api.acceptEmployerApplication(applicationId);
      else await api.rejectEmployerApplication(applicationId);
      await refreshExpanded();
      loadStatus();
      refreshStatusCount?.();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleSquadReview = async (squadId, action) => {
    setActionLoading(squadId + action);
    try {
      if (action === 'accept') await api.acceptSquadBid(squadId);
      else await api.rejectSquadBid(squadId);
      await refreshExpanded();
      loadStatus();
      refreshStatusCount?.();
    } catch (err) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeleteJob = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteEmployerJob(deleteTarget.id);
      if (expandedJobId === deleteTarget.id) setExpandedJobId(null);
      setDeleteTarget(null);
      loadStatus();
      refreshStatusCount?.();
    } catch (err) {
      alert(err.message || 'Failed to delete job');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <header className="emp-page-header ecs-page-header">
        <div>
          <h1>Check Status</h1>
          <p>View the status of your posted jobs and track freelancer bids and progress</p>
        </div>
      </header>

      <EmployerLockedGate feature="Check Status">
        <div className="ecs-toolbar">
          <div className="ecs-section-tabs" role="tablist" aria-label="Job status sections">
            {SECTIONS.map((tab) => {
              const count = tab.key === 'pending' ? pendingItems.length : progressItems.length;
              const notify = tab.key === 'pending'
                ? summary.pendingBidTotal
                : summary.progressActionTotal;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={section === tab.key}
                  className={`ecs-section-tab ${section === tab.key ? 'is-active' : ''}`}
                  onClick={() => {
                    setSection(tab.key);
                    setExpandedJobId(null);
                    setStatusFilter('all');
                  }}
                >
                  {tab.label}
                  {count > 0 && <span className="ecs-section-tab__count">{count}</span>}
                  {notify > 0 && <span className="ecs-section-tab__notify">{notify > 9 ? '9+' : notify}</span>}
                </button>
              );
            })}
          </div>

          <div className="ecs-toolbar__filters">
            <label className="ecs-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by job title…"
              />
            </label>
            <select className="ecs-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ecs-list">
          {loading ? (
            <div className="emp-empty">Loading status…</div>
          ) : visibleItems.length === 0 ? (
            <div className="emp-empty">
              {section === 'pending'
                ? 'No pending jobs match your filters.'
                : 'No work in progress jobs match your filters.'}
            </div>
          ) : (
            visibleItems.map((item) => (
              <JobCard
                key={item.id}
                item={item}
                section={section}
                expanded={expandedJobId === item.id}
                onToggle={() => toggleJob(item.id)}
                appsLoading={appsLoading && expandedJobId === item.id}
                jobMeta={expandedJobId === item.id ? jobMeta : null}
                applications={expandedJobId === item.id ? applications : []}
                roles={expandedJobId === item.id ? roles : []}
                squads={expandedJobId === item.id ? squads : []}
                reviewMode={reviewMode}
                setReviewMode={setReviewMode}
                actionLoading={actionLoading}
                onViewProfile={setProfileId}
                onAccept={(id) => handleReview(id, 'accept')}
                onReject={(id) => handleReview(id, 'reject')}
                onSquadReview={handleSquadReview}
                navigate={navigate}
              />
            ))
          )}
        </div>
      </EmployerLockedGate>

      {profileId && (
        <FreelancerProfileModal freelancerId={profileId} onClose={() => setProfileId(null)} variant="full" />
      )}

      {deleteTarget && (
        <div className="emp-delete-modal" role="dialog" aria-modal="true">
          <button type="button" className="emp-delete-modal__backdrop" aria-label="Close" onClick={() => !deleteLoading && setDeleteTarget(null)} />
          <div className="emp-delete-modal__panel">
            <h3>Delete job post?</h3>
            <p>This will permanently remove “{deleteTarget.title}” from your listings.</p>
            <div className="emp-delete-modal__actions">
              <button type="button" className="emp-btn emp-btn--ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancel</button>
              <button type="button" className="emp-btn emp-btn--danger" onClick={handleDeleteJob} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

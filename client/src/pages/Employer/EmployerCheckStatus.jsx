import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getProfileUrl } from '../../services/api';
import EmployerLockedGate from './EmployerLockedGate';
import FreelancerProfileModal from '../../components/jobs/FreelancerProfileModal';
import '../../components/Layout/EmployerLayout.css';
import '../../components/jobs/FreelancerProfileModal.css';
import './EmployerCheckStatus.css';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n) => `रू ${Number(n || 0).toLocaleString('en-IN')}`;

function BidBell({ count, active, onClick }) {
  const label = count > 9 ? '9+' : String(count);
  return (
    <button type="button" className={`bid-bell ${active ? 'bid-bell--active' : ''}`} onClick={onClick} aria-label={`${count} applications`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a5 5 0 00-5 5v2.5l-1.5 2.5h13L17 10.5V8a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 18a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {count > 0 && <span className="bid-bell__badge">{label}</span>}
    </button>
  );
}

export default function EmployerCheckStatus() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
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

  const loadStatus = useCallback(() => {
    setLoading(true);
    api.getEmployerJobStatus()
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const loadApplications = async (jobId) => {
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
      if (expandedJobId === deleteTarget.id) {
        setExpandedJobId(null);
        setApplications([]);
      }
      setDeleteTarget(null);
      loadStatus();
    } catch (err) {
      alert(err.message || 'Failed to delete job');
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderApplicantRow = (app) => {
    const f = app.freelancer;
    const avatar = f?.profilePicture ? getProfileUrl(f.profilePicture) : '';
    return (
      <li key={app.id} className="emp-applicant">
        <div className="emp-applicant__info">
          <div className="emp-applicant__avatar">
            {avatar ? <img src={avatar} alt="" /> : <span>{f?.firstName?.[0]}{f?.lastName?.[0]}</span>}
          </div>
          <div>
            <strong>{f ? `${f.firstName} ${f.lastName}` : 'Freelancer'}</strong>
            <p>
              {f?.freelancerId} · Applied {fmtDate(app.appliedAt)}
              {app.amount ? ` · ${fmtMoney(app.amount)}` : ''}
              {app.roleName ? ` · ${app.roleName}` : ''}
            </p>
            {app.message && <p className="emp-muted">{app.message}</p>}
            {f?.skills?.length > 0 && (
              <div className="emp-applicant__skills">
                {f.skills.slice(0, 4).map((s) => <span key={s}>{s}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="emp-applicant__actions">
          <button type="button" className="emp-btn emp-btn--ghost" onClick={() => setProfileId(f?.id)}>View profile</button>
          {app.status === 'pending' ? (
            <>
              <button type="button" className="emp-btn emp-btn--primary" disabled={!!actionLoading} onClick={() => handleReview(app.id, 'accept')}>
                {actionLoading === app.id + 'accept' ? '…' : 'Select'}
              </button>
              <button type="button" className="emp-btn emp-btn--danger" disabled={!!actionLoading} onClick={() => handleReview(app.id, 'reject')}>
                {actionLoading === app.id + 'reject' ? '…' : 'Reject'}
              </button>
            </>
          ) : (
            <>
              <span className={`emp-applicant__status emp-applicant__status--${app.status}`}>{app.status}</span>
              {app.status === 'accepted' && app.workspaceId && (
                app.workspaceStatus === 'certified' ? (
                  <span className="emp-completed-badge">Completed</span>
                ) : (
                  <button
                    type="button"
                    className="emp-btn emp-btn--primary"
                    onClick={() => navigate(`/employer/workspace/${app.workspaceId}`)}
                  >
                    View progress
                  </button>
                )
              )}
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <header className="emp-page-header">
        <h1>Check Status</h1>
        <p>Track your listings, review applications, and follow assigned work progress</p>
      </header>

      <EmployerLockedGate feature="Check Status">
        <div className="emp-card emp-status-card">
          {loading ? (
            <div className="emp-empty">Loading status…</div>
          ) : items.length === 0 ? (
            <div className="emp-empty">No jobs posted yet. Publish your first role to track applications here.</div>
          ) : (
            <div className="emp-status-list">
              {items.map((item) => (
                <div key={item.id} className="emp-status-row-wrap">
                  <div className="emp-status-row">
                    <div className="emp-status-row__main">
                      <h3>
                        {item.title}
                        {item.isMulti && <span className="emp-multi-badge">Multi</span>}
                      </h3>
                      <p>{item.stage} · {item.budgetDisplay || item.budget} · Posted {fmtDate(item.postedAt)}</p>
                      {item.workspaceStatus && (
                        <p className="emp-status-row__progress">
                          Assigned freelancer · workspace: {String(item.workspaceStatus).replace(/_/g, ' ')}
                        </p>
                      )}
                    </div>
                    <div className="emp-status-row__actions">
                      <BidBell
                        count={item.applicationCount || 0}
                        active={expandedJobId === item.id}
                        onClick={() => loadApplications(item.id)}
                      />
                      {item.workspaceId && (
                        item.workspaceStatus === 'certified' ? (
                          <span className="emp-completed-badge">Completed</span>
                        ) : (
                          <button
                            type="button"
                            className="emp-btn emp-btn--primary"
                            onClick={() => navigate(`/employer/workspace/${item.workspaceId}`)}
                          >
                            View progress
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="emp-btn emp-btn--danger emp-btn--delete"
                        disabled={!item.canDelete || deleteLoading}
                        title={item.canDelete ? 'Delete this job post' : 'Cannot delete after accepting a freelancer'}
                        onClick={() => item.canDelete && setDeleteTarget(item)}
                      >
                        Delete
                      </button>
                      <span className={`emp-tag emp-tag--${item.status}`}>{item.publishStatus === 'draft' ? 'draft' : item.status}</span>
                    </div>
                  </div>

                  {expandedJobId === item.id && (
                    <div className="emp-applicants-panel">
                      <div className="emp-applicants-panel__head">
                        <h4>{jobMeta?.projectMode === 'multi' ? 'Review bids' : 'Applications'}</h4>
                        <span>{item.applicationCount || 0} pending</span>
                      </div>

                      {jobMeta?.projectMode === 'multi' && (
                        <>
                          <div className="emp-multi-progress">
                            Roles filled: {jobMeta.rolesFilled || 0} of {jobMeta.rolesTotal || 0}
                            <span>
                              {jobMeta.rolesTotal
                                ? Math.round(((jobMeta.rolesFilled || 0) / jobMeta.rolesTotal) * 100)
                                : 0}
                              %
                            </span>
                          </div>
                          <div className="emp-review-tabs">
                            <button
                              type="button"
                              className={reviewMode === 'role' ? 'is-active' : ''}
                              onClick={() => setReviewMode('role')}
                            >
                              Role-based bidding
                            </button>
                            <button
                              type="button"
                              className={reviewMode === 'squad' ? 'is-active' : ''}
                              onClick={() => setReviewMode('squad')}
                            >
                              Squad bidding
                            </button>
                          </div>
                        </>
                      )}

                      {appsLoading ? (
                        <p className="emp-muted">Loading applications…</p>
                      ) : jobMeta?.projectMode === 'multi' && reviewMode === 'role' ? (
                        <div className="emp-role-review">
                          {roles.map((role) => (
                            <div key={role.roleKey} className="emp-role-block">
                              <div className="emp-role-block__head">
                                <div>
                                  <strong>{role.name}</strong>
                                  <p>{role.description || `${role.budgetPercent}% of budget`}</p>
                                </div>
                                <div className="emp-role-block__meta">
                                  <em>{fmtMoney(role.budgetAmount)}</em>
                                  <span className={`emp-role-pill ${role.status === 'filled' ? 'is-filled' : ''}`}>
                                    {role.status === 'filled' ? '✓ Filled' : `${role.bidCount || 0} bids`}
                                  </span>
                                </div>
                              </div>
                              <ul className="emp-applicants-list">
                                {(role.applications || []).length === 0 ? (
                                  <li className="emp-muted" style={{ padding: '0.5rem 0' }}>No bids yet</li>
                                ) : (
                                  role.applications.map(renderApplicantRow)
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : jobMeta?.projectMode === 'multi' && reviewMode === 'squad' ? (
                        <div className="emp-squad-review">
                          {squads.length === 0 ? (
                            <p className="emp-muted">No submitted squad bids yet.</p>
                          ) : (
                            squads.map((sq) => (
                              <div key={sq.id} className="emp-squad-card">
                                <div className="emp-squad-card__top">
                                  <div>
                                    <strong>{sq.name}</strong>
                                    <p>
                                      {(sq.members || []).length} members ·{' '}
                                      {(sq.members || []).map((m) => m.roleName).filter(Boolean).join(', ')}
                                    </p>
                                  </div>
                                  <div className="emp-squad-card__price">
                                    <em>{fmtMoney(sq.combinedAmount)}</em>
                                    <span>{sq.status}</span>
                                  </div>
                                </div>
                                <ul className="emp-squad-members">
                                  {(sq.members || []).map((m) => (
                                    <li key={`${m.freelancerId}-${m.roleKey}`}>
                                      {m.freelancer
                                        ? `${m.freelancer.firstName} ${m.freelancer.lastName}`
                                        : 'Member'}
                                      {' · '}
                                      {m.roleName}
                                      {' · '}
                                      {fmtMoney(m.splitAmount)}
                                    </li>
                                  ))}
                                </ul>
                                {sq.status === 'submitted' && (
                                  <div className="emp-squad-card__actions">
                                    <button
                                      type="button"
                                      className="emp-btn emp-btn--primary"
                                      disabled={!!actionLoading}
                                      onClick={() => handleSquadReview(sq.id, 'accept')}
                                    >
                                      Accept squad
                                    </button>
                                    <button
                                      type="button"
                                      className="emp-btn emp-btn--danger"
                                      disabled={!!actionLoading}
                                      onClick={() => handleSquadReview(sq.id, 'reject')}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      ) : applications.length === 0 ? (
                        <p className="emp-muted">No applications yet for this role.</p>
                      ) : (
                        <ul className="emp-applicants-list">
                          {applications.map(renderApplicantRow)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </EmployerLockedGate>

      {profileId && <FreelancerProfileModal freelancerId={profileId} onClose={() => setProfileId(null)} />}

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

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getProfileUrl } from '../../services/api';
import { useAdmin } from '../../context/AdminContext';
import AdminQuickActions from '../../components/admin/AdminQuickActions';
import { formatDate, formatDateTime, roleLabel, statusBadge, userName } from './adminHelpers';
import './AdminProfile.css';
import '../../components/Layout/AdminLayout.css';

const TABS = ['Overview', 'Work', 'Activity', 'Notes & Flags'];

function StatPill({ label, value }) {
  return (
    <div className="adm-profile-stat">
      <div className="adm-profile-stat__value">{value}</div>
      <div className="adm-profile-stat__label">{label}</div>
    </div>
  );
}

export default function AdminUserProfile() {
  const { userId } = useParams();
  const { openSendNote, openFlag, openSuspend, openVerify } = useAdmin();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Overview');

  const load = () => {
    setLoading(true);
    api.getAdminUserDetail(userId)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [userId]);

  if (loading) return <div className="admin-muted" style={{ padding: 40 }}>Loading profile…</div>;
  if (error || !data) return <div className="admin-error">{error || 'Profile not found'}</div>;

  const { user, stats, gigs, jobs, activity, flagHistory, sentNotes, adminHistory } = data;
  const avatar = user.profilePicture ? getProfileUrl(user.profilePicture) : '';
  const tagline = user.bio || user.professionalSummary || user.organizationName || '';
  const isEmployer = user.role === 'employer';
  const isSuspended = user.accountStatus === 'suspended';
  const needsVerification = isEmployer && user.verificationStatus === 'pending';

  const refresh = () => load();

  const handleRetryNote = async (noteId) => {
    try {
      await api.retrySentNote(noteId);
      refresh();
    } catch (err) {
      alert(err.message || 'Retry failed');
    }
  };

  const quickApprove = async () => {
    const label = user.organizationName || userName(user);
    if (!window.confirm(`Approve verification for ${label}?`)) return;
    try {
      await api.approveVerification(user.id);
      refresh();
    } catch (err) {
      alert(err.message || 'Failed to approve employer');
    }
  };

  return (
    <div className="adm-profile">
      <div className="adm-profile__back">
        <Link to="/admin/users" className="admin-btn admin-btn--ghost">← Back to search</Link>
      </div>

      <header className="adm-profile__hero">
        <div className="adm-profile__avatar-wrap">
          {avatar ? (
            <img src={avatar} alt="" className="adm-profile__avatar" />
          ) : (
            <div className="adm-profile__avatar adm-profile__avatar--placeholder">
              {(user.firstName?.[0] || user.email?.[0] || '?').toUpperCase()}
            </div>
          )}
        </div>
        <div className="adm-profile__identity">
          <h1 className="adm-profile__name">{userName(user)}</h1>
          {tagline && <p className="adm-profile__tagline">{tagline}</p>}
          <div className="adm-profile__meta">
            <span className={`admin-badge ${statusBadge(user.accountStatus)}`}>{user.accountStatus}</span>
            <span className="admin-badge admin-badge--pending">{roleLabel(user.role)}</span>
            {isEmployer && user.verificationStatus === 'verified' && (
              <span className="admin-badge admin-badge--active">Verified</span>
            )}
            {isEmployer && user.verificationStatus === 'pending' && (
              <span className="admin-badge admin-badge--pending">Pending verification</span>
            )}
            {user.freelancerId && <span className="admin-muted adm-profile__id">{user.freelancerId}</span>}
            {user.employerId && <span className="admin-muted adm-profile__id">{user.employerId}</span>}
          </div>
          <p className="admin-muted">Joined {formatDate(user.createdAt)} · {user.email}</p>
          {isSuspended && (
            <div className="adm-profile__suspension">
              <strong>{user.isAutoSuspended ? 'Automatic suspension' : 'Manual suspension'}</strong>
              <p>{user.suspensionReason || 'No reason recorded'}</p>
            </div>
          )}
        </div>
        <div className="adm-profile__actions">
          {needsVerification && (
            <>
              <button type="button" className="admin-btn admin-btn--primary" onClick={quickApprove}>
                Approve
              </button>
              <button type="button" className="admin-btn admin-btn--danger" onClick={() => openVerify(user, refresh)}>
                Reject
              </button>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => openVerify(user, refresh)}>
                Review docs
              </button>
            </>
          )}
          {!isSuspended && (
            <>
              <button type="button" className="admin-btn" onClick={() => openSendNote(user, refresh)}>Send note</button>
              <button type="button" className="admin-btn admin-btn--warn" onClick={() => openFlag(user, refresh)}>Flag</button>
              <button type="button" className="admin-btn admin-btn--danger" onClick={() => openSuspend(user, refresh)}>Suspend</button>
            </>
          )}
        </div>
      </header>

      <div className="adm-profile__stats">
        <StatPill label="Completed gigs" value={stats.completedGigs} />
        <StatPill label="Active gigs" value={stats.activeGigs} />
        <StatPill label={isEmployer ? 'Total spent' : 'Total earned'} value={`NPR ${(isEmployer ? stats.totalSpent : stats.totalEarned)?.toLocaleString?.() ?? 0}`} />
        <StatPill label="Flags" value={stats.flagCount} />
        {isEmployer && <StatPill label="Job posts" value={stats.jobsPosted} />}
      </div>

      <nav className="adm-profile__tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`adm-profile__tab ${tab === t ? 'adm-profile__tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="adm-profile__content">
        {tab === 'Overview' && (
          <div className="adm-profile-grid">
            <div className="admin-panel">
              <div className="admin-panel__head">About</div>
              <div className="admin-panel__body">
                {user.skills?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="admin-muted" style={{ marginBottom: 6 }}>Skills</div>
                    <div className="adm-profile-tags">
                      {user.skills.map((s) => <span key={s} className="admin-badge admin-badge--pending">{s}</span>)}
                    </div>
                  </div>
                )}
                <p>{user.professionalSummary || user.bio || 'No bio provided.'}</p>
                <div className="admin-muted" style={{ marginTop: 12 }}>
                  {[user.city, user.country].filter(Boolean).join(', ') || 'Location not set'}
                </div>
              </div>
            </div>
            {user.projects?.length > 0 && (
              <div className="admin-panel">
                <div className="admin-panel__head">Portfolio ({user.projects.length})</div>
                <div className="admin-panel__body adm-profile-portfolio">
                  {user.projects.slice(0, 6).map((p) => (
                    <div key={p._id || p.title} className="adm-profile-portfolio-item">
                      <strong>{p.title}</strong>
                      <p className="admin-muted">{p.description?.slice(0, 120)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'Work' && (
          <div className="admin-panel">
            <div className="admin-panel__head">{isEmployer ? 'Job posts' : 'Gigs'}</div>
            <div className="admin-panel__body admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEmployer ? jobs : gigs).length === 0 ? (
                    <tr><td colSpan={3} className="admin-muted">No work items.</td></tr>
                  ) : (
                    (isEmployer ? jobs : gigs).map((item) => (
                      <tr key={item._id}>
                        <td><strong>{item.title}</strong></td>
                        <td><span className="admin-badge admin-badge--pending">{item.status}</span></td>
                        <td>{formatDate(item.updatedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'Activity' && (
          <div className="admin-panel">
            <div className="admin-panel__head">Activity timeline</div>
            <div className="admin-panel__body adm-profile-timeline">
              {activity.length === 0 ? (
                <p className="admin-muted">No activity recorded.</p>
              ) : (
                activity.map((ev) => (
                  <div key={ev._id} className="adm-profile-timeline-item">
                    <time>{formatDateTime(ev.occurredAt)}</time>
                    <div><strong>{ev.title || ev.type}</strong></div>
                    {ev.description && <p className="admin-muted">{ev.description}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'Notes & Flags' && (
          <div className="adm-profile-grid">
            <div className="admin-panel">
              <div className="admin-panel__head">Notes sent</div>
              <div className="admin-panel__body adm-profile-timeline">
                {(sentNotes || []).length === 0 ? (
                  <p className="admin-muted">No notes sent.</p>
                ) : (
                  sentNotes.map((n) => (
                    <div key={n._id} className="adm-profile-timeline-item">
                      <time>{formatDateTime(n.sentAt)}</time>
                      <div>
                        <strong>{n.sentByAdminName}</strong>
                        <span className={`admin-badge ${n.status === 'sent' ? 'admin-badge--active' : 'admin-badge--failed'}`} style={{ marginLeft: 8 }}>
                          {n.status}
                        </span>
                      </div>
                      <p className="admin-muted">{n.subject}</p>
                      {n.status === 'failed' && (
                        <>
                          <p className="admin-error" style={{ marginTop: 8 }}>{n.errorReason}</p>
                          <button type="button" className="admin-btn admin-btn--warn" style={{ marginTop: 8 }} onClick={() => handleRetryNote(n._id)}>
                            Retry
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel__head">Flag history</div>
              <div className="admin-panel__body adm-profile-timeline">
                {flagHistory.length === 0 ? (
                  <p className="admin-muted">No flags.</p>
                ) : (
                  flagHistory.map((f, i) => (
                    <div key={f._id || i} className="adm-profile-timeline-item">
                      <time>{formatDateTime(f.createdAt)}</time>
                      <div><strong>{f.reason}</strong></div>
                      {f.note && <p className="admin-muted">{f.note}</p>}
                      <p className="admin-muted">By {f.flaggedByName || 'Admin'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="admin-panel" style={{ gridColumn: '1 / -1' }}>
              <div className="admin-panel__head">Admin audit trail</div>
              <div className="admin-panel__body admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>When</th><th>Admin</th><th>Action</th><th>Summary</th></tr>
                  </thead>
                  <tbody>
                    {adminHistory.map((log) => (
                      <tr key={log._id}>
                        <td>{formatDateTime(log.occurredAt)}</td>
                        <td>{log.adminName}</td>
                        <td className="admin-mono">{log.action}</td>
                        <td>{log.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

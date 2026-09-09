import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import AdminModal from '../../components/admin/AdminModal';
import { formatDate, formatDateTime } from './adminHelpers';
import '../../components/Layout/AdminLayout.css';

const FILTERS = [
  { key: 'all', label: 'All groups' },
  { key: 'reported', label: 'Reported' },
  { key: 'restricted', label: 'Restricted' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'active', label: 'Active' },
];

const STATUS_BADGE = {
  active: 'admin-badge--active',
  restricted: 'admin-badge--pending',
  suspended: 'admin-badge--suspended',
};

const REASON_LABELS = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate speech',
  scam: 'Scam',
  inappropriate_content: 'Inappropriate content',
  other: 'Other',
};

function ModerationBadge({ status }) {
  return (
    <span className={`admin-badge ${STATUS_BADGE[status] || 'admin-badge--pending'}`}>
      {status || 'active'}
    </span>
  );
}

export default function AdminCommunity() {
  const [filter, setFilter] = useState('all');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  const loadGroups = () => {
    setLoading(true);
    setError('');
    api.getAdminCommunityGroups(filter)
      .then((data) => setGroups(data.groups || []))
      .catch((err) => {
        setError(err.message || 'Failed to load community groups');
        setGroups([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGroups();
  }, [filter]);

  const openGroup = async (group) => {
    setSelected(group);
    setReason(group.moderationReason || '');
    setMembers([]);
    setMembersLoading(true);
    setError('');
    try {
      const [memberData, groupData] = await Promise.all([
        api.getAdminCommunityGroupMembers(group.id),
        api.getAdminCommunityGroup(group.id),
      ]);
      setSelected(groupData.group);
      setReason(groupData.group.moderationReason || '');
      setMembers(memberData.members || []);
    } catch (err) {
      setError(err.message || 'Failed to load group details');
    } finally {
      setMembersLoading(false);
    }
  };

  const applyModeration = async (status) => {
    if (!selected) return;
    if ((status === 'restricted' || status === 'suspended') && !reason.trim()) {
      setError('Add a moderation reason before restricting or suspending a group.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api.updateAdminCommunityGroupModeration(selected.id, {
        status,
        reason: reason.trim(),
      });
      setSelected(data.group);
      await loadGroups();
    } catch (err) {
      setError(err.message || 'Failed to update group');
    } finally {
      setBusy(false);
    }
  };

  const dismissReports = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.dismissAdminCommunityReports(selected.id);
      setSelected(data.group);
      await loadGroups();
    } catch (err) {
      setError(err.message || 'Failed to dismiss reports');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Community</h1>
          <p className="admin-page-subtitle">Review reported groups, inspect members, and restrict or suspend communities</p>
        </div>
      </header>

      {error && !selected && <p className="admin-error">{error}</p>}

      <div className="admin-segment-tabs" role="tablist" aria-label="Community filters">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={filter === item.key}
            className={`admin-segment-tab ${filter === item.key ? 'admin-segment-tab--active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel__head">Community groups ({groups.length})</div>
        <div className="admin-panel__body admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Visibility</th>
                <th>Members</th>
                <th>Reports</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="admin-muted">Loading…</td></tr>
              ) : groups.length === 0 ? (
                <tr><td colSpan={7} className="admin-muted admin-table__empty">No groups match this filter.</td></tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <strong>{group.name}</strong>
                      <div className="admin-muted">{group.slug}</div>
                      {group.owner && (
                        <div className="admin-muted">Owner: {group.owner.name}</div>
                      )}
                    </td>
                    <td>{group.visibility}</td>
                    <td>{group.memberCount}</td>
                    <td>
                      {group.reportCount > 0 ? (
                        <span className="admin-badge admin-badge--suspended">{group.reportCount}</span>
                      ) : (
                        <span className="admin-muted">0</span>
                      )}
                    </td>
                    <td><ModerationBadge status={group.moderationStatus} /></td>
                    <td>{formatDate(group.updatedAt)}</td>
                    <td>
                      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openGroup(group)}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <AdminModal
          open
          wide
          title={selected.name}
          subtitle={`${selected.visibility} · ${selected.memberCount} members`}
          onClose={() => { setSelected(null); setError(''); }}
          footer={(
            <>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setSelected(null)} disabled={busy}>
                Close
              </button>
              {selected.reportCount > 0 && (
                <button type="button" className="admin-btn" onClick={dismissReports} disabled={busy}>
                  Dismiss reports
                </button>
              )}
              {selected.moderationStatus !== 'restricted' && (
                <button type="button" className="admin-btn admin-btn--warn" onClick={() => applyModeration('restricted')} disabled={busy}>
                  Restrict
                </button>
              )}
              {selected.moderationStatus !== 'suspended' && (
                <button type="button" className="admin-btn admin-btn--danger" onClick={() => applyModeration('suspended')} disabled={busy}>
                  Suspend
                </button>
              )}
              {selected.moderationStatus !== 'active' && (
                <button type="button" className="admin-btn admin-btn--primary" onClick={() => applyModeration('active')} disabled={busy}>
                  Restore
                </button>
              )}
            </>
          )}
        >
          {error && <p className="admin-error">{error}</p>}

          <div className="admin-community-detail">
            <div className="admin-community-detail__meta">
              <p><strong>Status:</strong> <ModerationBadge status={selected.moderationStatus} /></p>
              {selected.description && <p className="admin-muted">{selected.description}</p>}
              {selected.owner && (
                <p className="admin-muted">Created by {selected.owner.name} ({selected.owner.email})</p>
              )}
            </div>

            <div className="adm-modal-form__field">
              <label className="adm-modal-form__label" htmlFor="community-reason">Moderation reason</label>
              <textarea
                id="community-reason"
                className="admin-textarea"
                rows={3}
                placeholder="Reason shown internally and used when restricting or suspending"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {(selected.reportLog?.length > 0 || selected.reports?.length > 0) && (
              <div className="admin-panel admin-panel--nested">
                <div className="admin-panel__head">
                  Report log ({selected.reportLog?.length || selected.reports?.length || 0})
                  {selected.openReports > 0 && (
                    <span className="admin-muted"> · {selected.openReports} open</span>
                  )}
                </div>
                <div className="admin-panel__body admin-table-wrap">
                  <table className="admin-table admin-table--report-log">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reporter</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.reportLog || selected.reports || []).map((report) => (
                        <tr key={report.id}>
                          <td>{formatDateTime(report.createdAt)}</td>
                          <td>
                            <strong>{report.reporterName || 'Unknown'}</strong>
                            {report.reporterEmail && (
                              <div className="admin-muted">{report.reporterEmail}</div>
                            )}
                          </td>
                          <td>{REASON_LABELS[report.reason] || report.reason}</td>
                          <td>
                            <span className={`admin-badge ${report.status === 'open' ? 'admin-badge--suspended' : 'admin-badge--active'}`}>
                              {report.status || 'open'}
                            </span>
                          </td>
                          <td className="admin-report-description">
                            {report.note?.trim() ? report.note : <span className="admin-muted">No description</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="admin-panel admin-panel--nested">
              <div className="admin-panel__head">Members</div>
              <div className="admin-panel__body admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membersLoading ? (
                      <tr><td colSpan={4} className="admin-muted">Loading members…</td></tr>
                    ) : members.length === 0 ? (
                      <tr><td colSpan={4} className="admin-muted">No members found.</td></tr>
                    ) : (
                      members.map((member) => (
                        <tr key={member.id}>
                          <td>
                            <strong>{member.user?.name || 'Member'}</strong>
                            <div className="admin-muted">{member.user?.role}</div>
                          </td>
                          <td>{member.role}</td>
                          <td>{member.status}</td>
                          <td>{formatDate(member.joinedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </AdminModal>
      )}
    </>
  );
}

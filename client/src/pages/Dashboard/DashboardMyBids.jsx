import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { fmtDate, fmtNPR } from './dashboardUtils';
import './DashboardMyBids.css';

function bidStatusLabel(status) {
  return ({ pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn' }[status] || status);
}

function workspaceActionLabel(status) {
  if (!status || status === 'not_started') return 'Start working';
  if (status === 'certified') return 'Completed';
  return 'Open workspace';
}

function isWorkspaceCompleted(status) {
  return status === 'certified';
}

export default function DashboardMyBids() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState('');
  const [invites, setInvites] = useState([]);
  const [inviteBusy, setInviteBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, inviteData] = await Promise.all([
        api.getBids({ page: 1, limit: 50 }),
        api.getMySquadInvites().catch(() => ({ invites: [] })),
      ]);
      setItems(data.items || []);
      setAcceptedCount(data.acceptedCount ?? (data.items || []).filter((i) => i.status === 'accepted').length);
      setInvites(inviteData.invites || []);
    } catch {
      setItems([]);
      setAcceptedCount(0);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respondInvite = async (squadId, accept) => {
    setInviteBusy(squadId + String(accept));
    try {
      await api.respondSquadInvite(squadId, { accept });
      await load();
    } catch (err) {
      alert(err.message || 'Failed to respond');
    } finally {
      setInviteBusy('');
    }
  };

  const openWorkspace = async (item) => {
    if (!item.workspaceId) {
      alert('Workspace is not ready yet. Refresh and try again.');
      return;
    }
    if (item.workspaceStatus === 'not_started') {
      setStartingId(item._id);
      try {
        await api.startWorkSession(item.workspaceId);
      } catch (err) {
        if (!String(err.message || '').includes('already')) {
          alert(err.message || 'Could not start work');
          setStartingId('');
          return;
        }
      } finally {
        setStartingId('');
      }
    }
    navigate(`/dashboard/workspace/${item.workspaceId}`);
  };

  return (
    <section className="glass-surface dmb" aria-label="My bids">
      <header className="dmb__head">
        <div>
          <h2 className="dmb__title">My Bids</h2>
          <p className="dmb__sub">Submitted, pending, and accepted applications in one place</p>
        </div>
        {acceptedCount > 0 && (
          <div className="dmb-badge" title={`${acceptedCount} accepted bid${acceptedCount === 1 ? '' : 's'}`}>
            <span className="dmb-badge__label">Accepted</span>
            <span className="dmb-badge__count">{acceptedCount > 9 ? '9+' : acceptedCount}</span>
          </div>
        )}
      </header>

      {invites.length > 0 && (
        <div className="dmb-invites">
          <h3>Squad invitations</h3>
          {invites.map((sq) => {
            const mine = (sq.members || []).find((m) => m.inviteStatus === 'pending');
            return (
              <div key={sq.id} className="dmb-invite">
                <div>
                  <strong>{sq.name}</strong>
                  <p>
                    {sq.jobTitle} · Your role: {mine?.roleName || '-'} · Split रू {Number(mine?.splitAmount || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="dmb-invite__actions">
                  <button
                    type="button"
                    disabled={!!inviteBusy}
                    onClick={() => respondInvite(sq.id, true)}
                  >
                    {inviteBusy === `${sq.id}true` ? '…' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="is-ghost"
                    disabled={!!inviteBusy}
                    onClick={() => respondInvite(sq.id, false)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="dmb-loading" role="status" aria-label="Loading bids" />
      ) : items.length === 0 ? (
        <div className="dmb-empty">
          <p className="dmb-empty__title">No bids yet</p>
          <p className="dmb-empty__sub">When you apply to jobs, they will appear here.</p>
        </div>
      ) : (
        <div className="dmb-table-wrap">
          <table className="dmb-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Organization</th>
                <th>Amount</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className={item.status === 'accepted' ? 'dmb-row--accepted' : ''}>
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>{item.organizationName || '-'}</td>
                  <td>{fmtNPR(item.amount)}</td>
                  <td>{fmtDate(item.occurredAt)}</td>
                  <td>
                    <span className={`dmb-pill dmb-pill--${item.status}`}>
                      {bidStatusLabel(item.status)}
                      {item.status === 'accepted' && item.workspaceStatus && item.workspaceStatus !== 'not_started' && (
                        <em className="dmb-pill__extra"> · {item.workspaceStatus.replace(/_/g, ' ')}</em>
                      )}
                    </span>
                  </td>
                  <td>
                    {item.status === 'accepted' && item.workspaceId ? (
                      isWorkspaceCompleted(item.workspaceStatus) ? (
                        <span className="dmb-completed">Completed</span>
                      ) : (
                        <button
                          type="button"
                          className="dmb-action"
                          disabled={startingId === item._id}
                          onClick={() => openWorkspace(item)}
                        >
                          {startingId === item._id ? 'Starting…' : workspaceActionLabel(item.workspaceStatus)}
                        </button>
                      )
                    ) : item.status === 'pending' ? (
                      <span className="dmb-wait">Awaiting review</span>
                    ) : (
                      <span className="dmb-wait">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

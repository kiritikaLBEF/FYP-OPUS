import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { fmtDate, fmtNPR } from './dashboardUtils';
import './DashboardMyBids.css';

const FILTERS = [
  { id: 'submitted', label: 'Submitted' },
  { id: 'todo', label: 'To do' },
  { id: 'progress', label: 'In progress' },
  { id: 'review', label: 'In review' },
  { id: 'completed', label: 'Completed' },
];

function bidStatusLabel(status) {
  return ({ pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn' }[status] || status);
}

function workspaceActionLabel(status) {
  if (!status || status === 'not_started') return 'Start working';
  if (status === 'certified' || status === 'paid') return 'Completed';
  return 'Open workspace';
}

function isWorkspaceCompleted(status) {
  return status === 'certified' || status === 'paid' || status === 'awaiting_payment';
}

function bidStage(item) {
  if (item.status !== 'accepted') return 'submitted';
  const ws = item.workspaceStatus;
  if (!ws || ws === 'not_started') return 'todo';
  if (ws === 'in_progress') return 'progress';
  if (ws === 'final_submitted') return 'review';
  return 'completed';
}

export default function DashboardMyBids({ initialFilter = 'submitted', filterKey = 0 }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState('');
  const [invites, setInvites] = useState([]);
  const [inviteBusy, setInviteBusy] = useState('');
  const [filter, setFilter] = useState(initialFilter);

  useEffect(() => {
    if (!initialFilter) return;
    setFilter(initialFilter);
  }, [initialFilter, filterKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, inviteData] = await Promise.all([
        api.getBids({ page: 1, limit: 100 }),
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

  const counts = useMemo(() => {
    const next = { submitted: items.length, todo: 0, progress: 0, review: 0, completed: 0 };
    items.forEach((item) => {
      const stage = bidStage(item);
      if (stage !== 'submitted') next[stage] += 1;
    });
    return next;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'submitted') return items;
    return items.filter((item) => bidStage(item) === filter);
  }, [items, filter]);

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
    if (item.teamWorkspaceId) {
      if (!item.workspaceStatus || item.workspaceStatus === 'not_started') {
        setStartingId(item._id);
        try {
          await api.startTeamRole(item.teamWorkspaceId);
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
      navigate(`/dashboard/team-workspace/${item.teamWorkspaceId}`);
      return;
    }

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

  const emptyCopy = {
    submitted: { title: 'No bids yet', sub: 'When you apply to jobs, they will appear here.' },
    todo: { title: 'No tasks to do', sub: 'Accepted bids waiting to start show up here.' },
    progress: { title: 'No tasks in progress', sub: 'Active workspace sessions show up here.' },
    review: { title: 'Nothing in review', sub: 'Work waiting on the client lands here.' },
    completed: { title: 'No completed tasks', sub: 'Finished engagements show up here.' },
  }[filter];

  return (
    <section className="dmb" aria-label="My bids">
      <header className="dmb__head">
        <div>
          <h2 className="dmb__title">My bids</h2>
          <p className="dmb__sub">Submitted applications and tasks by stage</p>
        </div>
        {acceptedCount > 0 && (
          <div className="dmb-badge" title={`${acceptedCount} accepted bid${acceptedCount === 1 ? '' : 's'}`}>
            <span className="dmb-badge__label">Accepted</span>
            <span className="dmb-badge__count">{acceptedCount > 9 ? '9+' : acceptedCount}</span>
          </div>
        )}
      </header>

      <div className="dmb-tabs" role="tablist" aria-label="Bid and task filters">
        {FILTERS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`dmb-tab${filter === tab.id ? ' dmb-tab--active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            <span className="dmb-tab__count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

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
      ) : filtered.length === 0 ? (
        <div className="dmb-empty">
          <p className="dmb-empty__title">{emptyCopy.title}</p>
          <p className="dmb-empty__sub">{emptyCopy.sub}</p>
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
              {filtered.map((item) => (
                <tr key={item._id} className={item.status === 'accepted' ? 'dmb-row--accepted' : ''}>
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>
                    {item.employerUserId ? (
                      <button
                        type="button"
                        className="dmb-org-link"
                        onClick={() => navigate(`/employers/${item.employerUserId}`, {
                          state: { from: '/dashboard', fromLabel: 'Back to dashboard' },
                        })}
                      >
                        {item.organizationName || '-'}
                      </button>
                    ) : (
                      item.organizationName || '-'
                    )}
                  </td>
                  <td className="fd-mono">{fmtNPR(item.amount)}</td>
                  <td className="fd-mono">{fmtDate(item.occurredAt)}</td>
                  <td>
                    <span className={`dmb-pill dmb-pill--${item.status}`}>
                      {bidStatusLabel(item.status)}
                      {item.status === 'accepted' && item.workspaceStatus && item.workspaceStatus !== 'not_started' && (
                        <em className="dmb-pill__extra"> · {item.workspaceStatus.replace(/_/g, ' ')}</em>
                      )}
                    </span>
                  </td>
                  <td>
                    {item.status === 'accepted' && (item.teamWorkspaceId || item.workspaceId) ? (
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

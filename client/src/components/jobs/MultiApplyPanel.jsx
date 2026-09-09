import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import './MultiApplyPanel.css';

const fmt = (n) => `रू ${Number(n || 0).toLocaleString('en-IN')}`;

export default function MultiApplyPanel({ job, onApplied }) {
  const { user } = useAuth();
  const allowRole = job.allowRoleBids !== false && ['role', 'both'].includes(job.multiBidMode || 'both');
  const allowSquad = job.allowSquadBids !== false && ['squad', 'both'].includes(job.multiBidMode || 'both');
  const [mode, setMode] = useState(allowRole ? 'solo' : 'squad');
  const [expandedRole, setExpandedRole] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [delivery, setDelivery] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [appliedRoles, setAppliedRoles] = useState(job.appliedRoleKeys || []);
  const [locked, setLocked] = useState(!!(job.lockedToOneRole || job.hasApplied || job.mySquadBid || (job.appliedRoleKeys || []).length));

  const [squadName, setSquadName] = useState('');
  const [squadMessage, setSquadMessage] = useState('');
  const [myRoleKey, setMyRoleKey] = useState(job.roles?.[0]?.roleKey || '');
  const [slots, setSlots] = useState([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteRoleKey, setInviteRoleKey] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [squad, setSquad] = useState(job.mySquadBid || null);

  const openRoles = useMemo(
    () => (job.roles || []).filter((r) => r.status !== 'filled'),
    [job.roles],
  );

  useEffect(() => {
    setAppliedRoles(job.appliedRoleKeys || []);
    setLocked(!!(job.lockedToOneRole || job.hasApplied || job.mySquadBid || (job.appliedRoleKeys || []).length));
  }, [job]);

  useEffect(() => {
    if (!job.mySquadBid?.id) return undefined;
    let cancelled = false;
    api.getMySquadBids?.()
      .then((d) => {
        if (cancelled) return;
        const match = (d.squads || []).find((s) => String(s.id) === String(job.mySquadBid.id));
        if (match) {
          setSquad(match);
          setMode('squad');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [job.mySquadBid?.id]);

  useEffect(() => {
    if (!allowRole && allowSquad) setMode('squad');
  }, [allowRole, allowSquad]);

  useEffect(() => {
    if (!myRoleKey && openRoles[0]) setMyRoleKey(openRoles[0].roleKey);
  }, [myRoleKey, openRoles]);

  useEffect(() => {
    if (inviteQuery.trim().length < 2) {
      setSearchHits([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api.searchFreelancers(inviteQuery.trim())
        .then((d) => setSearchHits(d.freelancers || []))
        .catch(() => setSearchHits([]));
    }, 280);
    return () => clearTimeout(t);
  }, [inviteQuery]);

  const combined = useMemo(() => {
    const mine = (job.roles || []).find((r) => r.roleKey === myRoleKey);
    const myAmt = Number(slots.find((s) => s.isLeader)?.splitAmount)
      ?? mine?.budgetAmount
      ?? 0;
    const others = slots.filter((s) => !s.isLeader).reduce((sum, s) => sum + (Number(s.splitAmount) || 0), 0);
    return (Number(myAmt) || 0) + others;
  }, [job.roles, myRoleKey, slots]);

  const submitRoleBid = async (role) => {
    setError('');
    setBusy(true);
    try {
      await api.applyToJob(job.id, {
        roleKey: role.roleKey,
        amount: Number(bidAmount) || role.budgetAmount,
        estimatedDelivery: delivery,
        message,
      });
      setAppliedRoles((prev) => [...prev, role.roleKey]);
      setLocked(true);
      setExpandedRole(null);
      onApplied?.();
    } catch (err) {
      setError(err.message || 'Failed to submit bid');
    } finally {
      setBusy(false);
    }
  };

  const addInvite = (freelancer) => {
    if (!inviteRoleKey) {
      setError('Pick which employer role this member will cover.');
      return;
    }
    if (inviteRoleKey === myRoleKey) {
      setError('That role is already yours.');
      return;
    }
    if (slots.some((s) => s.roleKey === inviteRoleKey || String(s.freelancerId) === String(freelancer.id))) {
      setError('That role or freelancer is already in the squad.');
      return;
    }
    const role = (job.roles || []).find((r) => r.roleKey === inviteRoleKey);
    setSlots((prev) => [
      ...prev,
      {
        freelancerId: freelancer.id,
        name: freelancer.name,
        roleKey: inviteRoleKey,
        roleName: role?.name || '',
        splitAmount: role?.budgetAmount || 0,
        isLeader: false,
      },
    ]);
    setInviteQuery('');
    setSearchHits([]);
    setError('');
  };

  const createAndMaybeSubmitSquad = async () => {
    setError('');
    if (!squadName.trim()) {
      setError('Name your squad.');
      return;
    }
    if (!myRoleKey) {
      setError('Pick your role from the employer’s work division.');
      return;
    }
    const myRole = (job.roles || []).find((r) => r.roleKey === myRoleKey);
    const members = [
      {
        roleKey: myRoleKey,
        splitAmount: myRole?.budgetAmount || 0,
        isLeader: true,
        freelancerId: user?.id || user?._id,
      },
      ...slots.map((s) => ({
        roleKey: s.roleKey,
        splitAmount: Number(s.splitAmount) || 0,
        freelancerId: s.freelancerId,
        isLeader: false,
      })),
    ];

    setBusy(true);
    try {
      const created = await api.createSquadBid(job.id, {
        name: squadName.trim(),
        message: squadMessage,
        members,
      });
      let next = created.squad;
      if (next?.canSubmit) {
        const submitted = await api.submitSquadBid(next.id);
        next = submitted.squad;
      }
      setSquad(next);
      setLocked(true);
      onApplied?.();
    } catch (err) {
      setError(err.message || 'Failed to create squad');
    } finally {
      setBusy(false);
    }
  };

  const submitExistingSquad = async () => {
    if (!squad?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.submitSquadBid(squad.id);
      setSquad(res.squad);
      setLocked(true);
      onApplied?.();
    } catch (err) {
      setError(err.message || 'Cannot submit yet');
    } finally {
      setBusy(false);
    }
  };

  if (!job.isMulti && job.projectMode !== 'multi') return null;

  return (
    <div className="multi-apply">
      <p className="multi-apply__label">Multi-freelancer project · {(job.roles || []).length} roles</p>

      {(allowRole && allowSquad) && !locked && (
        <div className="multi-apply__toggle">
          <button type="button" className={mode === 'solo' ? 'is-active' : ''} onClick={() => setMode('solo')}>
            <strong>Bid on a single role</strong>
            <span>Apply individually to one open role.</span>
          </button>
          <button type="button" className={mode === 'squad' ? 'is-active' : ''} onClick={() => setMode('squad')}>
            <strong>Bid as a squad</strong>
            <span>Invite teammates for the employer’s roles, then submit together.</span>
          </button>
        </div>
      )}

      {locked && (
        <p className="multi-apply__banner">
          You already submitted a bid on this project. You can only apply to one role (solo or via one squad).
        </p>
      )}

      {error && <p className="multi-apply__error">{error}</p>}

      {mode === 'solo' && allowRole && (
        <div className="multi-apply__roles">
          {(job.roles || []).map((role) => {
            const filled = role.status === 'filled';
            const already = appliedRoles.includes(role.roleKey);
            const lockedOut = locked && !already;
            const open = expandedRole === role.roleKey;
            return (
              <div key={role.roleKey} className="multi-apply__role">
                <button
                  type="button"
                  className="multi-apply__role-head"
                  disabled={filled || already || lockedOut}
                  onClick={() => {
                    if (filled || already || lockedOut) return;
                    setExpandedRole(open ? null : role.roleKey);
                    setBidAmount(String(role.budgetAmount || ''));
                    setDelivery('');
                    setMessage('');
                  }}
                >
                  <div>
                    <strong>{role.name}</strong>
                    <span>{role.description || 'No description'}</span>
                  </div>
                  <div className="multi-apply__role-meta">
                    <em>{fmt(role.budgetAmount)}</em>
                    <small>{role.budgetPercent}% of budget</small>
                    <span className={`multi-apply__pill ${filled || already || lockedOut ? 'is-done' : 'is-open'}`}>
                      {filled ? 'Filled' : already ? 'Bid sent' : lockedOut ? 'Locked' : 'Open'}
                    </span>
                  </div>
                </button>
                {open && (
                  <div className="multi-apply__panel">
                    <div className="multi-apply__row">
                      <label>
                        Your bid (रू)
                        <input type="number" value={bidAmount || role.budgetAmount || 0} readOnly disabled />
                      </label>
                      <label>
                        Estimated delivery
                        <input value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="e.g. 14 days" />
                      </label>
                    </div>
                    <label>
                      Message to the organization
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Relevant experience for this role…" />
                    </label>
                    <button type="button" className="multi-apply__submit" disabled={busy} onClick={() => submitRoleBid(role)}>
                      {busy ? 'Submitting…' : 'Submit bid for this role'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mode === 'squad' && allowSquad && (
        <div className="multi-apply__squad">
          <div className="multi-apply__banner">
            Squads need at least 2 members. Every invited member must accept their role before the squad bid can be submitted to the employer. You can cover only some of the open roles — the employer may fill the rest from role-based bids.
          </div>

          {squad ? (
            <div className="multi-apply__squad-status">
              <h4>{squad.name}</h4>
              <p>Status: <strong>{squad.status}</strong> · Combined {fmt(squad.combinedAmount)}</p>
              <ul>
                {(squad.members || []).map((m) => (
                  <li key={`${m.freelancerId}-${m.roleKey}`}>
                    {m.freelancer?.firstName || 'Member'} - {m.roleName} · {fmt(m.splitAmount)} · {m.inviteStatus}
                  </li>
                ))}
              </ul>
              {squad.status === 'forming' && (
                <button
                  type="button"
                  className="multi-apply__submit"
                  disabled={busy || !squad.canSubmit}
                  onClick={submitExistingSquad}
                >
                  {squad.canSubmit
                    ? (busy ? 'Submitting…' : 'Submit squad bid')
                    : `Waiting on ${squad.pendingInvites} invite(s)`}
                </button>
              )}
              {squad.status === 'submitted' && (
                <p className="multi-apply__ok">✓ Squad bid submitted - you’ll be notified if selected</p>
              )}
              {squad.status && !['forming', 'submitted'].includes(squad.status) && (
                <p className="multi-apply__ok">Squad status: {squad.status}</p>
              )}
            </div>
          ) : locked ? (
            <p className="multi-apply__ok">You already have a bid on this project, so a new squad cannot be created.</p>
          ) : (
            <>
              <label>
                Squad name
                <input value={squadName} onChange={(e) => setSquadName(e.target.value)} placeholder="e.g. Valley Builders" />
              </label>
              <label>
                Your role (from employer’s work division)
                <select value={myRoleKey} onChange={(e) => setMyRoleKey(e.target.value)}>
                  {openRoles.map((r) => (
                    <option key={r.roleKey} value={r.roleKey}>{r.name} · {fmt(r.budgetAmount)}</option>
                  ))}
                </select>
              </label>

              <div className="multi-apply__members">
                <div className="multi-apply__member">
                  <div>
                    <strong>You</strong>
                    <span>{(job.roles || []).find((r) => r.roleKey === myRoleKey)?.name}</span>
                  </div>
                  <em>{fmt((job.roles || []).find((r) => r.roleKey === myRoleKey)?.budgetAmount)}</em>
                  <span className="multi-apply__pill is-you">You</span>
                </div>
                {slots.map((s) => (
                  <div key={s.freelancerId} className="multi-apply__member">
                    <div>
                      <strong>{s.name}</strong>
                      <span>{s.roleName}</span>
                    </div>
                    <em>{fmt(s.splitAmount)}</em>
                    <button
                      type="button"
                      className="multi-apply__remove"
                      onClick={() => setSlots((prev) => prev.filter((x) => x.freelancerId !== s.freelancerId))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="multi-apply__invite">
                <select value={inviteRoleKey} onChange={(e) => setInviteRoleKey(e.target.value)}>
                  <option value="">Role for invitee…</option>
                  {openRoles
                    .filter((r) => r.roleKey !== myRoleKey && !slots.some((s) => s.roleKey === r.roleKey))
                    .map((r) => (
                      <option key={r.roleKey} value={r.roleKey}>{r.name}</option>
                    ))}
                </select>
                <input
                  value={inviteQuery}
                  onChange={(e) => setInviteQuery(e.target.value)}
                  placeholder="Invite by name, email, or freelancer ID…"
                />
              </div>
              {searchHits.length > 0 && (
                <ul className="multi-apply__hits">
                  {searchHits.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => addInvite(f)}>
                        {f.name} · {f.freelancerId || f.email}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <label>
                Note to organization (optional)
                <textarea value={squadMessage} onChange={(e) => setSquadMessage(e.target.value)} rows={2} />
              </label>

              <div className="multi-apply__sum">Combined bid: {fmt(combined)}</div>
              <button
                type="button"
                className="multi-apply__submit"
                disabled={busy || slots.length < 1}
                onClick={createAndMaybeSubmitSquad}
              >
                {busy
                  ? 'Saving…'
                  : slots.length < 1
                    ? 'Invite at least 1 teammate (squad needs 2+)'
                    : 'Create squad & send invites'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

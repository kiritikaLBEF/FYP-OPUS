import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { CandidateTables } from './AdminFeatured';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';

const emptyBadge = { key: '', label: '', description: '', color: '#0071e3', active: true };

export default function AdminBadges() {
  const [badges, setBadges] = useState([]);
  const [awards, setAwards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState({});
  const [form, setForm] = useState(emptyBadge);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [b, a, c] = await Promise.all([
        api.getAdminBadges(),
        api.getAdminBadgeAwards(),
        api.getAdminBadgeCandidates(),
      ]);
      setBadges(b.badges || []);
      setAwards(a.awards || []);
      setCategories(c.categories || []);
      setTables(c.tables || {});
    } catch (err) {
      setError(err.message || 'Failed to load badges');
    }
  };

  useEffect(() => { load(); }, []);

  const saveBadge = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.saveAdminBadge(form);
      setForm(emptyBadge);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to save badge');
    } finally {
      setSaving(false);
    }
  };

  const award = async (candidate, category, badgeId) => {
    setBusyId(candidate.id);
    setError('');
    try {
      await api.awardAdminBadge({ userId: candidate.id, badgeId, candidateCategory: category });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to award badge');
    } finally {
      setBusyId('');
    }
  };

  const revoke = async (awardId) => {
    try {
      await api.revokeAdminBadge(awardId);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to revoke badge');
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Badges</h1>
          <p className="admin-page-subtitle">
            The system lists who qualifies. You choose the badge. No badges appear on the homepage until you award them to featured talent.
          </p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel__head">Badge types</div>
          <div className="admin-panel__body admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Badge</th>
                  <th>Key</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {badges.length === 0 ? (
                  <tr><td colSpan={3} className="admin-muted">No badges yet.</td></tr>
                ) : badges.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="admin-badge" style={{ background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}55` }}>
                        {b.label}
                      </span>
                    </td>
                    <td className="admin-mono">{b.key}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => setForm({ key: b.key, label: b.label, description: b.description, color: b.color, active: b.active })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__head">{form.key ? `Edit ${form.key}` : 'New badge type'}</div>
          <form className="admin-mgmt-form" onSubmit={saveBadge}>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="b-key">Key</label>
              <input id="b-key" className="admin-input" value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} required />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="b-label">Label</label>
              <input id="b-label" className="admin-input" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="b-desc">Description</label>
              <input id="b-desc" className="admin-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="b-color">Color</label>
              <input id="b-color" className="admin-input" type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
            </div>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save badge'}</button>
          </form>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel__head">Awarded ({awards.length})</div>
        <div className="admin-panel__body admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Freelancer</th>
                <th>Badge</th>
                <th>From filter</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {awards.length === 0 ? (
                <tr><td colSpan={4} className="admin-muted admin-table__empty">No badges awarded yet.</td></tr>
              ) : awards.map((row) => (
                <tr key={row.id}>
                  <td>{row.user?.firstName} {row.user?.lastName}</td>
                  <td>{row.badge?.label}</td>
                  <td>{row.candidateCategory}</td>
                  <td>
                    <button type="button" className="admin-btn admin-btn--danger" onClick={() => revoke(row.id)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CandidateTables
        categories={categories}
        tables={tables}
        badges={badges}
        onAward={award}
        busyId={busyId}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { api, getProfileUrl } from '../../services/api';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';

function avatarSrc(user) {
  if (user?.profilePicture) return getProfileUrl(user.profilePicture);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'opus'}`;
}

function CandidateTables({ categories, tables, badges, onFeature, onAward, busyId }) {
  return (
    <div className="admin-form-stack" style={{ padding: 0, gap: 20 }}>
      {(categories || []).map((cat) => {
        const rows = tables?.[cat.key] || [];
        return (
          <div className="admin-panel" key={cat.key}>
            <div className="admin-panel__head">{cat.label} <span className="admin-muted">· system filter, top 5</span></div>
            <div className="admin-panel__body admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Freelancer</th>
                    <th>{cat.metric}</th>
                    <th className="admin-table__actions-col">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={3} className="admin-muted admin-table__empty">No one matches this filter yet.</td></tr>
                  ) : rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <img src={avatarSrc(c)} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                          <div>
                            <div>{c.firstName} {c.lastName}</div>
                            <div className="admin-muted" style={{ fontSize: 12 }}>{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{c.metricLabel}</td>
                      <td className="admin-table__actions-col">
                        {onFeature && (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            disabled={busyId === c.id || c.isFeatured}
                            onClick={() => onFeature(c, cat.key)}
                          >
                            {c.isFeatured ? 'Featured' : 'Feature'}
                          </button>
                        )}
                        {onAward && badges?.length > 0 && (
                          <select
                            className="admin-select"
                            defaultValue=""
                            disabled={busyId === c.id}
                            onChange={(e) => {
                              const badgeId = e.target.value;
                              e.target.value = '';
                              if (badgeId) onAward(c, cat.key, badgeId);
                            }}
                          >
                            <option value="">Award badge…</option>
                            {badges.filter((b) => b.active).map((b) => (
                              <option key={b.id} value={b.id}>{b.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminFeatured() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState({});
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [feat, cands] = await Promise.all([
        api.getAdminFeatured(),
        api.getAdminBadgeCandidates(),
      ]);
      setFeatured(feat.featured || []);
      setCategories(cands.categories || []);
      const next = { ...(cands.tables || {}) };
      const featuredIds = new Set((feat.featured || []).map((f) => f.user?.id));
      Object.keys(next).forEach((key) => {
        next[key] = (next[key] || []).map((c) => ({ ...c, isFeatured: featuredIds.has(c.id) }));
      });
      setTables(next);
    } catch (err) {
      setError(err.message || 'Failed to load featured talent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const feature = async (candidate, category) => {
    setBusyId(candidate.id);
    setError('');
    try {
      await api.addAdminFeatured({ userId: candidate.id, candidateCategory: category });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to feature freelancer');
    } finally {
      setBusyId('');
    }
  };

  const unfeature = async (row) => {
    try {
      await api.removeAdminFeatured(row.id);
      await load();
    } catch (err) {
      setError(err.message || 'Failed to remove');
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Top performers</h1>
          <p className="admin-page-subtitle">
            The system ranks candidates. You choose who appears on the homepage. The section stays blank until you feature someone.
          </p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}
      {loading && <p className="admin-muted">Loading…</p>}

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="admin-panel__head">On homepage ({featured.length})</div>
        <div className="admin-panel__body admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Freelancer</th>
                <th>From filter</th>
                <th className="admin-table__actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {featured.length === 0 ? (
                <tr><td colSpan={3} className="admin-muted admin-table__empty">Nobody featured yet.</td></tr>
              ) : featured.map((row) => (
                <tr key={row.id}>
                  <td>{row.user?.firstName} {row.user?.lastName}</td>
                  <td>{row.candidateCategory}</td>
                  <td className="admin-table__actions-col">
                    <button type="button" className="admin-btn admin-btn--danger" onClick={() => unfeature(row)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CandidateTables categories={categories} tables={tables} onFeature={feature} busyId={busyId} />
    </>
  );
}

export { CandidateTables, avatarSrc };

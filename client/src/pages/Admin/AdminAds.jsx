import { useEffect, useMemo, useState } from 'react';
import { api, getProfileUrl } from '../../services/api';
import AdSlide, { AD_ANIMATION_OPTIONS } from '../../components/AdSlide/AdSlide';
import '../../components/AdSlide/AdSlide.css';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';
import './AdminAds.css';

const MAX_AD_IMAGE_MB = 15;
const MAX_AD_IMAGE_BYTES = MAX_AD_IMAGE_MB * 1024 * 1024;

const emptyForm = {
  title: '',
  subtitle: '',
  organizationName: '',
  ctaLabel: 'Learn more',
  ctaUrl: '',
  animation: 'fade',
  sortOrder: 0,
  active: true,
};

export default function AdminAds() {
  const [ads, setAds] = useState([]);
  const [maxLive, setMaxLive] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [replayTick, setReplayTick] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminAds();
      setAds(data.ads || []);
      if (data.maxLive) setMaxLive(data.maxLive);
    } catch (err) {
      setError(err.message || 'Failed to load advertisements');
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filePreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
  }, [filePreviewUrl]);

  const editingAd = ads.find((ad) => ad.id === editingId);
  const previewSrc = filePreviewUrl
    || (editingAd?.imagePath ? getProfileUrl(editingAd.imagePath) : '');
  const liveCount = ads.filter((ad) => ad.active && ad.id !== editingId).length;
  const liveFull = liveCount >= maxLive;
  const canGoLive = !liveFull || !!editingAd?.active;

  const clearForm = () => {
    setForm(emptyForm);
    setEditingId('');
    setFile(null);
    setReplayTick(0);
  };

  const editAd = (ad) => {
    setEditingId(ad.id);
    setForm({
      title: ad.title || '',
      subtitle: ad.subtitle || '',
      organizationName: ad.organizationName || '',
      ctaLabel: ad.ctaLabel || 'Learn more',
      ctaUrl: ad.ctaUrl || '',
      animation: ad.animation || 'fade',
      sortOrder: ad.sortOrder || 0,
      active: ad.active !== false,
    });
    setFile(null);
    setReplayTick((n) => n + 1);
  };

  const buildFormData = () => {
    const fd = new FormData();
    const payload = { ...form, active: !!(form.active && canGoLive) };
    Object.entries(payload).forEach(([k, v]) => fd.append(k, String(v)));
    if (file) fd.append('image', file);
    return fd;
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (file && file.size > MAX_AD_IMAGE_BYTES) {
        throw new Error(`Image is too large. Use a file under ${MAX_AD_IMAGE_MB} MB.`);
      }
      if (editingId) await api.updateAdminAd(editingId, buildFormData());
      else await api.createAdminAd(buildFormData());
      await load();
      clearForm();
    } catch (err) {
      setError(err.message || 'Failed to save advertisement');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ad) => {
    if (!window.confirm(`Remove "${ad.title}" from the homepage slider?`)) return;
    try {
      await api.deleteAdminAd(ad.id);
      await load();
      if (editingId === ad.id) clearForm();
    } catch (err) {
      setError(err.message || 'Failed to delete advertisement');
    }
  };

  const animationLabel = (value) =>
    AD_ANIMATION_OPTIONS.find((opt) => opt.value === value)?.label || 'Fade in';

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Homepage ads</h1>
          <p className="admin-page-subtitle">
            Up to {maxLive} live banners rotate in the homepage carousel. Add each one separately.
          </p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-grid-2">
        <div className="admin-panel">
          <div className="admin-panel__head">Slides ({ads.length}) · Live {ads.filter((a) => a.active).length}/{maxLive}</div>
          <div className="admin-panel__body admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Organization</th>
                  <th>Motion</th>
                  <th>Status</th>
                  <th className="admin-table__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="admin-muted">Loading…</td></tr>
                ) : ads.length === 0 ? (
                  <tr><td colSpan={5} className="admin-muted admin-table__empty">No ads yet. The homepage slider stays empty.</td></tr>
                ) : ads.map((ad) => (
                  <tr key={ad.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {ad.imagePath ? (
                          <img src={getProfileUrl(ad.imagePath)} alt="" style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 6 }} />
                        ) : null}
                        <span>{ad.title}</span>
                      </div>
                    </td>
                    <td>{ad.organizationName || '-'}</td>
                    <td>{animationLabel(ad.animation)}</td>
                    <td>
                      <span className={`admin-badge ${ad.active ? 'admin-badge--success' : 'admin-badge--neutral'}`}>
                        {ad.active ? 'Live' : 'Off'}
                      </span>
                    </td>
                    <td className="admin-table__actions-col">
                      <button type="button" className="admin-btn admin-btn--ghost" onClick={() => editAd(ad)}>Edit</button>
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => remove(ad)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__head">{editingId ? 'Edit slide' : 'New slide'}</div>
          <form className="admin-mgmt-form" onSubmit={save}>
            <div className="admin-ad-preview">
              <div className="admin-ad-preview__bar">
                <span className="admin-mgmt-form__label">Homepage preview</span>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setReplayTick((n) => n + 1)}
                >
                  Replay motion
                </button>
              </div>
              <AdSlide
                key={`${form.animation}-${previewSrc}-${replayTick}`}
                ad={form}
                imageSrc={previewSrc}
                animation={form.animation}
                preview
              />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="ad-title">Title</label>
              <input id="ad-title" className="admin-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="ad-sub">Subtitle</label>
              <input id="ad-sub" className="admin-input" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="ad-org">Organization</label>
              <input id="ad-org" className="admin-input" value={form.organizationName} onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))} />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="ad-anim">Banner animation</label>
              <select
                id="ad-anim"
                className="admin-select"
                value={form.animation}
                onChange={(e) => {
                  setForm((f) => ({ ...f, animation: e.target.value }));
                  setReplayTick((n) => n + 1);
                }}
              >
                {AD_ANIMATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="admin-ad-preview__hint">
                {AD_ANIMATION_OPTIONS.find((opt) => opt.value === form.animation)?.hint}
              </p>
            </div>
            <div className="admin-mgmt-form__row">
              <div className="admin-mgmt-form__field">
                <label className="admin-mgmt-form__label" htmlFor="ad-cta">Button label</label>
                <input id="ad-cta" className="admin-input" value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))} />
              </div>
              <div className="admin-mgmt-form__field">
                <label className="admin-mgmt-form__label" htmlFor="ad-url">Link URL</label>
                <input id="ad-url" className="admin-input" value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} placeholder="https://…" />
              </div>
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="ad-image">Image</label>
              <input
                id="ad-image"
                className="admin-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const next = e.target.files?.[0] || null;
                  if (next && next.size > MAX_AD_IMAGE_BYTES) {
                    setError(`Image is too large. Use a file under ${MAX_AD_IMAGE_MB} MB.`);
                    e.target.value = '';
                    setFile(null);
                    return;
                  }
                  setError('');
                  setFile(next);
                }}
              />
              <p className="admin-ad-preview__hint">JPG, PNG, or WebP. Max {MAX_AD_IMAGE_MB} MB.</p>
            </div>
            <div className="admin-mgmt-form__row">
              <div className="admin-mgmt-form__field">
                <label className="admin-mgmt-form__label" htmlFor="ad-order">Sort order</label>
                <input id="ad-order" className="admin-input" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
              </div>
              <label className="admin-mgmt-form__label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
                <input
                  type="checkbox"
                  checked={form.active && canGoLive}
                  disabled={!canGoLive && !form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Show on homepage
              </label>
            </div>
            {liveFull && !editingAd?.active && (
              <p className="admin-ad-preview__hint">
                {maxLive} banners are already live. Turn one off to add another to the carousel.
              </p>
            )}
            <div className="admin-mgmt-form__row">
              <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save slide'}</button>
              {editingId && <button type="button" className="admin-btn admin-btn--secondary" onClick={clearForm}>Cancel</button>}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

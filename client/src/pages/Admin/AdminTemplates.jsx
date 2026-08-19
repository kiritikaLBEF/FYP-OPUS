import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';

export default function AdminTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ key: '', label: '', subject: '', body: '', category: 'General' });
  const [categories, setCategories] = useState(['General']);
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminTemplates();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.message || 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    api.getAdminMeta().then((m) => setCategories(m.templateCategories || ['General'])).catch(() => {});
  }, []);

  const editTemplate = (t) => {
    setForm({ key: t.key, label: t.label, subject: t.subject, body: t.body, category: t.category || 'General' });
  };

  const clearForm = () => {
    setForm({ key: '', label: '', subject: '', body: '', category: 'General' });
  };

  const saveTemplate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.saveAdminTemplate(form);
      await loadTemplates();
      clearForm();
    } catch (err) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Email Templates</h1>
          <p className="admin-page-subtitle">Nudge and notification templates for platform outreach</p>
        </div>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-grid-2">
        <div className="admin-panel">
          <div className="admin-panel__head">Templates ({templates.length})</div>
          <div className="admin-panel__body admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Category</th>
                  <th className="admin-table__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="admin-muted">Loading…</td></tr>
                ) : templates.length === 0 ? (
                  <tr><td colSpan={4} className="admin-muted admin-table__empty">No templates yet.</td></tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t._id || t.key}>
                      <td className="admin-mono">{t.key}</td>
                      <td>{t.label}</td>
                      <td><span className="admin-badge admin-badge--neutral">{t.category || 'General'}</span></td>
                      <td className="admin-table__actions-col">
                        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => editTemplate(t)}>Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__head">{form.key ? `Edit: ${form.key}` : 'New template'}</div>
          <form className="admin-mgmt-form" onSubmit={saveTemplate}>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="tpl-key">Key</label>
              <input
                id="tpl-key"
                className="admin-input"
                placeholder="e.g. profile_nudge"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                required
              />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="tpl-label">Label</label>
              <input
                id="tpl-label"
                className="admin-input"
                placeholder="Display name for admins"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="tpl-category">Category</label>
              <select
                id="tpl-category"
                className="admin-select"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="tpl-subject">Email subject</label>
              <input
                id="tpl-subject"
                className="admin-input"
                placeholder="Subject line recipients will see"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="tpl-body">Email body</label>
              <textarea
                id="tpl-body"
                className="admin-textarea"
                placeholder="Message body. Use {{first_name}}, {{organization_name}}, etc."
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                required
                rows={6}
              />
            </div>
            <div className="admin-form-actions">
              {form.key && (
                <button type="button" className="admin-btn admin-btn--secondary" onClick={clearForm}>
                  Clear
                </button>
              )}
              <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

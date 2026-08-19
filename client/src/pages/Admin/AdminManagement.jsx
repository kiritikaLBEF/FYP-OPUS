import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import AdminModal from '../../components/admin/AdminModal';
import { userName } from './adminHelpers';
import '../../components/Layout/admin-tokens.css';
import '../../components/Layout/AdminLayout.css';
import '../../components/admin/AdminModal.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  adminTier: 'admin',
};

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadAdmins = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminAdmins();
      setAdmins(data.admins || []);
    } catch (err) {
      setError(err.message || 'Failed to load admins');
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const createAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.createAdminAccount(form);
      setForm(EMPTY_FORM);
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'Failed to create admin');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (admin) => {
    setEditAdmin(admin);
    setEditForm({
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      email: admin.email || '',
      password: '',
      adminTier: admin.adminTier === 'super_admin' ? 'super_admin' : 'admin',
    });
    setError('');
  };

  const saveEdit = async () => {
    if (!editAdmin) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        adminTier: editForm.adminTier,
      };
      if (editForm.password.trim()) body.password = editForm.password.trim();
      await api.updateAdminAccount(editAdmin.id, body);
      setEditAdmin(null);
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'Failed to update admin');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (admin) => {
    const label = userName(admin);
    if (!window.confirm(`Deactivate admin account for ${label}? They will lose access immediately.`)) return;
    setBusyId(admin.id);
    setError('');
    try {
      await api.deactivateAdminAccount(admin.id);
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'Failed to deactivate admin');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Admin Management</h1>
          <p className="admin-page-subtitle">Create and manage admin accounts (Super Admin only)</p>
        </div>
      </header>

      {error && !editAdmin && <p className="admin-error">{error}</p>}

      <div className="admin-grid-2">
        <div className="admin-panel">
          <div className="admin-panel__head">Admin accounts</div>
          <div className="admin-panel__body admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Tier</th>
                  <th>Status</th>
                  <th className="admin-table__actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="admin-muted">Loading…</td></tr>
                ) : admins.length === 0 ? (
                  <tr><td colSpan={5} className="admin-muted admin-table__empty">No admin accounts found.</td></tr>
                ) : (
                  admins.map((a) => (
                    <tr key={a.id}>
                      <td>{userName(a)}</td>
                      <td>{a.email}</td>
                      <td>{a.adminTier === 'super_admin' ? 'Super Admin' : 'Admin'}</td>
                      <td>
                        <span className={`admin-badge ${a.accountStatus === 'active' ? 'admin-badge--active' : 'admin-badge--suspended'}`}>
                          {a.accountStatus}
                        </span>
                      </td>
                      <td className="admin-table__actions-col">
                        <div className="admin-quick-actions admin-quick-actions--compact">
                          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openEdit(a)}>
                            Edit
                          </button>
                          {!a.cannotDelete && a.accountStatus === 'active' && (
                            <button
                              type="button"
                              className="admin-btn admin-btn--danger"
                              disabled={busyId === a.id}
                              onClick={() => deactivate(a)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__head">Create admin</div>
          <form className="admin-mgmt-form" onSubmit={createAdmin}>
            <div className="admin-mgmt-form__row">
              <div className="admin-mgmt-form__field">
                <label className="admin-mgmt-form__label" htmlFor="create-first">First name</label>
                <input
                  id="create-first"
                  className="admin-input"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="admin-mgmt-form__field">
                <label className="admin-mgmt-form__label" htmlFor="create-last">Last name</label>
                <input
                  id="create-last"
                  className="admin-input"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="create-email">Email</label>
              <input
                id="create-email"
                className="admin-input"
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="create-password">Password</label>
              <input
                id="create-password"
                className="admin-input"
                type="password"
                placeholder="Strong password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div className="admin-mgmt-form__field">
              <label className="admin-mgmt-form__label" htmlFor="create-tier">Tier</label>
              <select
                id="create-tier"
                className="admin-select"
                value={form.adminTier}
                onChange={(e) => setForm((f) => ({ ...f, adminTier: e.target.value }))}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={creating}>
              {creating ? 'Creating…' : 'Create admin'}
            </button>
          </form>
        </div>
      </div>

      {editAdmin && (
        <AdminModal
          open
          title="Edit admin"
          subtitle={userName(editAdmin)}
          onClose={() => setEditAdmin(null)}
          footer={(
            <>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setEditAdmin(null)}>Cancel</button>
              <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={saveEdit}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        >
          {error && <p className="admin-error">{error}</p>}
          <div className="adm-modal-form">
            <div className="adm-modal-form__field">
              <label className="adm-modal-form__label" htmlFor="edit-first">First name</label>
              <input
                id="edit-first"
                className="admin-input"
                value={editForm.firstName}
                onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="adm-modal-form__field">
              <label className="adm-modal-form__label" htmlFor="edit-last">Last name</label>
              <input
                id="edit-last"
                className="admin-input"
                value={editForm.lastName}
                onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div className="adm-modal-form__field">
              <label className="adm-modal-form__label" htmlFor="edit-email">Email</label>
              <input
                id="edit-email"
                className="admin-input"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="adm-modal-form__field">
              <label className="adm-modal-form__label" htmlFor="edit-password">New password (optional)</label>
              <input
                id="edit-password"
                className="admin-input"
                type="password"
                placeholder="Leave blank to keep current"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            {!editAdmin.cannotDelete && (
              <div className="adm-modal-form__field">
                <label className="adm-modal-form__label" htmlFor="edit-tier">Tier</label>
                <select
                  id="edit-tier"
                  className="admin-select"
                  value={editForm.adminTier}
                  onChange={(e) => setEditForm((f) => ({ ...f, adminTier: e.target.value }))}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            )}
          </div>
        </AdminModal>
      )}
    </>
  );
}

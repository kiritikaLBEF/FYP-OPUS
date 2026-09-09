import {
  ADMIN_PRIVILEGES,
  DEFAULT_ADMIN_PRIVILEGES,
  countAdminPrivileges,
  privilegeLabel,
} from '../../utils/adminPrivileges';

export default function AdminPrivilegesEditor({ value, onChange, disabled = false }) {
  const privileges = value || DEFAULT_ADMIN_PRIVILEGES;

  const toggle = (key) => {
    if (disabled) return;
    onChange({ ...privileges, [key]: !privileges[key] });
  };

  return (
    <div className="admin-mgmt-privileges">
      <div className="admin-mgmt-privileges__head">
        <span className="admin-mgmt-privileges__title">Privileges</span>
        <span className="admin-muted admin-mgmt-privileges__count">
          {countAdminPrivileges(privileges)} of {ADMIN_PRIVILEGES.length} enabled
        </span>
      </div>
      <p className="admin-muted admin-mgmt-privileges__hint">
        Choose which admin sections this user can access. Email Templates, Analytics, and Admin Management remain Super Admin only.
      </p>
      <div className="admin-mgmt-privileges__grid">
        {ADMIN_PRIVILEGES.map(({ key, label }) => (
          <label key={key} className="admin-mgmt-privileges__item">
            <input
              type="checkbox"
              checked={!!privileges[key]}
              disabled={disabled}
              onChange={() => toggle(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function AdminPrivilegesSummary({ privileges }) {
  const enabled = ADMIN_PRIVILEGES.filter(({ key }) => privileges?.[key]);
  if (enabled.length === 0) return <span className="admin-muted">No privileges</span>;
  return (
    <span className="admin-mgmt-privileges__summary" title={enabled.map(({ label }) => label).join(', ')}>
      {enabled.length} enabled
    </span>
  );
}

export { privilegeLabel, countAdminPrivileges };

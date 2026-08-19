export function SettingsGroup({ title, description, children }) {
  return (
    <section className="ep-group">
      {(title || description) && (
        <header className="ep-group__head">
          {title && <h3 className="ep-group__title">{title}</h3>}
          {description && <p className="ep-group__desc">{description}</p>}
        </header>
      )}
      <div className="ep-group__cards">{children}</div>
    </section>
  );
}

export function SettingsCard({ children, className = '' }) {
  return <div className={`ep-settings-card ${className}`.trim()}>{children}</div>;
}

export function SettingsRow({ label, hint, badge, children, className = '' }) {
  return (
    <div className={`ep-settings-row ${className}`.trim()}>
      <div className="ep-settings-row__label">
        <span className="ep-settings-row__name">
          {label}
          {badge && <span className="ep-badge">{badge}</span>}
        </span>
        {hint && <span className="ep-settings-row__hint">{hint}</span>}
      </div>
      <div className="ep-settings-row__control">{children}</div>
    </div>
  );
}

export function SettingsInput({
  value, onChange, type = 'text', placeholder, disabled, readOnly, id, maxLength,
}) {
  return (
    <input
      id={id}
      className={`ep-input ${readOnly || disabled ? 'ep-input--readonly' : ''}`}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      maxLength={maxLength}
    />
  );
}

export function SettingsSelect({ value, onChange, children, id }) {
  return (
    <select id={id} className="ep-input ep-input--select" value={value} onChange={onChange}>
      {children}
    </select>
  );
}

export function SettingsTextarea({
  value, onChange, placeholder, rows = 4, maxLength, hint,
}) {
  const count = value?.length || 0;
  return (
    <div className="ep-textarea-wrap">
      <textarea
        className="ep-input ep-input--textarea"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
      />
      <div className="ep-textarea-wrap__foot">
        {hint && <span className="ep-textarea-wrap__hint">{hint}</span>}
        {maxLength && (
          <span className={`ep-char-count ${count >= maxLength * 0.9 ? 'ep-char-count--warn' : ''}`}>
            {count}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

export function SettingsToggle({ label, hint, checked, onChange }) {
  return (
    <label className="ep-switch-row">
      <span className="ep-switch-row__text">
        <span className="ep-switch-row__label">{label}</span>
        {hint && <span className="ep-switch-row__hint">{hint}</span>}
      </span>
      <span className="ep-switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="ep-switch__track" aria-hidden="true" />
      </span>
    </label>
  );
}

export function SettingsEmpty({ icon, title, description, action }) {
  return (
    <div className="ep-empty-state">
      {icon && <div className="ep-empty-state__icon">{icon}</div>}
      {title && <p className="ep-empty-state__title">{title}</p>}
      {description && <p className="ep-empty-state__desc">{description}</p>}
      {action}
    </div>
  );
}

export function SettingsAddButton({ children, onClick }) {
  return (
    <button type="button" className="ep-add-btn" onClick={onClick}>
      <span className="ep-add-btn__icon" aria-hidden="true">+</span>
      {children}
    </button>
  );
}

export function SubSectionCard({ title, description, children }) {
  return (
    <article className="ep-subsection">
      <header className="ep-subsection__head">
        <h3 className="ep-subsection__title">{title}</h3>
        {description && <p className="ep-subsection__desc">{description}</p>}
      </header>
      <div className="ep-subsection__body">{children}</div>
    </article>
  );
}

export const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const TIMEZONE_OPTIONS = [
  { value: '', label: 'Select timezone' },
  { value: 'Asia/Kathmandu', label: 'Nepal (NPT)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (BST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
  { value: 'Europe/London', label: 'UK (GMT)' },
];

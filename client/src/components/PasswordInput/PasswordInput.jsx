import { useState } from 'react';
import { IconEye, IconEyeOff } from '../icons/Icons';
import './PasswordInput.css';

export default function PasswordInput({ id, label, value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <label htmlFor={id} className="password-input__label">
        {label}
      </label>
      <div className="password-input__wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="password-input__field"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-input__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      </div>
    </div>
  );
}

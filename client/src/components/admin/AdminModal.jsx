import { useEffect } from 'react';
import { IconClose } from '../icons/Icons';
import './AdminModal.css';

export default function AdminModal({ open, title, subtitle, onClose, children, wide = false, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="adm-modal" role="dialog" aria-modal="true">
      <div className="adm-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`adm-modal__panel ${wide ? 'adm-modal__panel--wide' : ''}`}>
        <header className="adm-modal__header">
          <div>
            <h2 className="adm-modal__title">{title}</h2>
            {subtitle && <p className="adm-modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="adm-modal__close" onClick={onClose} aria-label="Close">
            <IconClose size={16} />
          </button>
        </header>
        <div className="adm-modal__body">{children}</div>
        {footer && <footer className="adm-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

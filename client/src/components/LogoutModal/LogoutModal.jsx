import { useAuthModal } from '../../context/AuthModalContext';
import { useAuth } from '../../context/AuthContext';
import { IconClose } from '../icons/Icons';
import './LogoutModal.css';

export default function LogoutModal() {
  const { modal, closeModal } = useAuthModal();
  const { logout } = useAuth();

  if (modal !== 'logout') return null;

  const confirm = () => {
    logout();
    closeModal();
  };

  return (
    <div className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
      <div className="logout-modal__backdrop" onClick={closeModal} aria-hidden="true" />
      <div className="logout-modal__panel">
        <button type="button" className="logout-modal__close" onClick={closeModal} aria-label="Close">
          <IconClose size={16} />
        </button>
        <h2 id="logout-title" className="logout-modal__title">Log out?</h2>
        <p className="logout-modal__text">You will need to sign in again to use OPUS.</p>
        <div className="logout-modal__actions">
          <button type="button" className="opus-btn opus-btn--secondary" onClick={closeModal}>Cancel</button>
          <button type="button" className="opus-btn logout-modal__confirm" onClick={confirm}>Log out</button>
        </div>
      </div>
    </div>
  );
}

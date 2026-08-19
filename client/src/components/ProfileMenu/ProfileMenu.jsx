import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPostLoginPath } from '../../utils/postLoginPath';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import './ProfileMenu.css';

export default function ProfileMenu() {
  const { user, profileUrl } = useAuth();
  const { openLogoutConfirm } = useAuthModal();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  return (
    <div className="profile-menu" ref={ref}>
      <button
        type="button"
        className="profile-menu__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <img src={profileUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" className="profile-menu__avatar" />
        <span className="profile-menu__greeting">Hello, {user.firstName}</span>
        <svg className={`profile-menu__chevron ${open ? 'profile-menu__chevron--open' : ''}`} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="profile-menu__dropdown" role="menu">
          <div className="profile-menu__header">
            <img src={profileUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" />
            <div className="profile-menu__meta">
              <p className="profile-menu__name">{user.firstName} {user.lastName}</p>
              <p className="profile-menu__email" title={user.email}>{user.email}</p>
            </div>
          </div>
          {user.role === 'freelancer' ? (
            <>
              <p className="profile-menu__group">Freelancer profile</p>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/dashboard'); }}>
                Dashboard
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/wallet'); }}>
                Wallet
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/messages'); }}>
                Messages
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/find-jobs'); }}>
                Find work
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/profile/edit'); }}>
                Edit profile
              </button>
            </>
          ) : (
            <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate(getPostLoginPath(user)); }}>
              Dashboard
            </button>
          )}
          <div className="profile-menu__sep" />
          <button type="button" className="profile-menu__item profile-menu__item--danger" role="menuitem" onClick={() => { setOpen(false); openLogoutConfirm(); }}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

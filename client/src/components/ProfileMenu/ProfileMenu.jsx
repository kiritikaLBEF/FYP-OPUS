import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPostLoginPath } from '../../utils/postLoginPath';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { api } from '../../services/api';
import './ProfileMenu.css';

const WALLET_TYPES = ['payment_confirmed', 'wallet_topup'];

export default function ProfileMenu() {
  const { user, profileUrl } = useAuth();
  const { openLogoutConfirm } = useAuthModal();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [walletUnread, setWalletUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.getUnreadNotificationCount();
        if (!cancelled) setWalletUnread(Number(data.walletUnread) || 0);
      } catch {
        if (!cancelled) setWalletUnread(0);
      }
    };
    load();
    const id = setInterval(load, 45000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  if (!user) return null;

  const walletPath = user.role === 'employer' ? '/employer/wallet' : '/wallet';
  const showWallet = user.role === 'freelancer' || user.role === 'employer';

  const openWallet = async () => {
    setOpen(false);
    if (walletUnread > 0) {
      try {
        await api.markNotificationsRead(null, WALLET_TYPES);
        setWalletUnread(0);
      } catch {
      }
    }
    navigate(walletPath);
  };

  return (
    <div className="profile-menu" ref={ref}>
      <button
        type="button"
        className="profile-menu__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="profile-menu__avatar-wrap">
          <img src={profileUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" className="profile-menu__avatar" />
          {walletUnread > 0 && <span className="profile-menu__trigger-dot" aria-hidden="true" />}
        </span>
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
              <button type="button" className="profile-menu__item" role="menuitem" onClick={openWallet}>
                <span>Wallet</span>
                {walletUnread > 0 && (
                  <span className="profile-menu__item-badge">{walletUnread > 9 ? '9+' : walletUnread}</span>
                )}
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/messages'); }}>
                Messages
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/community'); }}>
                Community
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/find-jobs'); }}>
                Find work
              </button>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/profile/edit'); }}>
                Edit profile
              </button>
            </>
          ) : (
            <>
              <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate(getPostLoginPath(user)); }}>
                Dashboard
              </button>
              {showWallet && (
                <button type="button" className="profile-menu__item" role="menuitem" onClick={openWallet}>
                  <span>Wallet</span>
                  {walletUnread > 0 && (
                    <span className="profile-menu__item-badge">{walletUnread > 9 ? '9+' : walletUnread}</span>
                  )}
                </button>
              )}
              {user.role === 'employer' && (
                <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/employer/community'); }}>
                  Community
                </button>
              )}
              {user.role === 'admin' && (
                <button type="button" className="profile-menu__item" role="menuitem" onClick={() => { setOpen(false); navigate('/admin/community'); }}>
                  Community
                </button>
              )}
            </>
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

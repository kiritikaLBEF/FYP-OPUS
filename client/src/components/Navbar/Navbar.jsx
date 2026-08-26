import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { useAuth } from '../../context/AuthContext';
import { IconSun, IconMoon, IconSignIn, IconPersonAdd, IconMenu, IconClose } from '../icons/Icons';
import ProfileMenu from '../ProfileMenu/ProfileMenu';
import NotificationBell from './NotificationBell';
import { useMessaging } from '../../features/messaging/MessagingProvider';
import { api } from '../../services/api';
import './Navbar.css';

const NAV_LINKS = [
  { label: 'Home', to: '/', hash: '' },
  { label: 'Find work', to: '/find-jobs', hash: '' },
  { label: 'Community', to: '/community', hash: '', auth: true },
  { label: 'Browse', to: '/', hash: 'categories' },
  { label: 'How it works', to: '/', hash: 'how-it-works' },
];

function scrollToHomeTarget(hash) {
  if (!hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const el = document.getElementById(hash);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function MessagesNavButton() {
  const { unreadTotal } = useMessaging();
  return (
    <Link
      to="/messages"
      className="navbar__theme-btn navbar__msg-btn"
      aria-label={unreadTotal > 0 ? `${unreadTotal} unread messages` : 'Messages'}
      title="Messages"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 6h14a1 1 0 011 1v9a1 1 0 01-1 1H8l-4 3V7a1 1 0 011-1z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {unreadTotal > 0 && (
        <span className="navbar__msg-badge">{unreadTotal > 9 ? '9+' : unreadTotal}</span>
      )}
    </Link>
  );
}

function CommunityNavButton() {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(async () => {
    try {
      const data = await api.getCommunityUnread();
      setUnread(data.unreadTotal || 0);
    } catch {
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener('opus:community-unread', onRefresh);
    const t = window.setInterval(refresh, 45000);
    return () => {
      window.removeEventListener('opus:community-unread', onRefresh);
      window.clearInterval(t);
    };
  }, [refresh]);

  return (
    <Link
      to="/community"
      className="navbar__theme-btn navbar__msg-btn"
      aria-label={unread > 0 ? `${unread} unread community messages` : 'Community'}
      title="Community"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8.5 10a3 3 0 116 0 3 3 0 01-6 0zM4 18c.8-2.2 2.6-3.5 5-3.5h2c2.4 0 4.2 1.3 5 3.5M15.5 9.5a2.5 2.5 0 114.2 1.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {unread > 0 && (
        <span className="navbar__msg-badge">{unread > 9 ? '9+' : unread}</span>
      )}
    </Link>
  );
}

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { openSignIn, openSignUp } = useAuthModal();
  const { isAuthenticated, isFreelancer, isEmployer, isAdmin, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.auth || (isAuthenticated && (isFreelancer || isEmployer || isAdmin)),
  );

  const goNav = (event, link) => {
    setMobileOpen(false);
    if (link.to !== '/') return;

    event.preventDefault();
    const afterArrive = () => scrollToHomeTarget(link.hash);

    if (location.pathname !== '/') {
      navigate(link.hash ? { pathname: '/', hash: `#${link.hash}` } : '/');
      window.setTimeout(afterArrive, 120);
      return;
    }

    if (link.hash) {
      navigate({ pathname: '/', hash: `#${link.hash}` }, { replace: true });
    } else if (location.hash) {
      navigate('/', { replace: true });
    }
    afterArrive();
  };

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo" aria-label="OPUS home">
          OPUS
        </Link>

        <nav className={`navbar__links ${mobileOpen ? 'navbar__links--open' : ''}`} aria-label="Main">
          {visibleLinks.map((link) => (
            <Link
              key={link.label}
              to={link.hash ? { pathname: link.to, hash: `#${link.hash}` } : link.to}
              className="navbar__link"
              onClick={(event) => goNav(event, link)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="navbar__actions">
          {!loading && isAuthenticated && (isFreelancer || isEmployer || isAdmin) && (
            <>
              {(isFreelancer || isEmployer || isAdmin) && <CommunityNavButton />}
              {isFreelancer && (
                <>
                  <MessagesNavButton />
                  <NotificationBell />
                </>
              )}
            </>
          )}

          <button type="button" className="navbar__theme-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </button>

          {!loading && (
            <>
              {isAuthenticated ? (
                <>
                  <span className="navbar__divider" aria-hidden="true" />
                  <ProfileMenu />
                </>
              ) : (
                <>
                  <span className="navbar__divider" aria-hidden="true" />
                  <button type="button" className="navbar__auth-btn" onClick={openSignIn}>
                    <IconSignIn size={16} />
                    <span>Sign In</span>
                  </button>
                  <button type="button" className="navbar__auth-btn navbar__auth-btn--primary" onClick={openSignUp}>
                    <IconPersonAdd size={16} />
                    <span className="navbar__auth-label">Sign Up</span>
                  </button>
                </>
              )}
            </>
          )}

          <button type="button" className="navbar__menu-btn" onClick={() => setMobileOpen((o) => !o)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}>
            {mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>
    </header>
  );
}

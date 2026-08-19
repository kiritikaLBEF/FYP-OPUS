import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { useAuth } from '../../context/AuthContext';
import { IconSun, IconMoon, IconSignIn, IconPersonAdd, IconMenu, IconClose } from '../icons/Icons';
import ProfileMenu from '../ProfileMenu/ProfileMenu';
import NotificationBell from './NotificationBell';
import { useMessaging } from '../../features/messaging/MessagingProvider';
import './Navbar.css';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Find work', href: '/find-jobs' },
  { label: 'Browse', href: '#categories' },
  { label: 'How it works', href: '#how-it-works' },
];

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

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { openSignIn, openSignUp } = useAuthModal();
  const { isAuthenticated, isFreelancer, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo" aria-label="OPUS home">
          OPUS
        </Link>

        <nav className={`navbar__links ${mobileOpen ? 'navbar__links--open' : ''}`} aria-label="Main">
          {NAV_LINKS.map((link) => {
            if (link.href.startsWith('/')) {
              return (
                <Link key={link.href} to={link.href} className="navbar__link" onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              );
            }
            return (
              <a key={link.href} href={link.href} className="navbar__link" onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="navbar__actions">
          {!loading && isAuthenticated && isFreelancer && (
            <>
              <MessagesNavButton />
              <NotificationBell />
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

import { NavLink, Outlet } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { api } from '../../services/api';
import { useMessaging } from '../../features/messaging/MessagingProvider';
import MessagingOverlays from '../../features/messaging/MessagingOverlays';
import MessagesFab from '../../features/messaging/MessagesFab';
import './EmployerLayout.css';

const NAV_ITEMS = [
  { to: '/employer/home', label: 'Home', icon: 'home', locked: false },
  { to: '/employer/dashboard', label: 'Dashboard', icon: 'dashboard', locked: false },
  { to: '/employer/wallet', label: 'Wallet', icon: 'wallet', locked: false },
  { to: '/employer/post-jobs', label: 'Post Jobs', icon: 'post', locked: true },
  { to: '/employer/check-status', label: 'Check Status', icon: 'status', locked: true },
  { to: '/employer/messages', label: 'Messages', icon: 'messages', locked: true },
  { to: '/employer/notifications', label: 'Notifications', icon: 'bell', locked: false },
];

function NavIcon({ name }) {
  const paths = {
    home: <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
    dashboard: <><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" /><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" /><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" /></>,
    post: <><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    status: <><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    messages: <path d="M5 6h14a1 1 0 011 1v9a1 1 0 01-1 1H8l-4 3V7a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
    bell: <><path d="M12 4a4 4 0 014 4v3l2 2H6l2-2V8a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M10 18a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    wallet: <><rect x="3" y="7" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M3 11h18" stroke="currentColor" strokeWidth="1.5" /><path d="M16 15h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    lock: <><rect x="7" y="10" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M9 10V8a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" /></>,
  };
  return (
    <svg className="emp-nav__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function EmployerLayout() {
  const { user } = useAuth();
  const { openLogoutConfirm } = useAuthModal();
  const { unreadTotal: msgUnread } = useMessaging();
  const isVerified = user?.verificationStatus === 'verified';
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await api.getUnreadNotificationCount();
      setUnread(data.unread || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 45000);
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshUnread]);

  return (
    <div className="emp-shell">
      <aside className="emp-sidebar">
        <div className="emp-sidebar__brand">
          <span className="emp-sidebar__logo">OPUS</span>
          <span className="emp-sidebar__badge">Employer</span>
        </div>

        <div className="emp-sidebar__org">
          <p className="emp-sidebar__org-name">{user?.organizationName || 'Organization'}</p>
          <p className="emp-sidebar__org-id">{user?.employerId || '-'}</p>
          {user?.verificationStatus !== 'verified' && (
            <span className="emp-sidebar__verify emp-sidebar__verify--pending">Pending verification</span>
          )}
          {user?.verificationStatus === 'verified' && (
            <span className="emp-sidebar__verify emp-sidebar__verify--ok">Verified</span>
          )}
        </div>

        <nav className="emp-nav" aria-label="Employer panel">
          {NAV_ITEMS.map((item) => {
            const locked = item.locked && !isVerified;
            const showNotifBadge = item.icon === 'bell' && unread > 0;
            const showMsgBadge = item.icon === 'messages' && msgUnread > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `emp-nav__link ${isActive ? 'emp-nav__link--active' : ''} ${locked ? 'emp-nav__link--locked' : ''}`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
                {showNotifBadge && (
                  <span className="emp-nav__badge">{unread > 9 ? '9+' : unread}</span>
                )}
                {showMsgBadge && (
                  <span className="emp-nav__badge">{msgUnread > 9 ? '9+' : msgUnread}</span>
                )}
                {locked && <NavIcon name="lock" />}
              </NavLink>
            );
          })}
        </nav>

        <button type="button" className="emp-nav__logout" onClick={openLogoutConfirm}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6H5a1 1 0 00-1 1v10a1 1 0 001 1h4M12 16l4-4-4-4M16 12H9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Logout
        </button>
      </aside>

      <main className="emp-main">
        <Outlet context={{ refreshUnreadNotifications: refreshUnread, setUnreadNotifications: setUnread }} />
      </main>

      {isVerified && <MessagesFab messagesPath="/employer/messages" />}
      <MessagingOverlays />
    </div>
  );
}

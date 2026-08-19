import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { IconBell } from '../icons/Icons';
import './NotificationBell.css';

const fmtWhen = (d) =>
  new Date(d).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function NotificationBell({ pollMs = 45000 }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

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
    const id = setInterval(refreshUnread, pollMs);
    return () => clearInterval(id);
  }, [refreshUnread, pollMs]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;

    setLoading(true);
    try {
      const data = await api.getMyNotifications();
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
      if ((data.unread || 0) > 0) {
        const marked = await api.markNotificationsRead();
        setUnread(marked.unread || 0);
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const onItemClick = (n) => {
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const badge = unread > 9 ? '9+' : String(unread);

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className={`navbar__theme-btn notif-bell__btn ${open ? 'notif-bell__btn--open' : ''}`}
        onClick={openPanel}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
      >
        <IconBell />
        {unread > 0 && <span className="notif-bell__badge">{badge}</span>}
      </button>

      {open && (
        <div className="notif-bell__panel" role="dialog" aria-label="Notifications">
          <div className="notif-bell__head">
            <strong>Notifications</strong>
            <span>{unread > 0 ? `${unread} unread` : 'All caught up'}</span>
          </div>
          <div className="notif-bell__list">
            {loading ? (
              <p className="notif-bell__empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="notif-bell__empty">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-bell__item ${!n.read ? 'notif-bell__item--unread' : ''}`}
                  onClick={() => onItemClick(n)}
                >
                  <span className="notif-bell__title">{n.title}</span>
                  <span className="notif-bell__msg">{n.message}</span>
                  <span className="notif-bell__time">{fmtWhen(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

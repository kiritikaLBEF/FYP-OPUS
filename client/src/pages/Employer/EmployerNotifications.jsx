import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../services/api';
import '../../components/Layout/EmployerLayout.css';

const fmtDate = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function EmployerNotifications() {
  const navigate = useNavigate();
  const { refreshUnreadNotifications, setUnreadNotifications } = useOutletContext() || {};
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getEmployerNotifications();
        if (cancelled) return;
        setNotifications(data.notifications || []);
        setUnread(data.unread ?? 0);

        if ((data.unread || 0) > 0) {
          const marked = await api.markNotificationsRead();
          if (cancelled) return;
          setUnread(marked.unread || 0);
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          setUnreadNotifications?.(0);
          refreshUnreadNotifications?.();
        }
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshUnreadNotifications, setUnreadNotifications]);

  const onOpen = (n) => {
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <header className="emp-page-header">
        <h1>Notifications</h1>
        <p>{unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up'}</p>
      </header>

      {loading ? (
        <div className="emp-empty">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="emp-empty">No notifications.</div>
      ) : (
        <div className="emp-notif-list">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`emp-notif ${!n.read ? 'emp-notif--unread' : ''}`}
              onClick={() => onOpen(n)}
              style={{ width: '100%', textAlign: 'left', cursor: n.link ? 'pointer' : 'default' }}
            >
              <div>
                <p className="emp-notif__title">{n.title}</p>
                <p className="emp-notif__msg">{n.message}</p>
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '6px 0 0' }}>{fmtDate(n.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

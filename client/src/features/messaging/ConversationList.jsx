import { getProfileUrl } from '../../services/api';

const fmtTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function ConversationList({
  conversations,
  activeId,
  loading,
  onSelect,
  emptyText = 'No conversations yet. Accept a bid to connect.',
}) {
  if (loading) {
    return <div className="msg-list__empty">Loading conversations…</div>;
  }

  if (!conversations.length) {
    return <div className="msg-list__empty">{emptyText}</div>;
  }

  return (
    <ul className="msg-list">
      {conversations.map((c) => {
        const avatar = c.peer?.profilePicture ? getProfileUrl(c.peer.profilePicture) : '';
        const initial = (c.peer?.name || '?').slice(0, 1).toUpperCase();
        const active = String(c.id) === String(activeId);
        return (
          <li key={c.id}>
            <button
              type="button"
              className={`msg-list__item ${active ? 'msg-list__item--active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <div className="msg-list__avatar">
                {avatar ? <img src={avatar} alt="" /> : <span>{initial}</span>}
              </div>
              <div className="msg-list__meta">
                <div className="msg-list__row">
                  <strong>{c.peer?.name || 'User'}</strong>
                  <span>{fmtTime(c.lastMessageAt)}</span>
                </div>
                <div className="msg-list__row msg-list__row--sub">
                  <p>{c.lastMessagePreview || c.jobTitle || 'Start a conversation'}</p>
                  {c.unread > 0 && <em>{c.unread > 9 ? '9+' : c.unread}</em>}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

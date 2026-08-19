import { useNavigate } from 'react-router-dom';
import { useMessaging } from './MessagingProvider';
import './messaging.css';

/** Floating entry — opens the full Messages page (dock opens only on incoming messages). */
export default function MessagesFab({ messagesPath = '/employer/messages' }) {
  const navigate = useNavigate();
  const { enabled, unreadTotal, dockIds } = useMessaging();

  if (!enabled || dockIds.length > 0) return null;

  return (
    <button
      type="button"
      className="msg-fab"
      onClick={() => navigate(messagesPath)}
      aria-label="Open messages"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 6h14a1 1 0 011 1v9a1 1 0 01-1 1H8l-4 3V7a1 1 0 011-1z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {unreadTotal > 0 && (
        <span className="msg-fab__badge">{unreadTotal > 9 ? '9+' : unreadTotal}</span>
      )}
    </button>
  );
}

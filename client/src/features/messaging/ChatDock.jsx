import { useState } from 'react';
import { useMessaging } from './MessagingProvider';
import { useAuth } from '../../context/AuthContext';
import ChatThread from './ChatThread';
import './messaging.css';

export default function ChatDock() {
  const { user } = useAuth();
  const {
    enabled,
    conversations,
    dockIds,
    messagesById,
    typingById,
    closeDock,
    sendMessage,
    deleteMessage,
    setTyping,
    startCall,
  } = useMessaging();

  const [minimized, setMinimized] = useState({});

  if (!enabled || !dockIds.length) return null;

  return (
    <div className="msg-dock" aria-label="Chat windows">
      {dockIds.map((id) => {
        const conversation = conversations.find((c) => String(c.id) === String(id));
        if (!conversation) return null;
        const isMin = !!minimized[id];
        return (
          <div key={id} className={`msg-dock__window ${isMin ? 'msg-dock__window--min' : ''}`}>
            {isMin ? (
              <button
                type="button"
                className="msg-dock__min-bar"
                onClick={() => setMinimized((m) => ({ ...m, [id]: false }))}
              >
                <span>{conversation.peer?.name || 'Chat'}</span>
                <span
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDock(id);
                  }}
                >
                  ×
                </span>
              </button>
            ) : (
              <>
                <ChatThread
                  compact
                  conversation={conversation}
                  messages={messagesById[String(id)] || []}
                  typing={!!typingById[String(id)]}
                  currentUserId={user?.id || user?._id}
                  onSend={(text, files) => sendMessage(id, text, files)}
                  onTyping={(typing) => setTyping(id, typing)}
                  onAudioCall={() => startCall(id, 'audio')}
                  onVideoCall={() => startCall(id, 'video')}
                  onDeleteMessage={(messageId, opts) => deleteMessage(id, messageId, opts)}
                  onClose={() => closeDock(id)}
                />
                <button
                  type="button"
                  className="msg-dock__minimize"
                  onClick={() => setMinimized((m) => ({ ...m, [id]: true }))}
                  aria-label="Minimize"
                >
                  -
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

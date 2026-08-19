import { useEffect, useMemo, useState } from 'react';
import { useMessaging } from './MessagingProvider';
import { useAuth } from '../../context/AuthContext';
import ConversationList from './ConversationList';
import ChatThread from './ChatThread';
import './messaging.css';

export default function MessengerPane({
  title = 'Messages',
  subtitle = 'Chat with your connected partners',
  emptyText,
  showHeader = true,
  wide = false,
}) {
  const { user } = useAuth();
  const {
    conversations,
    activeId,
    messagesById,
    typingById,
    loadingList,
    openConversation,
    sendMessage,
    deleteMessage,
    archiveConversation,
    setTyping,
    startCall,
    refreshConversations,
  } = useMessaging();

  const [tab, setTab] = useState('all'); // all | unread | archived
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft.trim()), 250);
    return () => clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    refreshConversations({
      archived: tab === 'archived',
      q: search,
    });
  }, [tab, search, refreshConversations]);

  const visible = useMemo(() => {
    if (tab === 'unread') return conversations.filter((c) => (c.unread || 0) > 0);
    return conversations;
  }, [conversations, tab]);

  const active = visible.find((c) => String(c.id) === String(activeId))
    || conversations.find((c) => String(c.id) === String(activeId))
    || null;
  const messages = active ? (messagesById[String(active.id)] || []) : [];

  return (
    <div className={`msg-shell ${wide ? 'msg-shell--wide' : ''}`}>
      {showHeader && (
        <header className="msg-shell__page-head">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
      )}
      <div className="msg-pane">
        <aside className="msg-pane__sidebar">
          <div className="msg-pane__sidebar-head">
            <span>Messages</span>
          </div>
          <div className="msg-pane__search">
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search name or message…"
              aria-label="Search messages"
            />
          </div>
          <div className="msg-pane__tabs" role="tablist">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'archived', label: 'Archived' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'is-active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <ConversationList
            conversations={visible}
            activeId={activeId}
            loading={loadingList}
            emptyText={
              tab === 'archived'
                ? 'No archived chats.'
                : tab === 'unread'
                  ? 'No unread chats.'
                  : emptyText
            }
            onSelect={(id) => openConversation(id)}
          />
        </aside>
        <section className="msg-pane__main">
          <ChatThread
            conversation={active}
            messages={messages}
            typing={!!(active && typingById[String(active.id)])}
            currentUserId={user?.id || user?._id}
            onSend={(text, files) => active && sendMessage(active.id, text, files)}
            onTyping={(typing) => active && setTyping(active.id, typing)}
            onAudioCall={() => active && startCall(active.id, 'audio')}
            onVideoCall={() => active && startCall(active.id, 'video')}
            onDeleteMessage={(messageId, opts) => active && deleteMessage(active.id, messageId, opts)}
            onArchive={async () => {
              if (!active) return;
              const shouldArchive = tab !== 'archived';
              const ok = await archiveConversation(active.id, shouldArchive);
              if (ok) {
                await refreshConversations({
                  archived: tab === 'archived',
                  q: search,
                });
              }
            }}
            archivedView={tab === 'archived'}
          />
        </section>
      </div>
    </div>
  );
}

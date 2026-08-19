import { useEffect, useRef, useState } from 'react';
import MessageComposer from './MessageComposer';
import { getProfileUrl } from '../../services/api';

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const fmtFull = (d) =>
  new Date(d).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function AttachmentBlock({ file, onMediaLoad }) {
  const url = getProfileUrl(file.filePath);
  const isImage = (file.mimeType || '').startsWith('image/');
  const isVideo = (file.mimeType || '').startsWith('video/');

  if (isImage && url) {
    return (
      <a className="msg-attach msg-attach--image" href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={file.fileName} onLoad={onMediaLoad} />
      </a>
    );
  }
  if (isVideo && url) {
    return (
      <video
        className="msg-attach msg-attach--video"
        src={url}
        controls
        preload="metadata"
        onLoadedMetadata={onMediaLoad}
      />
    );
  }
  return (
    <a className="msg-attach msg-attach--file" href={url || '#'} target="_blank" rel="noreferrer">
      📎 {file.fileName || 'Attachment'}
    </a>
  );
}

export default function ChatThread({
  conversation,
  messages = [],
  typing = false,
  currentUserId,
  onSend,
  onTyping,
  onVideoCall,
  onAudioCall,
  onClose,
  onDeleteMessage,
  onArchive,
  archivedView = false,
  compact = false,
}) {
  const bodyRef = useRef(null);
  const [menuId, setMenuId] = useState(null);
  const [infoId, setInfoId] = useState(null);
  const prevConvId = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const switched = prevConvId.current !== conversation?.id;
    prevConvId.current = conversation?.id;
    const pinToLatest = () => {
      el.scrollTop = el.scrollHeight;
    };
    if (switched) {
      pinToLatest();
      requestAnimationFrame(pinToLatest);
      return;
    }
    pinToLatest();
  }, [messages.length, typing, conversation?.id]);

  useEffect(() => {
    const close = () => {
      setMenuId(null);
      setInfoId(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  if (!conversation) {
    return (
      <div className="msg-thread msg-thread--empty">
        <p>Select a conversation to start chatting</p>
      </div>
    );
  }

  return (
    <div className={`msg-thread ${compact ? 'msg-thread--compact' : ''}`}>
      <header className="msg-thread__head">
        <div>
          <strong>{conversation.peer?.name || 'Chat'}</strong>
          <span>
            {conversation.jobTitle || 'Conversation'}
            {conversation.collaborationCount > 1 ? ` · Together ${conversation.collaborationCount}×` : ''}
            {archivedView ? ' · Archived' : ''}
          </span>
        </div>
        <div className="msg-thread__actions">
          {!archivedView && (
            <>
              <button type="button" className="msg-icon-btn" title="Audio call" onClick={onAudioCall} aria-label="Audio call">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.5 3.5l3 2.2-1.4 2.4a14 14 0 006.8 6.8l2.4-1.4 2.2 3A2 2 0 0118 20a14.5 14.5 0 01-14-14 2 2 0 012.5-2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="msg-icon-btn" title="Video call" onClick={onVideoCall} aria-label="Video call">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="7" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M15 10l5-2.5v9L15 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          {onArchive && (
            <button
              type="button"
              className={`msg-head-action ${archivedView ? 'msg-head-action--primary' : ''}`}
              title={archivedView ? 'Unarchive this chat' : 'Archive this chat'}
              onClick={onArchive}
            >
              {archivedView ? 'Unarchive' : 'Archive'}
            </button>
          )}
          {onClose && (
            <button type="button" className="msg-icon-btn" title="Close" onClick={onClose} aria-label="Close chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="msg-thread__body" ref={bodyRef}>
        <div className="msg-thread__spacer" aria-hidden="true" />
        {messages.map((m) => {
          if (m.type === 'system' || m.type === 'call_event' || m.senderRole === 'system' || m.deleted) {
            return (
              <div key={m.id} className="msg-bubble msg-bubble--system">
                {m.text}
              </div>
            );
          }
          const mine = String(m.senderId) === String(currentUserId);
          const readByOther = (m.readBy || []).some((r) => String(r.userId) !== String(currentUserId));
          return (
            <div
              key={m.id}
              className={`msg-bubble-wrap ${mine ? 'msg-bubble-wrap--mine' : ''}`}
            >
              <div className="msg-bubble-row">
                <div
                  className={`msg-bubble ${mine ? 'msg-bubble--mine' : 'msg-bubble--theirs'} ${m.pending ? 'msg-bubble--pending' : ''}`}
                >
                  {(m.attachments || []).map((a) => (
                    <AttachmentBlock
                      key={`${a.filePath}-${a.fileName}`}
                      file={a}
                      onMediaLoad={() => {
                        const el = bodyRef.current;
                        if (el) el.scrollTop = el.scrollHeight;
                      }}
                    />
                  ))}
                  {m.text ? <p>{m.text}</p> : null}
                  <time>
                    {fmtTime(m.createdAt)}
                    {mine && (
                      <span className="msg-bubble__receipt" title={readByOther ? 'Seen' : 'Sent'}>
                        {readByOther ? ' · Seen' : ' · Sent'}
                      </span>
                    )}
                  </time>
                </div>

                {onDeleteMessage && (
                  <div className="msg-bubble__more-wrap">
                    <button
                      type="button"
                      className="msg-bubble__more"
                      title="Message options"
                      aria-label="Message options"
                      aria-expanded={menuId === m.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId((id) => (id === m.id ? null : m.id));
                        setInfoId(null);
                      }}
                    >
                      ···
                    </button>
                    {menuId === m.id && (
                      <div
                        className={`msg-msg-menu ${mine ? 'msg-msg-menu--mine' : 'msg-msg-menu--theirs'}`}
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setInfoId(m.id);
                            setMenuId(null);
                          }}
                        >
                          Info
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onDeleteMessage?.(m.id, { everyone: false });
                            setMenuId(null);
                          }}
                        >
                          Delete for me
                        </button>
                        {mine && (
                          <button
                            type="button"
                            role="menuitem"
                            className="msg-msg-menu__danger"
                            onClick={() => {
                              onDeleteMessage?.(m.id, { everyone: true });
                              setMenuId(null);
                            }}
                          >
                            Delete for everyone
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {infoId === m.id && (
                <div className="msg-msg-info" onClick={(e) => e.stopPropagation()}>
                  Sent {fmtFull(m.createdAt)}
                  {mine && ` · ${readByOther ? 'Seen by peer' : 'Unread by peer'}`}
                  <button type="button" onClick={() => setInfoId(null)}>OK</button>
                </div>
              )}
            </div>
          );
        })}
        {typing && <div className="msg-typing">Typing…</div>}
      </div>

      {!archivedView && <MessageComposer onSend={onSend} onTyping={onTyping} />}
      {archivedView && (
        <div className="msg-archived-banner">
          This chat is archived.
          <button type="button" onClick={onArchive}>Unarchive to reply</button>
        </div>
      )}
    </div>
  );
}

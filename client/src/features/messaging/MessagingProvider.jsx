import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MessagingContext = createContext(null);

const makeClientMsgId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function MessagingProvider({ children }) {
  const { user, token, isAuthenticated, isEmployer, isFreelancer } = useAuth();
  const enabled = isAuthenticated && (isEmployer || isFreelancer);

  const [conversations, setConversations] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [messagesById, setMessagesById] = useState({});
  const [typingById, setTypingById] = useState({});
  const [dockIds, setDockIds] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const socketRef = useRef(null);
  const activeIdRef = useRef(null);
  const userIdRef = useRef(null);
  const dockIdsRef = useRef([]);
  const openConversationRef = useRef(async () => {});

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { userIdRef.current = user?.id || user?._id || null; }, [user]);
  useEffect(() => { dockIdsRef.current = dockIds; }, [dockIds]);

  const recomputeUnread = useCallback((list) => {
    setUnreadTotal(list.reduce((sum, c) => sum + (c.unread || 0), 0));
  }, []);

  const upsertConversation = useCallback((incoming) => {
    setConversations((prev) => {
      const id = String(incoming.id);
      const idx = prev.findIndex((c) => String(c.id) === id);
      let next;
      if (idx === -1) {
        next = [incoming, ...prev];
      } else {
        next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        next.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      }
      recomputeUnread(next);
      return next;
    });
  }, [recomputeUnread]);

  const refreshConversations = useCallback(async ({ archived = false, q = '' } = {}) => {
    if (!enabled) return;
    setLoadingList(true);
    try {
      const data = await api.getConversations({ archived, q });
      let list = data.conversations || [];
      setConversations(list);
      setUnreadTotal(data.unreadTotal ?? list.reduce((s, c) => s + (c.unread || 0), 0));
      return list;
    } catch {
      setConversations([]);
      setUnreadTotal(0);
      return [];
    } finally {
      setLoadingList(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !token) {
      setConversations([]);
      setUnreadTotal(0);
      setMessagesById({});
      setDockIds([]);
      setIncomingCall(null);
      setActiveCall(null);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocketConnected(false);
      return undefined;
    }

    refreshConversations();

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('conversation:created', (conv) => {
      if (conv?.id) upsertConversation(conv);
    });

    socket.on('conversation:updated', (payload) => {
      if (!payload?.conversationId) return;
      setConversations((prev) => {
        const next = prev.map((c) => {
          if (String(c.id) !== String(payload.conversationId)) return c;
          const myRole = c.myRole;
          const unread = myRole && payload.unreadBy
            ? (payload.unreadBy[myRole] || 0)
            : c.unread;
          return {
            ...c,
            lastMessageAt: payload.lastMessageAt || c.lastMessageAt,
            lastMessagePreview: payload.lastMessagePreview ?? c.lastMessagePreview,
            unread: activeIdRef.current === String(c.id) ? 0 : unread,
          };
        });
        next.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
        recomputeUnread(next);
        return next;
      });
    });

    socket.on('message:new', (msg) => {
      if (!msg?.conversationId) return;
      const cid = String(msg.conversationId);
      setMessagesById((prev) => {
        const existing = prev[cid] || [];
        if (msg.clientMsgId && existing.some((m) => m.clientMsgId === msg.clientMsgId)) {
          return {
            ...prev,
            [cid]: existing.map((m) => (m.clientMsgId === msg.clientMsgId ? { ...msg, pending: false } : m)),
          };
        }
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [cid]: [...existing, { ...msg, pending: false }] };
      });

      const mine = msg.senderId && String(msg.senderId) === String(userIdRef.current);
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const onFullInbox = /\/messages\/?$/.test(path) || path.endsWith('/employer/messages');
      const viewingHere = onFullInbox && activeIdRef.current === cid;

      if (activeIdRef.current === cid || viewingHere) {
        api.markConversationRead(cid).catch(() => {});
        setConversations((prev) => {
          const next = prev.map((c) => (String(c.id) === cid ? { ...c, unread: 0 } : c));
          recomputeUnread(next);
          return next;
        });
      }

      // Auto-open Facebook-style dock only for incoming messages while online
      // (not when you sent it, and not when already focused on that thread in the full inbox)
      if (!mine && !viewingHere) {
        const alreadyDocked = dockIdsRef.current.includes(cid);
        if (!alreadyDocked || activeIdRef.current !== cid) {
          openConversationRef.current?.(cid, { dock: true });
        }
      }
    });

    socket.on('message:deleted', (payload) => {
      if (!payload?.conversationId || !payload?.messageId) return;
      const cid = String(payload.conversationId);
      setMessagesById((prev) => {
        const list = prev[cid] || [];
        if (payload.everyone && payload.message) {
          return {
            ...prev,
            [cid]: list.map((m) => (String(m.id) === String(payload.messageId) ? payload.message : m)),
          };
        }
        return {
          ...prev,
          [cid]: list.filter((m) => String(m.id) !== String(payload.messageId)),
        };
      });
    });

    socket.on('typing:update', (payload) => {
      if (!payload?.conversationId) return;
      if (String(payload.userId) === String(userIdRef.current)) return;
      setTypingById((prev) => ({
        ...prev,
        [String(payload.conversationId)]: !!payload.typing,
      }));
    });

    socket.on('call:invite', (payload) => {
      if (!payload?.conversationId) return;
      if (String(payload.fromUserId) === String(userIdRef.current)) return;
      setIncomingCall(payload);
    });

    socket.on('call:accept', (payload) => {
      if (!payload?.conversationId) return;
      setActiveCall((prev) => {
        if (!prev || String(prev.conversationId) !== String(payload.conversationId)) return prev;
        return { ...prev, status: 'connected' };
      });
    });

    socket.on('call:decline', (payload) => {
      if (!payload?.conversationId) return;
      setActiveCall((prev) => {
        if (prev && String(prev.conversationId) === String(payload.conversationId)) return null;
        return prev;
      });
      setIncomingCall((prev) => {
        if (prev && String(prev.conversationId) === String(payload.conversationId)) return null;
        return prev;
      });
    });

    socket.on('call:ended', (payload) => {
      if (!payload?.conversationId) return;
      setActiveCall((prev) => {
        if (prev && String(prev.conversationId) === String(payload.conversationId)) return null;
        return prev;
      });
      setIncomingCall((prev) => {
        if (prev && String(prev.conversationId) === String(payload.conversationId)) return null;
        return prev;
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [enabled, token, refreshConversations, upsertConversation, recomputeUnread]);

  const openConversation = useCallback(async (conversationId, { dock = false } = {}) => {
    const id = String(conversationId);
    setActiveId(id);
    if (dock) {
      setDockIds((prev) => (prev.includes(id) ? prev : [...prev.slice(-2), id]));
    }

    const socket = socketRef.current;
    socket?.emit('conversation:join', { conversationId: id });

    try {
      const data = await api.getConversationMessages(id);
      if (data.conversation) upsertConversation({ ...data.conversation, unread: 0 });
      setMessagesById((prev) => ({ ...prev, [id]: data.messages || [] }));
      setConversations((prev) => {
        const next = prev.map((c) => (String(c.id) === id ? { ...c, unread: 0 } : c));
        recomputeUnread(next);
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  }, [upsertConversation, recomputeUnread]);

  useEffect(() => {
    openConversationRef.current = openConversation;
  }, [openConversation]);

  // Calls still use a dock window; normal chat navigation does not
  const closeDock = useCallback((conversationId) => {
    const id = String(conversationId);
    setDockIds((prev) => prev.filter((x) => x !== id));
    socketRef.current?.emit('conversation:leave', { conversationId: id });
    if (activeIdRef.current === id) setActiveId(null);
  }, []);

  const sendMessage = useCallback(async (conversationId, text, files = []) => {
    const id = String(conversationId);
    const trimmed = String(text || '').trim();
    const fileList = Array.isArray(files) ? files : [];
    if (!trimmed && !fileList.length) return;

    const clientMsgId = makeClientMsgId();
    const optimistic = {
      id: `temp-${clientMsgId}`,
      conversationId: id,
      senderId: String(userIdRef.current),
      senderRole: isEmployer ? 'employer' : 'freelancer',
      type: fileList.length ? 'attachment' : 'text',
      text: trimmed,
      attachments: fileList.map((f) => ({
        fileName: f.name,
        filePath: '',
        mimeType: f.type,
        fileSize: f.size,
      })),
      clientMsgId,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessagesById((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), optimistic],
    }));

    const socket = socketRef.current;
    if (socket?.connected && !fileList.length) {
      await new Promise((resolve) => {
        socket.emit(
          'message:send',
          { conversationId: id, text: trimmed, clientMsgId },
          (ack) => {
            if (!ack?.ok) {
              setMessagesById((prev) => ({
                ...prev,
                [id]: (prev[id] || []).filter((m) => m.clientMsgId !== clientMsgId),
              }));
              alert(ack?.message || 'Failed to send message');
            } else if (ack.message) {
              setMessagesById((prev) => ({
                ...prev,
                [id]: (prev[id] || []).map((m) =>
                  (m.clientMsgId === clientMsgId ? { ...ack.message, pending: false } : m)),
              }));
              if (ack.conversation) upsertConversation(ack.conversation);
            }
            resolve();
          },
        );
      });
      return;
    }

    try {
      const data = await api.sendConversationMessage(id, {
        text: trimmed,
        clientMsgId,
        files: fileList,
      });
      setMessagesById((prev) => ({
        ...prev,
        [id]: (prev[id] || []).map((m) =>
          (m.clientMsgId === clientMsgId ? { ...data.message, pending: false } : m)),
      }));
      if (data.conversation) upsertConversation(data.conversation);
    } catch (err) {
      setMessagesById((prev) => ({
        ...prev,
        [id]: (prev[id] || []).filter((m) => m.clientMsgId !== clientMsgId),
      }));
      alert(err.message || 'Failed to send message');
    }
  }, [isEmployer, upsertConversation]);

  const deleteMessage = useCallback(async (conversationId, messageId, { everyone = false } = {}) => {
    const cid = String(conversationId);
    try {
      const data = await api.deleteConversationMessage(messageId, { everyone });
      setMessagesById((prev) => {
        const list = prev[cid] || [];
        if (everyone && data.message) {
          return {
            ...prev,
            [cid]: list.map((m) => (String(m.id) === String(messageId) ? data.message : m)),
          };
        }
        return {
          ...prev,
          [cid]: list.filter((m) => String(m.id) !== String(messageId)),
        };
      });
    } catch (err) {
      alert(err.message || 'Failed to delete message');
    }
  }, []);

  const archiveConversation = useCallback(async (conversationId, archived = true) => {
    try {
      await api.archiveConversation(conversationId, archived);
      setConversations((prev) => prev.filter((c) => String(c.id) !== String(conversationId)));
      if (activeIdRef.current === String(conversationId)) setActiveId(null);
      return true;
    } catch (err) {
      alert(err.message || 'Failed to update archive');
      return false;
    }
  }, []);

  const setTyping = useCallback((conversationId, typing) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit(typing ? 'typing:start' : 'typing:stop', { conversationId });
  }, []);

  const startCall = useCallback(async (conversationId, callType = 'video') => {
    const id = String(conversationId);
    const socket = socketRef.current;
    setActiveCall({
      conversationId: id,
      callType,
      status: 'calling',
      isCaller: true,
    });
    openConversation(id, { dock: true });

    if (socket?.connected) {
      socket.emit('call:invite', { conversationId: id, callType }, (ack) => {
        if (!ack?.ok) {
          setActiveCall(null);
          alert(ack?.message || 'Could not start call');
        }
      });
    }
  }, [openConversation]);

  const acceptCall = useCallback(() => {
    if (!incomingCall) return;
    const payload = incomingCall;
    setIncomingCall(null);
    setActiveCall({
      conversationId: String(payload.conversationId),
      callType: payload.callType || 'video',
      status: 'connected',
      isCaller: false,
    });
    openConversation(payload.conversationId, { dock: true });
    socketRef.current?.emit('call:accept', {
      conversationId: payload.conversationId,
      callType: payload.callType,
    });
  }, [incomingCall, openConversation]);

  const declineCall = useCallback(() => {
    if (!incomingCall) return;
    socketRef.current?.emit('call:decline', {
      conversationId: incomingCall.conversationId,
      callType: incomingCall.callType,
    });
    setIncomingCall(null);
  }, [incomingCall]);

  const endCall = useCallback(() => {
    if (!activeCall) {
      setActiveCall(null);
      return;
    }
    socketRef.current?.emit('call:ended', {
      conversationId: activeCall.conversationId,
      callType: activeCall.callType,
    });
    setActiveCall(null);
  }, [activeCall]);

  const value = useMemo(() => ({
    enabled,
    conversations,
    unreadTotal,
    activeId,
    messagesById,
    typingById,
    dockIds,
    loadingList,
    socketConnected,
    incomingCall,
    activeCall,
    refreshConversations,
    openConversation,
    closeDock,
    setActiveId,
    sendMessage,
    deleteMessage,
    archiveConversation,
    setTyping,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    setDockIds,
  }), [
    enabled,
    conversations,
    unreadTotal,
    activeId,
    messagesById,
    typingById,
    dockIds,
    loadingList,
    socketConnected,
    incomingCall,
    activeCall,
    refreshConversations,
    openConversation,
    closeDock,
    sendMessage,
    deleteMessage,
    archiveConversation,
    setTyping,
    startCall,
    acceptCall,
    declineCall,
    endCall,
  ]);

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used within MessagingProvider');
  return ctx;
}

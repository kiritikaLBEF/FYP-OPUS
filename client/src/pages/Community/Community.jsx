import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getCommunityBasePath, getCommunityGroupPath, getCommunityInviteUrl } from '../../utils/rolePaths';
import { io } from 'socket.io-client';
import {
  Hash, Lock, Globe, Plus, Search, Users, Shield, ShieldCheck, Crown,
  Settings, UserPlus, Image as ImageIcon, Mic, Video, Send,
  Trash2, X, Pin, Flag, Megaphone, Info, AlertTriangle, AlertOctagon,
  ChevronDown, Copy, RefreshCw, Compass, LogOut,
} from 'lucide-react';
import { api, getProfileUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Community.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ROLE_RANK = { member: 1, moderator: 2, admin: 3, owner: 4 };
const canModerate = (role) => ROLE_RANK[role] >= ROLE_RANK.moderator;
const canManageRoles = (role) => ROLE_RANK[role] >= ROLE_RANK.admin;

const ROLE_META = {
  owner: { label: 'Owner', color: '#E8A33D', Icon: Crown },
  admin: { label: 'Admin', color: '#326d5c', Icon: ShieldCheck },
  moderator: { label: 'Mod', color: '#3FBFA0', Icon: Shield },
  member: { label: null, color: '#6B7086', Icon: null },
};

const TYPE_META = {
  regular: { label: 'Message', color: '#326d5c', Icon: Megaphone },
  notice: { label: 'Notice', color: '#326d5c', Icon: Info },
  warning: { label: 'Warning', color: '#E8A33D', Icon: AlertTriangle },
  alert: { label: 'Alert', color: '#E5484D', Icon: AlertOctagon },
};

const GROUP_COLORS = ['#326d5c', '#3FBFA0', '#E8A33D', '#6FB1E0', '#E5789D', '#4A7FD4'];

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or misleading content' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
];

const makeClientMsgId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function groupColor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % GROUP_COLORS.length;
  return GROUP_COLORS[h];
}

function groupTag(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).slice(0, 2).toUpperCase() || 'G';
}

function initialsOf(name = '') {
  return String(name).split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

function timeStr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function AvatarChip({ user, id, name, size = 32, online, pulse }) {
  const src = getProfileUrl(user?.profilePicture);
  const label = name || user?.name || 'Member';
  return (
    <div
      className="cm-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: groupColor(id || user?.id || label),
      }}
    >
      {src ? <img src={src} alt="" /> : initialsOf(label)}
      {online != null && (
        <span
          className={`cm-presenceDot${pulse && online ? ' cm-pulseDot' : ''}`}
          style={{ background: online ? '#3FBF7F' : '#565B6E' }}
        />
      )}
    </div>
  );
}

function AttachmentBlock({ att }) {
  const url = getProfileUrl(att.path);
  if (att.type === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="cm-imgCard">
        <img src={url} alt={att.name || 'Image'} />
        <div className="cm-imgLabel">
          <ImageIcon size={13} />
          {att.name || 'Image'}
        </div>
      </a>
    );
  }
  if (att.type === 'audio') {
    return (
      <div className="cm-fileChip">
        <Mic size={14} />
        <audio controls preload="metadata" src={url}>
          <track kind="captions" />
        </audio>
        <span>{att.name || 'Audio'}</span>
      </div>
    );
  }
  if (att.type === 'video') {
    return (
      <div className="cm-videoCard">
        <video controls preload="metadata" src={url} />
        <span className="cm-durBadge">{att.name || 'Video'}</span>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="cm-fileChip">
      {att.name || 'Attachment'}
    </a>
  );
}

function MemberRow({ m, dim, isMod, isAdmin, isOwner, myId, onRole, onStatus }) {
  const meta = ROLE_META[m.role] || ROLE_META.member;
  const name = m.user?.name || 'Member';
  return (
    <div className="cm-memRow" style={{ opacity: dim ? 0.55 : 1 }}>
      <AvatarChip user={m.user} id={m.userId} name={name} size={28} online={!!m.online} />
      <div className="cm-memMeta">
        <span className="cm-memName">{name}</span>
        {m.status !== 'active' && <span className="cm-memStatus">{m.status}</span>}
      </div>
      {meta.label && (
        <span className="cm-memRole" style={{ color: meta.color }}>{meta.label}</span>
      )}
      {isMod && m.userId !== myId && m.role !== 'owner' && (
        <div className="cm-memActions">
          {isAdmin && (
            <select
              aria-label="Change role"
              value={m.role}
              onChange={(e) => onRole(m.userId, e.target.value)}
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
              {isOwner && <option value="admin">Admin</option>}
            </select>
          )}
          {m.status === 'active' ? (
            <>
              <button type="button" onClick={() => onStatus(m.userId, 'inactive')}>Mute</button>
              <button type="button" onClick={() => onStatus(m.userId, 'banned')}>Ban</button>
            </>
          ) : (
            <button type="button" onClick={() => onStatus(m.userId, 'active')}>Restore</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Community() {
  const { groupId: routeGroupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useAuth();
  const myId = String(user?.id || user?._id || '');
  const myName = user?.role === 'employer'
    ? (user.organizationName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'You')
    : ([user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'You');

  const [panelMode, setPanelMode] = useState('mine'); // mine | discover
  const [myGroups, setMyGroups] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [discoverQ, setDiscoverQ] = useState('');
  const [msgSearch, setMsgSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [canPostSpecial, setCanPostSpecial] = useState(false);
  const [composer, setComposer] = useState('');
  const [kind, setKind] = useState('regular');
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [invites, setInvites] = useState([]);
  const [membersOpen, setMembersOpen] = useState(true);
  const [mobilePane, setMobilePane] = useState(routeGroupId ? 'chat' : 'list');
  const [createForm, setCreateForm] = useState({ name: '', description: '', visibility: 'public' });
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '', visibility: 'public' });
  const [reportForm, setReportForm] = useState({ reason: 'spam', note: '' });

  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const typingTimer = useRef(null);
  const toastTimer = useRef(null);
  const activeGroupRef = useRef(null);
  const fileRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const activeId = routeGroupId || null;

  const flash = (text) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => {
    activeGroupRef.current = activeId;
  }, [activeId]);

  const refreshLists = useCallback(async () => {
    setLoadingList(true);
    try {
      const [mineRes, discRes] = await Promise.all([
        api.getMyCommunityGroups(),
        api.discoverCommunityGroups(discoverQ),
      ]);
      setMyGroups(mineRes.groups || []);
      setDiscover(discRes.groups || []);
      window.dispatchEvent(new CustomEvent('opus:community-unread'));
    } catch (err) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoadingList(false);
    }
  }, [discoverQ]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    refreshLists();
    return undefined;
  }, [isAuthenticated, refreshLists]);

  const loadGroup = useCallback(async (id) => {
    if (!id) {
      setGroup(null);
      setMembers([]);
      setMessages([]);
      setPinned([]);
      return;
    }
    try {
      const [gRes, mRes, msgRes] = await Promise.all([
        api.getCommunityGroup(id),
        api.getCommunityMembers(id).catch(() => ({ members: [] })),
        api.getCommunityMessages(id).catch(() => ({ messages: [], pinned: [], canPostSpecial: false })),
      ]);
      setGroup(gRes.group);
      setSettingsForm({
        name: gRes.group.name || '',
        description: gRes.group.description || '',
        visibility: gRes.group.visibility || 'public',
      });
      setMembers(mRes.members || []);
      setMessages(msgRes.messages || []);
      setPinned(msgRes.pinned || []);
      setCanPostSpecial(!!msgRes.canPostSpecial);
      if (!msgRes.canPostSpecial) setKind('regular');
      setError('');
      if (gRes.group?.isMember) {
        api.markCommunityGroupRead(id).catch(() => {});
        setMyGroups((prev) => prev.map((g) => (g.id === id ? { ...g, unread: 0 } : g)));
        window.dispatchEvent(new CustomEvent('opus:community-unread'));
      }
      setMobilePane('chat');
    } catch (err) {
      setError(err.message || 'Failed to load group');
      setGroup(null);
    }
  }, []);

  useEffect(() => {
    loadGroup(activeId);
  }, [activeId, loadGroup]);

  useEffect(() => {
    const code = searchParams.get('invite');
    if (!code || !isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.resolveCommunityInvite(code);
        if (!cancelled) setInviteInfo({ code, ...data });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Invite not valid');
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, isAuthenticated]);

  useEffect(() => {
    if (!token || !isAuthenticated) return undefined;
    const socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('community:message:new', (payload) => {
      const msg = payload?.message;
      const gid = String(payload?.groupId || msg?.groupId || '');
      if (!msg || !gid) return;
      if (gid === String(activeGroupRef.current)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id || (msg.clientMsgId && m.clientMsgId === msg.clientMsgId))) {
            return prev.map((m) => (
              m.id === msg.id || (msg.clientMsgId && m.clientMsgId === msg.clientMsgId) ? msg : m
            ));
          }
          return [...prev, msg];
        });
        if (msg.pinned) setPinned((prev) => (prev.some((p) => p.id === msg.id) ? prev : [...prev, msg]));
        api.markCommunityGroupRead(gid).catch(() => {});
        return;
      }
      if (String(msg.authorId) !== String(myId)) {
        setMyGroups((prev) => prev.map((g) => (
          g.id === gid ? { ...g, unread: (g.unread || 0) + 1 } : g
        )));
        window.dispatchEvent(new CustomEvent('opus:community-unread'));
      }
    });

    socket.on('community:message:deleted', (payload) => {
      const mid = payload?.messageId;
      const gid = String(payload?.groupId || '');
      if (!mid || gid !== String(activeGroupRef.current)) return;
      setMessages((prev) => prev.map((m) => (
        m.id === mid ? { ...m, deleted: true, body: '', attachments: [], pinned: false } : m
      )));
      setPinned((prev) => prev.filter((p) => p.id !== mid));
    });

    socket.on('community:message:updated', (payload) => {
      const msg = payload?.message;
      if (!msg || String(msg.groupId) !== String(activeGroupRef.current)) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      setPinned((prev) => {
        if (msg.pinned) {
          return prev.some((p) => p.id === msg.id)
            ? prev.map((p) => (p.id === msg.id ? msg : p))
            : [...prev, msg];
        }
        return prev.filter((p) => p.id !== msg.id);
      });
    });

    socket.on('community:presence', (payload) => {
      if (String(payload?.groupId || '') !== String(activeGroupRef.current)) return;
      const onlineSet = new Set((payload.onlineIds || []).map(String));
      setMembers((prev) => prev.map((m) => ({ ...m, online: onlineSet.has(String(m.userId)) })));
    });

    socket.on('community:typing', (payload) => {
      if (String(payload?.groupId || '') !== String(activeGroupRef.current)) return;
      const uid = String(payload.userId);
      if (uid === myId) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (payload.typing) next[uid] = true;
        else delete next[uid];
        return next;
      });
    });

    socket.on('community:member:updated', (payload) => {
      const member = payload?.member;
      if (!member || String(member.groupId) !== String(activeGroupRef.current)) return;
      setMembers((prev) => {
        const idx = prev.findIndex((m) => m.userId === member.userId);
        if (idx === -1) return [...prev, member];
        const next = [...prev];
        next[idx] = member;
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, isAuthenticated, myId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeId || !group?.isMember) return undefined;
    socket.emit('community:join', { groupId: activeId }, () => {});
    return () => { socket.emit('community:leave', { groupId: activeId }); };
  }, [activeId, group?.isMember]);

  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [messages, activeId]);

  const emitTyping = (typing) => {
    socketRef.current?.emit('community:typing', { groupId: activeId, typing });
  };

  const selectGroup = (id) => {
    setPanelMode('mine');
    setMobilePane('chat');
    navigate(getCommunityGroupPath(user, id));
  };

  const refreshInvites = async () => {
    if (!activeId) return;
    try {
      const listed = await api.listCommunityInvites(activeId);
      setInvites(listed.invites || []);
    } catch {
      /* ignore */
    }
  };

  const openInviteModal = async () => {
    if (!activeId) return;
    setShowInvite(true);
    try {
      const listed = await api.listCommunityInvites(activeId).catch(() => ({ invites: [] }));
      const existing = listed.invites || [];
      setInvites(existing);
      if (existing[0]?.code) {
        setInviteLink(getCommunityInviteUrl(user, existing[0].code));
      } else {
        const created = await api.createCommunityInvite(activeId);
        const code = created.invite?.code;
        if (code) setInviteLink(getCommunityInviteUrl(user, code));
        await refreshInvites();
      }
    } catch (err) {
      setError(err.message || 'Could not open invites');
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    try {
      await api.revokeCommunityInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      flash('Invite revoked');
    } catch (err) {
      setError(err.message || 'Could not revoke invite');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const data = await api.createCommunityGroup(createForm);
      setShowCreate(false);
      setCreateForm({ name: '', description: '', visibility: 'public' });
      await refreshLists();
      if (data.group?.id) selectGroup(data.group.id);
      flash('Group created');
    } catch (err) {
      setError(err.message || 'Could not create group');
    }
  };

  const handleJoinPublic = async (id) => {
    try {
      await api.joinPublicCommunityGroup(id);
      await refreshLists();
      selectGroup(id);
      flash('Joined group');
    } catch (err) {
      setError(err.message || 'Could not join');
    }
  };

  const handleJoinInvite = async () => {
    if (!inviteInfo?.code) return;
    try {
      const data = await api.joinCommunityByInvite(inviteInfo.code);
      setInviteInfo(null);
      setSearchParams({});
      await refreshLists();
      if (data.group?.id) selectGroup(data.group.id);
      flash('Joined via invite');
    } catch (err) {
      setError(err.message || 'Could not join with invite');
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!activeId || !group?.isMember) return;
    const text = composer.trim();
    if (!text && files.length === 0) return;
    setSending(true);
    const clientMsgId = makeClientMsgId();
    try {
      emitTyping(false);
      const data = await api.sendCommunityMessage(activeId, {
        text,
        kind: canPostSpecial ? kind : 'regular',
        clientMsgId,
        files,
      });
      const msg = data.message;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setComposer('');
      setFiles([]);
      setKind('regular');
      setTypePickerOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await api.deleteCommunityMessage(messageId);
      setMessages((prev) => prev.map((m) => (
        m.id === messageId ? { ...m, deleted: true, body: '', attachments: [], pinned: false } : m
      )));
      setPinned((prev) => prev.filter((p) => p.id !== messageId));
      flash('Message deleted');
    } catch (err) {
      setError(err.message || 'Could not delete');
    }
  };

  const handlePin = async (messageId, pinnedState) => {
    try {
      const data = await api.pinCommunityMessage(messageId, pinnedState);
      const msg = data.message;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      setPinned((prev) => {
        if (msg.pinned) {
          return prev.some((p) => p.id === msg.id)
            ? prev.map((p) => (p.id === msg.id ? msg : p))
            : [...prev, msg];
        }
        return prev.filter((p) => p.id !== msg.id);
      });
      flash(msg.pinned ? 'Pinned' : 'Unpinned');
    } catch (err) {
      setError(err.message || 'Could not update pin');
    }
  };

  const handleReportGroup = async (e) => {
    e.preventDefault();
    if (!activeId) return;
    setReporting(true);
    setError('');
    try {
      const data = await api.reportCommunityGroup(activeId, {
        reason: reportForm.reason,
        note: reportForm.note.trim(),
      });
      setShowReport(false);
      setReportForm({ reason: 'spam', note: '' });
      flash(data.message || 'Report submitted. OPUS admin will review this group.');
    } catch (err) {
      setError(err.message || 'Could not submit report');
    } finally {
      setReporting(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!activeId) return;
    try {
      const data = await api.updateCommunityGroup(activeId, settingsForm);
      setGroup(data.group);
      setShowSettings(false);
      await refreshLists();
      flash('Settings saved');
    } catch (err) {
      setError(err.message || 'Could not update group');
    }
  };

  const handleCreateInvite = async () => {
    if (!activeId) return;
    try {
      const data = await api.createCommunityInvite(activeId);
      const code = data.invite?.code;
      if (code) {
        setInviteLink(getCommunityInviteUrl(user, code));
        setShowInvite(true);
        await refreshInvites();
      }
    } catch (err) {
      setError(err.message || 'Could not create invite');
    }
  };

  const handleLeave = async () => {
    if (!activeId) return;
    try {
      await api.leaveCommunityGroup(activeId);
      setShowSettings(false);
      navigate(getCommunityBasePath(user));
      await refreshLists();
    } catch (err) {
      setError(err.message || 'Could not leave');
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeId || !window.confirm('Delete this group permanently?')) return;
    try {
      await api.deleteCommunityGroup(activeId);
      navigate(getCommunityBasePath(user));
      await refreshLists();
    } catch (err) {
      setError(err.message || 'Could not delete group');
    }
  };

  const handleMemberStatus = async (userId, status) => {
    if (!activeId) return;
    const reason = status === 'banned' || status === 'inactive'
      ? window.prompt('Optional reason:', '') || ''
      : '';
    try {
      const data = await api.updateCommunityMember(activeId, userId, { status, statusReason: reason });
      setMembers((prev) => prev.map((m) => (m.userId === userId ? data.member : m)));
    } catch (err) {
      setError(err.message || 'Could not update member');
    }
  };

  const handleMemberRole = async (userId, role) => {
    if (!activeId) return;
    try {
      const data = await api.updateCommunityMember(activeId, userId, { role });
      setMembers((prev) => prev.map((m) => (m.userId === userId ? data.member : m)));
    } catch (err) {
      setError(err.message || 'Could not update role');
    }
  };

  const myRole = group?.myRole;
  const isMod = canModerate(myRole);
  const isAdmin = canManageRoles(myRole);
  const isOwner = myRole === 'owner';
  const myMembership = members.find((m) => m.userId === myId);

  const online = members.filter((m) => m.status === 'active' && m.online);
  const offline = members.filter((m) => m.status === 'active' && !m.online);
  const muted = members.filter((m) => m.status === 'inactive' || m.status === 'banned');

  const filteredMessages = useMemo(() => {
    const q = msgSearch.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (
      (m.body || '').toLowerCase().includes(q)
      || (m.author?.name || '').toLowerCase().includes(q)
    ));
  }, [messages, msgSearch]);

  const typingLabel = useMemo(() => {
    const ids = Object.keys(typingUsers);
    if (!ids.length) return '';
    const names = ids.map((id) => members.find((m) => m.userId === id)?.user?.name || 'Someone');
    return names.length === 1 ? `${names[0]} is typing…` : 'Several people are typing…';
  }, [typingUsers, members]);

  const visibleGroups = panelMode === 'discover' ? discover : myGroups;
  let lastDay = null;

  return (
    <main className="cm-page">
      <div className={`cm-root cm-root--${mobilePane}`}>
        {/* RAIL */}
        <div className="cm-rail">
          <div className="cm-rail-logo cm-display" title="OPUS Community">O</div>
          <div className="cm-rail-div" />
          {myGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`cm-group-btn${activeId === g.id ? ' active' : ''}`}
              style={{ background: groupColor(g.id) }}
              onClick={() => selectGroup(g.id)}
              title={g.name}
            >
              <span className="cm-group-indicator" />
              {groupTag(g.name)}
              {(g.unread || 0) > 0 && (
                <span className="cm-unread">{g.unread > 9 ? '9+' : g.unread}</span>
              )}
            </button>
          ))}
          <button
            type="button"
            className={`cm-add-group${panelMode === 'discover' ? ' on' : ''}`}
            onClick={() => {
              setPanelMode('discover');
              setMobilePane('list');
              navigate(getCommunityBasePath(user));
            }}
            title="Discover groups"
          >
            <Compass size={18} />
          </button>
          <button
            type="button"
            className="cm-add-group"
            onClick={() => setShowCreate(true)}
            title="Create a group"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* GROUP PANEL */}
        <div className="cm-groupPanel">
          {group && panelMode === 'mine' ? (
            <>
              <div className="cm-groupHead">
                <h2 className="cm-display">{group.name}</h2>
                <span className="cm-privacyTag">
                  {group.visibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}
                  {group.visibility === 'private' ? 'Private group' : 'Public group'}
                </span>
                {group.isMember && (
                  <div className="cm-groupTools">
                    {isMod && (
                      <button type="button" className="cm-toolBtn" onClick={openInviteModal}>
                        <UserPlus size={13} />
                        Invite
                      </button>
                    )}
                    <button type="button" className="cm-toolBtn" onClick={() => setShowSettings(true)}>
                      <Settings size={13} />
                      Settings
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="cm-mobileOnly cm-toolBtn"
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={() => setMobilePane('chat')}
                >
                  Open chat
                </button>
              </div>
              <div className="cm-channelList cm-scroll">
                <div className="cm-channelLabel">Chat</div>
                <button type="button" className="cm-channelBtn active">
                  <Hash size={15} />
                  general
                </button>
                {group.description && (
                  <p className="cm-groupDesc">{group.description}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="cm-groupHead">
                <h2 className="cm-display">{panelMode === 'discover' ? 'Discover' : 'My groups'}</h2>
                <p className="cm-panelHint">
                  {panelMode === 'discover'
                    ? 'Public groups you can join'
                    : 'Select a group from the rail, or discover new ones'}
                </p>
                {panelMode === 'discover' && (
                  <form
                    className="cm-panelSearch"
                    onSubmit={(e) => { e.preventDefault(); refreshLists(); }}
                  >
                    <Search size={13} />
                    <input
                      value={discoverQ}
                      onChange={(e) => setDiscoverQ(e.target.value)}
                      placeholder="Search public groups"
                    />
                  </form>
                )}
                <div className="cm-groupTools">
                  <button
                    type="button"
                    className={`cm-toolBtn${panelMode === 'mine' ? ' on' : ''}`}
                    onClick={() => setPanelMode('mine')}
                  >
                    Mine
                  </button>
                  <button
                    type="button"
                    className={`cm-toolBtn${panelMode === 'discover' ? ' on' : ''}`}
                    onClick={() => setPanelMode('discover')}
                  >
                    <Compass size={13} />
                    Discover
                  </button>
                </div>
              </div>
              <div className="cm-channelList cm-scroll">
                {loadingList && <p className="cm-emptyHint">Loading…</p>}
                {!loadingList && visibleGroups.length === 0 && (
                  <p className="cm-emptyHint">
                    {panelMode === 'mine' ? 'No groups yet. Create one to get started.' : 'No public groups found.'}
                  </p>
                )}
                {visibleGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`cm-channelBtn${activeId === g.id ? ' active' : ''}`}
                    onClick={() => {
                      if (panelMode === 'discover' && !g.isMember) return;
                      selectGroup(g.id);
                    }}
                  >
                    {g.visibility === 'private' ? <Lock size={14} /> : <Hash size={14} />}
                    <span className="cm-channelName">{g.name}</span>
                    {panelMode === 'discover' && !g.isMember && (
                      <span
                        className="cm-joinChip"
                        onClick={(e) => { e.stopPropagation(); handleJoinPublic(g.id); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.stopPropagation(); handleJoinPublic(g.id); }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        Join
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="cm-meBox">
            <AvatarChip user={user} id={myId} name={myName} size={32} online pulse />
            <div>
              <div className="cm-meName">{myName}</div>
              <div className="cm-meRole">
                {myMembership?.role || myRole || (
                  user?.role === 'employer'
                    ? 'Organization'
                    : user?.role === 'admin'
                      ? 'Admin'
                      : 'Freelancer'
                )}
              </div>
            </div>
            <button
              type="button"
              className="cm-iconBtn"
              style={{ marginLeft: 'auto' }}
              title="Leave community view"
              onClick={() => navigate(
                user?.role === 'employer'
                  ? '/employer/dashboard'
                  : user?.role === 'admin'
                    ? '/admin/overview'
                    : '/dashboard',
              )}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* MAIN */}
        <div className="cm-main">
          {error && (
            <div className="cm-alertBar">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}>Dismiss</button>
            </div>
          )}

          {inviteInfo && (
            <div className="cm-inviteBanner">
              <div>
                <strong>Invite to {inviteInfo.group?.name || 'a group'}</strong>
                <p>{inviteInfo.group?.visibility === 'private' ? 'Private group' : 'Public group'}</p>
              </div>
              <button type="button" className="cm-btn primary" onClick={handleJoinInvite}>Accept</button>
            </div>
          )}

          {!group ? (
            <div className="cm-emptyMain">
              <Megaphone size={28} />
              <h3 className="cm-display">Welcome to Community</h3>
              <p>Pick a group from the rail, discover public groups, or create your own.</p>
              <button type="button" className="cm-btn primary" onClick={() => setShowCreate(true)}>
                Create group
              </button>
            </div>
          ) : (
            <>
              <div className="cm-topbar">
                <button
                  type="button"
                  className="cm-iconBtn cm-mobileOnly"
                  title="Groups"
                  onClick={() => setMobilePane('list')}
                >
                  <Compass size={16} />
                </button>
                <h3 className="cm-display">
                  <Hash size={16} color="var(--cm-text-faint)" />
                  general
                </h3>
                <span className="cm-sub">
                  {group.memberCount || members.length}
                  {' '}
                  members
                </span>
                <div className="cm-searchBox">
                  <Search size={13} />
                  <input
                    placeholder="Search messages"
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={`cm-iconBtn${showPinned ? ' on' : ''}`}
                  title="Pinned messages"
                  onClick={() => setShowPinned((v) => !v)}
                >
                  <Pin size={16} />
                </button>
                {group.isMember && myRole !== 'owner' && (
                  <button
                    type="button"
                    className="cm-iconBtn cm-iconBtn--warn"
                    title="Report group"
                    onClick={() => {
                      setError('');
                      setShowReport(true);
                    }}
                  >
                    <Flag size={16} />
                  </button>
                )}
                <button
                  type="button"
                  className={`cm-iconBtn${membersOpen || mobilePane === 'members' ? ' on' : ''}`}
                  title="Toggle member list"
                  onClick={() => {
                    if (window.matchMedia('(max-width: 960px)').matches) {
                      setMobilePane((p) => (p === 'members' ? 'chat' : 'members'));
                      setMembersOpen(true);
                    } else {
                      setMembersOpen((v) => !v);
                    }
                  }}
                >
                  <Users size={16} />
                </button>
              </div>

              {showPinned && pinned.length > 0 && (
                <div className="cm-pinnedStrip">
                  {pinned.map((p) => {
                    const tMeta = TYPE_META[p.kind] || TYPE_META.notice;
                    return (
                      <div key={p.id} className="cm-pinnedItem" style={{ borderColor: `${tMeta.color}55` }}>
                        <tMeta.Icon size={12} color={tMeta.color} />
                        <span>{p.body || 'Pinned'}</span>
                        {isMod && (
                          <button type="button" onClick={() => handlePin(p.id, false)}>Unpin</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="cm-msgs cm-scroll" ref={streamRef}>
                {filteredMessages.length === 0 && (
                  <p className="cm-emptyHint" style={{ padding: 20 }}>No messages yet. Say hello.</p>
                )}
                {filteredMessages.map((m) => {
                  const authorName = m.authorId === myId ? myName : (m.author?.name || 'Member');
                  const authorRole = m.authorId === myId
                    ? (myRole || 'member')
                    : (members.find((x) => x.userId === m.authorId)?.role || 'member');
                  const roleMeta = ROLE_META[authorRole] || ROLE_META.member;
                  const day = dayLabel(m.createdAt);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  const tMeta = TYPE_META[m.kind] || TYPE_META.regular;
                  const isBanner = m.kind && m.kind !== 'regular' && !m.deleted;
                  const TypeIcon = tMeta.Icon;

                  return (
                    <Fragment key={m.id}>
                      {showDay && <div className="cm-day"><span>{day}</span></div>}
                      <div className="cm-row">
                        <AvatarChip
                          user={m.author}
                          id={m.authorId}
                          name={authorName}
                          size={34}
                        />
                        <div className="cm-msgBody">
                          <div className="cm-msgHead">
                            <span className="cm-authorName">{authorName}</span>
                            {roleMeta.label && (
                              <span
                                className="cm-roleBadge"
                                style={{ color: roleMeta.color, background: `${roleMeta.color}22` }}
                              >
                                {roleMeta.label}
                              </span>
                            )}
                            <span className="cm-ts cm-mono">{timeStr(m.createdAt)}</span>
                          </div>

                          {m.deleted ? (
                            <div className="cm-text deleted">
                              <Trash2 size={12} />
                              Message deleted
                            </div>
                          ) : isBanner ? (
                            <div
                              className="cm-banner"
                              style={{ borderColor: `${tMeta.color}55`, background: `${tMeta.color}14` }}
                            >
                              <div
                                className="cm-bannerIcon"
                                style={{ background: `${tMeta.color}26`, color: tMeta.color }}
                              >
                                <TypeIcon size={14} />
                              </div>
                              <div>
                                <div className="cm-bannerLabel" style={{ color: tMeta.color }}>{tMeta.label}</div>
                                <div className="cm-bannerText">{m.body}</div>
                                {(m.attachments || []).map((att) => (
                                  <AttachmentBlock key={`${m.id}-${att.path}`} att={att} />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.body && <div className="cm-text">{m.body}</div>}
                              {(m.attachments || []).map((att) => (
                                <AttachmentBlock key={`${m.id}-${att.path}`} att={att} />
                              ))}
                            </>
                          )}
                        </div>

                        {!m.deleted && (m.authorId === myId || isMod) && (
                          <div className="cm-rowActions">
                            {isMod && (m.kind === 'notice' || m.kind === 'alert' || m.kind === 'warning') && (
                              <button
                                type="button"
                                className="cm-iconBtn"
                                title={m.pinned ? 'Unpin' : 'Pin'}
                                onClick={() => handlePin(m.id, !m.pinned)}
                              >
                                <Pin size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="cm-iconBtn"
                              title="Delete"
                              onClick={() => handleDeleteMessage(m.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </Fragment>
                  );
                })}
              </div>

              {typingLabel && <p className="cm-typing">{typingLabel}</p>}

              {group.isMember ? (
                <div className="cm-composerWrap">
                  {files.length > 0 && (
                    <div className="cm-attachPreview">
                      {files.map((f) => (
                        <span key={f.name + f.size}>{f.name}</span>
                      ))}
                      <button type="button" className="cm-iconBtn" onClick={() => setFiles([])}>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <div className="cm-composer">
                    <div className="cm-composerTop">
                      {canPostSpecial ? (
                        <>
                          <button
                            type="button"
                            className="cm-typeChip"
                            style={{ color: TYPE_META[kind].color }}
                            onClick={() => setTypePickerOpen((v) => !v)}
                          >
                            {(() => {
                              const Icon = TYPE_META[kind].Icon;
                              return <Icon size={13} />;
                            })()}
                            {TYPE_META[kind].label}
                            <ChevronDown size={12} />
                          </button>
                          {typePickerOpen && (
                            <div className="cm-typeMenu">
                              {Object.entries(TYPE_META).map(([k, v]) => {
                                const Icon = v.Icon;
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    className="cm-typeOpt"
                                    onClick={() => { setKind(k); setTypePickerOpen(false); }}
                                  >
                                    <Icon size={13} color={v.color} />
                                    {v.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="cm-typeChip" style={{ cursor: 'default' }}>
                          <Megaphone size={13} />
                          Message
                        </span>
                      )}
                      <button type="button" className="cm-iconBtn" title="Attach image" onClick={() => fileRef.current?.click()}>
                        <ImageIcon size={16} />
                      </button>
                      <button type="button" className="cm-iconBtn" title="Attach audio" onClick={() => audioRef.current?.click()}>
                        <Mic size={16} />
                      </button>
                      <button type="button" className="cm-iconBtn" title="Attach video" onClick={() => videoRef.current?.click()}>
                        <Video size={16} />
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setFiles([...e.target.files].slice(0, 5))} />
                      <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => setFiles([...e.target.files].slice(0, 5))} />
                      <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => setFiles([...e.target.files].slice(0, 5))} />
                    </div>
                    <div className="cm-composerRow">
                      <textarea
                        rows={1}
                        placeholder={`Message #general`}
                        value={composer}
                        maxLength={4000}
                        onChange={(e) => {
                          setComposer(e.target.value);
                          emitTyping(true);
                          if (typingTimer.current) clearTimeout(typingTimer.current);
                          typingTimer.current = setTimeout(() => emitTyping(false), 1200);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="cm-sendBtn"
                        disabled={sending || (!composer.trim() && files.length === 0)}
                        onClick={handleSend}
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cm-joinCta">
                  {group.visibility === 'public' ? (
                    <button type="button" className="cm-btn primary" onClick={() => handleJoinPublic(group.id)}>
                      Join group
                    </button>
                  ) : (
                    <p>This group is private. Ask a member for an invite link.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* MEMBERS */}
        {membersOpen && group && (
          <div className="cm-members cm-scroll">
            <div className="cm-memGroup">
              Online -
              {' '}
              {online.length}
            </div>
            {online.map((m) => (
              <MemberRow
                key={m.id}
                m={m}
                isMod={isMod}
                isAdmin={isAdmin}
                isOwner={isOwner}
                myId={myId}
                onRole={handleMemberRole}
                onStatus={handleMemberStatus}
              />
            ))}
            <div className="cm-memGroup">
              Offline -
              {' '}
              {offline.length}
            </div>
            {offline.map((m) => (
              <MemberRow
                key={m.id}
                m={m}
                dim
                isMod={isMod}
                isAdmin={isAdmin}
                isOwner={isOwner}
                myId={myId}
                onRole={handleMemberRole}
                onStatus={handleMemberStatus}
              />
            ))}
            {muted.length > 0 && (
              <>
                <div className="cm-memGroup">Restricted - {muted.length}</div>
                {muted.map((m) => (
                  <MemberRow
                    key={m.id}
                    m={m}
                    dim
                    isMod={isMod}
                    isAdmin={isAdmin}
                    isOwner={isOwner}
                    myId={myId}
                    onRole={handleMemberRole}
                    onStatus={handleMemberStatus}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* CREATE */}
        {showCreate && (
          <div className="cm-overlay" onClick={() => setShowCreate(false)} role="presentation">
            <form className="cm-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
              <h3 className="cm-display">Create a group</h3>
              <p className="desc">Groups bring freelancers and organizations together for chat and notices.</p>
              <div className="cm-field">
                <label htmlFor="cm-create-name">Group name</label>
                <input
                  id="cm-create-name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="e.g. Kathmandu Freelancers"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="cm-field">
                <label htmlFor="cm-create-desc">Description</label>
                <textarea
                  id="cm-create-desc"
                  rows={2}
                  maxLength={500}
                  placeholder="What's this group about?"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="cm-field">
                <span className="cm-fieldLabel">Privacy</span>
                <div className="cm-privacyChoice">
                  <button
                    type="button"
                    className={`cm-privOpt${createForm.visibility === 'private' ? ' selected' : ''}`}
                    onClick={() => setCreateForm((f) => ({ ...f, visibility: 'private' }))}
                  >
                    <div className="t"><Lock size={13} /> Private</div>
                    <div className="d">Invite-only. Hidden from Discover.</div>
                  </button>
                  <button
                    type="button"
                    className={`cm-privOpt${createForm.visibility === 'public' ? ' selected' : ''}`}
                    onClick={() => setCreateForm((f) => ({ ...f, visibility: 'public' }))}
                  >
                    <div className="t"><Globe size={13} /> Public</div>
                    <div className="d">Anyone on OPUS can find and join.</div>
                  </button>
                </div>
              </div>
              <div className="cm-modalActions">
                <button type="button" className="cm-btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="cm-btn primary">Create group</button>
              </div>
            </form>
          </div>
        )}

        {/* INVITE */}
        {showInvite && (
          <div className="cm-overlay" onClick={() => setShowInvite(false)} role="presentation">
            <div className="cm-modal" onClick={(e) => e.stopPropagation()} role="dialog">
              <h3 className="cm-display">
                Invite people
                {group ? ` to ${group.name}` : ''}
              </h3>
              <p className="desc">
                Anyone with this link can join
                {group?.visibility === 'private' ? ' this private group.' : '.'}
              </p>
              <div className="cm-linkBox">
                <span className="cm-mono">{inviteLink || 'Generating…'}</span>
                <button
                  type="button"
                  className="cm-iconBtn"
                  title="Copy link"
                  onClick={() => {
                    navigator.clipboard?.writeText(inviteLink);
                    flash('Invite link copied');
                  }}
                >
                  <Copy size={14} />
                </button>
                <button type="button" className="cm-iconBtn" title="Generate new link" onClick={handleCreateInvite}>
                  <RefreshCw size={13} />
                </button>
              </div>
              {invites.length > 0 && (
                <div className="cm-inviteList">
                  <div className="cm-channelLabel" style={{ paddingLeft: 0 }}>Active invites</div>
                  {invites.map((inv) => (
                    <div key={inv.id} className="cm-inviteRow">
                      <code className="cm-mono">{inv.code}</code>
                      <span className="cm-inviteMeta">
                        used
                        {' '}
                        {inv.useCount || 0}
                        {inv.maxUses ? ` / ${inv.maxUses}` : ''}
                      </span>
                      <button
                        type="button"
                        className="cm-btn ghost"
                        onClick={() => handleRevokeInvite(inv.id)}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="cm-modalActions">
                <button type="button" className="cm-btn ghost" onClick={() => setShowInvite(false)}>Done</button>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {showSettings && group && (
          <div className="cm-overlay" onClick={() => setShowSettings(false)} role="presentation">
            <form className="cm-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveSettings}>
              <h3 className="cm-display">Group settings</h3>
              <div className="cm-field">
                <label htmlFor="cm-set-name">Name</label>
                <input
                  id="cm-set-name"
                  required
                  disabled={!isAdmin}
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="cm-field">
                <label htmlFor="cm-set-desc">Description</label>
                <textarea
                  id="cm-set-desc"
                  rows={2}
                  disabled={!isAdmin}
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              {isAdmin && (
                <div className="cm-field">
                  <span className="cm-fieldLabel">Privacy</span>
                  <div className="cm-privacyChoice">
                    <button
                      type="button"
                      className={`cm-privOpt${settingsForm.visibility === 'private' ? ' selected' : ''}`}
                      onClick={() => setSettingsForm((f) => ({ ...f, visibility: 'private' }))}
                    >
                      <div className="t"><Lock size={13} /> Private</div>
                      <div className="d">Invite-only</div>
                    </button>
                    <button
                      type="button"
                      className={`cm-privOpt${settingsForm.visibility === 'public' ? ' selected' : ''}`}
                      onClick={() => setSettingsForm((f) => ({ ...f, visibility: 'public' }))}
                    >
                      <div className="t"><Globe size={13} /> Public</div>
                      <div className="d">Listed in Discover</div>
                    </button>
                  </div>
                </div>
              )}
              <div className="cm-modalActions">
                <button type="button" className="cm-btn ghost" onClick={() => setShowSettings(false)}>Close</button>
                {isAdmin && <button type="submit" className="cm-btn primary">Save</button>}
              </div>
              <div className="cm-dangerRow">
                {myRole && myRole !== 'owner' && (
                  <button type="button" className="cm-btn ghost" onClick={handleLeave}>Leave group</button>
                )}
                {isOwner && (
                  <button type="button" className="cm-btn danger" onClick={handleDeleteGroup}>Delete group</button>
                )}
              </div>
            </form>
          </div>
        )}

        {showReport && (
          <div className="cm-overlay" onClick={() => setShowReport(false)} role="presentation">
            <form className="cm-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleReportGroup}>
              <h3 className="cm-display">Report group</h3>
              <p className="desc">
                Your report is sent to OPUS admin for review. Include details so moderators can investigate.
              </p>
              <div className="cm-field">
                <label htmlFor="cm-report-reason">Reason</label>
                <select
                  id="cm-report-reason"
                  value={reportForm.reason}
                  onChange={(e) => setReportForm((f) => ({ ...f, reason: e.target.value }))}
                  required
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="cm-field">
                <label htmlFor="cm-report-note">Description</label>
                <textarea
                  id="cm-report-note"
                  value={reportForm.note}
                  onChange={(e) => setReportForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Describe what happened and why you are reporting this group…"
                  rows={5}
                  maxLength={2000}
                  required
                />
              </div>
              <div className="cm-modalActions">
                <button type="button" className="cm-btn ghost" onClick={() => setShowReport(false)}>Cancel</button>
                <button type="submit" className="cm-btn danger" disabled={reporting || !reportForm.note.trim()}>
                  {reporting ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </form>
          </div>
        )}

        {toast && <div className="cm-toast">{toast}</div>}
      </div>
    </main>
  );
}

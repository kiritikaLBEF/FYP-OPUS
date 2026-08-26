/** In-memory presence for Community groups (socket layer). */
const onlineByGroup = new Map();
const userSockets = new Map();

export const communityPresence = {
  add(userId, socketId) {
    const id = String(userId);
    if (!userSockets.has(id)) userSockets.set(id, new Set());
    userSockets.get(id).add(socketId);
  },
  remove(userId, socketId) {
    const id = String(userId);
    const set = userSockets.get(id);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      userSockets.delete(id);
      return true;
    }
    return false;
  },
  isOnline(userId) {
    return (userSockets.get(String(userId))?.size || 0) > 0;
  },
  joinGroup(groupId, userId) {
    const gid = String(groupId);
    if (!onlineByGroup.has(gid)) onlineByGroup.set(gid, new Set());
    onlineByGroup.get(gid).add(String(userId));
  },
  leaveGroup(groupId, userId) {
    onlineByGroup.get(String(groupId))?.delete(String(userId));
  },
  onlineIds(groupId) {
    return onlineByGroup.get(String(groupId)) || new Set();
  },
};

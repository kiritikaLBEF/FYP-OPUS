import { Router } from 'express';
import { protect, requireOnboardingComplete } from '../middleware/auth.js';
import { uploadCommunityFiles } from '../middleware/upload.js';
import {
  listMyGroups,
  discoverGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  joinPublicGroup,
  leaveGroup,
  listMembers,
  updateMember,
  createGroupInvite,
  listGroupInvites,
  revokeInvite,
  resolveInvite,
  joinByInvite,
  listMessages,
  sendMessage,
  deleteCommunityMessage,
  pinMessage,
  getCommunityUnread,
  markGroupRead,
  reportGroup,
} from '../controllers/communityController.js';

const router = Router();

router.use(protect, requireOnboardingComplete);

const handleCommunityUpload = (req, res, next) => {
  uploadCommunityFiles.array('files', 5)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    next();
  });
};

router.get('/unread-count', getCommunityUnread);
router.get('/groups/mine', listMyGroups);
router.get('/groups/discover', discoverGroups);
router.post('/groups', createGroup);
router.get('/groups/:groupId', getGroup);
router.patch('/groups/:groupId', updateGroup);
router.delete('/groups/:groupId', deleteGroup);
router.post('/groups/:groupId/join', joinPublicGroup);
router.post('/groups/:groupId/leave', leaveGroup);
router.post('/groups/:groupId/read', markGroupRead);

router.get('/groups/:groupId/members', listMembers);
router.patch('/groups/:groupId/members/:userId', updateMember);

router.get('/groups/:groupId/invites', listGroupInvites);
router.post('/groups/:groupId/invites', createGroupInvite);
router.post('/invites/:inviteId/revoke', revokeInvite);
router.get('/invite/:code', resolveInvite);
router.post('/invite/:code/join', joinByInvite);

router.post('/groups/:groupId/report', reportGroup);
router.get('/groups/:groupId/messages', listMessages);
router.post('/groups/:groupId/messages', handleCommunityUpload, sendMessage);
router.delete('/messages/:messageId', deleteCommunityMessage);
router.post('/messages/:messageId/pin', pinMessage);

export default router;

import { Router } from 'express';
import { protect, requireOnboardingComplete } from '../middleware/auth.js';
import { uploadWorkspaceFiles } from '../middleware/upload.js';
import {
  listMyTeamWorkspaces,
  getTeamWorkspace,
  startTeamRole,
  addTeamProgressUpdate,
  reviewTeamUpdate,
  finalizeTeamRole,
  completeTeamProject,
  payTeamWorkspace,
  toggleTeamGuideline,
} from '../controllers/teamWorkspaceController.js';

const router = Router();

router.use(protect, requireOnboardingComplete);

router.get('/', listMyTeamWorkspaces);
router.get('/:teamId', getTeamWorkspace);
router.post('/:teamId/start', startTeamRole);
router.post(
  '/:teamId/updates',
  uploadWorkspaceFiles.array('files', 8),
  addTeamProgressUpdate,
);
router.post('/:teamId/updates/:updateId/review', reviewTeamUpdate);
router.post('/:teamId/finalize-role', finalizeTeamRole);
router.post('/:teamId/complete', completeTeamProject);
router.post('/:teamId/pay', payTeamWorkspace);
router.post('/:teamId/guidelines/:guidelineId/toggle', toggleTeamGuideline);

export default router;

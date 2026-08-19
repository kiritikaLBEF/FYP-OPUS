import { Router } from 'express';
import { protect, requireOnboardingComplete, requireWalletUser } from '../middleware/auth.js';
import {
  getWallet,
  getWalletLedger,
  linkPayoutMethod,
  setPrimaryPayoutMethod,
  unlinkPayoutMethod,
  updateWalletSettings,
  paySessionFromWallet,
  initiateWalletPayment,
  verifyWalletPayment,
  withdrawFromWallet,
} from '../controllers/walletController.js';

const router = Router();
router.use(protect, requireOnboardingComplete, requireWalletUser);

router.get('/', getWallet);
router.get('/ledger', getWalletLedger);
router.post('/payout-methods', linkPayoutMethod);
router.patch('/payout-methods/:methodId/primary', setPrimaryPayoutMethod);
router.delete('/payout-methods/:methodId', unlinkPayoutMethod);
router.patch('/settings', updateWalletSettings);
router.post('/pay-session/:sessionId', paySessionFromWallet);
router.post('/pay/initiate', initiateWalletPayment);
router.post('/pay/verify', verifyWalletPayment);
router.post('/withdraw', withdrawFromWallet);

export default router;

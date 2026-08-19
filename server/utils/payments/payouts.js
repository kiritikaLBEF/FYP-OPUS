import { isPaymentSandbox } from './config.js';

/**
 * Merchant disbursement to a user's eSewa/Khalti ID requires a live payout contract.
 * In sandbox (default for this project), a withdrawal is settled on the OPUS ledger
 * against the linked account the freelancer actually saved.
 */
export async function sendPayout({ provider, accountId, amount, reference }) {
  if (!accountId) {
    const err = new Error('A linked payout account is required');
    err.status = 400;
    throw err;
  }
  if (!isPaymentSandbox()) {
    const err = new Error(
      `Live ${provider === 'esewa' ? 'eSewa' : 'Khalti'} disbursement is not enabled on this merchant account yet.`,
    );
    err.status = 503;
    throw err;
  }
  return {
    ok: true,
    mode: 'sandbox',
    gatewayRef: `SANDBOX-${provider.toUpperCase()}-${reference}`,
    accountId,
    amount,
  };
}

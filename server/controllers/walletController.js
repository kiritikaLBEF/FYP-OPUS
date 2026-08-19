import crypto from 'crypto';
import WorkSession from '../models/WorkSession.js';
import PaymentIntent from '../models/PaymentIntent.js';
import {
  ensureWallet,
  summarizeWallet,
  serializePayoutMethod,
  normalizeNepalPhone,
  isValidNepalMobile,
  settleJobToFreelancerWallet,
  applyTopup,
  applyWithdrawal,
  roundNpr,
} from '../utils/walletLedger.js';
import { paymentProviderStatus, isPaymentSandbox } from '../utils/payments/config.js';
import { initiateKhaltiPayment, lookupKhaltiPayment } from '../utils/payments/khalti.js';
import { buildEsewaPayment, decodeEsewaCallback, verifyEsewaSignature, lookupEsewaPayment } from '../utils/payments/esewa.js';
import { sendPayout } from '../utils/payments/payouts.js';
import Transaction from '../models/Transaction.js';

const clientOrigin = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const callbackPath = (role) => (
  role === 'employer' ? '/employer/wallet/callback' : '/wallet/callback'
);

const defaultRedirect = (role) => (
  role === 'employer' ? '/employer/wallet' : '/wallet'
);

const methodLabel = (provider) => (provider === 'esewa' ? 'eSewa' : 'Khalti');

const serializeTxn = (t) => ({
  id: t._id,
  transactionId: t.transactionId,
  occurredAt: t.occurredAt,
  description: t.description,
  organizationName: t.organizationName || '',
  projectTitle: t.projectTitle || '',
  paymentType: t.paymentType,
  method: t.method || '',
  debit: t.debit,
  credit: t.credit,
  runningBalance: t.runningBalance,
  paymentStatus: t.paymentStatus,
  transactionStatus: t.transactionStatus,
  payoutAccount: t.payoutAccount || '',
  gatewayRef: t.gatewayRef || '',
});

export const getWallet = async (req, res) => {
  try {
    const summary = await summarizeWallet(req.user._id);
    const displayName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim()
      || req.user.organizationName
      || '';
    res.json({
      role: req.user.role,
      displayName,
      email: req.user.email || '',
      phone: req.user.phone || '',
      providers: paymentProviderStatus(),
      ...summary,
    });
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({ message: 'Failed to load wallet' });
  }
};

export const getWalletLedger = async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const q = { userId: req.user._id, isDemo: { $ne: true } };
    if (filter === 'credits') q.credit = { $gt: 0 };
    if (filter === 'payouts') q.paymentType = { $in: ['withdrawal', 'hiring', 'platform_fee'] };

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Transaction.find(q).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
      Transaction.countDocuments(q),
    ]);

    res.json({
      items: items.map(serializeTxn),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error('Wallet ledger error:', err);
    res.status(500).json({ message: 'Failed to load ledger' });
  }
};

export const linkPayoutMethod = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can link a payout account' });
    }
    const provider = req.body.provider === 'khalti' ? 'khalti' : req.body.provider === 'esewa' ? 'esewa' : '';
    if (!provider) return res.status(400).json({ message: 'Choose eSewa or Khalti' });
    const accountId = normalizeNepalPhone(req.body.accountId || req.body.phone);
    if (!isValidNepalMobile(accountId)) {
      return res.status(400).json({ message: 'Enter a valid Nepal mobile number (10 digits, starting with 9)' });
    }

    const wallet = await ensureWallet(req.user._id);
    const existing = wallet.payoutMethods.find((m) => m.provider === provider);
    if (existing) {
      existing.accountId = accountId;
      existing.last4 = accountId.slice(-4);
      existing.linkedAt = new Date();
    } else {
      const makePrimary = wallet.payoutMethods.length === 0 || !!req.body.isPrimary;
      if (makePrimary) wallet.payoutMethods.forEach((m) => { m.isPrimary = false; });
      wallet.payoutMethods.push({
        provider,
        accountId,
        last4: accountId.slice(-4),
        isPrimary: makePrimary,
        linkedAt: new Date(),
      });
    }
    await wallet.save();
    const summary = await summarizeWallet(req.user._id);
    res.json({ message: `${methodLabel(provider)} linked`, payoutMethods: summary.payoutMethods });
  } catch (err) {
    console.error('Link payout error:', err);
    res.status(500).json({ message: 'Failed to link payout method' });
  }
};

export const setPrimaryPayoutMethod = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.user._id);
    const method = wallet.payoutMethods.id(req.params.methodId);
    if (!method) return res.status(404).json({ message: 'Payout method not found' });
    wallet.payoutMethods.forEach((m) => { m.isPrimary = String(m._id) === String(method._id); });
    await wallet.save();
    res.json({ payoutMethods: wallet.payoutMethods.map(serializePayoutMethod) });
  } catch (err) {
    console.error('Set primary payout error:', err);
    res.status(500).json({ message: 'Failed to update payout method' });
  }
};

export const unlinkPayoutMethod = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.user._id);
    const method = wallet.payoutMethods.id(req.params.methodId);
    if (!method) return res.status(404).json({ message: 'Payout method not found' });
    const wasPrimary = method.isPrimary;
    method.deleteOne();
    if (wasPrimary && wallet.payoutMethods.length) {
      wallet.payoutMethods[0].isPrimary = true;
    }
    await wallet.save();
    res.json({ payoutMethods: wallet.payoutMethods.map(serializePayoutMethod) });
  } catch (err) {
    console.error('Unlink payout error:', err);
    res.status(500).json({ message: 'Failed to remove payout method' });
  }
};

export const updateWalletSettings = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.user._id);
    if (typeof req.body.autoWithdraw === 'boolean') {
      wallet.settings.autoWithdraw = req.body.autoWithdraw;
    }
    if (req.body.autoWithdrawProvider === 'esewa' || req.body.autoWithdrawProvider === 'khalti' || req.body.autoWithdrawProvider === '') {
      wallet.settings.autoWithdrawProvider = req.body.autoWithdrawProvider;
    }
    if (typeof req.body.emailReceipts === 'boolean') {
      wallet.settings.emailReceipts = req.body.emailReceipts;
    }
    await wallet.save();
    res.json({
      settings: {
        autoWithdraw: !!wallet.settings.autoWithdraw,
        autoWithdrawProvider: wallet.settings.autoWithdrawProvider || '',
        emailReceipts: wallet.settings.emailReceipts !== false,
      },
    });
  } catch (err) {
    console.error('Wallet settings error:', err);
    res.status(500).json({ message: 'Failed to save settings' });
  }
};

const loadPayableSession = async (req, sessionId) => {
  const session = await WorkSession.findById(sessionId);
  if (!session) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  if (String(session.employerId) !== String(req.user._id)) {
    const err = new Error('Only the organization can pay for this work');
    err.status = 403;
    throw err;
  }
  if (session.status !== 'awaiting_payment') {
    const err = new Error('Payment is not awaiting confirmation');
    err.status = 400;
    throw err;
  }
  return session;
};

export const paySessionFromWallet = async (req, res) => {
  try {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can pay from their wallet' });
    }
    const session = await loadPayableSession(req, req.params.sessionId);
    const result = await settleJobToFreelancerWallet({
      session,
      method: 'opus',
      employerPaidViaGateway: false,
    });
    res.json({
      message: 'Paid from OPUS wallet. Funds are now in the freelancer wallet.',
      amount: result.amount,
      availableBalance: (await summarizeWallet(req.user._id)).availableBalance,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('Pay from wallet error:', err);
    res.status(status).json({
      message: err.message || 'Failed to pay from wallet',
      code: err.code,
      availableBalance: err.availableBalance,
    });
  }
};

export const initiateWalletPayment = async (req, res) => {
  try {
    const provider = req.body.provider === 'khalti' ? 'khalti' : req.body.provider === 'esewa' ? 'esewa' : '';
    if (!provider) return res.status(400).json({ message: 'Choose eSewa or Khalti' });

    const kind = req.body.kind === 'job_pay' ? 'job_pay' : 'topup';
    if (kind === 'job_pay' && req.user.role !== 'employer') {
      return res.status(403).json({ message: 'Only the organization can pay a job' });
    }
    if (kind === 'topup' && req.user.role !== 'employer') {
      return res.status(403).json({ message: 'Only organizations can add funds to an OPUS wallet' });
    }

    let amount = roundNpr(req.body.amount);
    let session = null;
    let successRedirect = String(req.body.successRedirect || defaultRedirect(req.user.role));
    if (!successRedirect.startsWith('/')) successRedirect = defaultRedirect(req.user.role);

    if (kind === 'job_pay') {
      session = await loadPayableSession(req, req.body.sessionId);
      amount = roundNpr(session.bidAmount);
      if (!successRedirect.includes('/workspace/')) {
        successRedirect = `/employer/workspace/${session._id}`;
      }
    }

    if (!(amount >= 10)) {
      return res.status(400).json({ message: 'Amount must be at least NPR 10' });
    }

    const providers = paymentProviderStatus();
    if (provider === 'khalti' && !providers.khalti.collection) {
      return res.status(503).json({ message: 'Khalti is not configured. Add KHALTI_SECRET_KEY in the server environment.' });
    }
    if (provider === 'esewa' && !providers.esewa.collection) {
      return res.status(503).json({ message: 'eSewa is not configured.' });
    }

    const purchaseOrderId = `OPUS-${crypto.randomBytes(8).toString('hex')}`;
    const origin = clientOrigin();
    const returnUrl = `${origin}${callbackPath(req.user.role)}?provider=${provider}&intent=${purchaseOrderId}`;
    const failureUrl = `${origin}${callbackPath(req.user.role)}?provider=${provider}&intent=${purchaseOrderId}&status=failed`;

    const intent = await PaymentIntent.create({
      userId: req.user._id,
      kind,
      provider,
      amount,
      status: 'pending',
      workSessionId: session?._id,
      purchaseOrderId,
      transactionUuid: purchaseOrderId,
      successRedirect,
      metadata: session ? { title: session.title } : {},
    });

    if (provider === 'khalti') {
      const started = await initiateKhaltiPayment({
        amount,
        purchaseOrderId,
        purchaseOrderName: session ? `OPUS · ${session.title}` : 'OPUS wallet top-up',
        returnUrl,
        websiteUrl: origin,
        customer: {
          name: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.organizationName,
          email: req.user.email,
          phone: normalizeNepalPhone(req.user.phone),
        },
      });
      intent.pidx = started.pidx || '';
      await intent.save();
      return res.json({
        provider,
        kind,
        amount,
        paymentUrl: started.payment_url,
        intentId: intent.purchaseOrderId,
      });
    }

    const form = buildEsewaPayment({
      amount,
      transactionUuid: purchaseOrderId,
      successUrl: returnUrl,
      failureUrl,
    });
    await intent.save();
    return res.json({
      provider,
      kind,
      amount,
      form,
      intentId: intent.purchaseOrderId,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('Initiate payment error:', err);
    res.status(status).json({ message: err.message || 'Failed to start payment' });
  }
};

async function fulfillIntent(intent) {
  if (intent.status === 'completed') return { already: true, intent };
  if (intent.kind === 'topup') {
    await applyTopup({
      userId: intent.userId,
      amount: intent.amount,
      method: intent.provider,
      gatewayRef: intent.gatewayRef,
    });
  } else if (intent.kind === 'job_pay') {
    const session = await WorkSession.findById(intent.workSessionId);
    if (!session) {
      const err = new Error('Workspace not found for this payment');
      err.status = 404;
      throw err;
    }
    if (session.status === 'paid' || session.status === 'certified') {
      intent.status = 'completed';
      await intent.save();
      return { already: true, intent };
    }
    await settleJobToFreelancerWallet({
      session,
      method: intent.provider,
      gatewayRef: intent.gatewayRef,
      employerPaidViaGateway: true,
    });
  }
  intent.status = 'completed';
  await intent.save();
  return { already: false, intent };
}

export const verifyWalletPayment = async (req, res) => {
  try {
    const provider = req.body.provider === 'khalti' ? 'khalti' : req.body.provider === 'esewa' ? 'esewa' : '';
    const intentKey = String(req.body.intentId || req.body.purchase_order_id || '').trim();
    if (!provider) return res.status(400).json({ message: 'Missing payment provider' });

    let intent = null;
    if (intentKey) {
      intent = await PaymentIntent.findOne({ purchaseOrderId: intentKey, userId: req.user._id });
    }
    if (!intent && req.body.pidx) {
      intent = await PaymentIntent.findOne({ pidx: req.body.pidx, userId: req.user._id });
    }

    if (!intent) {
      return res.status(404).json({ message: 'Payment session not found' });
    }
    if (intent.provider !== provider) {
      return res.status(400).json({ message: 'Provider does not match this payment' });
    }
    if (intent.status === 'completed') {
      return res.json({
        message: 'Payment already recorded',
        kind: intent.kind,
        amount: intent.amount,
        successRedirect: intent.successRedirect || defaultRedirect(req.user.role),
      });
    }

    const locked = await PaymentIntent.findOneAndUpdate(
      { _id: intent._id, status: { $in: ['pending', 'failed'] } },
      { $set: { status: 'processing' } },
      { new: true },
    );
    if (!locked) {
      const current = await PaymentIntent.findById(intent._id);
      if (current?.status === 'completed') {
        return res.json({
          message: 'Payment already recorded',
          kind: current.kind,
          amount: current.amount,
          successRedirect: current.successRedirect || defaultRedirect(req.user.role),
        });
      }
      return res.status(409).json({ message: 'This payment is already being confirmed' });
    }

    if (provider === 'khalti') {
      const pidx = req.body.pidx || locked.pidx;
      if (!pidx) {
        locked.status = 'pending';
        await locked.save();
        return res.status(400).json({ message: 'Missing Khalti payment id' });
      }
      const lookup = await lookupKhaltiPayment(pidx);
      if (lookup.status !== 'Completed') {
        locked.status = lookup.status === 'Pending' ? 'pending' : 'failed';
        await locked.save();
        return res.status(400).json({ message: `Khalti payment is ${lookup.status || 'not complete'}` });
      }
      const paidPaisa = Number(lookup.total_amount);
      if (Number.isFinite(paidPaisa) && Math.round(locked.amount * 100) !== paidPaisa) {
        locked.status = 'failed';
        await locked.save();
        return res.status(400).json({ message: 'Paid amount does not match this order' });
      }
      locked.pidx = pidx;
      locked.gatewayRef = lookup.transaction_id || pidx;
    } else {
      const payload = decodeEsewaCallback(req.body.data) || {};
      const uuid = payload.transaction_uuid || locked.transactionUuid;
      if (payload.signature && !verifyEsewaSignature(payload)) {
        locked.status = 'failed';
        await locked.save();
        return res.status(400).json({ message: 'eSewa signature could not be verified' });
      }
      const lookup = await lookupEsewaPayment({
        transactionUuid: uuid,
        totalAmount: locked.amount,
      });
      const status = String(lookup.status || payload.status || '').toUpperCase();
      if (status !== 'COMPLETE') {
        locked.status = 'failed';
        await locked.save();
        return res.status(400).json({ message: `eSewa payment is ${lookup.status || 'not complete'}` });
      }
      locked.gatewayRef = lookup.ref_id || payload.transaction_code || uuid;
    }

    await locked.save();
    const result = await fulfillIntent(locked);
    res.json({
      message: result.already ? 'Payment already recorded' : 'Payment confirmed',
      kind: locked.kind,
      amount: locked.amount,
      successRedirect: locked.successRedirect || defaultRedirect(req.user.role),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('Verify payment error:', err);
    res.status(status).json({ message: err.message || 'Failed to verify payment' });
  }
};

export const withdrawFromWallet = async (req, res) => {
  try {
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ message: 'Only freelancers can withdraw from an OPUS wallet' });
    }
    const provider = req.body.provider === 'khalti' ? 'khalti' : req.body.provider === 'esewa' ? 'esewa' : '';
    if (!provider) return res.status(400).json({ message: 'Choose eSewa or Khalti' });

    const amount = roundNpr(req.body.amount);
    if (!(amount >= 10)) {
      return res.status(400).json({ message: 'Minimum withdrawal is NPR 10' });
    }

    const wallet = await ensureWallet(req.user._id);
    if (amount > roundNpr(wallet.availableBalance)) {
      return res.status(400).json({
        message: 'Amount is more than your available OPUS balance',
        availableBalance: roundNpr(wallet.availableBalance),
      });
    }

    const method = wallet.payoutMethods.find((m) => m.provider === provider)
      || wallet.payoutMethods.find((m) => m.isPrimary);
    if (!method || method.provider !== provider) {
      return res.status(400).json({ message: `Link your ${methodLabel(provider)} number before withdrawing` });
    }

    const providers = paymentProviderStatus();
    if (!providers[provider]?.payout) {
      return res.status(503).json({
        message: `Live ${methodLabel(provider)} payout is not enabled yet.`,
      });
    }

    const payout = await sendPayout({
      provider,
      accountId: method.accountId,
      amount,
      reference: crypto.randomBytes(4).toString('hex'),
    });

    await applyWithdrawal({
      userId: req.user._id,
      amount,
      provider,
      accountId: method.accountId,
      gatewayRef: payout.gatewayRef,
    });

    const summary = await summarizeWallet(req.user._id);
    res.json({
      message: `NPR ${amount.toLocaleString('en-NP')} sent to ${methodLabel(provider)} ${method.accountId.slice(0, 2)}••••${method.accountId.slice(-2)}`,
      sandbox: isPaymentSandbox(),
      availableBalance: summary.availableBalance,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('Withdraw error:', err);
    res.status(status).json({ message: err.message || 'Failed to withdraw' });
  }
};

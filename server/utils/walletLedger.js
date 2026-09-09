import crypto from 'crypto';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import ActivityEvent from '../models/ActivityEvent.js';
import { notifyUser } from './notify.js';
import { issueCertificateForPaidSession } from './workCertificate.js';

export const PLATFORM_FEE_RATE = 0.10;

export const roundNpr = (n) => Math.round(Number(n || 0) * 100) / 100;

export function splitJobPayment(gross) {
  const g = roundNpr(gross);
  const fee = roundNpr(g * PLATFORM_FEE_RATE);
  const net = roundNpr(g - fee);
  return {
    gross: g,
    feeRate: PLATFORM_FEE_RATE,
    fee,
    net,
  };
}

export const makeTxnId = () => `OPUS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

export const normalizeNepalPhone = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('977') && digits.length > 10) digits = digits.slice(3);
  return digits;
};

export const isValidNepalMobile = (phone) => /^9[6-9]\d{8}$/.test(phone);

export const maskAccount = (accountId) => {
  const id = String(accountId || '');
  if (id.length < 4) return '••••';
  return `${id.slice(0, 2)}${'•'.repeat(Math.max(4, id.length - 4))}${id.slice(-2)}`;
};

export const serializePayoutMethod = (m) => ({
  id: String(m._id),
  provider: m.provider,
  accountId: m.accountId,
  masked: maskAccount(m.accountId),
  last4: m.last4 || m.accountId.slice(-4),
  isPrimary: !!m.isPrimary,
  linkedAt: m.linkedAt,
});

export async function ensureWallet(userId) {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId });
  }
  return wallet;
}

export async function getAvailableBalance(userId) {
  const wallet = await ensureWallet(userId);
  return roundNpr(wallet.availableBalance);
}

async function lastRunningBalance(userId) {
  const last = await Transaction.findOne({ userId, isDemo: { $ne: true } })
    .sort({ occurredAt: -1, createdAt: -1 })
    .select('runningBalance')
    .lean();
  return roundNpr(last?.runningBalance || 0);
}

export async function appendLedger(userId, {
  credit = 0,
  debit = 0,
  description,
  paymentType = 'milestone',
  method = '',
  paymentStatus = 'completed',
  transactionStatus = 'settled',
  organizationRef = '',
  organizationName = '',
  projectRef = '',
  projectTitle = '',
  workSessionId = null,
  gatewayRef = '',
  counterpartyUserId = null,
  payoutAccount = '',
}) {
  const inAmt = roundNpr(credit);
  const outAmt = roundNpr(debit);
  const wallet = await ensureWallet(userId);
  const nextAvailable = roundNpr(wallet.availableBalance + inAmt - outAmt);
  if (nextAvailable < 0) {
    const err = new Error('OPUS wallet balance is not enough for this payment');
    err.status = 400;
    err.code = 'INSUFFICIENT_WALLET';
    err.availableBalance = roundNpr(wallet.availableBalance);
    throw err;
  }

  const runningBalance = roundNpr((await lastRunningBalance(userId)) + inAmt - outAmt);
  const txn = await Transaction.create({
    userId,
    transactionId: makeTxnId(),
    occurredAt: new Date(),
    description,
    organizationRef,
    organizationName,
    projectRef,
    projectTitle,
    paymentType,
    method: method || '',
    debit: outAmt,
    credit: inAmt,
    runningBalance,
    paymentStatus,
    transactionStatus,
    workSessionId: workSessionId || undefined,
    gatewayRef: gatewayRef || '',
    counterpartyUserId: counterpartyUserId || undefined,
    payoutAccount: payoutAccount || '',
    isDemo: false,
  });

  wallet.availableBalance = nextAvailable;
  if (inAmt > 0 && ['milestone', 'bonus', 'topup'].includes(paymentType)) {
    wallet.lifetimeEarned = roundNpr(wallet.lifetimeEarned + inAmt);
  }
  if (outAmt > 0 && paymentType === 'withdrawal') {
    wallet.lifetimeWithdrawn = roundNpr(wallet.lifetimeWithdrawn + outAmt);
  }
  if (outAmt > 0 && paymentType === 'platform_fee') {
    wallet.lifetimePlatformFees = roundNpr((wallet.lifetimePlatformFees || 0) + outAmt);
  }
  await wallet.save();
  return { txn, wallet };
}

export async function summarizeWallet(userId) {
  const wallet = await ensureWallet(userId);
  const txns = await Transaction.find({ userId, isDemo: { $ne: true } }).sort({ occurredAt: 1 }).lean();
  const processing = txns
    .filter((t) => t.transactionStatus === 'processing' || t.paymentStatus === 'pending')
    .reduce((s, t) => s + (t.debit || 0) + (t.credit || 0), 0);

  const platformFees = txns
    .filter((t) => t.paymentType === 'platform_fee')
    .reduce((s, t) => s + (t.debit || 0), 0);

  return {
    availableBalance: roundNpr(wallet.availableBalance),
    pendingBalance: roundNpr(wallet.pendingBalance || processing),
    lifetimeEarned: roundNpr(wallet.lifetimeEarned),
    lifetimeWithdrawn: roundNpr(wallet.lifetimeWithdrawn),
    platformFees: roundNpr(wallet.lifetimePlatformFees || platformFees),
    feeRate: PLATFORM_FEE_RATE,
    payoutCount: (wallet.payoutMethods || []).length,
    payoutMethods: (wallet.payoutMethods || []).map(serializePayoutMethod),
    settings: {
      autoWithdraw: !!wallet.settings?.autoWithdraw,
      autoWithdrawProvider: wallet.settings?.autoWithdrawProvider || '',
      emailReceipts: wallet.settings?.emailReceipts !== false,
      lowBalanceThreshold: Number(wallet.settings?.lowBalanceThreshold ?? 10000),
    },
  };
}

export async function settleJobToFreelancerWallet({
  session,
  method = 'opus',
  gatewayRef = '',
  employerPaidViaGateway = false,
}) {
  if (!session) {
    const err = new Error('Workspace not found');
    err.status = 404;
    throw err;
  }
  if (!['awaiting_payment'].includes(session.status)) {
    const err = new Error('Payment is not awaiting confirmation');
    err.status = 400;
    throw err;
  }
  const amount = roundNpr(session.bidAmount);
  if (!(amount > 0)) {
    const err = new Error('This workspace has no payable amount');
    err.status = 400;
    throw err;
  }
  const { gross, fee, net, feeRate } = splitJobPayment(amount);

  if (employerPaidViaGateway) {
    await appendLedger(session.employerId, {
      credit: gross,
      description: `Added via ${method === 'esewa' ? 'eSewa' : 'Khalti'} for "${session.title}"`,
      paymentType: 'topup',
      method,
      organizationName: session.organizationName,
      projectTitle: session.title,
      projectRef: session.paymentRef || '',
      workSessionId: session._id,
      gatewayRef,
    });
  }

  await appendLedger(session.employerId, {
    debit: gross,
    description: `Paid freelancer for "${session.title}"`,
    paymentType: 'hiring',
    method: employerPaidViaGateway ? method : 'opus',
    organizationName: session.organizationName,
    projectTitle: session.title,
    projectRef: session.paymentRef || '',
    workSessionId: session._id,
    gatewayRef,
    counterpartyUserId: session.freelancerId,
  });

  await appendLedger(session.freelancerId, {
    credit: gross,
    description: `Payment released for "${session.title}"`,
    paymentType: 'milestone',
    method: employerPaidViaGateway ? method : 'opus',
    organizationName: session.organizationName,
    projectTitle: session.title,
    projectRef: session.paymentRef || '',
    workSessionId: session._id,
    gatewayRef,
    counterpartyUserId: session.employerId,
  });

  if (fee > 0) {
    await appendLedger(session.freelancerId, {
      debit: fee,
      description: `OPUS service charge (${Math.round(feeRate * 100)}%) for "${session.title}"`,
      paymentType: 'platform_fee',
      method: 'opus',
      organizationName: session.organizationName,
      projectTitle: session.title,
      projectRef: session.paymentRef || '',
      workSessionId: session._id,
      gatewayRef,
    });
  }

  session.status = 'paid';
  session.paidAt = new Date();
  await session.save();

  await ActivityEvent.create({
    userId: session.freelancerId,
    type: 'payment_received',
    title: 'Payment received',
    subtitle: `${session.organizationName || 'The organization'} paid for "${session.title}"`,
    meta: {
      organizationName: session.organizationName,
      projectTitle: session.title,
      projectRef: session.paymentRef || '',
      amount: net,
    },
    occurredAt: new Date(),
    isDemo: false,
  }).catch(() => {});

  await notifyUser({
    userId: session.freelancerId,
    type: 'payment_confirmed',
    title: 'Payment in your OPUS wallet',
    message: `${session.organizationName || 'The organization'} paid NPR ${gross.toLocaleString('en-NP')} for "${session.title}". OPUS kept NPR ${fee.toLocaleString('en-NP')} (${Math.round(feeRate * 100)}% service charge). NPR ${net.toLocaleString('en-NP')} is in your wallet.`,
    link: '/wallet',
    meta: { workspaceId: session._id, jobId: session.jobPostingId, amount: net, gross, fee },
  });

  try {
    await issueCertificateForPaidSession(session);
  } catch (certErr) {
    console.error('Auto-issue certificate after payment failed:', certErr.message);
  }

  return { amount: gross, fee, net, feeRate, session };
}

export async function settleTeamWorkspaceToWallets(team) {
  if (!team) {
    const err = new Error('Team workspace not found');
    err.status = 404;
    throw err;
  }
  if (team.status !== 'awaiting_payment') {
    const err = new Error('Team payment is not awaiting confirmation');
    err.status = 400;
    throw err;
  }

  const allFinalized = (team.members || []).every((m) =>
    ['role_finalized', 'paid', 'certified'].includes(m.roleStatus),
  );
  if (!allFinalized) {
    const err = new Error('Finalize every role before paying the team');
    err.status = 400;
    throw err;
  }

  const totalGross = roundNpr(
    (team.members || []).reduce((sum, m) => sum + Number(m.splitAmount || 0), 0),
  );
  if (!(totalGross > 0)) {
    const err = new Error('No payable split amounts on this team workspace');
    err.status = 400;
    throw err;
  }

  const employerBalance = await getAvailableBalance(team.employerId);
  if (employerBalance < totalGross) {
    const err = new Error('OPUS wallet balance is not enough for the full team payout');
    err.status = 400;
    err.code = 'INSUFFICIENT_WALLET';
    err.availableBalance = employerBalance;
    throw err;
  }

  const bill = [];
  for (const member of team.members) {
    const amount = roundNpr(member.splitAmount);
    if (!(amount > 0)) continue;
    const { gross, fee, net, feeRate } = splitJobPayment(amount);

    await appendLedger(team.employerId, {
      debit: gross,
      description: `Paid ${member.roleName || 'role'} for "${team.title}"`,
      paymentType: 'hiring',
      method: 'opus',
      organizationName: team.organizationName,
      projectTitle: team.title,
      projectRef: team.paymentRef || '',
      counterpartyUserId: member.freelancerId,
    });

    await appendLedger(member.freelancerId, {
      credit: gross,
      description: `Team payment for "${team.title}" (${member.roleName || 'role'})`,
      paymentType: 'milestone',
      method: 'opus',
      organizationName: team.organizationName,
      projectTitle: team.title,
      projectRef: team.paymentRef || '',
      counterpartyUserId: team.employerId,
    });

    if (fee > 0) {
      await appendLedger(member.freelancerId, {
        debit: fee,
        description: `OPUS service charge (${Math.round(feeRate * 100)}%) for "${team.title}"`,
        paymentType: 'platform_fee',
        method: 'opus',
        organizationName: team.organizationName,
        projectTitle: team.title,
        projectRef: team.paymentRef || '',
      });
    }

    member.roleStatus = 'paid';
    member.paidAt = new Date();
    if (!member.certificateId) {
      member.certificateId = `OPUS-CERT-${String(team._id).slice(-4)}${String(member.roleKey).slice(0, 4)}`.toUpperCase();
    }

    bill.push({
      freelancerId: member.freelancerId,
      roleKey: member.roleKey,
      roleName: member.roleName,
      gross,
      fee,
      net,
    });

    await notifyUser({
      userId: member.freelancerId,
      type: 'payment_confirmed',
      title: 'Team payment in your OPUS wallet',
      message: `${team.organizationName || 'The organization'} paid NPR ${gross.toLocaleString('en-NP')} for your ${member.roleName || 'role'} on "${team.title}". OPUS deducted NPR ${fee.toLocaleString('en-NP')} (10% service charge). NPR ${net.toLocaleString('en-NP')} is now in your wallet.`,
      link: '/wallet',
      meta: { teamWorkspaceId: team._id, jobId: team.jobPostingId, amount: net, gross, fee },
    });

    try {
      const pseudo = {
        _id: `${team._id}-${member.roleKey}`,
        freelancerId: member.freelancerId,
        title: `${team.title} · ${member.roleName || member.roleKey}`,
        organizationName: team.organizationName,
        status: 'paid',
        certificateId: member.certificateId,
        certificateFilePath: '',
        certifiedAt: null,
        certificateAddedToProfile: false,
        save: async function savePseudo() {
          member.certificateFilePath = this.certificateFilePath;
          member.certificateId = this.certificateId;
          member.roleStatus = 'certified';
          member.certifiedAt = this.certifiedAt || new Date();
        },
      };
      await issueCertificateForPaidSession(pseudo);
      member.roleStatus = 'certified';
      member.certifiedAt = new Date();
      member.certificateFilePath = pseudo.certificateFilePath || member.certificateFilePath;
    } catch (certErr) {
      console.error('Team cert issue failed:', certErr.message);
    }
  }

  team.status = 'certified';
  team.paidAt = new Date();
  team.certifiedAt = new Date();
  await team.save();

  return { totalGross, bill, team };
}

export async function applyTopup({ userId, amount, method, gatewayRef, description }) {
  const result = await appendLedger(userId, {
    credit: amount,
    description: description || `Added from ${method === 'esewa' ? 'eSewa' : 'Khalti'}`,
    paymentType: 'topup',
    method,
    gatewayRef,
  });

  const credited = roundNpr(amount);
  await notifyUser({
    userId,
    type: 'wallet_topup',
    title: 'Funds added to OPUS wallet',
    message: `NPR ${credited.toLocaleString('en-NP')} was added from ${method === 'esewa' ? 'eSewa' : 'Khalti'}.`,
    link: '/wallet',
    meta: { amount: credited, method },
  });

  return result;
}

export async function applyWithdrawal({
  userId,
  amount,
  provider,
  accountId,
  gatewayRef,
}) {
  const result = await appendLedger(userId, {
    debit: amount,
    description: `Withdrawal to ${provider === 'esewa' ? 'eSewa' : 'Khalti'} ${maskAccount(accountId)}`,
    paymentType: 'withdrawal',
    method: provider,
    gatewayRef,
    payoutAccount: maskAccount(accountId),
  });

  await ActivityEvent.create({
    userId,
    type: 'withdrawal_completed',
    title: 'Withdrawal sent',
    subtitle: `NPR ${roundNpr(amount).toLocaleString('en-NP')} to ${provider === 'esewa' ? 'eSewa' : 'Khalti'}`,
    meta: { amount },
    occurredAt: new Date(),
    isDemo: false,
  }).catch(() => {});

  return result;
}

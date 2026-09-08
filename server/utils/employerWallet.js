import JobPosting from '../models/JobPosting.js';
import WorkSession from '../models/WorkSession.js';
import { ensureWallet, getAvailableBalance, roundNpr } from './walletLedger.js';

const COMPLETED_WORKSPACE_STATUSES = new Set(['paid', 'certified']);

export function getJobCommitmentAmount(job) {
  if (!job || job.publishStatus === 'draft') return 0;
  if (job.budgetType === 'hourly') {
    return roundNpr(Number(job.hourlyRate) || 0);
  }
  return roundNpr(Number(job.budget) || 0);
}

export async function getEmployerCommittedFunds(employerId) {
  const jobs = await JobPosting.find({
    employerId,
    isRemoved: { $ne: true },
    publishStatus: 'published',
  }).lean();

  if (!jobs.length) return 0;

  const jobIds = jobs.map((j) => j._id);
  const sessions = await WorkSession.find({ jobPostingId: { $in: jobIds } }).lean();
  const sessionByJob = Object.fromEntries(sessions.map((s) => [String(s.jobPostingId), s]));

  let total = 0;
  for (const job of jobs) {
    const ws = sessionByJob[String(job._id)];
    if (ws && COMPLETED_WORKSPACE_STATUSES.has(ws.status)) continue;
    total = roundNpr(total + getJobCommitmentAmount(job));
  }
  return total;
}

export async function getEmployerWalletSummary(employerId) {
  const [availableBalance, committedFunds] = await Promise.all([
    getAvailableBalance(employerId),
    getEmployerCommittedFunds(employerId),
  ]);
  return {
    availableBalance,
    committedFunds,
    remainingFunds: roundNpr(availableBalance - committedFunds),
  };
}

export async function assertEmployerCanFundJob(employerId, jobAmount) {
  const amount = roundNpr(jobAmount);
  const summary = await getEmployerWalletSummary(employerId);
  if (summary.availableBalance < roundNpr(summary.committedFunds + amount)) {
    const err = new Error('Insufficient wallet. Kindly load balance first.');
    err.status = 400;
    err.code = 'INSUFFICIENT_WALLET';
    err.wallet = summary;
    err.requiredTotal = roundNpr(summary.committedFunds + amount);
    throw err;
  }
  return summary;
}

export async function ensureEmployerWallet(employerId) {
  return ensureWallet(employerId);
}

import crypto from 'crypto';

export const makeRoleKey = () => crypto.randomBytes(8).toString('hex');

export const normalizeRolesInput = (rawRoles, totalBudget = 0) => {
  if (!Array.isArray(rawRoles)) return [];
  return rawRoles
    .map((r) => {
      const name = String(r?.name || '').trim();
      if (!name) return null;
      const budgetPercent = Math.max(0, Math.min(100, Number(r.budgetPercent) || 0));
      return {
        roleKey: String(r.roleKey || makeRoleKey()),
        name,
        description: String(r.description || '').trim(),
        budgetPercent,
        budgetAmount: Math.round((Number(totalBudget) || 0) * budgetPercent / 100),
        status: 'open',
        filledByApplicationId: null,
      };
    })
    .filter(Boolean);
};

export const rolesBudgetOk = (roles) => {
  if (!roles.length) return false;
  const sum = roles.reduce((acc, r) => acc + (Number(r.budgetPercent) || 0), 0);
  return Math.round(sum) === 100;
};

export const roleAmount = (job, roleKey) => {
  const role = (job.roles || []).find((r) => r.roleKey === roleKey);
  if (!role) return 0;
  if (role.budgetAmount) return role.budgetAmount;
  return Math.round((Number(job.budget) || 0) * (Number(role.budgetPercent) || 0) / 100);
};

export const serializeRole = (role, job) => ({
  roleKey: role.roleKey,
  name: role.name,
  description: role.description || '',
  budgetPercent: role.budgetPercent || 0,
  budgetAmount: role.budgetAmount || roleAmount(job, role.roleKey),
  status: role.status || 'open',
  filledByApplicationId: role.filledByApplicationId || null,
});

export const allRolesFilled = (job) => {
  const roles = job.roles || [];
  if (!roles.length) return false;
  return roles.every((r) => r.status === 'filled');
};

export const squadReadyToSubmit = (squad) => {
  if (!squad?.members?.length) return false;
  return squad.members.every((m) => m.inviteStatus === 'leader' || m.inviteStatus === 'accepted');
};

export const recomputeSquadTotal = (squad) =>
  (squad.members || []).reduce((sum, m) => sum + (Number(m.splitAmount) || 0), 0);

export const initialsFromUser = (u) => {
  const a = (u?.firstName || '').charAt(0);
  const b = (u?.lastName || '').charAt(0);
  const s = `${a}${b}`.toUpperCase();
  return s || (u?.email || '?').charAt(0).toUpperCase();
};

export const serializeSquadMember = (m, userMap = {}) => {
  const u = userMap[String(m.freelancerId)];
  return {
    freelancerId: String(m.freelancerId),
    roleKey: m.roleKey,
    roleName: m.roleName || '',
    splitAmount: m.splitAmount || 0,
    inviteStatus: m.inviteStatus,
    respondedAt: m.respondedAt || null,
    freelancer: u
      ? {
          id: u._id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          freelancerId: u.freelancerId,
          skills: u.skills || [],
          profilePicture: u.profilePicture || '',
          initials: initialsFromUser(u),
        }
      : null,
  };
};

export const serializeSquadBid = (squad, userMap = {}) => ({
  id: squad._id,
  jobPostingId: squad.jobPostingId,
  employerId: squad.employerId,
  leaderId: String(squad.leaderId),
  name: squad.name,
  message: squad.message || '',
  estimatedDelivery: squad.estimatedDelivery || '',
  combinedAmount: squad.combinedAmount || recomputeSquadTotal(squad),
  status: squad.status,
  members: (squad.members || []).map((m) => serializeSquadMember(m, userMap)),
  submittedAt: squad.submittedAt,
  reviewedAt: squad.reviewedAt,
  jobTitle: squad.jobTitle || '',
  organizationName: squad.organizationName || '',
  pendingInvites: (squad.members || []).filter((m) => m.inviteStatus === 'pending').length,
  canSubmit: squad.status === 'forming' && squadReadyToSubmit(squad),
  createdAt: squad.createdAt,
});

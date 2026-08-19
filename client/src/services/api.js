const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const getProfileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
};

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('opus_token');
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  getMeta: () => request('/api/auth/meta'),
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp: (body) => request('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) }),
  resendOtp: (body) => request('/api/auth/resend-otp', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (body) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  verifyResetOtp: (body) => request('/api/auth/verify-reset-otp', { method: 'POST', body: JSON.stringify(body) }),
  resendResetOtp: (body) => request('/api/auth/resend-reset-otp', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  google: (body) => request('/api/auth/google', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),
  setPassword: (body) => request('/api/auth/onboarding/password', { method: 'POST', body: JSON.stringify(body) }),
  saveDegree: (body) => request('/api/auth/onboarding/degree', { method: 'POST', body: JSON.stringify(body) }),
  saveSkills: (body) => request('/api/auth/onboarding/skills', { method: 'POST', body: JSON.stringify(body) }),
  saveProfile: (formData) => request('/api/auth/onboarding/profile', { method: 'POST', body: formData }),
  saveEmployerDocuments: (formData) => request('/api/auth/onboarding/employer/documents', { method: 'POST', body: formData }),
  saveEmployerBusinessType: (body) => request('/api/auth/onboarding/employer/business-type', { method: 'POST', body: JSON.stringify(body) }),

  getEmployerInit: () => request('/api/employer/init'),
  getEmployerJobFeed: ({ page = 1, limit = 8 } = {}) => {
    const q = new URLSearchParams({ page, limit }).toString();
    return request(`/api/employer/jobs/feed?${q}`);
  },
  getEmployerOverview: () => request('/api/employer/dashboard/overview'),
  getEmployerTransactions: ({ page = 1, limit = 15, preset = '', from = '', to = '' } = {}) => {
    const q = new URLSearchParams({ page, limit });
    if (preset) q.set('preset', preset);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request(`/api/employer/transactions?${q}`);
  },
  getEmployerEStatement: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/employer/estatement?${q}`);
  },
  getEmployerNotifications: () => request('/api/employer/notifications'),
  getMyNotifications: () => request('/api/notifications'),
  getUnreadNotificationCount: () => request('/api/notifications/unread-count'),
  markNotificationsRead: (ids) =>
    request('/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {}),
    }),
  getConversations: ({ archived = false, q = '' } = {}) => {
    const params = new URLSearchParams();
    if (archived) params.set('archived', '1');
    if (q) params.set('q', q);
    const qs = params.toString();
    return request(`/api/messaging/conversations${qs ? `?${qs}` : ''}`);
  },
  getMessagingUnread: () => request('/api/messaging/unread-count'),
  searchMessaging: (q) => request(`/api/messaging/search?${new URLSearchParams({ q })}`),
  getConversationMessages: (id, { cursor = '', limit = 40 } = {}) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (cursor) q.set('cursor', cursor);
    return request(`/api/messaging/conversations/${id}/messages?${q}`);
  },
  markConversationRead: (id) => request(`/api/messaging/conversations/${id}/read`, { method: 'POST' }),
  archiveConversation: (id, archived = true) =>
    request(`/api/messaging/conversations/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archived }),
    }),
  sendConversationMessage: (id, { text = '', clientMsgId = '', files = [] } = {}) => {
    if (files?.length) {
      const formData = new FormData();
      if (text) formData.append('text', text);
      if (clientMsgId) formData.append('clientMsgId', clientMsgId);
      files.forEach((f) => formData.append('files', f));
      return request(`/api/messaging/conversations/${id}/messages`, {
        method: 'POST',
        body: formData,
      });
    }
    return request(`/api/messaging/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, clientMsgId }),
    });
  },
  deleteConversationMessage: (messageId, { everyone = false } = {}) =>
    request(`/api/messaging/messages/${messageId}?everyone=${everyone ? '1' : '0'}`, {
      method: 'DELETE',
    }),
  getCallToken: (conversationId) =>
    request('/api/messaging/calls/token', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    }),
  createEmployerJob: (formData) => request('/api/employer/jobs', { method: 'POST', body: formData }),
  deleteEmployerJob: (jobId) => request(`/api/employer/jobs/${jobId}`, { method: 'DELETE' }),
  getPublicJobs: ({
    page = 1,
    limit = 12,
    search = '',
    category = '',
    skill = '',
    location = '',
    budgetType = '',
    minPrice = '',
    maxPrice = '',
    sort = 'newest',
  } = {}) => {
    const q = new URLSearchParams({ page, limit });
    if (search) q.set('search', search);
    if (category) q.set('category', category);
    if (skill) q.set('skill', skill);
    if (location) q.set('location', location);
    if (budgetType) q.set('budgetType', budgetType);
    if (minPrice !== '' && minPrice != null) q.set('minPrice', String(minPrice));
    if (maxPrice !== '' && maxPrice != null) q.set('maxPrice', String(maxPrice));
    if (sort) q.set('sort', sort);
    return request(`/api/jobs?${q}`);
  },
  getPublicJobDetail: (jobId) => request(`/api/jobs/${jobId}`),
  applyToJob: (jobId, body = {}) =>
    request(`/api/jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getMyJobApplications: () => request('/api/jobs/mine/applications'),
  searchFreelancers: (q) => request(`/api/jobs/freelancers/search?q=${encodeURIComponent(q || '')}`),
  createSquadBid: (jobId, body) =>
    request(`/api/jobs/${jobId}/squad-bids`, { method: 'POST', body: JSON.stringify(body) }),
  submitSquadBid: (squadId) =>
    request(`/api/jobs/squad-bids/${squadId}/submit`, { method: 'POST', body: JSON.stringify({}) }),
  respondSquadInvite: (squadId, body) =>
    request(`/api/jobs/squad-bids/${squadId}/respond`, { method: 'POST', body: JSON.stringify(body) }),
  getMySquadInvites: () => request('/api/jobs/mine/squad-invites'),
  getMySquadBids: () => request('/api/jobs/mine/squad-bids'),
  getEmployerJobStatus: () => request('/api/employer/status'),
  getEmployerJobApplications: (jobId) => request(`/api/employer/jobs/${jobId}/applications`),
  getEmployerApplicantProfile: (freelancerId) => request(`/api/employer/applicants/${freelancerId}/profile`),
  acceptEmployerApplication: (applicationId) => request(`/api/employer/applications/${applicationId}/accept`, { method: 'POST' }),
  rejectEmployerApplication: (applicationId) => request(`/api/employer/applications/${applicationId}/reject`, { method: 'POST' }),
  acceptSquadBid: (squadId) => request(`/api/employer/squad-bids/${squadId}/accept`, { method: 'POST' }),
  rejectSquadBid: (squadId) => request(`/api/employer/squad-bids/${squadId}/reject`, { method: 'POST' }),
  getEmployerMessages: () => request('/api/employer/messages'),

  getAdminOverview: () => request('/api/admin/overview'),
  getAdminUsers: ({ page = 1, limit = 20, search = '', role = '', status = '', minFlags = 0 } = {}) => {
    const q = new URLSearchParams({ page, limit });
    if (search) q.set('search', search);
    if (role) q.set('role', role);
    if (status) q.set('status', status);
    if (minFlags) q.set('minFlags', String(minFlags));
    return request(`/api/admin/users?${q}`);
  },
  getAdminUsersSegment: ({ segment, page = 1, limit = 20, search = '' } = {}) => {
    const q = new URLSearchParams({ page, limit });
    if (search) q.set('search', search);
    return request(`/api/admin/users/segment/${segment}?${q}`);
  },
  getAdminUserDetail: (userId) => request(`/api/admin/users/${userId}`),
  updateAdminUser: (userId, body) => request(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAdminUser: (userId) => request(`/api/admin/users/${userId}`, { method: 'DELETE' }),
  flagAdminUser: (userId, body) => request(`/api/admin/users/${userId}/flag`, { method: 'POST', body: JSON.stringify(body) }),
  suspendAdminUser: (userId, body) => request(`/api/admin/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify(body) }),
  getVerificationQueue: () => request('/api/admin/verification-queue'),
  getVerificationDetail: (userId) => request(`/api/admin/verification-queue/${userId}`),
  approveVerification: (userId) => request(`/api/admin/verification-queue/${userId}/approve`, { method: 'POST' }),
  rejectVerification: (userId, body) => request(`/api/admin/verification-queue/${userId}/reject`, { method: 'POST', body: JSON.stringify(body) }),
  getAdminGigs: () => request('/api/admin/gigs'),
  getAdminJobs: ({ page = 1, limit = 20, search = '', status = '', includeRemoved = false } = {}) => {
    const q = new URLSearchParams({ page, limit });
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    if (includeRemoved) q.set('includeRemoved', 'true');
    return request(`/api/admin/jobs?${q}`);
  },
  getAdminJobDetail: (jobId) => request(`/api/admin/jobs/${jobId}`),
  deleteAdminJob: (jobId, body) => request(`/api/admin/jobs/${jobId}`, { method: 'DELETE', body: JSON.stringify(body) }),
  getAdminMeta: () => request('/api/admin/meta'),
  getAdminTemplates: () => request('/api/admin/email-templates'),
  saveAdminTemplate: (body) => request('/api/admin/email-templates', { method: 'POST', body: JSON.stringify(body) }),
  sendNudge: (userId, body) => request(`/api/admin/nudges/${userId}`, { method: 'POST', body: JSON.stringify(body) }),
  retrySentNote: (sentNoteId) => request(`/api/admin/sent-notes/${sentNoteId}/retry`, { method: 'POST' }),
  getAdminAnalytics: () => request('/api/admin/analytics'),
  getAdminAuditLogs: () => request('/api/admin/audit-logs'),
  getAdminAdmins: () => request('/api/admin/admins'),
  createAdminAccount: (body) => request('/api/admin/admins', { method: 'POST', body: JSON.stringify(body) }),
  updateAdminAccount: (adminId, body) => request(`/api/admin/admins/${adminId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deactivateAdminAccount: (adminId) => request(`/api/admin/admins/${adminId}/deactivate`, { method: 'POST' }),

  getHomepage: () => request('/api/homepage'),
  getPublicFreelancerProfile: (userId) => request(`/api/homepage/freelancers/${userId}`),
  getAdminAds: () => request('/api/admin/ads'),
  createAdminAd: (formData) => request('/api/admin/ads', { method: 'POST', body: formData }),
  updateAdminAd: (adId, formData) => request(`/api/admin/ads/${adId}`, { method: 'PUT', body: formData }),
  deleteAdminAd: (adId) => request(`/api/admin/ads/${adId}`, { method: 'DELETE' }),
  getAdminBadgeCandidates: (category = '') => {
    const q = category ? `?category=${encodeURIComponent(category)}` : '';
    return request(`/api/admin/badge-candidates${q}`);
  },
  getAdminFeatured: () => request('/api/admin/featured'),
  addAdminFeatured: (body) => request('/api/admin/featured', { method: 'POST', body: JSON.stringify(body) }),
  removeAdminFeatured: (featuredId) => request(`/api/admin/featured/${featuredId}`, { method: 'DELETE' }),
  getAdminBadges: () => request('/api/admin/badges'),
  saveAdminBadge: (body) => request('/api/admin/badges', { method: 'POST', body: JSON.stringify(body) }),
  getAdminBadgeAwards: () => request('/api/admin/badge-awards'),
  awardAdminBadge: (body) => request('/api/admin/badge-awards', { method: 'POST', body: JSON.stringify(body) }),
  revokeAdminBadge: (awardId) => request(`/api/admin/badge-awards/${awardId}`, { method: 'DELETE' }),

  getProfile: () => request('/api/profile'),
  updateProfile: (body) => request('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
  uploadProfilePhoto: (formData) => request('/api/profile/photo', { method: 'POST', body: formData }),
  changePassword: (body) => request('/api/profile/password', { method: 'PUT', body: JSON.stringify(body) }),
  addCertification: (formData) => request('/api/profile/certifications', { method: 'POST', body: formData }),
  updateCertification: (id, formData) => request(`/api/profile/certifications/${id}`, { method: 'PUT', body: formData }),
  deleteCertification: (id) => request(`/api/profile/certifications/${id}`, { method: 'DELETE' }),
  addProject: (formData) => request('/api/profile/projects', { method: 'POST', body: formData }),
  updateProject: (id, formData) => request(`/api/profile/projects/${id}`, { method: 'PUT', body: formData }),
  deleteProject: (id) => request(`/api/profile/projects/${id}`, { method: 'DELETE' }),
  deleteAccount: (body) => request('/api/profile/account', { method: 'DELETE', body: JSON.stringify(body) }),

  getDashboardInit: () => request('/api/dashboard/init'),
  getDashboardOverview: () => request('/api/dashboard/overview'),
  getDashboardAnalytics: () => request('/api/dashboard/analytics'),
  getDashboardEarnings: () => request('/api/dashboard/earnings'),
  getAcceptedProjects: () => request('/api/dashboard/accepted-projects'),
  getActivityFeed: ({ page = 1, limit = 4 } = {}) => {
    const q = new URLSearchParams({ page, limit }).toString();
    return request(`/api/dashboard/activity?${q}`);
  },
  getTasks: ({ status = 'pending', page = 1, limit = 4 } = {}) => {
    const q = new URLSearchParams({ status, page, limit }).toString();
    return request(`/api/dashboard/tasks?${q}`);
  },
  getBids: ({ page = 1, limit = 4 } = {}) => {
    const q = new URLSearchParams({ page, limit }).toString();
    return request(`/api/dashboard/bids?${q}`);
  },
  getWorkSessions: () => request('/api/workspace'),
  getWorkSession: (sessionId) => request(`/api/workspace/${sessionId}`),
  startWorkSession: (sessionId) => request(`/api/workspace/${sessionId}/start`, { method: 'POST' }),
  sendWorkStartReminder: (sessionId) => request(`/api/workspace/${sessionId}/remind-start`, { method: 'POST' }),
  addWorkUpdate: (sessionId, formData) => request(`/api/workspace/${sessionId}/updates`, { method: 'POST', body: formData }),
  attachWorkUpdateFiles: (sessionId, updateId, formData) => request(`/api/workspace/${sessionId}/updates/${updateId}/attachments`, { method: 'POST', body: formData }),
  reviewWorkUpdate: (sessionId, updateId, body) => request(`/api/workspace/${sessionId}/updates/${updateId}/review`, { method: 'POST', body: JSON.stringify(body) }),
  revertWorkUpdateReview: (sessionId, updateId) => request(`/api/workspace/${sessionId}/updates/${updateId}/revert-review`, { method: 'POST' }),
  toggleWorkGuideline: (sessionId, guidelineId, body) => request(`/api/workspace/${sessionId}/guidelines/${guidelineId}/toggle`, { method: 'POST', body: JSON.stringify(body) }),
  proceedWorkFinalization: (sessionId) => request(`/api/workspace/${sessionId}/proceed-finalization`, { method: 'POST' }),
  submitFinalDelivery: (sessionId, formData) => request(`/api/workspace/${sessionId}/final-delivery`, { method: 'POST', body: formData }),
  attachFinalDeliveryFiles: (sessionId, formData) => request(`/api/workspace/${sessionId}/final-delivery/attachments`, { method: 'POST', body: formData }),
  acceptFinalDelivery: (sessionId) => request(`/api/workspace/${sessionId}/final-delivery/accept`, { method: 'POST' }),
  requestFinalChanges: (sessionId, body) => request(`/api/workspace/${sessionId}/final-delivery/request-changes`, { method: 'POST', body: JSON.stringify(body) }),
  sendWorkMessage: (sessionId, body) => request(`/api/workspace/${sessionId}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  confirmWorkPayment: (sessionId) => request(`/api/workspace/${sessionId}/confirm-payment`, { method: 'POST' }),
  getWallet: () => request('/api/wallet'),
  getWalletLedger: ({ filter = 'all', page = 1, limit = 20 } = {}) => {
    const q = new URLSearchParams({ filter, page, limit }).toString();
    return request(`/api/wallet/ledger?${q}`);
  },
  linkWalletPayoutMethod: (body) => request('/api/wallet/payout-methods', { method: 'POST', body: JSON.stringify(body) }),
  setPrimaryWalletPayout: (methodId) => request(`/api/wallet/payout-methods/${methodId}/primary`, { method: 'PATCH' }),
  unlinkWalletPayout: (methodId) => request(`/api/wallet/payout-methods/${methodId}`, { method: 'DELETE' }),
  updateWalletSettings: (body) => request('/api/wallet/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  paySessionFromWallet: (sessionId) => request(`/api/wallet/pay-session/${sessionId}`, { method: 'POST' }),
  initiateWalletPayment: (body) => request('/api/wallet/pay/initiate', { method: 'POST', body: JSON.stringify(body) }),
  verifyWalletPayment: (body) => request('/api/wallet/pay/verify', { method: 'POST', body: JSON.stringify(body) }),
  withdrawFromWallet: (body) => request('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify(body) }),
  getDashboardBoard: () => request('/api/dashboard/board'),
  issueWorkCertificate: (sessionId) => request(`/api/workspace/${sessionId}/issue-certificate`, { method: 'POST' }),
  downloadWorkCertificate: async (sessionId) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('opus_token');
    const res = await fetch(`${API_URL}/api/workspace/${sessionId}/certificate`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to download certificate');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `OPUS-Certificate-${sessionId}.pdf`;
    return { blob, filename };
  },
  addWorkCertificateToProfile: (sessionId) => request(`/api/workspace/${sessionId}/add-certificate`, { method: 'POST' }),
  getTransactions: ({ search = '', sort = 'date_desc', page = 1, limit = 15, preset = '', from = '', to = '' } = {}) => {
    const q = new URLSearchParams({ search, sort, page, limit });
    if (preset) q.set('preset', preset);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request(`/api/dashboard/transactions?${q}`);
  },
  getEStatement: ({ preset = 'last_3_months', from = '', to = '' } = {}) => {
    const q = new URLSearchParams({ preset, from, to }).toString();
    return request(`/api/dashboard/estatement?${q}`);
  },
};

export const getEStatementPdfUrl = (params) => {
  const q = new URLSearchParams(params).toString();
  return `${API_URL}/api/dashboard/estatement/pdf?${q}`;
};

export const getEmployerEStatementPdfUrl = (params) => {
  const q = new URLSearchParams(params).toString();
  return `${API_URL}/api/employer/estatement/pdf?${q}`;
};

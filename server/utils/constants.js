export const DEGREE_OPTIONS = [
  'No formal education',
  'SLC/SEE',
  'Intermediate (+2)',
  'Bachelor',
  'Master',
];

export const DEFAULT_SKILLS = [
  'UI UX',
  'Graphic Design',
  'Nepali Typing',
  'Data Entry',
  'Web Design',
  'Python Programmer',
  'MERN Stack Developer',
  'JAVA',
  'PHP',
  'LARAVEL',
  'Word Press',
  'Dot Net',
  'Video Editing',
  'Content Creator',
];

export const AVATAR_SEEDS = [
  'opus-aurora', 'opus-blaze', 'opus-cedar', 'opus-drift', 'opus-ember',
  'opus-frost', 'opus-glow', 'opus-haven', 'opus-iris', 'opus-jade',
  'opus-kite', 'opus-luna',
];

export const getAvatarUrl = (seed) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

export const getRandomAvatarSeed = () =>
  AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)];

export const getPassoutYears = () => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= 1980; y -= 1) years.push(y);
  return years;
};

export const needsDegreeName = (degree) => degree === 'Bachelor' || degree === 'Master';

export const BUSINESS_TYPES = [
  { value: 'it', label: 'IT' },
  { value: 'government', label: 'Government' },
  { value: 'ngo_ingo', label: 'NGO / INGO' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'consulting', label: 'Consulting Company' },
  { value: 'other', label: 'Others' },
];

export const VERIFICATION_REJECT_REASONS = [
  { value: 'invalid_documents', label: 'Invalid or unreadable documents' },
  { value: 'mismatched_info', label: 'Information does not match documents' },
  { value: 'incomplete_submission', label: 'Incomplete document submission' },
  { value: 'unregistered_business', label: 'Business not legally registered' },
  { value: 'suspected_fraud', label: 'Suspected fraudulent submission' },
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'other', label: 'Other' },
];

export const VERIFICATION_EMAIL = {
  approved: {
    subject: 'Your OPUS employer profile has been verified',
    body: `Hi {{first_name}},

Great news: your employer profile for {{organization_name}} has been verified.

You can now post jobs, message freelancers, and access all hiring features on OPUS.

Welcome aboard,
OPUS Team`,
  },
  rejected: {
    subject: 'Your OPUS employer profile was not approved',
    body: `Hi {{first_name}},

Unfortunately, your employer verification for {{organization_name}} was not approved.

Reason: {{rejection_reason}}

Please review your documents and contact support if you have questions.

OPUS Team`,
  },
};

export const NUDGE_TEMPLATES = [
  { key: 'gentle_reminder', label: 'Gentle reminder', category: 'Inactivity Reminder', subject: 'Gentle reminder from OPUS Admin', body: 'This is a gentle reminder to review your ongoing gig activity and post your latest update.' },
  { key: 'deadline_approaching', label: 'Deadline approaching', category: 'Deadline Approaching', subject: 'Deadline approaching for your gig', body: 'Your gig deadline is approaching. Please coordinate and share progress to avoid disruption.' },
  { key: 'final_notice', label: 'Final notice', category: 'Final Notice', subject: 'Final notice regarding inactive gig', body: 'This is a final notice regarding prolonged inactivity on your gig. Please respond immediately.' },
  { key: 'verification_approved', label: 'Verification approved', category: 'Verification', subject: 'Your OPUS employer profile has been verified', body: 'Hi {{first_name}}, your employer profile for {{organization_name}} has been verified. You can now post jobs and use all hiring features.' },
  { key: 'verification_rejected', label: 'Verification rejected', category: 'Verification Rejected', subject: 'Your OPUS employer profile was not approved', body: 'Hi {{first_name}}, your employer verification for {{organization_name}} was not approved. Reason: {{rejection_reason}}' },
  { key: 'post_removed', label: 'Post removed', category: 'Post Removed', subject: 'Your job post was removed', body: 'Your job post was removed by OPUS administration. Please see the reason below and contact support if you have questions.' },
];

export const TEMPLATE_CATEGORIES = [
  'Inactivity Reminder',
  'Deadline Approaching',
  'Final Notice',
  'Verification',
  'Verification Rejected',
  'Post Removed',
  'General',
];

export const FLAG_REASONS = [
  { value: 'policy_violation', label: 'Policy violation' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'fraud_suspected', label: 'Suspected fraud' },
  { value: 'spam', label: 'Spam or misleading activity' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'legal_issue', label: 'Legal issue' },
  { value: 'other', label: 'Other' },
];

export const JOB_DELETE_REASONS = [
  { value: 'fake_listing', label: 'Fake listing' },
  { value: 'offensive_content', label: 'Offensive content' },
  { value: 'scam_fraud', label: 'Scam / fraud' },
  { value: 'duplicate', label: 'Duplicate post' },
  { value: 'other', label: 'Other' },
];

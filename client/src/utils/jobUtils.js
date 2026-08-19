export const JOB_CATEGORIES = [
  { value: 'coding', label: 'Development & Tech' },
  { value: 'ui_ux', label: 'Design & UI/UX' },
  { value: 'graphic_design', label: 'Graphic Design' },
  { value: 'content_writing', label: 'Writing & Content' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'data_entry', label: 'Admin & Support' },
  { value: 'video_editing', label: 'Video & Media' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' },
];

export const categoryLabel = (value) =>
  JOB_CATEGORIES.find((c) => c.value === value)?.label || value?.replace(/_/g, ' ') || 'Other';

export const fmtBudget = (job) => {
  if (job?.budgetDisplay) return job.budgetDisplay;
  const amount = job?.budgetType === 'hourly' ? job?.hourlyRate : job?.budget;
  const formatted = amount ? `रू ${Number(amount).toLocaleString('en-IN')}` : 'रू -';
  return job?.budgetType === 'hourly' ? `${formatted} /hr` : formatted;
};

export const budgetTypeLabel = (job) =>
  job?.budgetLabel || (job?.budgetType === 'hourly' ? 'Hourly rate' : 'Fixed budget');

export const orgInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'OP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const fmtDeadline = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

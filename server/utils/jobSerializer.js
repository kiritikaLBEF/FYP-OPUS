export const CATEGORY_LABELS = {
  coding: 'Development & Tech',
  ui_ux: 'Design & UI/UX',
  graphic_design: 'Graphic Design',
  video_editing: 'Video & Media',
  data_entry: 'Admin & Support',
  marketing: 'Marketing',
  consulting: 'Consulting',
  content_writing: 'Writing & Content',
  other: 'Other',
};

export const formatBudget = (job) => {
  const amount = job.budgetType === 'hourly' ? job.hourlyRate : job.budget;
  const formatted = amount ? `रू ${Number(amount).toLocaleString('en-IN')}` : 'रू -';
  return job.budgetType === 'hourly' ? `${formatted} /hr` : formatted;
};

export const toJobPublic = (j) => {
  const projectMode = j.projectMode || 'single';
  const roles = (j.roles || []).map((r) => ({
    roleKey: r.roleKey,
    name: r.name,
    description: r.description || '',
    budgetPercent: r.budgetPercent || 0,
    budgetAmount:
      r.budgetAmount
      || Math.round((Number(j.budget) || 0) * (Number(r.budgetPercent) || 0) / 100),
    status: r.status || 'open',
    filledByApplicationId: r.filledByApplicationId || null,
  }));
  const filledRoles = roles.filter((r) => r.status === 'filled').length;

  return {
    id: j._id,
    title: j.title,
    description: j.description,
    organizationName: j.organizationName,
    employerRef: j.employerRef,
    employerId: j.employerId,
    category: j.category,
    categoryLabel: CATEGORY_LABELS[j.category] || j.category,
    budget: j.budget,
    budgetType: j.budgetType || 'fixed',
    hourlyRate: j.hourlyRate || 0,
    budgetLabel: j.budgetType === 'hourly' ? 'Hourly rate' : 'Fixed budget',
    budgetDisplay: formatBudget(j),
    location: j.location,
    skillsRequired: j.skillsRequired || [],
    conditions: j.conditions || [],
    coverMode: j.coverMode || 'none',
    coverImage: j.coverImage || '',
    coverText: j.coverText || '',
    applicationDeadline: j.applicationDeadline,
    status: j.status,
    publishStatus: j.publishStatus || 'published',
    isRemoved: !!j.isRemoved,
    postedAt: j.postedAt,
    updatedAt: j.updatedAt,
    projectMode,
    multiBidMode: j.multiBidMode || (projectMode === 'multi' ? 'both' : null),
    roles,
    rolesFilled: filledRoles,
    rolesTotal: roles.length,
    isMulti: projectMode === 'multi',
    allowRoleBids: projectMode === 'multi' && ['role', 'both'].includes(j.multiBidMode || 'both'),
    allowSquadBids: projectMode === 'multi' && ['squad', 'both'].includes(j.multiBidMode || 'both'),
  };
};

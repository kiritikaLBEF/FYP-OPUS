export const calculateProfileCompletion = (user) => {
  if (!user) return { percentage: 0, incomplete: [] };

  const checks = [
    { key: 'profilePicture', weight: 12, done: !!(user.profilePicture || user.avatarId) },
    { key: 'personal', weight: 18, done: !!(user.firstName && user.lastName && user.phone && user.country && user.city && user.username) },
    { key: 'education', weight: 12, done: !!(user.degree && user.schoolName) },
    { key: 'skills', weight: 13, done: Array.isArray(user.skills) && user.skills.length >= 2 },
    { key: 'professional', weight: 15, done: !!(user.professionalSummary && user.professionalSummary.length >= 20) },
    { key: 'certifications', weight: 15, done: Array.isArray(user.certifications) && user.certifications.length > 0 },
    { key: 'projects', weight: 15, done: Array.isArray(user.projects) && user.projects.length > 0 },
  ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter((c) => c.done).reduce((s, c) => s + c.weight, 0);

  const suggestions = {
    profilePicture: 'Add a profile photo',
    personal: 'Complete personal details',
    education: 'Add education and school name',
    skills: 'Add at least 2 skills',
    professional: 'Add a professional summary',
    certifications: 'Add a certification',
    projects: 'Add a portfolio project',
  };

  return {
    percentage: Math.round((earned / total) * 100),
    incomplete: checks.filter((c) => !c.done).map((c) => ({ key: c.key, label: suggestions[c.key] })),
  };
};

export const PROJECT_CATEGORIES = [
  { value: 'coding', label: 'Coding Project' },
  { value: 'university', label: 'University Assignment' },
  { value: 'ui_ux', label: 'UI/UX Design' },
  { value: 'graphic_design', label: 'Graphic Design' },
  { value: 'video_editing', label: 'Video Editing' },
  { value: 'photography', label: 'Photography' },
  { value: 'research', label: 'Research Paper' },
  { value: 'presentation', label: 'Presentation' },
  { value: '3d_modeling', label: '3D Modeling' },
  { value: 'animation', label: 'Animation' },
  { value: 'content_writing', label: 'Content Writing' },
  { value: 'marketing', label: 'Marketing Campaign' },
  { value: 'other', label: 'Other' },
];

export const LINK_TYPES = [
  { value: 'github', label: 'GitHub' },
  { value: 'figma', label: 'Figma' },
  { value: 'behance', label: 'Behance' },
  { value: 'dribbble', label: 'Dribbble' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'drive', label: 'Google Drive' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'demo', label: 'Live Demo' },
  { value: 'other', label: 'Other' },
];

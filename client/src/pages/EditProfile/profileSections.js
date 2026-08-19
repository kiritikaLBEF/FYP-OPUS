import {
  IconPersonal,
  IconProfessional,
  IconSkills,
  IconCertifications,
  IconProjects,
  IconPreferences,
  IconPrivacy,
  IconAccount,
} from './ProfileSectionIcons';

export const PROFILE_SECTIONS = [
  { id: 'personal', label: 'Personal Information', subtitle: 'Photo, contact details, and education', Icon: IconPersonal },
  { id: 'professional', label: 'Professional Profile', subtitle: 'Summary, expertise, and interests', Icon: IconProfessional },
  { id: 'skills', label: 'Skills', subtitle: 'Your technical and soft skills', Icon: IconSkills },
  { id: 'certifications', label: 'Certifications', subtitle: 'Credentials and certificates', Icon: IconCertifications },
  { id: 'projects', label: 'Projects & Portfolio', subtitle: 'Showcase your creative work', Icon: IconProjects },
  { id: 'preferences', label: 'Preferences', subtitle: 'Notifications and language', Icon: IconPreferences },
  { id: 'privacy', label: 'Privacy & Security', subtitle: 'Privacy controls and password', Icon: IconPrivacy },
  { id: 'account', label: 'Account Settings', subtitle: 'Manage your OPUS account', Icon: IconAccount },
];

export const getSectionComplete = (id, form) => {
  if (!form) return false;
  switch (id) {
    case 'personal':
      return !!(form.profilePicture && form.firstName && form.lastName && form.username && form.phone && form.country && form.city && form.schoolName);
    case 'professional':
      return !!(form.professionalSummary && form.professionalSummary.length >= 20);
    case 'skills':
      return Array.isArray(form.skills) && form.skills.length >= 2;
    case 'certifications':
      return Array.isArray(form.certifications) && form.certifications.length > 0;
    case 'projects':
      return Array.isArray(form.projects) && form.projects.length > 0;
    case 'preferences':
      return !!form.language;
    case 'privacy':
      return true;
    case 'account':
      return true;
    default:
      return false;
  }
};

export const SECTION_FIELDS = {
  personal: [
    'firstName', 'lastName', 'username', 'phone', 'alternatePhone',
    'country', 'stateProvince', 'city', 'address', 'postalCode', 'timezone',
    'gender', 'dateOfBirth', 'degree', 'degreeName', 'schoolName', 'passoutYear', 'stillRunning',
    'profilePicture',
  ],
  professional: ['interests', 'professionalSummary'],
  skills: ['skills'],
  preferences: ['notificationPreferences', 'language'],
  privacy: ['privacySettings'],
};

export const SECTION_SAVEABLE = ['personal', 'professional', 'skills', 'preferences', 'privacy'];

export const pickSection = (sectionId, form) => {
  const fields = SECTION_FIELDS[sectionId] || [];
  const slice = {};
  fields.forEach((f) => { slice[f] = form[f]; });
  return slice;
};

export const sectionSnapshot = (sectionId, form) => JSON.stringify(pickSection(sectionId, form));

export const mergeSectionIntoForm = (sectionId, baselineForm, currentForm) => {
  const fields = SECTION_FIELDS[sectionId] || [];
  const next = { ...currentForm };
  fields.forEach((f) => { next[f] = baselineForm[f]; });
  return next;
};

export const buildSectionPayload = (sectionId, form) => {
  const slice = pickSection(sectionId, form);
  switch (sectionId) {
    case 'personal':
      return {
        firstName: slice.firstName,
        lastName: slice.lastName,
        username: slice.username,
        phone: slice.phone,
        alternatePhone: slice.alternatePhone,
        country: slice.country,
        stateProvince: slice.stateProvince,
        city: slice.city,
        address: slice.address,
        postalCode: slice.postalCode,
        timezone: slice.timezone,
        gender: slice.gender,
        dateOfBirth: slice.dateOfBirth || null,
        degree: slice.degree,
        degreeName: slice.degreeName,
        schoolName: slice.schoolName,
        passoutYear: slice.stillRunning ? null : slice.passoutYear,
        stillRunning: slice.stillRunning,
      };
    case 'professional':
      return {
        interests: slice.interests,
        professionalSummary: slice.professionalSummary,
      };
    case 'skills':
      return { skills: slice.skills };
    case 'preferences':
      return {
        notificationPreferences: slice.notificationPreferences,
        language: slice.language,
      };
    case 'privacy':
      return { privacySettings: slice.privacySettings };
    default:
      return {};
  }
};

export const buildSectionBaselines = (form) => {
  const baselines = {};
  Object.keys(SECTION_FIELDS).forEach((id) => {
    baselines[id] = sectionSnapshot(id, form);
  });
  return baselines;
};

const inferGuidelineCategory = (text = '') => {
  const t = text.toLowerCase();
  if (/\b(figma|design|ui|ux|visual|brand|layout|color|typography)\b/.test(t)) return 'design';
  if (/\b(code|api|test|react|node|database|ios|android|technical|integrate|unit)\b/.test(t)) {
    return 'technical';
  }
  return 'submission';
};

export const buildGuidelinesFromJob = (jobDoc) => {
  const conditions = Array.isArray(jobDoc?.conditions) ? jobDoc.conditions.filter(Boolean) : [];
  return conditions.map((text) => ({
    text: String(text).trim(),
    category: inferGuidelineCategory(text),
    checked: false,
  }));
};

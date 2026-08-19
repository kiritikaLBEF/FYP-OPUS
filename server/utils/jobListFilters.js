const parseNumber = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const buildPublicJobQuery = ({
  search = '',
  category = '',
  skill = '',
  location = '',
  budgetType = '',
  minPrice = '',
  maxPrice = '',
}) => {
  const and = [];

  const q = (search || '').trim();
  if (q) {
    and.push({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { organizationName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ],
    });
  }

  if (category) and.push({ category });

  const skillQ = (skill || '').trim();
  if (skillQ) {
    and.push({ skillsRequired: { $regex: skillQ, $options: 'i' } });
  }

  const loc = (location || '').trim();
  if (loc) {
    and.push({ location: { $regex: loc, $options: 'i' } });
  }

  const min = parseNumber(minPrice);
  const max = parseNumber(maxPrice);
  const range = {};
  if (min !== null) range.$gte = min;
  if (max !== null) range.$lte = max;
  const hasRange = Object.keys(range).length > 0;

  if (budgetType === 'fixed') {
    and.push({ budgetType: { $ne: 'hourly' } });
    if (hasRange) and.push({ budget: range });
  } else if (budgetType === 'hourly') {
    and.push({ budgetType: 'hourly' });
    if (hasRange) and.push({ hourlyRate: range });
  } else if (hasRange) {
    and.push({
      $or: [
        { budgetType: 'hourly', hourlyRate: range },
        { budgetType: { $ne: 'hourly' }, budget: range },
      ],
    });
  }

  return and.length ? { $and: and } : {};
};

export const jobSortFromParam = (sort = 'newest') => {
  switch (sort) {
    case 'budget_high':
      return { budget: -1, hourlyRate: -1, postedAt: -1 };
    case 'budget_low':
      return { budget: 1, hourlyRate: 1, postedAt: -1 };
    case 'deadline':
      return { applicationDeadline: 1, postedAt: -1 };
    default:
      return { postedAt: -1 };
  }
};

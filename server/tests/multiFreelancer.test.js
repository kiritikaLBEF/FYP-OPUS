import { describe, it, expect } from 'vitest';
import { allRolesFilled, rolesBudgetOk } from '../utils/multiFreelancer.js';

describe('U-05 allRolesFilled', () => {
  it('returns false when no roles exist', () => {
    expect(allRolesFilled({ roles: [] })).toBe(false);
    expect(allRolesFilled({})).toBe(false);
  });

  it('returns false when any role is still open', () => {
    const job = {
      roles: [
        { roleKey: 'a', status: 'filled' },
        { roleKey: 'b', status: 'open' },
      ],
    };
    expect(allRolesFilled(job)).toBe(false);
  });

  it('returns true only when every role is filled', () => {
    const job = {
      roles: [
        { roleKey: 'a', status: 'filled' },
        { roleKey: 'b', status: 'filled' },
      ],
    };
    expect(allRolesFilled(job)).toBe(true);
  });
});

describe('U-03 related rolesBudgetOk', () => {
  it('requires role budget percents to sum to 100', () => {
    expect(rolesBudgetOk([{ budgetPercent: 40 }, { budgetPercent: 60 }])).toBe(true);
    expect(rolesBudgetOk([{ budgetPercent: 50 }, { budgetPercent: 40 }])).toBe(false);
    expect(rolesBudgetOk([])).toBe(false);
  });
});

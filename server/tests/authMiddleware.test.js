import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * U-02 / U-03 style unit tests for auth middleware.
 * User model is mocked so these stay unit tests (no MongoDB).
 */
vi.mock('../models/User.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../utils/adminConfig.js', () => ({
  isSuperAdminUser: vi.fn(() => false),
}));

vi.mock('../utils/jwt.js', () => ({
  verifyToken: vi.fn(),
}));

import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { protect, requireEmployerVerified } from '../middleware/auth.js';

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('U-02 protect middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and sets req.user for a valid token', async () => {
    verifyToken.mockReturnValue({ userId: 'abc', scope: 'access' });
    User.findById.mockResolvedValue({
      _id: 'abc',
      accountStatus: 'active',
      role: 'freelancer',
    });

    const req = { headers: { authorization: 'Bearer good.token' } };
    const res = mockRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user._id).toBe('abc');
    expect(req.tokenScope).toBe('access');
  });
});

describe('U-03 requireEmployerVerified middleware', () => {
  it('returns 403 when employer is not verified', () => {
    const req = { user: { verificationStatus: 'pending' } };
    const res = mockRes();
    const next = vi.fn();

    requireEmployerVerified(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when employer is verified', () => {
    const req = { user: { verificationStatus: 'verified' } };
    const res = mockRes();
    const next = vi.fn();

    requireEmployerVerified(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

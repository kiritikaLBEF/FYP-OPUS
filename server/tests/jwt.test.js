import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  signAccessToken,
  signOnboardingToken,
  verifyToken,
} from '../utils/jwt.js';

describe('JWT helpers (unit)', () => {
  const prev = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'opus_unit_test_secret';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prev;
  });

  it('signAccessToken stores access scope', () => {
    const token = signAccessToken('user123');
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user123');
    expect(decoded.scope).toBe('access');
  });

  it('signOnboardingToken stores onboarding scope', () => {
    const token = signOnboardingToken('user456');
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user456');
    expect(decoded.scope).toBe('onboarding');
  });

  it('verifyToken rejects a tampered token', () => {
    const token = signAccessToken('user123');
    expect(() => verifyToken(`${token}x`)).toThrow();
  });
});

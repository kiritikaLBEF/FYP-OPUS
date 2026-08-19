import jwt from 'jsonwebtoken';

const secret = () => process.env.JWT_SECRET || 'opus_fallback_secret';

export const signToken = (payload, expiresIn = '7d') =>
  jwt.sign(payload, secret(), { expiresIn });

export const verifyToken = (token) => jwt.verify(token, secret());

export const signOnboardingToken = (userId) =>
  signToken({ userId, scope: 'onboarding' }, '24h');

export const signAccessToken = (userId) =>
  signToken({ userId, scope: 'access' }, '7d');

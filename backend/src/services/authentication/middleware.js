import jwt from 'jsonwebtoken';
import { findUserByEmail, sanitizeUser } from './users.js';

const DEV_FALLBACK = 'dashzw-dev-secret-change-in-production';
let warnedDevSecret = false;

/**
 * In production, JWT_SECRET must be set — refuse to use the hardcoded fallback.
 */
export function assertJwtConfigured() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('[DashZW] FATAL: JWT_SECRET must be set when NODE_ENV=production');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[DashZW] JWT_SECRET not set — using insecure dev fallback. Never deploy without JWT_SECRET.'
    );
  }
}

export function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (!warnedDevSecret) {
    console.warn(
      '[DashZW] JWT_SECRET not set — using insecure dev fallback. Never deploy without JWT_SECRET.'
    );
    warnedDevSecret = true;
  }
  return DEV_FALLBACK;
}

export function signToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role, id: user.id },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  try {
    const payload = verifyToken(token);
    const user = await findUserByEmail(payload.email);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = verifyToken(token);
      const user = await findUserByEmail(payload.email);
      if (user) req.user = sanitizeUser(user);
    } catch {
      /* ignore */
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    const role = req.user.role;
    const allowed = new Set(roles);
    if (allowed.has('admin')) {
      allowed.add('super_admin');
    }
    if (!allowed.has(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

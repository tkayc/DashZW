import jwt from 'jsonwebtoken';
import { findUserByEmail, sanitizeUser } from './users.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dashzw-dev-secret-change-in-production';

export function signToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role, id: user.id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  try {
    const payload = verifyToken(token);
    const user = findUserByEmail(payload.email);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = verifyToken(token);
      const user = findUserByEmail(payload.email);
      if (user) req.user = sanitizeUser(user);
    } catch {}
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

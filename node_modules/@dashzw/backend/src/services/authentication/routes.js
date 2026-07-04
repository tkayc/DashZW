import { Router } from 'express';
import {
  findUserByEmail,
  sanitizeUser,
  registerUser,
  updateUser,
  listUsersSafe,
  ensureDemoUsers,
} from './users.js';
import { signToken, authMiddleware, requireRole } from './middleware.js';

const router = Router();

router.post('/login', (req, res) => {
  try {
    ensureDemoUsers();
    const { email, password } = req.body;
    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const safe = sanitizeUser(user);
    const token = signToken(safe);
    res.json({ user: safe, token });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.post('/register', (req, res) => {
  try {
    const safe = registerUser(req.body);
    const token = signToken(safe);
    res.status(201).json({ user: safe, token });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

router.get('/users', authMiddleware, requireRole('admin'), (req, res) => {
  res.json(listUsersSafe());
});

router.patch('/users/:email', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const safe = updateUser(req.params.email, req.body);
    res.json(safe);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

export default router;

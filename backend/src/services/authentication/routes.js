import { Router } from 'express';
import {
  authenticateUser,
  findUserByEmail,
  sanitizeUser,
  registerUser,
  updateUser,
  listUsersSafe,
  ensureDemoUsers,
} from './users.js';
import { signToken, authMiddleware, requireRole } from './middleware.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    ensureDemoUsers();
    const { email, password } = req.body;
    const user = await authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const safe = sanitizeUser(user);
    const token = signToken(safe);
    res.json({ user: safe, token });
  } catch (e) {
    console.error('[auth/login]', e.message);
    res.status(400).json({ message: e.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const safe = await registerUser(req.body);
    const token = signToken(safe);
    res.status(201).json({ user: safe, token });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const fresh = await findUserByEmail(req.user?.email);
    res.json(fresh || req.user);
  } catch {
    res.json(req.user);
  }
});

router.get('/users', authMiddleware, requireRole('admin'), async (req, res) => {
  res.json(await listUsersSafe());
});

router.patch('/users/:email', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const safe = await updateUser(req.params.email, req.body);
    res.json(safe);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

export default router;

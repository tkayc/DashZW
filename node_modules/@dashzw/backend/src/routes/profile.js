import { Router } from 'express';
import { authMiddleware } from '../services/authentication/middleware.js';
import { getMeta, setMeta } from '../db/store.js';

const router = Router();
router.use(authMiddleware);

router.get('/:email', (req, res) => {
  res.json(getMeta(`profile_${req.params.email}`) || {});
});

router.patch('/:email', (req, res) => {
  const key = `profile_${req.params.email}`;
  const existing = getMeta(key) || {};
  const updated = { ...existing, ...req.body };
  setMeta(key, updated);
  res.json(updated);
});

export default router;

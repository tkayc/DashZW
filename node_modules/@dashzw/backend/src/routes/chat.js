import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../services/authentication/middleware.js';
import { DATA_DIR } from '../db/store.js';
import { notifyListeners } from '../db/store.js';

const router = Router();
router.use(authMiddleware);

function chatPath(orderId) {
  return path.join(DATA_DIR, 'chats', `${orderId}.json`);
}

router.get('/:orderId', (req, res) => {
  try {
    const raw = fs.readFileSync(chatPath(req.params.orderId), 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.json([]);
  }
});

router.post('/:orderId', (req, res) => {
  const dir = path.join(DATA_DIR, 'chats');
  fs.mkdirSync(dir, { recursive: true });
  const msgs = req.body.messages ?? [];
  fs.writeFileSync(chatPath(req.params.orderId), JSON.stringify(msgs));
  notifyListeners('Chat');
  res.json(msgs);
});

export default router;

import { Router } from 'express';
import { authMiddleware } from '../services/authentication/middleware.js';
import { localDb } from '../db/localDb.js';
import { getCollection, saveCollection } from '../db/store.js';

const COLLECTIONS = Object.keys(localDb.entities);
const router = Router();

router.use(authMiddleware);

router.get('/:collection/list', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
  const { sort = '-created_date', limit = '50' } = req.query;
  const data = await localDb.entities[collection].list(sort, parseInt(limit, 10));
  res.json(data);
});

router.get('/:collection/filter', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
  const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
  const { sort = '-created_date', limit = '100' } = req.query;
  const data = await localDb.entities[collection].filter(filters, sort, parseInt(limit, 10));
  res.json(data);
});

router.get('/:collection/raw', async (req, res) => {
  const { collection } = req.params;
  res.json(getCollection(collection));
});

router.post('/:collection/raw', async (req, res) => {
  const { collection } = req.params;
  saveCollection(collection, req.body.data ?? []);
  res.json({ ok: true });
});

router.post('/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
  const item = await localDb.entities[collection].create(req.body);
  res.status(201).json(item);
});

router.patch('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
  const item = await localDb.entities[collection].update(id, req.body);
  res.json(item);
});

router.delete('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
  await localDb.entities[collection].delete(id);
  res.json({ id });
});

export default router;

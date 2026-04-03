import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = express.Router({ mergeParams: true });

// GET /api/maps/:mapId/groups
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM groups WHERE map_id = ? ORDER BY created_at ASC').all(req.params.mapId);
  res.json(rows);
});

// POST /api/maps/:mapId/groups
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuidv4();
  db.prepare('INSERT INTO groups (id, map_id, name, created_at) VALUES (?, ?, ?, ?)')
    .run(id, req.params.mapId, name, new Date().toISOString());
  res.status(201).json({ id, map_id: req.params.mapId, name });
});

// PUT /api/maps/:mapId/groups/:groupId
router.put('/:groupId', (req, res) => {
  const { name } = req.body;
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND map_id = ?').get(req.params.groupId, req.params.mapId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(name ?? group.name, req.params.groupId);
  res.json({ ...group, name: name ?? group.name });
});

// DELETE /api/maps/:mapId/groups/:groupId
router.delete('/:groupId', (req, res) => {
  const info = db.prepare('DELETE FROM groups WHERE id = ? AND map_id = ?').run(req.params.groupId, req.params.mapId);
  if (info.changes === 0) return res.status(404).json({ error: 'Group not found' });
  res.status(204).end();
});

export default router;

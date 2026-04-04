import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

async function mapOwnedByUser(mapId, userId) {
  const [rows] = await db.query('SELECT id FROM maps WHERE id = ? AND user_id = ?', [mapId, userId]);
  return rows.length > 0;
}

// GET /api/maps/:mapId/groups
router.get('/', async (req, res) => {
  try {
    if (!(await mapOwnedByUser(req.params.mapId, req.userId))) {
      return res.status(404).json({ error: 'Map not found' });
    }
    const [rows] = await db.query(
      'SELECT * FROM `groups` WHERE map_id = ? ORDER BY created_at ASC',
      [req.params.mapId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/maps/:mapId/groups
router.post('/', async (req, res) => {
  try {
    if (!(await mapOwnedByUser(req.params.mapId, req.userId))) {
      return res.status(404).json({ error: 'Map not found' });
    }
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const id = uuidv4();
    await db.execute(
      'INSERT INTO `groups` (id, map_id, user_id, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.mapId, req.userId, name, new Date().toISOString()]
    );
    res.status(201).json({ id, map_id: req.params.mapId, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/maps/:mapId/groups/:groupId
router.put('/:groupId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT g.* FROM `groups` g JOIN maps m ON g.map_id = m.id WHERE g.id = ? AND m.user_id = ?',
      [req.params.groupId, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Group not found' });
    const group = rows[0];
    const { name } = req.body;
    await db.execute('UPDATE `groups` SET name = ? WHERE id = ?', [name ?? group.name, req.params.groupId]);
    res.json({ ...group, name: name ?? group.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/maps/:mapId/groups/:groupId
router.delete('/:groupId', async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE g FROM `groups` g JOIN maps m ON g.map_id = m.id WHERE g.id = ? AND m.user_id = ?',
      [req.params.groupId, req.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

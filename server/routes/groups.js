import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = express.Router({ mergeParams: true });

// GET /api/maps/:mapId/groups
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
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
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const id = uuidv4();
    await db.execute(
      'INSERT INTO `groups` (id, map_id, name, created_at) VALUES (?, ?, ?, ?)',
      [id, req.params.mapId, name, new Date().toISOString()]
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
    const { name } = req.body;
    const [rows] = await db.execute(
      'SELECT * FROM `groups` WHERE id = ? AND map_id = ?',
      [req.params.groupId, req.params.mapId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Group not found' });
    const group = rows[0];
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
    const [result] = await db.execute(
      'DELETE FROM `groups` WHERE id = ? AND map_id = ?',
      [req.params.groupId, req.params.mapId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Group not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

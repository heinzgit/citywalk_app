import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

// Helper: verify map belongs to user
async function mapOwnedByUser(mapId, userId) {
  const [rows] = await db.query('SELECT id FROM maps WHERE id = ? AND user_id = ?', [mapId, userId]);
  return rows.length > 0;
}

// GET /api/maps/:mapId/routes
router.get('/', async (req, res) => {
  try {
    if (!(await mapOwnedByUser(req.params.mapId, req.userId))) {
      return res.status(404).json({ error: 'Map not found' });
    }
    const [rows] = await db.query(
      'SELECT * FROM routes WHERE map_id = ? ORDER BY created_at ASC',
      [req.params.mapId]
    );
    const routes = rows.map(r => ({ ...r, points: JSON.parse(r.points) }));
    res.json(routes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/maps/:mapId/routes
router.post('/', async (req, res) => {
  try {
    if (!(await mapOwnedByUser(req.params.mapId, req.userId))) {
      return res.status(404).json({ error: 'Map not found' });
    }
    const { name, points, color = '#fffb00', group_id = null } = req.body;
    if (!name || !points || !Array.isArray(points)) {
      return res.status(400).json({ error: 'name and points array are required' });
    }
    const id = uuidv4();
    await db.execute(
      'INSERT INTO routes (id, map_id, user_id, name, points, color, group_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.mapId, req.userId, name, JSON.stringify(points), color, group_id, new Date().toISOString()]
    );
    res.status(201).json({ id, map_id: req.params.mapId, name, points, color, group_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/maps/:mapId/routes/:routeId
router.put('/:routeId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM routes r JOIN maps m ON r.map_id = m.id WHERE r.id = ? AND m.user_id = ?',
      [req.params.routeId, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Route not found' });
    const route = rows[0];

    const { name, color, group_id, points } = req.body;
    const newName = name ?? route.name;
    const newColor = color ?? route.color;
    const newGroupId = group_id !== undefined ? (group_id || null) : route.group_id;
    const newPoints = points ? JSON.stringify(points) : route.points;

    await db.execute(
      'UPDATE routes SET name = ?, color = ?, group_id = ?, points = ? WHERE id = ?',
      [newName, newColor, newGroupId, newPoints, req.params.routeId]
    );
    res.json({ ...route, name: newName, color: newColor, group_id: newGroupId, points: JSON.parse(newPoints) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/maps/:mapId/routes/:routeId
router.delete('/:routeId', async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE r FROM routes r JOIN maps m ON r.map_id = m.id WHERE r.id = ? AND m.user_id = ?',
      [req.params.routeId, req.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Route not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

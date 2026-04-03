import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = express.Router({ mergeParams: true });

// GET /api/maps/:mapId/routes
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM routes WHERE map_id = ? ORDER BY created_at ASC').all(req.params.mapId);
  const routes = rows.map(r => ({ ...r, points: JSON.parse(r.points) }));
  res.json(routes);
});

// POST /api/maps/:mapId/routes
router.post('/', (req, res) => {
  const { name, points, color = '#fffb00', group_id = null } = req.body;
  if (!name || !points || !Array.isArray(points)) {
    return res.status(400).json({ error: 'name and points array are required' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO routes (id, map_id, name, points, color, group_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.mapId, name, JSON.stringify(points), color, group_id, new Date().toISOString());

  res.status(201).json({ id, map_id: req.params.mapId, name, points, color, group_id });
});

// PUT /api/maps/:mapId/routes/:routeId — rename, recolor, move, or update points
router.put('/:routeId', (req, res) => {
  const { name, color, group_id, points } = req.body;
  const route = db.prepare('SELECT * FROM routes WHERE id = ? AND map_id = ?').get(req.params.routeId, req.params.mapId);
  if (!route) return res.status(404).json({ error: 'Route not found' });

  const newName = name ?? route.name;
  const newColor = color ?? route.color;
  const newGroupId = group_id !== undefined ? (group_id || null) : route.group_id;
  const newPoints = points ? JSON.stringify(points) : route.points;
  db.prepare('UPDATE routes SET name = ?, color = ?, group_id = ?, points = ? WHERE id = ?')
    .run(newName, newColor, newGroupId, newPoints, req.params.routeId);
  res.json({ ...route, name: newName, color: newColor, group_id: newGroupId, points: JSON.parse(newPoints) });
});

// DELETE /api/maps/:mapId/routes/:routeId
router.delete('/:routeId', (req, res) => {
  const info = db.prepare('DELETE FROM routes WHERE id = ? AND map_id = ?').run(req.params.routeId, req.params.mapId);
  if (info.changes === 0) return res.status(404).json({ error: 'Route not found' });
  res.status(204).end();
});

export default router;

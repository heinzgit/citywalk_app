import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
router.use(authMiddleware);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// GET /api/maps — list current user's maps
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM maps WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/maps — upload a map image
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image uploaded' });

    const meta = await sharp(file.path).metadata();
    const id = uuidv4();

    await db.execute(
      'INSERT INTO maps (id, user_id, filename, original_name, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.userId, file.filename, file.originalname, meta.width, meta.height, new Date().toISOString()]
    );

    res.json({ id, filename: file.filename, original_name: file.originalname, width: meta.width, height: meta.height });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/maps/:id — get map metadata
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM maps WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Map not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/maps/:id — update name and/or scale
router.put('/:id', async (req, res) => {
  try {
    const { name, scale } = req.body;
    const [rows] = await db.query('SELECT * FROM maps WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Map not found' });
    const newName = name !== undefined ? name.trim() : rows[0].original_name;
    if (name !== undefined && !newName) return res.status(400).json({ error: 'name cannot be empty' });
    const newScale = scale !== undefined ? scale : rows[0].scale;
    await db.execute('UPDATE maps SET original_name = ?, scale = ? WHERE id = ? AND user_id = ?', [newName, newScale, req.params.id, req.userId]);
    res.json({ ...rows[0], original_name: newName, scale: newScale });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/maps/:id — delete map + image file
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM maps WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Map not found' });
    await db.execute('DELETE FROM maps WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    const filePath = path.join(__dirname, '../uploads', rows[0].filename);
    import('fs').then(fs => fs.unlink(filePath, () => {}));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

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

// POST /api/maps — upload a map image
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image uploaded' });

    const meta = await sharp(file.path).metadata();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO maps (id, filename, original_name, width, height, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, file.filename, file.originalname, meta.width, meta.height, new Date().toISOString());

    res.json({ id, filename: file.filename, originalName: file.originalname, width: meta.width, height: meta.height });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/maps/:id — get map metadata
router.get('/:id', (req, res) => {
  const map = db.prepare('SELECT * FROM maps WHERE id = ?').get(req.params.id);
  if (!map) return res.status(404).json({ error: 'Map not found' });
  res.json(map);
});

export default router;

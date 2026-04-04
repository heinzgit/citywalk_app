import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { signToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (username.trim().length < 2 || username.trim().length > 50) {
      return res.status(400).json({ error: 'username must be 2-50 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing.length) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const id = uuidv4();
    const hashed = await bcrypt.hash(password, 10);
    await db.execute(
      'INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)',
      [id, username.trim(), hashed, new Date().toISOString()]
    );

    const token = signToken(id);
    res.status(201).json({ token, user: { id, username: username.trim() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const jwtSecret = process.env.JWT_SECRET || 'citywalk-dev-secret-change-in-production';
    let payload;
    try {
      const { default: jwtVerify } = await import('jsonwebtoken');
      payload = jwtVerify(token, jwtSecret);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const [rows] = await db.query('SELECT id, username FROM users WHERE id = ?', [payload.userId]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── POST /api/signup ──────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { email, username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)`,
      [email, username, hash]
    );
    res.json({ message: 'User created!' });
  } catch {
    res.status(400).json({ error: 'Username or Email already exists.' });
  }
});

// ── POST /api/login ───────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1 OR email = $1`,
      [username]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }
    const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET);
    res.json({ token, username: user.username });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/google-auth ─────────────────────────────────────────────────────
// Accepts a Google credential (ID token), upserts the user, returns a JWT
router.post('/google-auth', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'No credential provided.' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, sub: googleId } = payload;
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');

    let userResult = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    if (userResult.rows.length === 0) {
      let username = baseUsername;
      const existing = await pool.query(`SELECT id FROM users WHERE username = $1`, [username]);
      if (existing.rows.length > 0) username = `${baseUsername}_${googleId.slice(-4)}`;
      await pool.query(
        `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)`,
        [email, username, 'GOOGLE_SSO']
      );
      userResult = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    }

    const user = userResult.rows[0];
    const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Invalid or expired Google token.' });
  }
});

module.exports = router;

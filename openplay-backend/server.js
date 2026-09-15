require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const corsOptions = {
  origin: ['https://openplay-web-daryl16.vercel.app', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true
};

// Enable CORS for your live frontend
app.use(cors(corsOptions));
// Explicitly handle preflight requests for all routes (Vercel Serverless requirement)
app.options('*', cors(corsOptions));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

// Connect to Neon PostgreSQL using the URL from your .env file
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize Database Tables in the Cloud
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS open_plays (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100),
        court_name VARCHAR(100),
        returning_players INTEGER,
        new_players INTEGER,
        court_fee_rev NUMERIC,
        misc_rev NUMERIC,
        base_cost NUMERIC,
        losses NUMERIC
      );
    `);
    console.log('✅ Connected to Neon PostgreSQL successfully.');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
  }
};
initDb();

// --- HELPER ---
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ENDPOINTS ---

app.post('/api/signup', async (req, res) => {
  const { email, username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3)`,
      [email, username, hash]
    );
    res.json({ message: 'User created!' });
  } catch (err) {
    res.status(400).json({ error: 'Username or Email already exists.' });
  }
});

app.post('/api/login', async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Google SSO — verify access token, upsert user, return JWT
app.post('/api/google-auth', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'No access token provided.' });

  try {
    // Fetch the authenticated user's profile from Google
    const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const { email, name, sub: googleId } = googleRes.data;

    // Use part of email as default username (before @), de-conflict if needed
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');

    // Upsert: insert if new, otherwise fetch existing record
    let userResult = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (userResult.rows.length === 0) {
      // New Google user — create them with a placeholder password hash
      let username = baseUsername;
      // Ensure username uniqueness
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

// --- OPEN PLAY ENDPOINTS ---

app.get('/api/open-plays', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM open_plays WHERE username = $1 ORDER BY id ASC`,
      [req.user.username]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/open-plays', authenticateToken, async (req, res) => {
  const { court_name, returning_players, new_players, court_fee_rev, misc_rev, base_cost, losses } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO open_plays (username, court_name, returning_players, new_players, court_fee_rev, misc_rev, base_cost, losses)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [req.user.username, court_name, returning_players, new_players, court_fee_rev, misc_rev, base_cost, losses]
    );
    res.json({ id: result.rows[0].id, message: 'Record saved!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/open-plays/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM open_plays WHERE id = $1 AND username = $2`,
      [req.params.id, req.user.username]
    );
    res.json({ message: 'Record deleted!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(5000, () => console.log('🚀 Server running on port 5000'));
}

module.exports = app;
require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const corsOptions = {
  origin: [
    'https://thebottombaseline.vercel.app',
    'https://opfintracker.vercel.app',
    'https://openplay-web-daryl16.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true
};

app.use(cors(corsOptions));
app.options('/*path', cors(corsOptions));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Initialize / migrate DB tables ────────────────────────────────────────────
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

    // Main open_plays table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS open_plays (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100),
        court_name VARCHAR(100),
        returning_players INTEGER DEFAULT 0,
        new_players INTEGER DEFAULT 0,
        court_fee_rev NUMERIC(12,2) DEFAULT 0,
        misc_rev NUMERIC(12,2) DEFAULT 0,
        base_cost NUMERIC(12,2) DEFAULT 0,
        procured_costs NUMERIC(12,2) DEFAULT 0,
        losses NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Migration: add columns that may not exist on older DB instances
    const migrations = [
      `ALTER TABLE open_plays ADD COLUMN IF NOT EXISTS procured_costs NUMERIC(12,2) DEFAULT 0`,
      `ALTER TABLE open_plays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    ];
    for (const sql of migrations) {
      await pool.query(sql);
    }

    // Loss items table — each row is one line item attached to an open play
    await pool.query(`
      CREATE TABLE IF NOT EXISTS loss_items (
        id SERIAL PRIMARY KEY,
        open_play_id INTEGER REFERENCES open_plays(id) ON DELETE CASCADE,
        item_type VARCHAR(20) CHECK (item_type IN ('procured', 'incident')),
        description TEXT,
        cost NUMERIC(12,2) DEFAULT 0
      );
    `);

    console.log('✅ Connected to Neon PostgreSQL successfully.');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
  }
};
initDb();

// ── Auth helper ───────────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ── Auth endpoints ────────────────────────────────────────────────────────────
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

const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.options('/api/google-auth', cors(corsOptions));

app.post('/api/google-auth', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'No credential provided.' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;
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

// ── Open Play endpoints ───────────────────────────────────────────────────────

// GET all records for authenticated user, including loss item lists
app.get('/api/open-plays', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM open_plays WHERE username = $1 ORDER BY id ASC`,
      [req.user.username]
    );

    // Attach loss items to each record
    const records = await Promise.all(
      result.rows.map(async (row) => {
        const items = await pool.query(
          `SELECT * FROM loss_items WHERE open_play_id = $1 ORDER BY id ASC`,
          [row.id]
        );
        return { ...row, loss_items: items.rows };
      })
    );

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new open play record + its loss items in one request
// Body: { court_name, returning_players, new_players, court_fee_rev, misc_rev,
//         base_cost, procured_costs, losses, loss_items: [{item_type, description, cost}] }
app.post('/api/open-plays', authenticateToken, async (req, res) => {
  const {
    court_name, returning_players, new_players,
    court_fee_rev, misc_rev, base_cost,
    procured_costs, losses, loss_items = []
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO open_plays
         (username, court_name, returning_players, new_players,
          court_fee_rev, misc_rev, base_cost, procured_costs, losses)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        req.user.username, court_name,
        returning_players || 0, new_players || 0,
        court_fee_rev || 0, misc_rev || 0,
        base_cost || 0, procured_costs || 0, losses || 0
      ]
    );
    const openPlayId = result.rows[0].id;

    // Insert each loss item
    for (const item of loss_items) {
      await client.query(
        `INSERT INTO loss_items (open_play_id, item_type, description, cost)
         VALUES ($1, $2, $3, $4)`,
        [openPlayId, item.item_type, item.description, item.cost || 0]
      );
    }

    await client.query('COMMIT');
    res.json({ id: openPlayId, message: 'Record saved!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE a record (loss_items cascade automatically)
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
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your_super_secret_jwt_key';

// Replace this with your actual Google Client ID later
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Initialize Database
const db = new sqlite3.Database('./openplay.db', (err) => {
  if (err) console.error(err.message);
  console.log('Connected to the SQLite database.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS open_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    court_name TEXT,
    returning_players INTEGER,
    new_players INTEGER,
    court_fee_rev REAL,
    misc_rev REAL,
    base_cost REAL,
    losses REAL
  )`);
});

// Auth Middleware
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
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    db.run(`INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)`, 
      [email, username, hash], 
      function(err) {
        if (err) return res.status(400).json({ error: "Username or Email already exists." });
        res.json({ message: "User created successfully!" });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: "Invalid credentials." });
    
    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ error: "Invalid credentials." });

    const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET);
    res.json({ token, username: user.username });
  });
});

// --- GOOGLE SSO ENDPOINT ---
app.post('/api/google-login', async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const username = email.split('@')[0];

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
      if (err) return res.status(500).json({ error: "Database error" });
      
      let finalUser = user;
      if (!user) {
        const dummyHash = await bcrypt.hash("GOOGLE_SSO_USER", 10);
        await new Promise((resolve) => {
          db.run(`INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)`, 
            [email, username, dummyHash], function() { resolve(); });
        });
        finalUser = { username, email };
      }

      const token = jwt.sign({ username: finalUser.username, email: finalUser.email }, JWT_SECRET);
      res.json({ token, username: finalUser.username });
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid Google Token" });
  }
});

// --- DATA ENDPOINTS ---

app.get('/api/open-plays', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM open_plays WHERE username = ? ORDER BY id ASC`, [req.user.username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/open-plays', authenticateToken, (req, res) => {
  const { court_name, returning_players, new_players, court_fee_rev, misc_rev, base_cost, losses } = req.body;
  db.run(`INSERT INTO open_plays (username, court_name, returning_players, new_players, court_fee_rev, misc_rev, base_cost, losses) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [req.user.username, court_name, returning_players, new_players, court_fee_rev, misc_rev, base_cost, losses], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: "Record saved!" });
  });
});

app.delete('/api/open-plays/:id', authenticateToken, (req, res) => {
  db.run(`DELETE FROM open_plays WHERE id = ? AND username = ?`, [req.params.id, req.user.username], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Record deleted!" });
  });
});

app.listen(5000, () => console.log('Server running on port 5000'));
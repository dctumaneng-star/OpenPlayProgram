require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const { initDb }    = require('./db');
const authRoutes    = require('./routes/auth');
const openPlayRoutes = require('./routes/openPlays');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: [
    'https://thebottombaseline.vercel.app',
    'https://opfintracker.vercel.app',
    'https://openplay-web-daryl16.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('/*path', cors(corsOptions));          // preflight for all routes
app.options('/api/google-auth', cors(corsOptions)); // explicit Vercel requirement

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(express.json());

// ── DB init ───────────────────────────────────────────────────────────────────
initDb();

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', authRoutes);              // /api/signup  /api/login  /api/google-auth
app.use('/api/open-plays', openPlayRoutes); // /api/open-plays (GET, POST, DELETE /:id)

// ── Start (local dev only) ────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(5000, () => console.log('🚀 Server running on port 5000'));
}

module.exports = app;
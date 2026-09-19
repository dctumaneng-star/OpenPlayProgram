const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Initialize / migrate tables on startup ────────────────────────────────────
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

    // Safe migrations for older DB instances
    const migrations = [
      `ALTER TABLE open_plays ADD COLUMN IF NOT EXISTS procured_costs NUMERIC(12,2) DEFAULT 0`,
      `ALTER TABLE open_plays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    ];
    for (const sql of migrations) {
      await pool.query(sql);
    }

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

module.exports = { pool, initDb };


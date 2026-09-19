const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ── GET /api/open-plays ───────────────────────────────────────────────────────
// Returns all records for the authenticated user, with loss_items attached
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM open_plays WHERE username = $1 ORDER BY id ASC`,
      [req.user.username]
    );

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

// ── POST /api/open-plays ──────────────────────────────────────────────────────
// Body: { court_name, returning_players, new_players, court_fee_rev, misc_rev,
//         base_cost, procured_costs, losses,
//         loss_items: [{ item_type, description, cost }] }
router.post('/', authenticateToken, async (req, res) => {
  const {
    court_name, returning_players, new_players,
    court_fee_rev, misc_rev, base_cost,
    procured_costs, losses, loss_items = [],
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
        base_cost || 0, procured_costs || 0, losses || 0,
      ]
    );
    const openPlayId = result.rows[0].id;

    // Insert each loss line item
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

// ── DELETE /api/open-plays/:id ────────────────────────────────────────────────
// loss_items rows are removed automatically via ON DELETE CASCADE
router.delete('/:id', authenticateToken, async (req, res) => {
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

module.exports = router;


import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router(); // a mini route list for this module

router.get('/', async (req, res) => {
  try {
    // SELECT NOW() just asks Postgres for the time, so no table is needed
    const { rows } = await pool.query('SELECT NOW() AS server_time');
    res.json({ ok: true, serverTime: rows[0].server_time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Database connection failed' });
  }
});

export default router;
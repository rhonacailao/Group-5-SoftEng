import { pool } from '../config/db.js';

// A new link cancels the older unused links of the same user, so only the latest works.
export async function create({ userId, tokenHash, purpose, hours }, db = pool) {
  await db.query(
    `UPDATE password_reset_token SET is_used = true, used_at = now()
      WHERE user_id = $1 AND NOT is_used`,
    [userId],
  );
  await db.query(
    `INSERT INTO password_reset_token (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [userId, tokenHash, purpose, hours],
  );
}

// The expiry check happens inside SQL so it uses the database clock (no clock mismatch)
export async function findByHashForUpdate(tokenHash, db) {
  const { rows } = await db.query(
    `SELECT token_id, user_id, purpose, is_used, (expires_at <= now()) AS is_expired
       FROM password_reset_token
      WHERE token_hash = $1
      FOR UPDATE`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.token_id,
    userId: Number(row.user_id),
    purpose: row.purpose,
    isUsed: row.is_used,
    isExpired: row.is_expired,
  };
}

export async function markUsed(id, db) {
  await db.query('UPDATE password_reset_token SET is_used = true, used_at = now() WHERE token_id = $1', [id]);
}

export async function cancelAllForUser(userId, db) {
  await db.query(
    'UPDATE password_reset_token SET is_used = true, used_at = now() WHERE user_id = $1 AND NOT is_used',
    [userId],
  );
}

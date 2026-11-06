import { pool } from '../config/db.js';

export async function create({ tokenHash, userId, hours }, db = pool) {
  await db.query(
    `INSERT INTO user_session (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [tokenHash, userId, hours],
  );
}

// Finds who a cookie belongs to. Expired sessions are ignored.
export async function findUserByTokenHash(tokenHash, db = pool) {
  const { rows } = await db.query(
    `SELECT u.user_id, u.first_name, u.last_name, u.email, r.role_name, u.status, u.is_blocked
       FROM user_session s
       JOIN app_user u ON u.user_id = s.user_id
       JOIN "role" r ON r.role_id = u.role_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.deleted_at IS NULL`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.user_id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role_name,
    status: row.status,
    isBlocked: row.is_blocked,
  };
}

export async function remove(tokenHash, db = pool) {
  await db.query('DELETE FROM user_session WHERE token_hash = $1', [tokenHash]);
}

// Logs the user out of every browser (used when blocking someone or changing a password)
export async function removeAllForUser(userId, db = pool) {
  await db.query('DELETE FROM user_session WHERE user_id = $1', [userId]);
}

export async function removeExpired(db = pool) {
  await db.query('DELETE FROM user_session WHERE expires_at <= now()');
}

import { pool } from '../config/db.js';

// Tables from 20261105110500_userManagement.sql: module, rights, user_permission.
// A right is GRANTED to a user when its user_permission row is status 'Active' AND
// deleted_at IS NULL. Taking a right away is a soft delete (status 'Inactive' + deleted_at),
// never a real DELETE, so the history stays.

// Every right that can be handed out, with its module, in the order they were seeded.
// Inactive or deleted modules / rights are left out, so they can never be granted.
export async function listCatalogue(db = pool) {
  const { rows } = await db.query(
    `SELECT m.module_id, m.module_code, m.module_name,
            r.right_id, r.right_code, r.description
       FROM module m
       JOIN rights r ON r.module_id = m.module_id
      WHERE m.status = 'Active' AND m.deleted_at IS NULL
        AND r.status = 'Active' AND r.deleted_at IS NULL
      ORDER BY m.module_id, r.right_id`,
  );
  return rows.map((row) => ({
    moduleId: Number(row.module_id),
    moduleCode: row.module_code,
    moduleName: row.module_name,
    rightId: Number(row.right_id),
    rightCode: row.right_code,
    description: row.description,
  }));
}

// All of one user's permission rows, including taken-away ones (so they can be restored).
// FOR UPDATE: nobody else can change this user's rights until our transaction ends.
export async function listForUser(userId, db) {
  const { rows } = await db.query(
    `SELECT right_id, (status = 'Active' AND deleted_at IS NULL) AS is_granted
       FROM user_permission
      WHERE user_id = $1
      FOR UPDATE`,
    [userId],
  );
  return new Map(rows.map((row) => [Number(row.right_id), row.is_granted]));
}

// The codes a user holds right now (the main page menu uses this). Taken-away rights and
// rights of an inactive module do not count.
export async function listGrantedCodes(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT r.right_code
       FROM user_permission up
       JOIN rights r ON r.right_id = up.right_id
       JOIN module m ON m.module_id = r.module_id
      WHERE up.user_id = $1 AND up.status = 'Active' AND up.deleted_at IS NULL
        AND r.status = 'Active' AND r.deleted_at IS NULL
        AND m.status = 'Active' AND m.deleted_at IS NULL
      ORDER BY m.module_id, r.right_id`,
    [userId],
  );
  return rows.map((row) => row.right_code);
}

export async function grant(userId, rightId, by, db) {
  await db.query(
    `INSERT INTO user_permission (user_id, right_id, stamp) VALUES ($1, $2, $3)`,
    [userId, rightId, `grant:${by}`.slice(0, 100)],
  );
}

export async function restore(userId, rightId, by, db) {
  await db.query(
    `UPDATE user_permission
        SET status = 'Active', deleted_at = NULL, stamp = $3, updated_at = now()
      WHERE user_id = $1 AND right_id = $2`,
    [userId, rightId, `restore:${by}`.slice(0, 100)],
  );
}

export async function revoke(userId, rightId, by, db) {
  await db.query(
    `UPDATE user_permission
        SET status = 'Inactive', deleted_at = now(), stamp = $3, updated_at = now()
      WHERE user_id = $1 AND right_id = $2`,
    [userId, rightId, `revoke:${by}`.slice(0, 100)],
  );
}

// S1-DEV-08: the server-side permission check. True when the user holds AT LEAST ONE of
// these codes right now. One small query, run on every protected request, so taking a right
// away works immediately (nothing is remembered in the browser or the session).
export async function userHasAnyRight(userId, codes, db = pool) {
  const { rows } = await db.query(
    `SELECT 1
       FROM user_permission up
       JOIN rights r ON r.right_id = up.right_id
       JOIN module m ON m.module_id = r.module_id
      WHERE up.user_id = $1 AND r.right_code = ANY($2::text[])
        AND up.status = 'Active' AND up.deleted_at IS NULL
        AND r.status = 'Active' AND r.deleted_at IS NULL
        AND m.status = 'Active' AND m.deleted_at IS NULL
      LIMIT 1`,
    [userId, codes],
  );
  return rows.length > 0;
}

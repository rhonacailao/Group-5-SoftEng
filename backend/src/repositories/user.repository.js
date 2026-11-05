import { pool } from '../config/db.js';

// Repositories contain ONLY SQL. Every function takes an optional `db`:
//   - leave it out  -> runs on the shared pool (one single query)
//   - pass `client` -> runs inside the transaction that client belongs to
// All values go in as $1, $2... so user input can never change the SQL (no SQL injection).
//
// Table names come from supabase/migrations/20261105110500_userManagement.sql:
// app_user + "role" (role_name is 'superadmin' | 'admin' | 'user'). A row with
// deleted_at set is deleted, so every read ignores it.

const COLUMNS = `u.user_id, u.first_name, u.last_name, u.email, r.role_name, u.status, u.is_blocked,
                 (u.password_hash IS NOT NULL) AS has_password, u.created_at`;
const FROM = `FROM app_user u JOIN "role" r ON r.role_id = u.role_id`;

// Database names are snake_case; the rest of the app uses camelCase.
// password_hash is never copied here, so it cannot leak into an API reply by accident.
function toUser(row) {
  if (!row) return null;
  return {
    id: Number(row.user_id), // BIGINT arrives as text, so turn it into a number
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role_name,
    status: row.status,
    isBlocked: row.is_blocked,
    hasPassword: row.has_password,
    createdAt: row.created_at,
  };
}

export async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE u.user_id = $1 AND u.deleted_at IS NULL`, [id]);
  return toUser(rows[0]);
}

// FOR UPDATE locks the user row until the transaction ends, so two requests cannot change
// the same user at the same moment.
export async function findByIdForUpdate(id, db) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} ${FROM} WHERE u.user_id = $1 AND u.deleted_at IS NULL FOR UPDATE OF u`,
    [id],
  );
  return toUser(rows[0]);
}

export async function findByEmail(email, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} ${FROM} WHERE lower(u.email) = $1 AND u.deleted_at IS NULL`,
    [email],
  );
  return toUser(rows[0]);
}

// The only place that reads password_hash (the login needs it to compare)
export async function findForLogin(email, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}, u.password_hash ${FROM} WHERE lower(u.email) = $1 AND u.deleted_at IS NULL`,
    [email],
  );
  if (!rows[0]) return null;
  return { ...toUser(rows[0]), passwordHash: rows[0].password_hash };
}

// The table also wants a username, so we use the email (it is already unique).
// `stamp` records who created the row.
export async function insert({ firstName, lastName, email, role, status }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO app_user (first_name, last_name, username, email, role_id, status, stamp)
     VALUES ($1, $2, $3, $3, (SELECT role_id FROM "role" WHERE role_name = $4), $5, $6)
     RETURNING user_id`,
    [firstName, lastName, email, role, status, `register:${email}`.slice(0, 100)],
  );
  return findById(rows[0].user_id, db);
}

export async function setPasswordHash(id, passwordHash, db = pool) {
  await db.query(
    'UPDATE app_user SET password_hash = $2, updated_at = now() WHERE user_id = $1',
    [id, passwordHash],
  );
}

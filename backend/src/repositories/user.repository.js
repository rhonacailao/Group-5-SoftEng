import { pool } from '../config/db.js';

// Repositories contain ONLY SQL. Every function takes an optional `db`:
//   - leave it out  -> runs on the shared pool (one single query)
//   - pass `client` -> runs inside the transaction that client belongs to
// All values go in as $1, $2... so user input can never change the SQL (no SQL injection).
//
// Tables: app_user + "role" (20261105110500_userManagement.sql). Karla seeded the roles as
// 'Superadmin' / 'Admin' / 'User'; the app uses them in lower case, so we compare and
// return lower(role_name). A row with deleted_at set is deleted, so every read skips it.
//
// IMPORTANT (20261106083000_superadmin_pendingPassword.sql): a user with NO password must be
// Pending AND is_blocked = TRUE. So "blocked" in the database also means "has not chosen a
// password yet". isBlocked below is only true for a REAL block (blocked AND has a password).

const COLUMNS = `u.user_id, u.first_name, u.last_name, u.email, lower(r.role_name) AS role_name,
                 u.status, u.is_blocked, (u.password_hash IS NOT NULL) AS has_password, u.created_at,
                 EXISTS (SELECT 1 FROM password_reset_token t
                          WHERE t.user_id = u.user_id AND NOT t.is_used AND t.expires_at > now()) AS has_open_link`;
const FROM = `FROM app_user u JOIN "role" r ON r.role_id = u.role_id`;
const LIVE = 'u.deleted_at IS NULL';

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
    isBlocked: row.is_blocked && row.has_password, // a real block
    hasPassword: row.has_password,
    hasOpenLink: row.has_open_link, // an unused, unexpired emailed link exists
    createdAt: row.created_at,
  };
}

export async function findById(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE u.user_id = $1 AND ${LIVE}`, [id]);
  return toUser(rows[0]);
}

// FOR UPDATE locks the user row until the transaction ends, so two requests cannot change
// the same user at the same moment.
export async function findByIdForUpdate(id, db) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} ${FROM} WHERE u.user_id = $1 AND ${LIVE} FOR UPDATE OF u`,
    [id],
  );
  return toUser(rows[0]);
}

export async function findByEmail(email, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} ${FROM} WHERE lower(u.email) = $1 AND ${LIVE}`,
    [email],
  );
  return toUser(rows[0]);
}

// The only place that reads password_hash (the login needs it to compare)
export async function findForLogin(email, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}, u.password_hash ${FROM} WHERE lower(u.email) = $1 AND ${LIVE}`,
    [email],
  );
  if (!rows[0]) return null;
  return { ...toUser(rows[0]), passwordHash: rows[0].password_hash };
}

// New users never have a password yet, so they are saved as is_blocked = TRUE (the rule
// above). The table also wants a username, so we use the email. `stamp` says who did it.
export async function insert({ firstName, lastName, email, role, status, createdBy }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO app_user (first_name, last_name, username, email, role_id, status, is_blocked, stamp)
     VALUES ($1, $2, $3, $3, (SELECT role_id FROM "role" WHERE lower(role_name) = $4), $5, TRUE, $6)
     RETURNING user_id`,
    [firstName, lastName, email, role, status, `add:${createdBy ?? email}`.slice(0, 100)],
  );
  return findById(rows[0].user_id, db);
}

// A password RESET: the user already has a password, so nothing else changes.
export async function setPasswordHash(id, passwordHash, db = pool) {
  await db.query(
    'UPDATE app_user SET password_hash = $2, updated_at = now() WHERE user_id = $1',
    [id, passwordHash],
  );
}

// The FIRST password: the account becomes Active and stops being "blocked until set up".
export async function setFirstPassword(id, passwordHash, db = pool) {
  await db.query(
    `UPDATE app_user
        SET password_hash = $2, status = 'Active', is_blocked = FALSE, updated_at = now()
      WHERE user_id = $1`,
    [id, passwordHash],
  );
}

// S1-DEV-05: Edit User. username follows the email so the two never disagree.
export async function updateProfile(id, { firstName, lastName, email }, editedBy, db = pool) {
  await db.query(
    `UPDATE app_user
        SET first_name = $2, last_name = $3, email = $4, username = $4,
            stamp = $5, updated_at = now()
      WHERE user_id = $1`,
    [id, firstName, lastName, email, `edit:${editedBy}`.slice(0, 100)],
  );
  return findById(id, db);
}

// S1-DEV-05: Block / Unblock (only for users who already have a password)
export async function setBlocked(id, isBlocked, editedBy, db = pool) {
  await db.query(
    `UPDATE app_user SET is_blocked = $2, stamp = $3, updated_at = now() WHERE user_id = $1`,
    [id, isBlocked, `${isBlocked ? 'block' : 'unblock'}:${editedBy}`.slice(0, 100)],
  );
  return findById(id, db);
}

// Superadmins who can currently sign in. Locked, so two people cannot disable the last two
// superadmins at the same moment (the "last superadmin" guard uses this).
export async function lockActiveSuperadmins(db) {
  const { rows } = await db.query(
    `SELECT u.user_id
       FROM app_user u JOIN "role" r ON r.role_id = u.role_id
      WHERE lower(r.role_name) = 'superadmin' AND u.status = 'Active'
        AND NOT u.is_blocked AND ${LIVE}
      ORDER BY u.user_id
      FOR UPDATE OF u`,
  );
  return rows.map((row) => Number(row.user_id));
}

// Search + filter + paging for the User Management list.
//   hideRole: leave this role out completely (admins never see superadmins)
export async function list({ search, status, role, isBlocked, hideRole, limit, offset }, db = pool) {
  const where = [LIVE];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`; // the placeholder for the value we just added
  };

  if (search) {
    const like = add(`%${search}%`);
    where.push(`(u.first_name ILIKE ${like} OR u.last_name ILIKE ${like} OR u.email ILIKE ${like})`);
  }
  if (status) where.push(`u.status = ${add(status)}`);
  if (role) where.push(`lower(r.role_name) = ${add(role)}`);
  if (typeof isBlocked === 'boolean') {
    where.push(`(u.is_blocked AND u.password_hash IS NOT NULL) = ${add(isBlocked)}`);
  }
  if (hideRole) where.push(`lower(r.role_name) <> ${add(hideRole)}`);

  const limitSql = add(limit);
  const offsetSql = add(offset);

  const { rows } = await db.query(
    `SELECT ${COLUMNS}, count(*) OVER () AS total
       ${FROM}
      WHERE ${where.join(' AND ')}
      ORDER BY u.created_at DESC, u.user_id DESC
      LIMIT ${limitSql} OFFSET ${offsetSql}`,
    params,
  );
  return {
    users: rows.map(toUser),
    total: rows.length ? Number(rows[0].total) : 0,
  };
}

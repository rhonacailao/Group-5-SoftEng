// Import this FIRST in every test file. It swaps the real database for an in-memory
// Postgres (PGlite) so tests need no internet, no Docker and never touch Supabase.
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // fast hashing for tests only
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.DATABASE_URL = 'postgres://unused:unused@localhost:1/unused';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { setPool } from '../../src/config/db.js';
import { setMailTransport } from '../../src/config/mailer.js';
import { hashPassword } from '../../src/utils/password.js';
import app from '../../src/app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../../supabase/migrations');
// Karla's tables first, then the extra pieces login needs
const migrations = [
  '20261105110500_userManagement.sql',
  '20261105130000_password_reset_token.sql',
  '20261105140000_modulesRights.sql',
  '20261106083000_superadmin_pendingPassword.sql',
  '20261106090000_authSupport.sql',
];

export const db = new PGlite();
let chain = Promise.resolve(); // PGlite runs one thing at a time, so we queue transactions

// Minimal stand-in for pg.Pool: query(), connect() -> client with query()/release()
function makePool() {
  return {
    query: (sql, params) => db.query(sql, params),
    async connect() {
      let release;
      const turn = new Promise((resolve) => (release = resolve));
      const previous = chain;
      chain = chain.then(() => turn);
      await previous; // wait until the earlier transaction finished
      return { query: (sql, params) => db.query(sql, params), release };
    },
    on() {},
  };
}

export const outbox = []; // every email "sent" during a test
setMailTransport(async (message) => {
  outbox.push(message);
});

export async function resetDb() {
  await db.exec(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  // Supabase has these two roles built in; a plain Postgres does not
  await db.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  END $$;`);
  for (const file of migrations) await db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  outbox.length = 0;
}

export async function startApp() {
  setPool(makePool());
  await resetDb();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

// Directly inserts a user (bypasses the API) – used to set up scenarios quickly
// Same rule as the database: a user WITHOUT a password must be Pending and blocked
// (20261106083000_superadmin_pendingPassword.sql); a user with a password is Active.
export async function seedUser({ email, role = 'user', status, password = 'Passw0rd!x', blocked = false, first = 'Test', last = 'User' }) {
  const hash = password ? await hashPassword(password) : null;
  const finalStatus = status ?? (hash ? 'Active' : 'Pending');
  const finalBlocked = hash ? blocked : true;
  const { rows } = await db.query(
    `INSERT INTO app_user (first_name,last_name,username,email,role_id,status,is_blocked,password_hash,stamp)
     VALUES ($1,$2,$3,$3,(SELECT role_id FROM "role" WHERE lower(role_name)=$4),$5,$6,$7,'test') RETURNING user_id`,
    [first, last, email, role, finalStatus, finalBlocked, hash],
  );
  return Number(rows[0].user_id);
}

// A tiny HTTP client that remembers the login cookie, like a browser
export function client(base) {
  let cookie = '';
  async function call(method, url, body) {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const line of set) {
      const pair = line.split(';')[0];
      cookie = pair.endsWith('=') ? '' : pair; // an empty value means "cleared"
    }
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, body: json };
  }
  return {
    get: (u) => call('GET', u),
    post: (u, b = {}) => call('POST', u, b),
    patch: (u, b = {}) => call('PATCH', u, b),
    put: (u, b = {}) => call('PUT', u, b),
    login: (email, password = 'Passw0rd!x') => call('POST', '/api/auth/login', { email, password }),
    get cookie() { return cookie; },
  };
}

// Pulls the ?token=... out of the newest email
export function lastToken() {
  const m = outbox.at(-1)?.text.match(/token=([a-f0-9]+)/);
  return m?.[1];
}

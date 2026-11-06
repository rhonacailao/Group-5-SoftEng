import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, seedUser, client, db, outbox, lastToken } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => ctx?.server.close());
beforeEach(async () => { await resetDb(); });

const as = async (email, password) => { const c = client(ctx.base); const r = await c.login(email, password); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
const anon = () => client(ctx.base);

describe('S1-DEV-02 register', () => {
  test('creates a pending user with no password', async () => {
    const r = await anon().post('/api/auth/register', { firstName: 'Ana', lastName: 'Cruz', email: 'Ana@Example.com' });
    assert.equal(r.status, 201);
    const { rows } = await db.query('SELECT u.status, r.role_name AS role_code, u.password_hash, u.email FROM app_user u JOIN "role" r USING (role_id)');
    assert.deepEqual(rows[0], { status: 'Pending', role_code: 'user', password_hash: null, email: 'ana@example.com' });
  });
  test('cannot self-assign role/status', async () => {
    await anon().post('/api/auth/register', { firstName: 'A', lastName: 'B', email: 'a@b.co', role: 'superadmin', status: 'Active' });
    const { rows } = await db.query('SELECT u.status, r.role_name AS role_code FROM app_user u JOIN "role" r USING (role_id)');
    assert.deepEqual(rows[0], { status: 'Pending', role_code: 'user' });
  });
  test('duplicate email -> 409, bad input -> 400', async () => {
    const body = { firstName: 'A', lastName: 'B', email: 'a@b.co' };
    await anon().post('/api/auth/register', body);
    assert.equal((await anon().post('/api/auth/register', body)).status, 409);
    const bad = await anon().post('/api/auth/register', { firstName: '', lastName: {}, email: 'nope' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors.firstName && bad.body.errors.lastName && bad.body.errors.email);
  });
  test('pending user cannot log in', async () => {
    await anon().post('/api/auth/register', { firstName: 'A', lastName: 'B', email: 'a@b.co' });
    assert.equal((await anon().login('a@b.co', 'whatever123')).status, 401);
  });
});

describe('S1-DEV-03 set password, login, logout', () => {
  // Same thing the create-superadmin script / approval step does: make a one-time link
  async function inviteLink(userId) {
    const { withTransaction } = await import('../src/config/db.js');
    const credentials = await import('../src/services/credential.service.js');
    const users = await import('../src/repositories/user.repository.js');
    const user = await users.findById(userId);
    const token = await withTransaction(null, (c) => credentials.createLink(c, user, 'set_password'));
    return token;
  }

  test('set password with the emailed link -> login -> me -> logout', async () => {
    const id = await seedUser({ email: 'p@x.co', password: null });
    const token = await inviteLink(id);
    const u = anon();
    assert.equal((await u.post('/api/auth/set-password', { token, password: 'short' })).status, 400);
    assert.equal((await u.post('/api/auth/set-password', { token, password: 'GoodPass123' })).status, 200);
    assert.equal((await u.post('/api/auth/set-password', { token, password: 'GoodPass123' })).status, 400, 'link works once');
    assert.equal((await u.login('p@x.co', 'GoodPass123')).status, 200);
    assert.equal((await u.get('/api/auth/me')).body.user.email, 'p@x.co');
    assert.equal((await u.post('/api/auth/logout')).status, 200);
    assert.equal((await u.get('/api/auth/me')).status, 401);
  });
  test('expired or garbage link rejected', async () => {
    const id = await seedUser({ email: 'p@x.co', password: null });
    const token = await inviteLink(id);
    await db.query(`UPDATE password_reset_token SET created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute'`);
    assert.equal((await anon().post('/api/auth/set-password', { token, password: 'GoodPass123' })).status, 400);
    assert.equal((await anon().post('/api/auth/set-password', { token: 'abc', password: 'GoodPass123' })).status, 400);
  });
  test('password is stored hashed, never returned', async () => {
    await seedUser({ email: 'a@x.co' });
    const c = anon();
    const r = await c.login('a@x.co');
    assert.equal(JSON.stringify(r.body).includes('$2'), false);
    assert.equal(JSON.stringify((await c.get('/api/auth/me')).body).includes('$2'), false);
    const { rows } = await db.query('SELECT password_hash FROM app_user');
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
  });
  test('wrong password and unknown email give the same generic 401', async () => {
    await seedUser({ email: 'a@x.co' });
    const a = await anon().login('a@x.co', 'wrongwrong');
    const b = await anon().login('nobody@x.co', 'wrongwrong');
    assert.equal(a.status, 401); assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });
  test('blocked user cannot log in, and an open session stops working', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    const u = await as('u@x.co');
    await db.query('UPDATE app_user SET is_blocked = true WHERE user_id = $1', [id]);
    assert.ok((await u.get('/api/auth/me')).status >= 401);
    assert.equal((await anon().login('u@x.co')).status, 403);
    await db.query('UPDATE app_user SET is_blocked = false WHERE user_id = $1', [id]);
    assert.equal((await anon().login('u@x.co')).status, 200);
  });
  test('logging in with a pending / password-less account is refused', async () => {
    await seedUser({ email: 'p@x.co', status: 'Pending', password: null });
    assert.equal((await anon().login('p@x.co', 'whatever123')).status, 401);
  });
  test('/me needs a login', async () => {
    assert.equal((await anon().get('/api/auth/me')).status, 401);
  });
});

describe('S1-DEV-04 reset password', () => {
  test('generic reply, link emailed, reset works, old password and sessions die', async () => {
    await seedUser({ email: 'u@x.co' });
    const u = await as('u@x.co');
    const unknown = await anon().post('/api/auth/forgot-password', { email: 'ghost@x.co' });
    assert.equal(unknown.status, 200); assert.equal(outbox.length, 0);
    const known = await anon().post('/api/auth/forgot-password', { email: 'U@x.co' });
    assert.equal(known.status, 200); assert.equal(known.body.message, unknown.body.message);
    assert.equal(outbox.length, 1);
    assert.match(outbox[0].text, /expires in 1 hour/);
    const token = lastToken();
    assert.equal((await anon().post('/api/auth/reset-password', { token, password: 'tiny' })).status, 400);
    const r = await anon().post('/api/auth/reset-password', { token, password: 'NewPass12345' });
    assert.equal(r.status, 200); assert.equal(r.body.purpose, 'reset_password');
    assert.equal((await u.get('/api/auth/me')).status, 401, 'old session revoked');
    assert.equal((await anon().login('u@x.co', 'Passw0rd!x')).status, 401);
    assert.equal((await anon().login('u@x.co', 'NewPass12345')).status, 200);
    assert.equal((await anon().post('/api/auth/reset-password', { token, password: 'Another12345' })).status, 400, 'link works once');
  });
  test('a newer request cancels the older link', async () => {
    await seedUser({ email: 'u@x.co' });
    await anon().post('/api/auth/forgot-password', { email: 'u@x.co' });
    const first = lastToken();
    await anon().post('/api/auth/forgot-password', { email: 'u@x.co' });
    const second = lastToken();
    assert.equal((await anon().post('/api/auth/reset-password', { token: first, password: 'NewPass12345' })).status, 400);
    assert.equal((await anon().post('/api/auth/reset-password', { token: second, password: 'NewPass12345' })).status, 200);
  });
  test('no email for unknown, blocked, pending or password-less accounts; bad input safe', async () => {
    await seedUser({ email: 'b@x.co', blocked: true });
    await seedUser({ email: 'p@x.co', status: 'Pending', password: null });
    await seedUser({ email: 'n@x.co', password: null });
    for (const email of ['b@x.co', 'p@x.co', 'n@x.co', 'nope', '', undefined, { a: 1 }]) {
      assert.equal((await anon().post('/api/auth/forgot-password', { email })).status, 200);
    }
    assert.equal((await anon().post('/api/auth/forgot-password')).status, 200);
    assert.equal(outbox.length, 0);
  });
  test('expired reset link is rejected; token is stored only as a hash', async () => {
    await seedUser({ email: 'u@x.co' });
    await anon().post('/api/auth/forgot-password', { email: 'u@x.co' });
    const token = lastToken();
    const { rows } = await db.query('SELECT token_hash FROM password_reset_token');
    assert.notEqual(rows[0].token_hash, token);
    await db.query(`UPDATE password_reset_token SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'`);
    const r = await anon().post('/api/auth/reset-password', { token, password: 'NewPass12345' });
    assert.equal(r.status, 400); assert.equal(r.body.code, 'TOKEN_EXPIRED');
  });
  test('reset is written to the audit log without the password', async () => {
    await seedUser({ email: 'u@x.co' });
    await anon().post('/api/auth/forgot-password', { email: 'u@x.co' });
    await anon().post('/api/auth/reset-password', { token: lastToken(), password: 'NewPass12345' });
    const { rows } = await db.query(`SELECT new_values FROM audit_log WHERE table_name='app_user' AND action='EDIT'`);
    assert.equal(rows[0].new_values.event, 'password_reset');
    assert.equal(JSON.stringify(rows).includes('NewPass'), false);
  });
});

describe('misc', () => {
  test('bad JSON -> 400, unknown route -> 404', async () => {
    const res = await fetch(ctx.base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
    assert.equal((await anon().get('/api/nothing')).status, 404);
  });
  test('register with no body does not crash', async () => {
    const res = await fetch(ctx.base + '/api/auth/register', { method: 'POST' });
    assert.equal(res.status, 400);
  });
});

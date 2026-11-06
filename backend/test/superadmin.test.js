import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, seedUser, client, db, outbox, lastToken } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => ctx?.server.close());
beforeEach(async () => { await resetDb(); });

const anon = () => client(ctx.base);
const as = async (email) => { const c = anon(); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
const roleOf = async (id) => (await db.query(`SELECT lower(r.role_name) AS role FROM app_user u JOIN "role" r USING (role_id) WHERE user_id=$1`, [id])).rows[0].role;

describe('S1-DEV-06 approve pending users', () => {
  test('approval queue -> approve -> emailed link -> user chooses a password and is Active', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    await anon().post('/api/auth/register', { firstName: 'Pia', lastName: 'Lopez', email: 'pia@x.co' });
    const sa = await as('sa@x.co');

    const queue = (await sa.get('/api/users?awaitingApproval=true')).body;
    assert.equal(queue.total, 1);
    assert.equal(queue.users[0].awaitingApproval, true);
    const id = queue.users[0].id;

    assert.equal(outbox.length, 0, 'registering sends nothing');
    const r = await sa.patch(`/api/users/${id}/approve`);
    assert.equal(r.status, 200); assert.equal(r.body.emailSent, true);
    assert.equal(r.body.user.awaitingApproval, false);
    assert.equal(outbox.at(-1).to, 'pia@x.co');
    assert.equal((await sa.get('/api/users?awaitingApproval=true')).body.total, 0, 'leaves the queue');

    const pia = anon();
    assert.equal((await pia.login('pia@x.co', 'MyNewPass123')).status, 401, 'cannot log in before choosing a password');
    assert.equal((await pia.post('/api/auth/set-password', { token: lastToken(), password: 'MyNewPass123' })).status, 200);
    assert.equal((await pia.login('pia@x.co', 'MyNewPass123')).status, 200);

    const log = await db.query(`SELECT action_by, new_values FROM audit_log WHERE action='EDIT' AND new_values->>'approved'='true'`);
    assert.equal(log.rows[0].action_by, 'sa@x.co');
  });
  test('approving twice, or approving someone already active, is refused (one link only)', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const active = await seedUser({ email: 'u@x.co' });
    await anon().post('/api/auth/register', { firstName: 'Pia', lastName: 'Lopez', email: 'pia@x.co' });
    const sa = await as('sa@x.co');
    const { rows } = await db.query(`SELECT user_id FROM app_user WHERE email='pia@x.co'`);
    const id = rows[0].user_id;
    assert.equal((await sa.patch(`/api/users/${id}/approve`)).status, 200);
    const mails = outbox.length;
    assert.equal((await sa.patch(`/api/users/${id}/approve`)).status, 409);
    assert.equal(outbox.length, mails, 'no second email');
    assert.equal((await sa.patch(`/api/users/${active}/approve`)).status, 409);
    assert.equal((await sa.patch(`/api/users/99999/approve`)).status, 404);
    assert.equal((await sa.patch(`/api/users/abc/approve`)).status, 404);
  });
  test('a user added by an admin is not in the approval queue', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    await (await as('ad@x.co')).post('/api/users', { firstName: 'A', lastName: 'B', email: 'added@x.co' });
    assert.equal((await (await as('sa@x.co')).get('/api/users?awaitingApproval=true')).body.total, 0);
  });
  test('only a superadmin may approve', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    await seedUser({ email: 'u@x.co' });
    await anon().post('/api/auth/register', { firstName: 'Pia', lastName: 'Lopez', email: 'pia@x.co' });
    const { rows } = await db.query(`SELECT user_id FROM app_user WHERE email='pia@x.co'`);
    assert.equal((await (await as('ad@x.co')).patch(`/api/users/${rows[0].user_id}/approve`)).status, 403);
    assert.equal((await (await as('u@x.co')).patch(`/api/users/${rows[0].user_id}/approve`)).status, 403);
    assert.equal((await anon().patch(`/api/users/${rows[0].user_id}/approve`)).status, 401);
    assert.equal(outbox.length, 0);
  });
});

describe('S1-DEV-06 designate admins', () => {
  test('superadmin makes an admin and back; the change counts immediately; audited', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const id = await seedUser({ email: 'u@x.co' });
    const sa = await as('sa@x.co');
    const u = await as('u@x.co');
    assert.equal((await u.get('/api/users')).status, 403);

    const up = await sa.patch(`/api/users/${id}/role`, { role: 'admin' });
    assert.equal(up.status, 200); assert.equal(up.body.user.role, 'admin');
    assert.equal(await roleOf(id), 'admin');
    assert.equal((await u.get('/api/users')).status, 200, 'works without logging in again');

    const down = await sa.patch(`/api/users/${id}/role`, { role: 'user' });
    assert.equal(down.body.user.role, 'user');
    assert.equal((await u.get('/api/users')).status, 403);
    assert.equal((await sa.patch(`/api/users/${id}/role`, { role: 'user' })).status, 200, 'same role is harmless');

    const log = await db.query(`SELECT old_values, new_values FROM audit_log WHERE new_values ? 'role' AND action='EDIT' ORDER BY audit_id`);
    assert.deepEqual(log.rows.map((r) => [r.old_values.role, r.new_values.role]), [['user', 'admin'], ['admin', 'user']]);
  });
  test('only superadmin; role must be admin or user; target must be active', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const pending = await seedUser({ email: 'p@x.co', password: null });
    assert.equal((await (await as('ad@x.co')).patch(`/api/users/${id}/role`, { role: 'admin' })).status, 403);
    const sa = await as('sa@x.co');
    for (const role of ['superadmin', 'root', '', undefined, 5]) {
      assert.equal((await sa.patch(`/api/users/${id}/role`, { role })).status, 400, String(role));
    }
    assert.equal((await sa.patch(`/api/users/${id}/role`)).status, 400, 'no body does not crash');
    assert.equal((await sa.patch(`/api/users/${pending}/role`, { role: 'admin' })).status, 409);
    assert.equal(await roleOf(id), 'user');
  });
});

describe('S1-DEV-06 the last superadmin is protected', () => {
  test('cannot be stepped down or blocked while they are the only one', async () => {
    const only = await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const sa = await as('sa@x.co');
    const demote = await sa.patch(`/api/users/${only}/role`, { role: 'admin' });
    assert.equal(demote.status, 409); assert.equal(demote.body.code, 'LAST_SUPERADMIN');
    assert.equal((await sa.patch(`/api/users/${only}/block`)).status, 400);
    assert.equal(await roleOf(only), 'superadmin');
  });
  test('a blocked superadmin does not count: with one blocked, the other is the last', async () => {
    const a = await seedUser({ email: 'a@x.co', role: 'superadmin' });
    await seedUser({ email: 'b@x.co', role: 'superadmin', blocked: true });
    const ca = await as('a@x.co');
    const r = await ca.patch(`/api/users/${a}/role`, { role: 'user' });
    assert.equal(r.status, 409); assert.equal(r.body.code, 'LAST_SUPERADMIN');
  });
  test('with two, one may step down the other; then the remaining one is protected', async () => {
    const a = await seedUser({ email: 'a@x.co', role: 'superadmin' });
    const b = await seedUser({ email: 'b@x.co', role: 'superadmin' });
    const ca = await as('a@x.co');
    assert.equal((await ca.patch(`/api/users/${b}/role`, { role: 'admin' })).status, 200);
    assert.equal((await ca.patch(`/api/users/${a}/role`, { role: 'admin' })).status, 409);
    assert.equal(await roleOf(a), 'superadmin');
  });
  // Note: the test database runs one transaction at a time, so this checks the rule, not the row locks
  test('two superadmins stepping each other down at the same moment: one always remains', async () => {
    const a = await seedUser({ email: 'a@x.co', role: 'superadmin' });
    const b = await seedUser({ email: 'b@x.co', role: 'superadmin' });
    const ca = await as('a@x.co');
    const cb = await as('b@x.co');
    const results = await Promise.all([
      ca.patch(`/api/users/${b}/role`, { role: 'user' }),
      cb.patch(`/api/users/${a}/role`, { role: 'user' }),
    ]);
    const { rows } = await db.query(`SELECT count(*)::int n FROM app_user u JOIN "role" r USING (role_id) WHERE lower(r.role_name)='superadmin'`);
    assert.equal(rows[0].n, 1, JSON.stringify(results.map((r) => r.status)));
  });
  test('two superadmins blocking each other at the same moment: one always stays usable', async () => {
    const a = await seedUser({ email: 'a@x.co', role: 'superadmin' });
    const b = await seedUser({ email: 'b@x.co', role: 'superadmin' });
    const ca = await as('a@x.co');
    const cb = await as('b@x.co');
    await Promise.all([ca.patch(`/api/users/${b}/block`), cb.patch(`/api/users/${a}/block`)]);
    const { rows } = await db.query(`SELECT count(*)::int n FROM app_user u JOIN "role" r USING (role_id) WHERE lower(r.role_name)='superadmin' AND NOT is_blocked`);
    assert.equal(rows[0].n >= 1, true);
  });
});

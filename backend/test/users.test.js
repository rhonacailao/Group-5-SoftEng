import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, seedUser, client, db, outbox, lastToken } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => ctx?.server.close());
beforeEach(async () => { await resetDb(); });

const anon = () => client(ctx.base);
const as = async (email) => { const c = anon(); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };

describe('S1-DEV-05 who may use User Management', () => {
  test('needs login; plain users are refused', async () => {
    assert.equal((await anon().get('/api/users')).status, 401);
    await seedUser({ email: 'u@x.co' });
    assert.equal((await (await as('u@x.co')).get('/api/users')).status, 403);
  });
  test('Karla\'s capitalised roles (Admin, Superadmin) work', async () => {
    const { rows } = await db.query(`SELECT role_name FROM "role" ORDER BY role_name`);
    assert.deepEqual(rows.map((r) => r.role_name), ['Admin', 'Superadmin', 'User']);
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const me = await (await as('ad@x.co')).get('/api/auth/me');
    assert.equal(me.body.user.role, 'admin');
  });
});

describe('S1-DEV-05 user list', () => {
  test('admin never sees superadmins; superadmin sees everyone', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    const forAdmin = await ad.get('/api/users');
    assert.equal(forAdmin.status, 200);
    assert.deepEqual(forAdmin.body.users.map((x) => x.email).sort(), ['ad@x.co', 'u@x.co']);
    assert.equal(forAdmin.body.total, 2);
    assert.equal((await ad.get('/api/users?role=superadmin')).body.users.length, 0, 'filtering cannot reveal them');
    const sa = await as('sa@x.co');
    assert.equal((await sa.get('/api/users')).body.total, 3);
  });
  test('canManage flag: admin can manage users only', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    await seedUser({ email: 'ad2@x.co', role: 'admin' });
    await seedUser({ email: 'u@x.co' });
    const list = (await (await as('ad@x.co')).get('/api/users')).body.users;
    const byEmail = Object.fromEntries(list.map((x) => [x.email, x.canManage]));
    assert.deepEqual(byEmail, { 'ad@x.co': false, 'ad2@x.co': false, 'u@x.co': true });
  });
  test('never returns password hashes; shows setup state', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    await seedUser({ email: 'new@x.co', password: null });
    const body = (await (await as('sa@x.co')).get('/api/users')).body;
    assert.equal(JSON.stringify(body).includes('$2'), false);
    assert.equal(JSON.stringify(body).includes('password_hash'), false);
    const row = body.users.find((x) => x.email === 'new@x.co');
    assert.deepEqual([row.status, row.hasPassword, row.isBlocked], ['Pending', false, false]);
  });
  test('search, filters, paging; % and _ are not wildcards; bad ids', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    for (let i = 1; i <= 5; i++) await seedUser({ email: `u${i}@x.co`, first: `Person${i}` });
    await seedUser({ email: 'blocked@x.co', blocked: true });
    const sa = await as('sa@x.co');
    assert.equal((await sa.get('/api/users?search=person3')).body.users.length, 1);
    assert.equal((await sa.get('/api/users?search=%25')).body.users.length, 0);
    assert.equal((await sa.get('/api/users?search=_')).body.users.length, 0);
    assert.equal((await sa.get('/api/users?blocked=true')).body.users.length, 1);
    assert.equal((await sa.get('/api/users?status=Pending')).body.users.length, 0);
    const page = (await sa.get('/api/users?pageSize=2&page=2')).body;
    assert.equal(page.users.length, 2); assert.equal(page.total, 7);
    assert.equal((await sa.get('/api/users/abc')).status, 404);
    assert.equal((await sa.get('/api/users/99999')).status, 404);
  });
});

describe('S1-DEV-05 add user', () => {
  test('creates a Pending user without a password and emails a one-time link; they can then activate', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const ad = await as('ad@x.co');
    const r = await ad.post('/api/users', { firstName: 'Neo', lastName: 'One', email: 'Neo@X.co' });
    assert.equal(r.status, 201);
    assert.equal(r.body.emailSent, true);
    assert.equal(r.body.user.email, 'neo@x.co');
    assert.deepEqual([r.body.user.status, r.body.user.role, r.body.user.hasPassword], ['Pending', 'user', false]);
    const { rows } = await db.query(`SELECT username, is_blocked, password_hash FROM app_user WHERE email='neo@x.co'`);
    assert.deepEqual(rows[0], { username: 'neo@x.co', is_blocked: true, password_hash: null });
    assert.equal(outbox.at(-1).to, 'neo@x.co');
    // the new person follows the link
    const neo = anon();
    assert.equal((await neo.login('neo@x.co', 'whatever123')).status, 401, 'cannot log in before choosing a password');
    assert.equal((await neo.post('/api/auth/set-password', { token: lastToken(), password: 'MyNewPass123' })).status, 200);
    assert.equal((await neo.login('neo@x.co', 'MyNewPass123')).status, 200);
    const audit = await db.query(`SELECT action_by FROM audit_log WHERE table_name='app_user' AND action='ADD'`);
    assert.equal(audit.rows[0].action_by, 'ad@x.co');
  });
  test('validation, duplicates, role rules', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const ad = await as('ad@x.co');
    const bad = await ad.post('/api/users', { firstName: '', lastName: 'x'.repeat(60), email: 'nope' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.errors.firstName && bad.body.errors.lastName && bad.body.errors.email);
    assert.equal((await ad.post('/api/users', { firstName: 'A', lastName: 'B', email: 'ok@x.co' })).status, 201);
    assert.equal((await ad.post('/api/users', { firstName: 'A', lastName: 'B', email: 'OK@x.co' })).status, 409, 'duplicate ignoring case');
    assert.equal((await ad.post('/api/users', { firstName: 'A', lastName: 'B', email: 'a2@x.co', role: 'admin' })).status, 400, 'admin cannot add admins');
    assert.equal((await ad.post('/api/users', { firstName: 'A', lastName: 'B', email: 'a3@x.co', role: 'superadmin' })).status, 400);
    const sa = await as('sa@x.co');
    const made = await sa.post('/api/users', { firstName: 'A', lastName: 'B', email: 'a4@x.co', role: 'admin' });
    assert.equal(made.status, 201); assert.equal(made.body.user.role, 'admin');
    assert.equal((await sa.post('/api/users', { firstName: 'A', lastName: 'B', email: 'a5@x.co', role: 'superadmin' })).status, 400, 'superadmins come from the script only');
    assert.equal((await ad.post('/api/users')).status, 400, 'no body does not crash');
  });
});

describe('S1-DEV-05 edit user', () => {
  test('edits name and email (username follows) and is audited', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    const r = await ad.patch(`/api/users/${id}`, { firstName: 'Trinity', email: 'trin@x.co' });
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.user.firstName, r.body.user.email], ['Trinity', 'trin@x.co']);
    const { rows } = await db.query(`SELECT username FROM app_user WHERE user_id=$1`, [id]);
    assert.equal(rows[0].username, 'trin@x.co');
    const log = await db.query(`SELECT old_values, new_values FROM audit_log WHERE action='EDIT'`);
    assert.equal(log.rows[0].old_values.email, 'u@x.co');
    assert.equal(log.rows[0].new_values.email, 'trin@x.co');
  });
  test('cannot change role/status/password through edit; empty or invalid edits refused; duplicate email 409', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    await seedUser({ email: 'taken@x.co' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    assert.equal((await ad.patch(`/api/users/${id}`, { role: 'superadmin', status: 'Rejected', password: 'x' })).status, 400, 'nothing editable sent');
    const { rows } = await db.query(`SELECT u.status, lower(r.role_name) role FROM app_user u JOIN "role" r USING (role_id) WHERE user_id=$1`, [id]);
    assert.deepEqual(rows[0], { status: 'Active', role: 'user' });
    assert.equal((await ad.patch(`/api/users/${id}`, { firstName: '' })).status, 400);
    assert.equal((await ad.patch(`/api/users/${id}`, { email: 'TAKEN@x.co' })).status, 409);
  });
  test('admin cannot edit admins or see superadmins; superadmin can edit anyone', async () => {
    const sa = await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const other = await seedUser({ email: 'ad2@x.co', role: 'admin' });
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const ad = await as('ad@x.co');
    assert.equal((await ad.patch(`/api/users/${other}`, { firstName: 'X' })).status, 403);
    assert.equal((await ad.patch(`/api/users/${sa}`, { firstName: 'X' })).status, 404);
    assert.equal((await ad.get(`/api/users/${sa}`)).status, 404);
    const boss = await as('sa@x.co');
    assert.equal((await boss.patch(`/api/users/${other}`, { firstName: 'Y' })).status, 200);
  });
});

describe('S1-DEV-05 block / unblock', () => {
  test('block logs them out at once and stops login; unblock restores it; both audited', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    const u = await as('u@x.co');
    const b = await ad.patch(`/api/users/${id}/block`);
    assert.equal(b.status, 200); assert.equal(b.body.user.isBlocked, true);
    assert.ok((await u.get('/api/auth/me')).status >= 401, 'old session stops working');
    assert.equal((await anon().login('u@x.co')).status, 403);
    assert.equal((await ad.patch(`/api/users/${id}/block`)).status, 200, 'blocking twice is harmless');
    const ub = await ad.patch(`/api/users/${id}/unblock`);
    assert.equal(ub.body.user.isBlocked, false);
    assert.equal((await anon().login('u@x.co')).status, 200);
    const log = await db.query(`SELECT new_values FROM audit_log WHERE action='EDIT' ORDER BY audit_id`);
    assert.deepEqual(log.rows.map((r) => r.new_values.isBlocked), [true, false]);
  });
  test('admin cannot block admins or superadmins; cannot block yourself', async () => {
    const sa = await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const other = await seedUser({ email: 'ad2@x.co', role: 'admin' });
    const me = await seedUser({ email: 'ad@x.co', role: 'admin' });
    const ad = await as('ad@x.co');
    assert.equal((await ad.patch(`/api/users/${other}/block`)).status, 403);
    assert.equal((await ad.patch(`/api/users/${sa}/block`)).status, 404);
    assert.equal((await ad.patch(`/api/users/${me}/block`)).status, 403, 'admins are not "users", so not even themselves');
    const boss = await as('sa@x.co');
    assert.equal((await boss.patch(`/api/users/${sa}/block`)).status, 400, 'self-block refused');
  });
  test('last working superadmin cannot be blocked', async () => {
    const a = await seedUser({ email: 'a@x.co', role: 'superadmin' });
    const b = await seedUser({ email: 'b@x.co', role: 'superadmin' });
    const ca = await as('a@x.co');
    assert.equal((await ca.patch(`/api/users/${b}/block`)).status, 200);
    const cb = anon();
    assert.equal((await cb.login('b@x.co')).status, 403);
    // b is blocked now, so a is the last one; nobody else could block a anyway (self-block is refused)
    assert.equal((await ca.patch(`/api/users/${a}/block`)).status, 400);
    // a blocked superadmin does not count: a second superadmin cannot be blocked by... themselves either
    await ca.patch(`/api/users/${b}/unblock`);
    const cb2 = await as('b@x.co');
    assert.equal((await cb2.patch(`/api/users/${a}/block`)).status, 200);
  });
  test('users who have no password yet cannot be (un)blocked; use resend invite', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'new@x.co', password: null });
    const ad = await as('ad@x.co');
    assert.equal((await ad.patch(`/api/users/${id}/unblock`)).status, 409);
    assert.equal((await ad.patch(`/api/users/${id}/block`)).status, 409);
    const { rows } = await db.query(`SELECT is_blocked FROM app_user WHERE user_id=$1`, [id]);
    assert.equal(rows[0].is_blocked, true, 'database rule (Pending + no password => blocked) still holds');
  });
});

describe('S1-DEV-05 resend invite', () => {
  test('resends to an invited user (old link dies); refuses unapproved self-registrations and users who have a password', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const ad = await as('ad@x.co');
    const added = await ad.post('/api/users', { firstName: 'Neo', lastName: 'One', email: 'neo@x.co' });
    const first = lastToken();
    const r = await ad.post(`/api/users/${added.body.user.id}/resend-invite`);
    assert.equal(r.status, 200); assert.equal(r.body.emailSent, true);
    const second = lastToken();
    assert.notEqual(first, second);
    assert.equal((await anon().post('/api/auth/set-password', { token: first, password: 'MyNewPass123' })).status, 400);
    assert.equal((await anon().post('/api/auth/set-password', { token: second, password: 'MyNewPass123' })).status, 200);
    assert.equal((await ad.post(`/api/users/${added.body.user.id}/resend-invite`)).status, 409, 'already has a password');

    await anon().post('/api/auth/register', { firstName: 'Self', lastName: 'Reg', email: 'self@x.co' });
    const { rows } = await db.query(`SELECT user_id FROM app_user WHERE email='self@x.co'`);
    const before = outbox.length;
    assert.equal((await ad.post(`/api/users/${rows[0].user_id}/resend-invite`)).status, 409, 'not approved yet');
    assert.equal(outbox.length, before);
  });
});

describe('a self-registered, unapproved user cannot get in by any route', () => {
  test('forgot-password sends nothing and set-password with a made-up token fails', async () => {
    await anon().post('/api/auth/register', { firstName: 'Self', lastName: 'Reg', email: 'self@x.co' });
    await anon().post('/api/auth/forgot-password', { email: 'self@x.co' });
    assert.equal(outbox.length, 0);
    assert.equal((await anon().post('/api/auth/set-password', { token: 'a'.repeat(64), password: 'MyNewPass123' })).status, 400);
    assert.equal((await anon().login('self@x.co', 'MyNewPass123')).status, 401);
  });
});

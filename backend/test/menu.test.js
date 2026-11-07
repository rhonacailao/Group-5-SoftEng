import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import { startApp, resetDb, seedUser, client, db } from './helpers/setup.js';
import { requireAuth } from '../src/middleware/auth.js';
import { requirePermission } from '../src/middleware/permission.js';
import { notFound, errorHandler } from '../src/middleware/errorHandler.js';

let ctx; let probe;
before(async () => {
  ctx = await startApp();
  // A tiny test-only website with routes protected by requirePermission, like the real
  // module routes will be in later sprints.
  const app = express();
  app.use(cookieParser());
  app.post('/customers', requireAuth, requirePermission('CUSTOMER_ADD'), (req, res) => res.json({ ok: true }));
  app.get('/reports/sales-or-products', requireAuth, requirePermission('REPORT_TOP_SALES', 'REPORT_TOP_PRODUCTS'), (req, res) => res.json({ ok: true }));
  app.use(notFound); app.use(errorHandler);
  probe = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
});
after(() => { ctx?.server.close(); probe?.close(); });
beforeEach(async () => { await resetDb(); });

const anon = () => client(ctx.base);
const as = async (email) => { const c = anon(); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
// Same login cookie, but sent to the test website
const probeCall = async (c, method, path) => {
  const res = await fetch(`http://127.0.0.1:${probe.address().port}${path}`, { method, headers: { cookie: c.cookie } });
  return res.status;
};
const give = async (id, ...codes) => {
  for (const code of codes) {
    await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code=$2`, [id, code]);
  }
};
const keys = (menu) => menu.sidebar.map((s) => s.key);

describe('S1-DEV-08 main page menu', () => {
  test('needs a login', async () => {
    assert.equal((await anon().get('/api/menu')).status, 401);
  });
  test('superadmin: Dashboard, all five modules with every right, User Management', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const { body } = await (await as('sa@x.co')).get('/api/menu');
    assert.deepEqual(keys(body), ['DASHBOARD', 'CUSTOMER', 'PRODUCT', 'HUMAN_RESOURCES', 'SALES', 'REPORTS', 'USER_MANAGEMENT']);
    assert.deepEqual(body.tiles.map((t) => t.grantedCount), [3, 6, 13, 7, 7]);
    assert.ok(body.tiles.every((t) => t.grantedCount === t.total));
    assert.equal(body.hasModuleAccess, true);
    assert.equal(body.user.role, 'superadmin');
  });
  test('admin: User Management but NO module tiles until rights are given', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const { body } = await (await as('ad@x.co')).get('/api/menu');
    assert.deepEqual(keys(body), ['DASHBOARD', 'USER_MANAGEMENT']);
    assert.deepEqual(body.tiles, []);
    assert.equal(body.hasModuleAccess, false);
  });
  test('admin with rights: tiles for those modules and User Management', async () => {
    const id = await seedUser({ email: 'ad@x.co', role: 'admin' });
    await give(id, 'SALE_ADD');
    const { body } = await (await as('ad@x.co')).get('/api/menu');
    assert.deepEqual(keys(body), ['DASHBOARD', 'SALES', 'USER_MANAGEMENT']);
  });
  test('plain user: only the modules they have rights in, with the rights listed; no User Management', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await give(id, 'CUSTOMER_ADD', 'CUSTOMER_EDIT', 'REPORT_TOP_SALES');
    const { body } = await (await as('u@x.co')).get('/api/menu');
    assert.deepEqual(keys(body), ['DASHBOARD', 'CUSTOMER', 'REPORTS']);
    assert.deepEqual(body.tiles[0], { code: 'CUSTOMER', name: 'Customer', path: '/customers', icon: 'fa-users', rights: ['CUSTOMER_ADD', 'CUSTOMER_EDIT'], grantedCount: 2, total: 3 });
    assert.deepEqual(body.tiles[1].rights, ['REPORT_TOP_SALES']);
  });
  test('plain user with no rights: Dashboard only', async () => {
    await seedUser({ email: 'u@x.co' });
    const { body } = await (await as('u@x.co')).get('/api/menu');
    assert.deepEqual(keys(body), ['DASHBOARD']);
    assert.equal(body.hasModuleAccess, false);
  });
  test('changes show up on the next request: take a right away and the tile disappears', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await give(id, 'PRODUCT_ADD');
    const u = await as('u@x.co');
    assert.deepEqual(keys((await u.get('/api/menu')).body), ['DASHBOARD', 'PRODUCT']);
    await db.query(`UPDATE user_permission SET status='Inactive', deleted_at=now() WHERE user_id=$1`, [id]);
    assert.deepEqual(keys((await u.get('/api/menu')).body), ['DASHBOARD']);
  });
  test('inactive rights and inactive modules are not shown', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await give(id, 'PRODUCT_ADD', 'SALE_ADD', 'CUSTOMER_ADD');
    await db.query(`UPDATE rights SET status='Inactive' WHERE right_code='PRODUCT_ADD'`);
    await db.query(`UPDATE module SET status='Inactive' WHERE module_code='SALES'`);
    assert.deepEqual(keys((await (await as('u@x.co')).get('/api/menu')).body), ['DASHBOARD', 'CUSTOMER']);
  });
  test('rights belong to the person: another user with no rights sees nothing', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await seedUser({ email: 'v@x.co' });
    await give(id, 'CUSTOMER_ADD');
    assert.deepEqual(keys((await (await as('v@x.co')).get('/api/menu')).body), ['DASHBOARD']);
  });
  test('a blocked user cannot use the menu any more', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    const u = await as('u@x.co');
    await db.query('UPDATE app_user SET is_blocked=true WHERE user_id=$1', [id]);
    assert.ok((await u.get('/api/menu')).status >= 401);
  });
  test('the menu never leaks password data or other users', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const text = JSON.stringify((await (await as('sa@x.co')).get('/api/menu')).body);
    assert.equal(text.includes('$2'), false);
    assert.equal(text.includes('password'), false);
  });
});

describe('S1-DEV-08 requirePermission (the server-side check)', () => {
  test('visitor: 401; user without the right: 403; with the right: allowed', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    assert.equal(await probeCall({ cookie: '' }, 'POST', '/customers'), 401);
    const u = await as('u@x.co');
    assert.equal(await probeCall(u, 'POST', '/customers'), 403);
    await give(id, 'CUSTOMER_ADD');
    assert.equal(await probeCall(u, 'POST', '/customers'), 200);
  });
  test('the right must be the right one: CUSTOMER_EDIT does not open CUSTOMER_ADD', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await give(id, 'CUSTOMER_EDIT');
    assert.equal(await probeCall(await as('u@x.co'), 'POST', '/customers'), 403);
  });
  test('taking the right away blocks the very next request', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await give(id, 'CUSTOMER_ADD');
    const u = await as('u@x.co');
    assert.equal(await probeCall(u, 'POST', '/customers'), 200);
    await db.query(`UPDATE user_permission SET status='Inactive', deleted_at=now() WHERE user_id=$1`, [id]);
    assert.equal(await probeCall(u, 'POST', '/customers'), 403);
  });
  test('superadmin always passes; an admin does NOT pass just for being an admin', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const ad = await seedUser({ email: 'ad@x.co', role: 'admin' });
    assert.equal(await probeCall(await as('sa@x.co'), 'POST', '/customers'), 200);
    const admin = await as('ad@x.co');
    assert.equal(await probeCall(admin, 'POST', '/customers'), 403);
    await give(ad, 'CUSTOMER_ADD');
    assert.equal(await probeCall(admin, 'POST', '/customers'), 200);
  });
  test('several codes mean "at least one of them"', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    const u = await as('u@x.co');
    assert.equal(await probeCall(u, 'GET', '/reports/sales-or-products'), 403);
    await give(id, 'REPORT_TOP_PRODUCTS');
    assert.equal(await probeCall(u, 'GET', '/reports/sales-or-products'), 200);
  });
  test('inactive right or module does not count; a blocked user is stopped before the right is checked', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await give(id, 'CUSTOMER_ADD');
    const u = await as('u@x.co');
    await db.query(`UPDATE module SET status='Inactive' WHERE module_code='CUSTOMER'`);
    assert.equal(await probeCall(u, 'POST', '/customers'), 403);
    await db.query(`UPDATE module SET status='Active' WHERE module_code='CUSTOMER'`);
    assert.equal(await probeCall(u, 'POST', '/customers'), 200);
    await db.query('UPDATE app_user SET is_blocked=true WHERE user_id=$1', [id]);
    assert.equal(await probeCall(u, 'POST', '/customers'), 403);
  });
  test('a typo in the route setup fails when the server starts, not silently', () => {
    assert.throws(() => requirePermission(), /needs one or more/);
    assert.throws(() => requirePermission(''), /needs one or more/);
    assert.throws(() => requirePermission(undefined), /needs one or more/);
    assert.throws(() => requirePermission('CUSTOMER_ADD', 5), /needs one or more/);
  });
  test('a made-up right code never lets anyone in (except a superadmin by design)', async () => {
    await seedUser({ email: 'u@x.co' });
    const mw = requirePermission('NOT_A_RIGHT');
    await assert.rejects(() => mw({ user: { id: 1, role: 'user' } }, {}, () => {}), (e) => e.status === 403);
    await assert.rejects(() => mw({}, {}, () => {}), (e) => e.status === 401);
  });
});

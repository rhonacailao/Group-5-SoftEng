import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => ctx?.server.close());
beforeEach(async () => { await resetDb(); });

const anon = () => client(ctx.base);
const as = async (email) => { const c = anon(); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
const allCodes = async () => (await db.query('SELECT right_code FROM rights ORDER BY right_id')).rows.map((r) => r.right_code);
const heldBy = async (id) => (await db.query(
  `SELECT r.right_code FROM user_permission up JOIN rights r USING (right_id)
    WHERE up.user_id=$1 AND up.status='Active' AND up.deleted_at IS NULL ORDER BY r.right_code`, [id])).rows.map((r) => r.right_code);
const auditRows = async () => (await db.query(
  `SELECT action, record_key, action_by, old_values, new_values FROM audit_log WHERE table_name='user_permission' ORDER BY audit_id`)).rows;

describe('S1-DEV-07 the rights list', () => {
  test('five modules in the sheet order with all 36 rights; module checkbox state starts at none', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const r = await (await as('ad@x.co')).get('/api/rights');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.modules.map((m) => m.code), ['CUSTOMER', 'PRODUCT', 'HUMAN_RESOURCES', 'SALES', 'REPORTS']);
    assert.deepEqual(r.body.modules.map((m) => m.total), [3, 6, 13, 7, 7]);
    assert.equal(r.body.modules.flatMap((m) => m.rights).length, 36);
    assert.ok(r.body.modules.every((m) => m.state === 'none' && m.grantedCount === 0));
  });
  test('only admin / superadmin can see it', async () => {
    await seedUser({ email: 'u@x.co' });
    assert.equal((await anon().get('/api/rights')).status, 401);
    assert.equal((await (await as('u@x.co')).get('/api/rights')).status, 403);
  });
  test('inactive or deleted rights and modules are not offered', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    await db.query(`UPDATE rights SET status='Inactive' WHERE right_code='CUSTOMER_DELETE'`);
    await db.query(`UPDATE module SET deleted_at=now() WHERE module_code='REPORTS'`);
    const ad = await as('ad@x.co');
    const modules = (await ad.get('/api/rights')).body.modules;
    assert.equal(modules.length, 4);
    assert.equal(modules[0].total, 2);
    const id = await seedUser({ email: 'u@x.co' });
    assert.equal((await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_DELETE'] })).status, 400);
    assert.equal((await ad.put(`/api/users/${id}/rights`, { rights: ['REPORT_TOP_SALES'] })).status, 400);
  });
});

describe('S1-DEV-07 assign rights', () => {
  test('pick single rights; module checkbox shows some / all; the dialog reads back what was saved', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    const r = await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'SALE_ADD'] });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.changes, { granted: ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'SALE_ADD'], revoked: [] });
    const state = Object.fromEntries(r.body.modules.map((m) => [m.code, m.state]));
    assert.deepEqual(state, { CUSTOMER: 'some', PRODUCT: 'none', HUMAN_RESOURCES: 'none', SALES: 'some', REPORTS: 'none' });
    assert.deepEqual(await heldBy(id), ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'SALE_ADD']); // alphabetical in this helper
    const again = await ad.get(`/api/users/${id}/rights`);
    assert.equal(again.body.modules[0].rights.find((x) => x.code === 'CUSTOMER_ADD').granted, true);
    assert.equal(again.body.modules[0].rights.find((x) => x.code === 'CUSTOMER_DELETE').granted, false);
  });
  test('module checkbox (all rights of one module), All, and None', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    const modules = (await ad.get('/api/rights')).body.modules;
    const reports = modules.find((m) => m.code === 'REPORTS').rights.map((x) => x.code);

    let r = await ad.put(`/api/users/${id}/rights`, { rights: reports });
    assert.equal(r.body.modules.find((m) => m.code === 'REPORTS').state, 'all');
    assert.equal(r.body.changes.granted.length, 7);

    r = await ad.put(`/api/users/${id}/rights`, { rights: await allCodes() }); // "All"
    assert.ok(r.body.modules.every((m) => m.state === 'all'));
    assert.equal(r.body.changes.granted.length, 29, 'only the ones not held yet are added');
    assert.equal((await heldBy(id)).length, 36);

    r = await ad.put(`/api/users/${id}/rights`, { rights: [] }); // "None"
    assert.ok(r.body.modules.every((m) => m.state === 'none'));
    assert.equal(r.body.changes.revoked.length, 36);
    assert.deepEqual(await heldBy(id), []);
  });
  test('duplicates in the list are harmless; saving the same set again changes nothing', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD', 'CUSTOMER_ADD'] });
    const before = (await auditRows()).length;
    const r = await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD'] });
    assert.deepEqual(r.body.changes, { granted: [], revoked: [] });
    assert.equal((await auditRows()).length, before, 'no audit noise for a no-op save');
  });
  test('a pending user can be given rights before they set a password', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'new@x.co', password: null });
    assert.equal((await (await as('ad@x.co')).put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD'] })).status, 200);
  });
});

describe('S1-DEV-07 every change is logged in audit_log', () => {
  test('ADD, DELETE and RESTORE rows with who did it and the before / after', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD', 'CUSTOMER_EDIT'] });
    await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD'] });                  // takes EDIT away
    await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD', 'CUSTOMER_EDIT'] }); // gives it back
    const rows = await auditRows();
    assert.deepEqual(rows.map((r) => [r.action, r.record_key]), [
      ['ADD', `${id}:CUSTOMER_ADD`], ['ADD', `${id}:CUSTOMER_EDIT`],
      ['DELETE', `${id}:CUSTOMER_EDIT`], ['RESTORE', `${id}:CUSTOMER_EDIT`],
    ]);
    assert.ok(rows.every((r) => r.action_by === 'ad@x.co'));
    assert.deepEqual(rows[2].old_values, { right: 'CUSTOMER_EDIT', granted: true });
    assert.deepEqual(rows[2].new_values, { right: 'CUSTOMER_EDIT', granted: false });
    // taken away = soft delete, the row is still there
    const { rows: perm } = await db.query(`SELECT status, deleted_at FROM user_permission WHERE user_id=$1`, [id]);
    assert.equal(perm.length, 2);
  });
  test('taking a right away keeps the row (Inactive + deleted_at) until it is given back', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    await ad.put(`/api/users/${id}/rights`, { rights: ['SALE_ADD'] });
    await ad.put(`/api/users/${id}/rights`, { rights: [] });
    let { rows } = await db.query(`SELECT status, deleted_at FROM user_permission WHERE user_id=$1`, [id]);
    assert.equal(rows[0].status, 'Inactive'); assert.ok(rows[0].deleted_at);
    await ad.put(`/api/users/${id}/rights`, { rights: ['SALE_ADD'] });
    ({ rows } = await db.query(`SELECT status, deleted_at FROM user_permission WHERE user_id=$1`, [id]));
    assert.equal(rows[0].status, 'Active'); assert.equal(rows[0].deleted_at, null);
  });
  test('a rejected save changes nothing and logs nothing (all or nothing)', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_ADD'] });
    const before = (await auditRows()).length;
    const bad = await ad.put(`/api/users/${id}/rights`, { rights: ['CUSTOMER_EDIT', 'NOT_A_RIGHT'] });
    assert.equal(bad.status, 400);
    assert.deepEqual(await heldBy(id), ['CUSTOMER_ADD']);
    assert.equal((await auditRows()).length, before);
  });
  test('bad input: not a list, wrong types, too many, no body', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const id = await seedUser({ email: 'u@x.co' });
    const ad = await as('ad@x.co');
    for (const rights of ['CUSTOMER_ADD', { a: 1 }, [1, 2], [null], Array(201).fill('CUSTOMER_ADD'), undefined]) {
      assert.equal((await ad.put(`/api/users/${id}/rights`, { rights })).status, 400, JSON.stringify(rights)?.slice(0, 30));
    }
    assert.equal((await ad.put(`/api/users/${id}/rights`)).status, 400);
    assert.equal((await ad.put(`/api/users/abc/rights`, { rights: [] })).status, 404);
    assert.equal((await ad.put(`/api/users/99999/rights`, { rights: [] })).status, 404);
    assert.equal((await auditRows()).length, 0);
  });
});

describe('S1-DEV-07 who may assign rights to whom', () => {
  test('plain users and visitors cannot', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await seedUser({ email: 'u2@x.co' });
    assert.equal((await anon().put(`/api/users/${id}/rights`, { rights: [] })).status, 401);
    assert.equal((await (await as('u2@x.co')).put(`/api/users/${id}/rights`, { rights: [] })).status, 403);
    assert.equal((await (await as('u2@x.co')).get(`/api/users/${id}/rights`)).status, 403);
  });
  test('an admin can only do it for plain users; superadmins are invisible to them', async () => {
    const sa = await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const other = await seedUser({ email: 'ad2@x.co', role: 'admin' });
    const me = await seedUser({ email: 'ad@x.co', role: 'admin' });
    const ad = await as('ad@x.co');
    assert.equal((await ad.put(`/api/users/${other}/rights`, { rights: ['SALE_ADD'] })).status, 403);
    assert.equal((await ad.put(`/api/users/${me}/rights`, { rights: ['SALE_ADD'] })).status, 403, 'not their own either');
    assert.equal((await ad.put(`/api/users/${sa}/rights`, { rights: ['SALE_ADD'] })).status, 404);
    assert.equal((await ad.get(`/api/users/${sa}/rights`)).status, 404);
    assert.equal((await auditRows()).length, 0);
  });
  test('a superadmin can do it for users and admins, but not for a superadmin (they have every right)', async () => {
    const sa = await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    await seedUser({ email: 'sa2@x.co', role: 'superadmin' });
    const admin = await seedUser({ email: 'ad@x.co', role: 'admin' });
    const boss = await as('sa@x.co');
    assert.equal((await boss.put(`/api/users/${admin}/rights`, { rights: ['REPORT_TOP_SALES'] })).status, 200);
    const r = await boss.put(`/api/users/${sa}/rights`, { rights: ['SALE_ADD'] });
    assert.equal(r.status, 400);
    assert.equal((await boss.get(`/api/users/${sa}/rights`)).status, 400);
    assert.equal((await boss.put(`/api/users/${await seedUser({ email: 'sa3@x.co', role: 'superadmin' })}/rights`, { rights: [] })).status, 400);
  });
  test('rights follow the user: the log shows the superadmin, not the admin', async () => {
    const id = await seedUser({ email: 'u@x.co' });
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    await (await as('sa@x.co')).put(`/api/users/${id}/rights`, { rights: ['PRICE_ADD'] });
    assert.equal((await auditRows())[0].action_by, 'sa@x.co');
  });
});

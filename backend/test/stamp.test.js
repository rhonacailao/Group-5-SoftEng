import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, loadAuditTriggers, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => { ctx?.server.close(); delete process.env.BUSINESS_TIMEZONE; });
beforeEach(async () => {
  delete process.env.BUSINESS_TIMEZONE;
  await resetDb();
  await loadBusinessTables();
  await loadAuditTriggers();
});

const as = async (email) => { const c = client(ctx.base); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
const give = async (id, ...codes) => {
  for (const code of codes) await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code=$2`, [id, code]);
};
const ALL = ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE', 'PRODUCT_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRICE_ADD', 'PRICE_EDIT', 'PRICE_DELETE'];
// A superadmin with a real name, so the stamp can show "Ana Cruz" instead of an email
const staff = async (email, role, first = 'Ana', last = 'Cruz') => {
  const id = await seedUser({ email, role, first, last });
  await give(id, ...ALL);
  return as(email);
};
const plainUser = async (email = 'plain@x.co') => {
  const id = await seedUser({ email, role: 'user' });
  await give(id, ...ALL);
  return as(email);
};
const NEW_STAMP = /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2} (AM|PM)$/;

describe('Stamp on products', () => {
  test('a user does NOT get a stamp anywhere (list, one product, price history)', async () => {
    const c = await plainUser();
    const list = await c.get('/api/products?pageSize=3');
    assert.ok(list.body.products.every((p) => !('stamp' in p)));
    assert.ok(!('stamp' in (await c.get('/api/products/AK0001')).body.product));
    const hist = await c.get('/api/products/AK0001/prices');
    assert.ok(hist.body.prices.every((p) => !('stamp' in p)));
  });

  test('an admin and a superadmin get a stamp on every listed product', async () => {
    for (const role of ['admin', 'superadmin']) {
      const c = await staff(`${role}@x.co`, role);
      const list = await c.get('/api/products?pageSize=5');
      assert.equal(list.status, 200);
      for (const p of list.body.products) {
        assert.deepEqual(Object.keys(p.stamp), ['action', 'user', 'date'], p.prodCode);
      }
    }
  });

  test('sample data that was never touched shows CREATED by "system" and NO invented date', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    // sample rows were loaded before the audit triggers existed, so they have no log line
    const p = (await c.get('/api/products/AK0001')).body.product;
    assert.deepEqual(p.stamp, { action: 'CREATED', user: 'system', date: null });
  });

  test('adding a product stamps it CREATED with the person\'s full name and a readable date', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    assert.equal((await c.post('/api/products', { prodCode: 'ZZ0001', description: 'Stamp Test', unit: 'ea' })).status, 201);
    const p = (await c.get('/api/products/ZZ0001')).body.product;
    assert.equal(p.stamp.action, 'CREATED');
    assert.equal(p.stamp.user, 'Ana Cruz');
    assert.match(p.stamp.date, NEW_STAMP);
  });

  test('edit, delete and restore move the stamp: EDITED -> DELETED -> RESTORED', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await c.post('/api/products', { prodCode: 'ZZ0001', description: 'Stamp Test', unit: 'ea' });
    const stampNow = async () => (await c.get('/api/products/ZZ0001')).body.product.stamp.action;
    assert.equal(await stampNow(), 'CREATED');
    assert.equal((await c.patch('/api/products/ZZ0001', { description: 'Changed It' })).status, 200);
    assert.equal(await stampNow(), 'EDITED');
    assert.equal((await c.delete('/api/products/ZZ0001')).status, 200);
    assert.equal(await stampNow(), 'DELETED');
    assert.equal((await c.patch('/api/products/ZZ0001/restore')).status, 200);
    assert.equal(await stampNow(), 'RESTORED');
  });

  test('the stamp names whoever did the LAST change, not the first', async () => {
    const ana = await staff('ana@x.co', 'superadmin', 'Ana', 'Cruz');
    const ben = await staff('ben@x.co', 'admin', 'Ben', 'Reyes');
    await ana.post('/api/products', { prodCode: 'ZZ0001', description: 'Stamp Test', unit: 'ea' });
    await ben.patch('/api/products/ZZ0001', { description: 'By Ben' });
    const p = (await ana.get('/api/products/ZZ0001')).body.product;
    assert.deepEqual([p.stamp.action, p.stamp.user], ['EDITED', 'Ben Reyes']);
  });

  test('a change that saved nothing (same values) leaves the stamp alone', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await c.post('/api/products', { prodCode: 'ZZ0001', description: 'Stamp Test', unit: 'ea' });
    await c.patch('/api/products/ZZ0001', { description: 'Stamp Test' });
    assert.equal((await c.get('/api/products/ZZ0001')).body.product.stamp.action, 'CREATED');
  });

  test('the list gives each product its OWN stamp (not one shared stamp)', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await c.post('/api/products', { prodCode: 'ZZ0001', description: 'One', unit: 'ea' });
    await c.post('/api/products', { prodCode: 'ZZ0002', description: 'Two', unit: 'ea' });
    await c.patch('/api/products/ZZ0002', { description: 'Two Changed' });
    const rows = (await c.get('/api/products?search=ZZ000&pageSize=10')).body.products;
    const by = Object.fromEntries(rows.map((p) => [p.prodCode, p.stamp.action]));
    assert.deepEqual(by, { ZZ0001: 'CREATED', ZZ0002: 'EDITED' });
  });

  test('an email with no matching user is shown as it is; the database account shows as "system"', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await db.query(`INSERT INTO audit_log (table_name, action, record_key, action_by) VALUES ('product','EDIT','AK0001','ghost@old.co'), ('product','EDIT','AK0002','postgres')`);
    assert.equal((await c.get('/api/products/AK0001')).body.product.stamp.user, 'ghost@old.co');
    assert.equal((await c.get('/api/products/AK0002')).body.product.stamp.user, 'system');
  });

  test('the date follows the company time zone (BUSINESS_TIMEZONE)', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await db.query(`INSERT INTO audit_log (table_name, action, record_key, action_by, action_at)
                    VALUES ('product','EDIT','AK0001','x@x.co','2026-10-30 04:37:00+00')`);
    assert.equal((await c.get('/api/products/AK0001')).body.product.stamp.date, '2026-10-30 12:37 PM'); // Manila = UTC+8
    process.env.BUSINESS_TIMEZONE = 'UTC';
    assert.equal((await c.get('/api/products/AK0001')).body.product.stamp.date, '2026-10-30 4:37 AM');
  });

  test('a log line of another table with the same key does not leak in', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await db.query(`INSERT INTO audit_log (table_name, action, record_key, action_by) VALUES ('customer','DELETE','AK0001','other@x.co')`);
    assert.deepEqual((await c.get('/api/products/AK0001')).body.product.stamp, { action: 'CREATED', user: 'system', date: null });
  });

  test('an empty page (no matches) works with stamps on', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    const r = await c.get('/api/products?search=NOSUCHPRODUCT');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.products, []);
  });
});

describe('Stamp on customers', () => {
  test('user: none. admin: yes. Full cycle CREATED -> EDITED -> DELETED -> RESTORED', async () => {
    const u = await plainUser();
    assert.ok(!('stamp' in (await u.get('/api/customers/C0020')).body.customer));
    const c = await staff('sa@x.co', 'superadmin');
    const created = await c.post('/api/customers', { custName: 'Stamp Co', address: 'Angeles City', payTerm: 'COD' });
    assert.equal(created.status, 201);
    const no = created.body.customer.custNo;
    const now = async () => (await c.get(`/api/customers/${no}`)).body.customer.stamp;
    assert.deepEqual([(await now()).action, (await now()).user], ['CREATED', 'Ana Cruz']);
    await c.patch(`/api/customers/${no}`, { address: 'Mabalacat City' });
    assert.equal((await now()).action, 'EDITED');
    await c.delete(`/api/customers/${no}`);
    assert.equal((await now()).action, 'DELETED');
    await c.patch(`/api/customers/${no}/restore`);
    assert.equal((await now()).action, 'RESTORED');
    const list = (await c.get(`/api/customers?search=${no}`)).body.customers;
    assert.equal(list[0].stamp.action, 'RESTORED');
    assert.match(list[0].stamp.date, NEW_STAMP);
  });
});

describe('Stamp on price history', () => {
  test('each price has its own stamp; a user sees none', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await c.post('/api/products', { prodCode: 'ZZ0001', description: 'Stamp Test', unit: 'ea' });
    await c.post('/api/products/ZZ0001/prices', { effectiveDate: '2026-12-01', unitPrice: 10 });
    await c.post('/api/products/ZZ0001/prices', { effectiveDate: '2027-01-01', unitPrice: 12 });
    await c.patch('/api/products/ZZ0001/prices/2027-01-01', { unitPrice: 13 });
    const prices = (await c.get('/api/products/ZZ0001/prices')).body.prices;
    assert.deepEqual(prices.map((p) => [p.effectiveDate, p.stamp.action, p.stamp.user]), [
      ['2027-01-01', 'EDITED', 'Ana Cruz'],
      ['2026-12-01', 'CREATED', 'Ana Cruz'],
    ]);
    const u = await plainUser();
    assert.ok((await u.get('/api/products/ZZ0001/prices')).body.prices.every((p) => !('stamp' in p)));
  });

  test('moving a price to another date keeps its stamp (EDITED) under the new date', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    await c.post('/api/products', { prodCode: 'ZZ0001', description: 'Stamp Test', unit: 'ea' });
    await c.post('/api/products/ZZ0001/prices', { effectiveDate: '2026-12-01', unitPrice: 10 });
    await c.patch('/api/products/ZZ0001/prices/2026-12-01', { effectiveDate: '2026-12-15' });
    const [p] = (await c.get('/api/products/ZZ0001/prices')).body.prices;
    assert.equal(p.effectiveDate, '2026-12-15');
    assert.equal(p.stamp.action, 'EDITED');
  });

  test('the current price and the rest of the answer are unchanged by stamps', async () => {
    const c = await staff('sa@x.co', 'superadmin');
    const r = (await c.get('/api/products/PC0001/prices')).body;
    assert.deepEqual(r.currentPrice, { unitPrice: 454.54, effectiveDate: '2010-07-12' });
    assert.equal(r.total, r.prices.length);
  });
});

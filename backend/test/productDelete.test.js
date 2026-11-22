import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, loadAuditTriggers, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => { ctx?.server.close(); });
beforeEach(async () => {
  await resetDb();
  await loadBusinessTables();
  await loadAuditTriggers(); // so we also see that our own DELETE / RESTORE rows sit next to the trigger's
});

const anon = () => client(ctx.base);
const as = async (email) => { const c = anon(); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
const give = async (id, ...codes) => {
  for (const code of codes) {
    await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code=$2`, [id, code]);
  }
};
const userWith = async (email, ...codes) => {
  const id = await seedUser({ email, role: 'user' });
  await give(id, ...codes);
  return { id, c: await as(email) };
};
const row = async (code) => (await db.query('SELECT prodcode, description, unit, deleted_at FROM product WHERE prodcode = $1', [code])).rows[0];
const ours = async (code) =>
  (await db.query(
    `SELECT action, action_by, old_values, new_values FROM audit_log
      WHERE table_name = 'product' AND record_key = $1 AND action IN ('DELETE', 'RESTORE') ORDER BY audit_id`,
    [code],
  )).rows;

// The sample products all have price history, so the product we are free to delete is one that
// was just added (no sale lines, no prices yet), like a product added through S2-DEV-05.
const FREE = 'ZZ0001';
const addFree = () => db.query(`INSERT INTO product (prodcode, description, unit) VALUES ($1, 'Fresh Product', 'ea')`, [FREE]);
// A product with sale lines AND price history, and one with prices only
const busyProduct = async () => (await db.query(`SELECT prodcode FROM salesdetail ORDER BY transno, prodcode LIMIT 1`)).rows[0]?.prodcode;
const pricesOnlyProduct = async () => (await db.query(
  `SELECT p.prodcode FROM product p WHERE NOT EXISTS (SELECT 1 FROM salesdetail s WHERE s.prodcode = p.prodcode) ORDER BY p.prodcode LIMIT 1`,
)).rows[0]?.prodcode;
const n = async (sql, params) => Number((await db.query(sql, params)).rows[0].n);

describe('S2-DEV-06 soft delete and restore: permission check', () => {
  beforeEach(addFree);

  test('both routes need a login (401)', async () => {
    assert.equal((await anon().delete(`/api/products/${FREE}`)).status, 401);
    assert.equal((await anon().patch(`/api/products/${FREE}/restore`)).status, 401);
    assert.equal((await row(FREE)).deleted_at, null);
  });

  test('a user with no rights is refused (403) and nothing changes', async () => {
    await seedUser({ email: 'u@x.co', role: 'user' });
    const r = await (await as('u@x.co')).delete(`/api/products/${FREE}`);
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'FORBIDDEN');
    assert.equal((await row(FREE)).deleted_at, null);
  });

  for (const code of ['PRODUCT_ADD', 'PRODUCT_EDIT', 'PRICE_ADD', 'PRICE_EDIT', 'PRICE_DELETE']) {
    test(`${code} alone is not enough to delete or restore (403)`, async () => {
      const { c } = await userWith(`${code.toLowerCase()}@x.co`, code);
      assert.equal((await c.delete(`/api/products/${FREE}`)).status, 403);
      await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = $1`, [FREE]);
      assert.equal((await c.patch(`/api/products/${FREE}/restore`)).status, 403);
      assert.notEqual((await row(FREE)).deleted_at, null);
    });
  }

  test('a right from another module is not enough (403)', async () => {
    const { c } = await userWith('o@x.co', 'CUSTOMER_DELETE', 'SALE_DELETE');
    assert.equal((await c.delete(`/api/products/${FREE}`)).status, 403);
  });

  test('being an admin gives no product rights (403)', async () => {
    await seedUser({ email: 'a@x.co', role: 'admin' });
    assert.equal((await (await as('a@x.co')).delete(`/api/products/${FREE}`)).status, 403);
  });

  test('the Delete right can delete and restore', async () => {
    const { c } = await userWith('d@x.co', 'PRODUCT_DELETE');
    assert.equal((await c.delete(`/api/products/${FREE}`)).status, 200);
    assert.equal((await c.patch(`/api/products/${FREE}/restore`)).status, 200);
  });

  test('the superadmin can always delete and restore', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const c = await as('sa@x.co');
    assert.equal((await c.delete(`/api/products/${FREE}`)).status, 200);
    assert.equal((await c.patch(`/api/products/${FREE}/restore`)).status, 200);
  });

  test('taking the right away stops it on the very next request', async () => {
    const { id, c } = await userWith('t@x.co', 'PRODUCT_DELETE');
    await db.query('DELETE FROM user_permission WHERE user_id = $1', [id]);
    assert.equal((await c.delete(`/api/products/${FREE}`)).status, 403);
    assert.equal((await row(FREE)).deleted_at, null);
  });
});

describe('S2-DEV-06 soft delete', () => {
  let c;
  beforeEach(async () => { await addFree(); c = (await userWith('d@x.co', 'PRODUCT_DELETE')).c; });

  test('marks the product Inactive and keeps the row (nothing is really removed)', async () => {
    const total = await n('SELECT count(*) AS n FROM product');
    const was = await row(FREE);
    const r = await c.delete(`/api/products/${FREE}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.product, { prodCode: FREE, description: 'Fresh Product', unit: 'ea', status: 'Inactive' });
    const now = await row(FREE);
    assert.notEqual(now.deleted_at, null);
    assert.equal(now.description, was.description);
    assert.equal(now.unit, was.unit);
    assert.equal(await n('SELECT count(*) AS n FROM product'), total);
  });

  test('the product leaves the Active list and shows under Inactive; the tab counts follow', async () => {
    const before = (await c.get('/api/products')).body.counts;
    await c.delete(`/api/products/${FREE}`);
    assert.equal((await c.get(`/api/products?search=${FREE}`)).body.total, 0);
    const inactive = (await c.get('/api/products?status=inactive')).body;
    assert.deepEqual(inactive.products.map((p) => p.prodCode), [FREE]);
    assert.deepEqual((await c.get('/api/products')).body.counts, { active: before.active - 1, inactive: before.inactive + 1, all: before.all });
  });

  test('the code is lower or upper case, and spaces around it do not matter', async () => {
    assert.equal((await c.delete(`/api/products/${FREE.toLowerCase()}`)).status, 200);
    await db.query(`UPDATE product SET deleted_at = NULL WHERE prodcode = $1`, [FREE]);
    assert.equal((await c.delete(`/api/products/%20${FREE}%20`)).status, 200);
  });

  test('deleting an already deleted product is a 409', async () => {
    await c.delete(`/api/products/${FREE}`);
    const r = await c.delete(`/api/products/${FREE}`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'ALREADY_DELETED');
  });

  test('a product that does not exist, or a badly shaped code, is a 404', async () => {
    for (const bad of ['ZZ9999', 'nope', 'A1']) {
      assert.equal((await c.delete(`/api/products/${bad}`)).status, 404, bad);
    }
  });

  test('a product with sale lines and price history cannot be deleted (409), and nothing changes', async () => {
    const busy = await busyProduct();
    assert.ok(busy, 'sample data should have sale lines');
    const lines = await n('SELECT count(*) AS n FROM salesdetail WHERE prodcode = $1', [busy]);
    const prices = await n('SELECT count(*) AS n FROM pricehist WHERE prodcode = $1', [busy]);
    const r = await c.delete(`/api/products/${busy}`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'HAS_ACTIVE_CHILDREN');
    assert.match(r.body.message, new RegExp(`${busy} cannot be deleted`));
    assert.match(r.body.message, new RegExp(`${lines} sale line`));
    assert.match(r.body.message, new RegExp(`${prices} price record`));
    assert.equal((await row(busy)).deleted_at, null);
    assert.deepEqual(await ours(busy), []); // a refused delete is not logged as a delete
  });

  test('price history alone also blocks the delete', async () => {
    const code = await pricesOnlyProduct();
    assert.ok(code, 'sample data should have a product with prices but no sale lines');
    const r = await c.delete(`/api/products/${code}`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'HAS_ACTIVE_CHILDREN');
    assert.match(r.body.message, /price record/);
    assert.doesNotMatch(r.body.message, /sale line/);
    assert.equal((await row(code)).deleted_at, null);
  });

  test('sale lines alone also block the delete', async () => {
    const busy = await busyProduct();
    await db.exec(`DELETE FROM pricehist WHERE prodcode = '${busy}'`);
    const r = await c.delete(`/api/products/${busy}`);
    assert.equal(r.status, 409);
    assert.match(r.body.message, /sale line/);
    assert.doesNotMatch(r.body.message, /price record/);
  });

  test('once the product has no sale lines or prices left, the delete goes through', async () => {
    const busy = await busyProduct();
    assert.equal((await c.delete(`/api/products/${busy}`)).status, 409);
    await db.exec(`DELETE FROM salesdetail WHERE prodcode = '${busy}'; DELETE FROM pricehist WHERE prodcode = '${busy}';`);
    assert.equal((await c.delete(`/api/products/${busy}`)).status, 200);
    assert.notEqual((await row(busy)).deleted_at, null);
  });

  test('a deleted product cannot be edited until it is restored', async () => {
    await c.delete(`/api/products/${FREE}`);
    const editor = (await userWith('e@x.co', 'PRODUCT_EDIT')).c;
    const r = await editor.patch(`/api/products/${FREE}`, { description: 'Changed' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRODUCT_INACTIVE');
  });

  test('a deleted product keeps its code, so adding the same code again is refused', async () => {
    await c.delete(`/api/products/${FREE}`);
    const adder = (await userWith('a@x.co', 'PRODUCT_ADD')).c;
    assert.equal((await adder.post('/api/products', { prodCode: FREE, description: 'Again', unit: 'pc' })).status, 409);
  });
});

describe('S2-DEV-06 restore', () => {
  let c;
  beforeEach(async () => {
    await addFree();
    c = (await userWith('d@x.co', 'PRODUCT_DELETE')).c;
    await c.delete(`/api/products/${FREE}`);
  });

  test('puts the product back in the Active list, with every field as it was', async () => {
    const deleted = await row(FREE);
    const r = await c.patch(`/api/products/${FREE}/restore`);
    assert.equal(r.status, 200);
    assert.equal(r.body.product.status, 'Active');
    const after = await row(FREE);
    assert.equal(after.deleted_at, null);
    assert.equal(after.description, deleted.description);
    assert.equal(after.unit, deleted.unit);
    const found = (await c.get(`/api/products?search=${FREE}`)).body;
    assert.equal(found.total, 1);
    assert.equal(found.products[0].status, 'Active');
    assert.equal((await c.get('/api/products?status=inactive')).body.total, 0);
  });

  test('restoring a product that is not deleted is a 409', async () => {
    await c.patch(`/api/products/${FREE}/restore`);
    const r = await c.patch(`/api/products/${FREE}/restore`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'NOT_DELETED');
  });

  test('a product that does not exist, or a badly shaped code, is a 404', async () => {
    for (const bad of ['ZZ9999', 'nope']) {
      assert.equal((await c.patch(`/api/products/${bad}/restore`)).status, 404, bad);
    }
  });

  test('a restored product can be edited and deleted again', async () => {
    await c.patch(`/api/products/${FREE}/restore`);
    const editor = (await userWith('e@x.co', 'PRODUCT_EDIT')).c;
    assert.equal((await editor.patch(`/api/products/${FREE}`, { description: 'Back Again' })).status, 200);
    assert.equal((await c.delete(`/api/products/${FREE}`)).status, 200);
  });
});

describe('S2-DEV-06 audit log', () => {
  beforeEach(addFree);

  test('a delete and a restore are each logged with who did it and the status before and after', async () => {
    const { c } = await userWith('d@x.co', 'PRODUCT_DELETE');
    await c.delete(`/api/products/${FREE}`);
    await c.patch(`/api/products/${FREE}/restore`);
    assert.deepEqual(await ours(FREE), [
      { action: 'DELETE', action_by: 'd@x.co', old_values: { status: 'Active' }, new_values: { status: 'Inactive' } },
      { action: 'RESTORE', action_by: 'd@x.co', old_values: { status: 'Inactive' }, new_values: { status: 'Active' } },
    ]);
  });

  test('the database audit trigger also saw the change, under the same user', async () => {
    const { c } = await userWith('d@x.co', 'PRODUCT_DELETE');
    await c.delete(`/api/products/${FREE}`);
    const { rows } = await db.query(`SELECT action_by FROM audit_log WHERE table_name = 'product' AND record_key = $1 AND action = 'EDIT'`, [FREE]);
    assert.deepEqual(rows, [{ action_by: 'd@x.co' }]);
  });

  test('a refused request (wrong state or children) writes nothing to the log', async () => {
    const { c } = await userWith('d@x.co', 'PRODUCT_DELETE');
    await c.patch(`/api/products/${FREE}/restore`); // 409: not deleted
    const busy = await busyProduct();
    await c.delete(`/api/products/${busy}`); // 409: has children
    assert.deepEqual(await ours(FREE), []);
    assert.deepEqual(await ours(busy), []);
  });
});

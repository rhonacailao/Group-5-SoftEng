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
const count = async () => Number((await db.query('SELECT count(*) AS n FROM customer')).rows[0].n);
const row = async (custNo) => (await db.query('SELECT custno, custname, address, payterm, deleted_at FROM customer WHERE custno = $1', [custNo])).rows[0];
const ours = async (custNo) =>
  (await db.query(
    `SELECT action, action_by, old_values, new_values FROM audit_log
      WHERE table_name = 'customer' AND record_key = $1 AND action IN ('DELETE', 'RESTORE') ORDER BY audit_id`,
    [custNo],
  )).rows;

// A customer nobody has sold to (free to delete) and one that has sales (protected)
const freeCustomer = async () => (await db.query(
  `SELECT c.custno FROM customer c WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.custno = c.custno) ORDER BY c.custno LIMIT 1`,
)).rows[0]?.custno;
const busyCustomer = async () => (await db.query(`SELECT custno FROM sales ORDER BY transno LIMIT 1`)).rows[0]?.custno;

describe('S2-DEV-03 soft delete and restore: permission check', () => {
  let target;
  beforeEach(async () => { target = await freeCustomer(); assert.ok(target, 'sample data should have a customer without sales'); });

  test('both routes need a login (401)', async () => {
    assert.equal((await anon().delete(`/api/customers/${target}`)).status, 401);
    assert.equal((await anon().patch(`/api/customers/${target}/restore`)).status, 401);
    assert.equal((await row(target)).deleted_at, null);
  });

  test('a user with no rights is refused (403) and nothing changes', async () => {
    await seedUser({ email: 'u@x.co', role: 'user' });
    const c = await as('u@x.co');
    const r = await c.delete(`/api/customers/${target}`);
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'FORBIDDEN');
    assert.equal((await row(target)).deleted_at, null);
  });

  for (const code of ['CUSTOMER_ADD', 'CUSTOMER_EDIT']) {
    test(`${code} alone is not enough to delete or restore (403)`, async () => {
      const { c } = await userWith(`${code.toLowerCase()}@x.co`, code);
      assert.equal((await c.delete(`/api/customers/${target}`)).status, 403);
      await db.query(`UPDATE customer SET deleted_at = now() WHERE custno = $1`, [target]);
      assert.equal((await c.patch(`/api/customers/${target}/restore`)).status, 403);
      assert.notEqual((await row(target)).deleted_at, null);
    });
  }

  test('a right from another module is not enough (403)', async () => {
    const { c } = await userWith('p@x.co', 'PRODUCT_DELETE', 'SALE_DELETE');
    assert.equal((await c.delete(`/api/customers/${target}`)).status, 403);
  });

  test('being an admin gives no customer rights (403)', async () => {
    await seedUser({ email: 'a@x.co', role: 'admin' });
    assert.equal((await (await as('a@x.co')).delete(`/api/customers/${target}`)).status, 403);
  });

  test('the Delete right can delete and restore', async () => {
    const { c } = await userWith('d@x.co', 'CUSTOMER_DELETE');
    assert.equal((await c.delete(`/api/customers/${target}`)).status, 200);
    assert.equal((await c.patch(`/api/customers/${target}/restore`)).status, 200);
  });

  test('the superadmin can always delete and restore', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const c = await as('sa@x.co');
    assert.equal((await c.delete(`/api/customers/${target}`)).status, 200);
    assert.equal((await c.patch(`/api/customers/${target}/restore`)).status, 200);
  });

  test('taking the right away stops it on the very next request', async () => {
    const { id, c } = await userWith('t@x.co', 'CUSTOMER_DELETE');
    await db.query('DELETE FROM user_permission WHERE user_id = $1', [id]);
    assert.equal((await c.delete(`/api/customers/${target}`)).status, 403);
    assert.equal((await row(target)).deleted_at, null);
  });
});

describe('S2-DEV-03 soft delete', () => {
  let c; let target;
  beforeEach(async () => {
    c = (await userWith('d@x.co', 'CUSTOMER_DELETE')).c;
    target = await freeCustomer();
  });

  test('marks the customer Inactive and keeps the row (nothing is really removed)', async () => {
    const before = await count();
    const original = await row(target);
    const r = await c.delete(`/api/customers/${target}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.customer.custNo, target);
    assert.equal(r.body.customer.status, 'Inactive');
    assert.equal(await count(), before);
    const after = await row(target);
    assert.notEqual(after.deleted_at, null);
    assert.equal(after.custname, original.custname);
    assert.equal(after.address, original.address);
    assert.equal(after.payterm, original.payterm);
  });

  test('the customer leaves the Active list and shows under Inactive; the tab counts follow', async () => {
    const before = (await c.get('/api/customers?pageSize=100')).body;
    await c.delete(`/api/customers/${target}`);
    const active = (await c.get('/api/customers?pageSize=100')).body;
    assert.equal(active.total, before.total - 1);
    assert.ok(!active.customers.some((x) => x.custNo === target));
    const inactive = (await c.get('/api/customers?status=inactive')).body;
    assert.deepEqual(inactive.customers.map((x) => x.custNo), [target]);
    assert.deepEqual(active.counts, { active: before.counts.active - 1, inactive: before.counts.inactive + 1, all: before.counts.all });
  });

  test('the number is lower or upper case, and spaces around it do not matter', async () => {
    const r = await c.delete(`/api/customers/${encodeURIComponent(` ${target.toLowerCase()} `)}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.customer.custNo, target);
  });

  test('deleting an already deleted customer is a 409', async () => {
    await c.delete(`/api/customers/${target}`);
    const r = await c.delete(`/api/customers/${target}`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'ALREADY_DELETED');
  });

  test('a customer that does not exist, or a badly shaped number, is a 404', async () => {
    for (const bad of ['C9999', 'abc', 'C12', "C0001'; DROP TABLE customer; --"]) {
      const r = await c.delete(`/api/customers/${encodeURIComponent(bad)}`);
      assert.equal(r.status, 404, bad);
    }
    assert.ok(await count() > 0); // the table is still there
  });

  test('a customer with sales cannot be deleted (409), and nothing changes', async () => {
    const busy = await busyCustomer();
    assert.ok(busy, 'sample data should have sales');
    const sales = Number((await db.query('SELECT count(*) AS n FROM sales WHERE custno = $1', [busy])).rows[0].n);
    const r = await c.delete(`/api/customers/${busy}`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'HAS_ACTIVE_CHILDREN');
    assert.match(r.body.message, new RegExp(`${busy} cannot be deleted`));
    assert.match(r.body.message, new RegExp(`${sales} active sale`));
    assert.equal((await row(busy)).deleted_at, null);
    assert.deepEqual(await ours(busy), []); // a refused delete is not logged as a delete
  });

  test('once the customer has no sales left, the delete goes through', async () => {
    const busy = await busyCustomer();
    assert.equal((await c.delete(`/api/customers/${busy}`)).status, 409);
    // Clear the customer's sales the way a future Sales screen will (children first)
    const trans = `SELECT transno FROM sales WHERE custno = '${busy}'`;
    await db.exec(`DELETE FROM payment WHERE transno IN (${trans}); DELETE FROM salesdetail WHERE transno IN (${trans}); DELETE FROM sales WHERE custno = '${busy}';`);
    assert.equal((await c.delete(`/api/customers/${busy}`)).status, 200);
    assert.notEqual((await row(busy)).deleted_at, null);
  });

  test('a deleted customer cannot be edited until it is restored', async () => {
    await c.delete(`/api/customers/${target}`);
    const editor = (await userWith('e@x.co', 'CUSTOMER_EDIT')).c;
    const r = await editor.patch(`/api/customers/${target}`, { custName: 'Changed Name' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'CUSTOMER_INACTIVE');
  });
});

describe('S2-DEV-03 restore', () => {
  let c; let target;
  beforeEach(async () => {
    c = (await userWith('d@x.co', 'CUSTOMER_DELETE')).c;
    target = await freeCustomer();
    await c.delete(`/api/customers/${target}`);
  });

  test('puts the customer back in the Active list, with every field as it was', async () => {
    const deleted = await row(target);
    const r = await c.patch(`/api/customers/${target}/restore`);
    assert.equal(r.status, 200);
    assert.equal(r.body.customer.status, 'Active');
    const after = await row(target);
    assert.equal(after.deleted_at, null);
    assert.equal(after.custname, deleted.custname);
    assert.equal(after.address, deleted.address);
    assert.equal(after.payterm, deleted.payterm);
    const found = (await c.get(`/api/customers?search=${target}`)).body;
    assert.equal(found.total, 1);
    assert.equal(found.customers[0].status, 'Active');
    assert.equal((await c.get('/api/customers?status=inactive')).body.total, 0);
  });

  test('restoring a customer that is not deleted is a 409', async () => {
    await c.patch(`/api/customers/${target}/restore`);
    const r = await c.patch(`/api/customers/${target}/restore`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'NOT_DELETED');
  });

  test('a customer that does not exist, or a badly shaped number, is a 404', async () => {
    for (const bad of ['C9999', 'abc']) {
      assert.equal((await c.patch(`/api/customers/${bad}/restore`)).status, 404, bad);
    }
  });

  test('a restored customer can be edited and deleted again', async () => {
    await c.patch(`/api/customers/${target}/restore`);
    const editor = (await userWith('e@x.co', 'CUSTOMER_EDIT')).c;
    assert.equal((await editor.patch(`/api/customers/${target}`, { custName: 'Back Again' })).status, 200);
    assert.equal((await c.delete(`/api/customers/${target}`)).status, 200);
  });
});

describe('S2-DEV-03 audit log', () => {
  test('a delete and a restore are each logged with who did it and the status before and after', async () => {
    const { c } = await userWith('d@x.co', 'CUSTOMER_DELETE');
    const target = await freeCustomer();
    await c.delete(`/api/customers/${target}`);
    await c.patch(`/api/customers/${target}/restore`);
    assert.deepEqual(await ours(target), [
      { action: 'DELETE', action_by: 'd@x.co', old_values: { status: 'Active' }, new_values: { status: 'Inactive' } },
      { action: 'RESTORE', action_by: 'd@x.co', old_values: { status: 'Inactive' }, new_values: { status: 'Active' } },
    ]);
  });

  test('the database audit trigger also saw the change, under the same user', async () => {
    const { c } = await userWith('d@x.co', 'CUSTOMER_DELETE');
    const target = await freeCustomer();
    await c.delete(`/api/customers/${target}`);
    const { rows } = await db.query(`SELECT action_by FROM audit_log WHERE table_name = 'customer' AND record_key = $1 AND action = 'EDIT'`, [target]);
    assert.deepEqual(rows, [{ action_by: 'd@x.co' }]);
  });

  test('a refused request (wrong state) writes nothing to the log', async () => {
    const { c } = await userWith('d@x.co', 'CUSTOMER_DELETE');
    const target = await freeCustomer();
    await c.patch(`/api/customers/${target}/restore`); // 409: not deleted
    assert.deepEqual(await ours(target), []);
  });
});

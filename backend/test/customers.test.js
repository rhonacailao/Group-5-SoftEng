import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => { ctx?.server.close(); });
beforeEach(async () => {
  await resetDb();
  await loadBusinessTables(); // the real customer table and its sample rows
});

const anon = () => client(ctx.base);
const as = async (email) => { const c = anon(); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
const give = async (id, ...codes) => {
  for (const code of codes) {
    await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code=$2`, [id, code]);
  }
};
const count = async (where = 'true', params = []) =>
  Number((await db.query(`SELECT count(*) AS n FROM customer WHERE ${where}`, params)).rows[0].n);

// A plain user who has been given the right(s) and is logged in
const userWith = async (email, ...codes) => {
  const id = await seedUser({ email, role: 'user' });
  await give(id, ...codes);
  return { id, c: await as(email) };
};

describe('S2-DEV-01 customer list: permission check', () => {
  test('needs a login', async () => {
    assert.equal((await anon().get('/api/customers')).status, 401);
  });

  test('a user with no rights is refused (403)', async () => {
    await seedUser({ email: 'u@x.co', role: 'user' });
    const r = await (await as('u@x.co')).get('/api/customers');
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'FORBIDDEN');
  });

  test('being an admin gives no customer rights (403)', async () => {
    await seedUser({ email: 'a@x.co', role: 'admin' });
    assert.equal((await (await as('a@x.co')).get('/api/customers')).status, 403);
  });

  test('a right from another module is not enough (403)', async () => {
    const { c } = await userWith('p@x.co', 'PRODUCT_ADD', 'SALE_ADD');
    assert.equal((await c.get('/api/customers')).status, 403);
  });

  for (const code of ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE']) {
    test(`any one customer right opens the list (${code})`, async () => {
      const { c } = await userWith(`${code.toLowerCase()}@x.co`, code);
      const r = await c.get('/api/customers');
      assert.equal(r.status, 200);
      assert.equal(r.body.total, await count());
    });
  }

  test('the superadmin can always open it', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const r = await (await as('sa@x.co')).get('/api/customers');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, await count());
  });

  test('taking the right away stops access on the very next request', async () => {
    const { id, c } = await userWith('t@x.co', 'CUSTOMER_EDIT');
    assert.equal((await c.get('/api/customers')).status, 200);
    await db.query('DELETE FROM user_permission WHERE user_id = $1', [id]);
    assert.equal((await c.get('/api/customers')).status, 403);
  });

  test('a blocked user is refused even with the right', async () => {
    const { id, c } = await userWith('b@x.co', 'CUSTOMER_ADD');
    await db.query('UPDATE app_user SET is_blocked = TRUE WHERE user_id = $1', [id]);
    assert.notEqual((await c.get('/api/customers')).status, 200);
  });
});

describe('S2-DEV-01 customer list: the list itself', () => {
  let c;
  beforeEach(async () => { c = (await userWith('v@x.co', 'CUSTOMER_ADD')).c; });

  test('rows have exactly the five fields, sorted by customer number, 20 per page by default', async () => {
    const r = await c.get('/api/customers');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.page, 1);
    assert.equal(r.body.pageSize, 20);
    assert.equal(r.body.customers.length, Math.min(20, r.body.total));
    assert.deepEqual(Object.keys(r.body.customers[0]), ['custNo', 'custName', 'address', 'payTerm', 'status']);
    assert.deepEqual(r.body.customers[0], {
      custNo: 'C0001', custName: 'Globus Medical, Inc', address: '2560 Gen Armistead Ave Audubon CA 94031', payTerm: '30D', status: 'Active',
    });
    const numbers = r.body.customers.map((x) => x.custNo);
    assert.deepEqual(numbers, [...numbers].sort());
  });

  test('paging: page 2 continues where page 1 stopped, nothing repeats', async () => {
    const p1 = await c.get('/api/customers?pageSize=5&page=1');
    const p2 = await c.get('/api/customers?pageSize=5&page=2');
    assert.equal(p1.body.customers.length, 5);
    assert.equal(p2.body.customers.length, 5);
    assert.equal(p2.body.page, 2);
    const all = [...p1.body.customers, ...p2.body.customers].map((x) => x.custNo);
    assert.equal(new Set(all).size, 10);
    assert.ok(p2.body.customers[0].custNo > p1.body.customers[4].custNo);
  });

  test('a page past the end is empty but the total is still right', async () => {
    const r = await c.get('/api/customers?page=9999');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.customers, []);
    assert.equal(r.body.total, await count());
  });

  test('page and pageSize are kept inside safe limits; junk falls back to the defaults', async () => {
    assert.equal((await c.get('/api/customers?pageSize=100000')).body.pageSize, 100);
    assert.equal((await c.get('/api/customers?pageSize=0')).body.pageSize, 1);
    const junk = await c.get('/api/customers?page=abc&pageSize=xyz');
    assert.equal(junk.body.page, 1);
    assert.equal(junk.body.pageSize, 20);
    assert.equal((await c.get('/api/customers?page=-4')).body.page, 1);
  });

  test('search finds a name, ignoring upper/lower case', async () => {
    const r = await c.get('/api/customers?search=GLOBUS');
    assert.equal(r.body.total, 1);
    assert.equal(r.body.customers[0].custNo, 'C0001');
  });

  test('search finds a customer number and part of an address', async () => {
    assert.deepEqual((await c.get('/api/customers?search=c0002')).body.customers.map((x) => x.custNo), ['C0002']);
    const byAddress = await c.get('/api/customers?search=Miramar');
    assert.ok(byAddress.body.customers.some((x) => x.custNo === 'C0002'));
  });

  test('search matches the same rows the database says it should', async () => {
    const expected = await count(`custno ILIKE $1 OR custname ILIKE $1 OR address ILIKE $1`, ['%san diego%']);
    assert.ok(expected > 0);
    assert.equal((await c.get('/api/customers?search=san%20diego&pageSize=100')).body.total, expected);
  });

  test('extra spaces around the search words are ignored', async () => {
    assert.equal((await c.get('/api/customers?search=%20%20globus%20%20')).body.total, 1);
  });

  test('no match gives an empty list, not an error', async () => {
    const r = await c.get('/api/customers?search=zzzzqqq');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.customers, []);
    assert.equal(r.body.total, 0);
  });

  test('% and _ in the search are plain characters, not wildcards', async () => {
    assert.equal((await c.get('/api/customers?search=%25')).body.total, 0);
    assert.equal((await c.get('/api/customers?search=_')).body.total, 0);
  });

  test('SQL typed into the search box is just text and harms nothing', async () => {
    const before = await count();
    const r = await c.get(`/api/customers?search=${encodeURIComponent("'; DROP TABLE customer; --")}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 0);
    const r2 = await c.get(`/api/customers?search=${encodeURIComponent("' OR '1'='1")}`);
    assert.equal(r2.body.total, 0);
    assert.equal(await count(), before);
  });

  test('a search sent twice (a list) is ignored instead of crashing', async () => {
    const r = await c.get('/api/customers?search=x&search=y');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, await count());
  });

  test('filter by pay terms, upper or lower case', async () => {
    for (const term of ['COD', '30D', '45D']) {
      const r = await c.get(`/api/customers?payTerm=${term.toLowerCase()}&pageSize=100`);
      assert.equal(r.status, 200);
      assert.equal(r.body.total, await count('payterm = $1', [term]));
      assert.ok(r.body.total > 0, `sample data should have ${term} customers`);
      assert.ok(r.body.customers.every((x) => x.payTerm === term));
    }
  });

  test('an empty pay terms filter means "all"', async () => {
    assert.equal((await c.get('/api/customers?payTerm=')).body.total, await count());
  });

  test('a pay terms value the database does not allow is a 400 with a field message', async () => {
    for (const bad of ['60D', 'cash', "x'--"]) {
      const r = await c.get(`/api/customers?payTerm=${encodeURIComponent(bad)}`);
      assert.equal(r.status, 400, bad);
      assert.match(r.body.errors.payTerm, /COD, 30D, 45D/);
    }
    // the same key sent twice arrives as a list, which is not a valid pay term either
    assert.equal((await c.get('/api/customers?payTerm=COD&payTerm=30D')).status, 400);
  });

  test('search and pay terms work together', async () => {
    const expected = await count(`payterm = '30D' AND (custno ILIKE $1 OR custname ILIKE $1 OR address ILIKE $1)`, ['%inc%']);
    const r = await c.get('/api/customers?search=inc&payTerm=30D&pageSize=100');
    assert.equal(r.body.total, expected);
    assert.ok(r.body.customers.every((x) => x.payTerm === '30D'));
  });
});

describe('S2-DEV-01 customer list: Active / Inactive filter (Karla\'s deleted_at column)', () => {
  let c; let everyone; let deletedNo;
  beforeEach(async () => {
    c = (await userWith('s@x.co', 'CUSTOMER_DELETE')).c;
    everyone = await count();
    // Soft-delete two customers the way S2-DEV-03 will: deleted_at gets a date
    await db.query(`UPDATE customer SET deleted_at = now() WHERE custno IN ('C0004', 'C0007')`);
    deletedNo = ['C0004', 'C0007'];
  });

  test('the default list leaves deleted customers out', async () => {
    const r = await c.get('/api/customers?pageSize=100');
    assert.equal(r.body.total, everyone - 2);
    assert.ok(r.body.customers.every((x) => x.status === 'Active'));
    assert.ok(!r.body.customers.some((x) => deletedNo.includes(x.custNo)));
  });

  test('status=inactive shows only the deleted ones, marked Inactive', async () => {
    const r = await c.get('/api/customers?status=inactive');
    assert.deepEqual(r.body.customers.map((x) => x.custNo), deletedNo);
    assert.ok(r.body.customers.every((x) => x.status === 'Inactive'));
    assert.equal(r.body.total, 2);
  });

  test('status=all shows everyone, deleted ones included', async () => {
    const r = await c.get('/api/customers?status=ALL&pageSize=100');
    assert.equal(r.body.total, everyone);
    assert.equal(r.body.customers.filter((x) => x.status === 'Inactive').length, 2);
  });

  test('counts give the three tab numbers, whatever tab is open', async () => {
    const expected = { active: everyone - 2, inactive: 2, all: everyone };
    assert.deepEqual((await c.get('/api/customers')).body.counts, expected);
    assert.deepEqual((await c.get('/api/customers?status=inactive')).body.counts, expected);
    assert.deepEqual((await c.get('/api/customers?status=all')).body.counts, expected);
  });

  test('counts follow the search and the pay terms filter', async () => {
    const r = await c.get('/api/customers?search=C0004');
    assert.deepEqual(r.body.counts, { active: 0, inactive: 1, all: 1 });
    assert.equal(r.body.total, 0); // the default tab is Active, and C0004 is deleted
    const term = (await db.query(`SELECT payterm FROM customer WHERE custno = 'C0007'`)).rows[0].payterm;
    const r2 = await c.get(`/api/customers?payTerm=${term}&status=all&pageSize=100`);
    assert.equal(r2.body.counts.all, await count('payterm = $1', [term]));
    assert.equal(r2.body.total, r2.body.counts.all);
  });

  test('search and paging work inside the Inactive tab', async () => {
    const r = await c.get('/api/customers?status=inactive&pageSize=1&page=2');
    assert.deepEqual(r.body.customers.map((x) => x.custNo), ['C0007']);
    assert.equal(r.body.total, 2);
    assert.equal((await c.get('/api/customers?status=inactive&page=3')).body.customers.length, 0);
  });

  test('restoring (deleted_at back to empty) puts the customer back in the Active list', async () => {
    await db.query(`UPDATE customer SET deleted_at = NULL WHERE custno = 'C0004'`);
    const r = await c.get('/api/customers?search=C0004');
    assert.equal(r.body.total, 1);
    assert.equal(r.body.customers[0].status, 'Active');
  });

  test('a status that does not exist is a 400 with a field message', async () => {
    for (const bad of ['deleted', 'x', "all'--"]) {
      const r = await c.get(`/api/customers?status=${encodeURIComponent(bad)}`);
      assert.equal(r.status, 400, bad);
      assert.match(r.body.errors.status, /active, inactive, all/);
    }
    assert.equal((await c.get('/api/customers?status=active&status=all')).status, 400);
  });

  test('an empty status means the default (active)', async () => {
    assert.equal((await c.get('/api/customers?status=')).body.total, everyone - 2);
  });
});

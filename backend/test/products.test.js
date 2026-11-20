import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => { ctx?.server.close(); });
beforeEach(async () => {
  await resetDb();
  await loadBusinessTables(); // the real product table and its sample rows
});

const anon = () => client(ctx.base);
const as = async (email) => { const c = anon(); const r = await c.login(email); assert.equal(r.status, 200, JSON.stringify(r.body)); return c; };
const give = async (id, ...codes) => {
  for (const code of codes) {
    await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code=$2`, [id, code]);
  }
};
const count = async (where = 'true', params = []) =>
  Number((await db.query(`SELECT count(*) AS n FROM product WHERE ${where}`, params)).rows[0].n);

const userWith = async (email, ...codes) => {
  const id = await seedUser({ email, role: 'user' });
  await give(id, ...codes);
  return { id, c: await as(email) };
};
const viewer = () => userWith('v@x.co', 'PRODUCT_EDIT').then((x) => x.c);

describe('S2-DEV-04 product list: permission check', () => {
  test('needs a login', async () => {
    assert.equal((await anon().get('/api/products')).status, 401);
  });

  test('a user with no rights is refused (403)', async () => {
    await seedUser({ email: 'u@x.co', role: 'user' });
    const r = await (await as('u@x.co')).get('/api/products');
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'FORBIDDEN');
  });

  test('being an admin gives no product rights (403)', async () => {
    await seedUser({ email: 'a@x.co', role: 'admin' });
    assert.equal((await (await as('a@x.co')).get('/api/products')).status, 403);
  });

  test('a right from another module is not enough (403)', async () => {
    const { c } = await userWith('o@x.co', 'CUSTOMER_ADD', 'SALE_ADD');
    assert.equal((await c.get('/api/products')).status, 403);
  });

  for (const code of ['PRODUCT_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRICE_ADD', 'PRICE_EDIT', 'PRICE_DELETE']) {
    test(`any one product-module right opens the list (${code})`, async () => {
      const { c } = await userWith(`${code.toLowerCase()}@x.co`, code);
      const r = await c.get('/api/products');
      assert.equal(r.status, 200);
      assert.equal(r.body.total, await count('deleted_at IS NULL'));
    });
  }

  test('the superadmin can always open it', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const r = await (await as('sa@x.co')).get('/api/products');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, await count('deleted_at IS NULL'));
  });

  test('taking the right away stops access on the very next request', async () => {
    const { id, c } = await userWith('t@x.co', 'PRODUCT_EDIT');
    assert.equal((await c.get('/api/products')).status, 200);
    await db.query('DELETE FROM user_permission WHERE user_id = $1', [id]);
    assert.equal((await c.get('/api/products')).status, 403);
  });

  test('a blocked user is refused even with the right', async () => {
    const { id, c } = await userWith('b@x.co', 'PRODUCT_ADD');
    await db.query('UPDATE app_user SET is_blocked = TRUE WHERE user_id = $1', [id]);
    assert.notEqual((await c.get('/api/products')).status, 200);
  });
});

describe('S2-DEV-04 product list: shape and paging', () => {
  test('rows are { prodCode, description, unit, status } with no stray spaces', async () => {
    const r = await (await viewer()).get('/api/products?pageSize=5');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.products.length, 5);
    for (const p of r.body.products) {
      assert.deepEqual(Object.keys(p), ['prodCode', 'description', 'unit', 'status']);
      assert.equal(p.description, p.description.trim());
      assert.equal(p.status, 'Active');
    }
  });

  test('defaults to page 1 with 20 per page, ordered by product code', async () => {
    const r = await (await viewer()).get('/api/products');
    assert.equal(r.body.page, 1);
    assert.equal(r.body.pageSize, 20);
    assert.equal(r.body.products.length, Math.min(20, r.body.total));
    const codes = r.body.products.map((p) => p.prodCode);
    assert.deepEqual(codes, [...codes].sort());
  });

  test('page 2 continues where page 1 stopped, with nothing repeated', async () => {
    const c = await viewer();
    const a = (await c.get('/api/products?pageSize=10&page=1')).body.products.map((p) => p.prodCode);
    const b = (await c.get('/api/products?pageSize=10&page=2')).body.products.map((p) => p.prodCode);
    assert.equal(b.length, 10);
    assert.equal(a.filter((x) => b.includes(x)).length, 0);
    assert.ok(a[a.length - 1] < b[0]);
  });

  test('a page past the end is empty but the total is still right', async () => {
    const r = await (await viewer()).get('/api/products?page=999');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.products, []);
    assert.equal(r.body.total, await count('deleted_at IS NULL'));
  });

  test('pageSize is capped at 100 and bad numbers fall back to the defaults', async () => {
    const c = await viewer();
    assert.equal((await c.get('/api/products?pageSize=5000')).body.pageSize, 100);
    const r = await c.get('/api/products?page=abc&pageSize=-3');
    assert.equal(r.body.page, 1);
    assert.ok(r.body.pageSize >= 1);
  });
});

describe('S2-DEV-04 product list: search', () => {
  test('finds a product by its code, ignoring upper/lower case', async () => {
    const { rows } = await db.query('SELECT prodcode FROM product ORDER BY prodcode LIMIT 1');
    const code = rows[0].prodcode;
    const r = await (await viewer()).get(`/api/products?search=${code.toLowerCase()}`);
    assert.ok(r.body.products.some((p) => p.prodCode === code));
    assert.ok(r.body.products.every((p) => `${p.prodCode} ${p.description}`.toLowerCase().includes(code.toLowerCase())));
  });

  test('finds products by a word in the description', async () => {
    const { rows } = await db.query(`SELECT trim(description) AS d FROM product WHERE deleted_at IS NULL ORDER BY prodcode LIMIT 1`);
    const word = rows[0].d.split(/\s+/)[0].slice(0, 4).toUpperCase();
    const expected = await count(`deleted_at IS NULL AND (prodcode ILIKE $1 OR description ILIKE $1)`, [`%${word}%`]);
    const r = await (await viewer()).get(`/api/products?search=${encodeURIComponent(word)}&pageSize=100`);
    assert.equal(r.body.total, expected);
    assert.ok(expected >= 1);
  });

  test('no match gives an empty list, not an error', async () => {
    const r = await (await viewer()).get('/api/products?search=zzzzqqqq');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.products, []);
    assert.equal(r.body.total, 0);
  });

  test('% and _ are searched as plain characters, not wildcards', async () => {
    const c = await viewer();
    assert.equal((await c.get('/api/products?search=%25')).body.total, 0);
    assert.equal((await c.get('/api/products?search=_')).body.total, 0);
  });

  test('SQL text in the search box is just text', async () => {
    const before = await count();
    const r = await (await viewer()).get(`/api/products?search=${encodeURIComponent("'; DROP TABLE product; --")}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 0);
    assert.equal(await count(), before);
  });

  test('a search sent twice is ignored instead of crashing', async () => {
    const r = await (await viewer()).get('/api/products?search=a&search=b');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, await count('deleted_at IS NULL'));
  });
});

describe('S2-DEV-04 product list: unit filter', () => {
  test('only returns products in the chosen unit', async () => {
    const r = await (await viewer()).get('/api/products?unit=pc&pageSize=100');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, await count(`unit='pc' AND deleted_at IS NULL`));
    assert.ok(r.body.products.length > 0);
    assert.ok(r.body.products.every((p) => p.unit === 'pc'));
  });

  test('upper case and spaces are tolerated', async () => {
    const r = await (await viewer()).get('/api/products?unit=%20EA%20');
    assert.equal(r.body.total, await count(`unit='ea' AND deleted_at IS NULL`));
  });

  test('a unit nobody sells in gives an empty list', async () => {
    const r = await (await viewer()).get('/api/products?unit=ltr');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, await count(`unit='ltr' AND deleted_at IS NULL`));
  });

  test('an unknown unit is refused with a field error (400)', async () => {
    const r = await (await viewer()).get('/api/products?unit=kg');
    assert.equal(r.status, 400);
    assert.ok(r.body.errors.unit);
  });

  test('unit and search work together', async () => {
    const r = await (await viewer()).get('/api/products?unit=ea&search=a&pageSize=100');
    const expected = await count(`unit='ea' AND deleted_at IS NULL AND (prodcode ILIKE '%a%' OR description ILIKE '%a%')`);
    assert.equal(r.body.total, expected);
    assert.ok(r.body.products.every((p) => p.unit === 'ea'));
  });
});

describe('S2-DEV-04 product list: status and counts', () => {
  const retire = (code) => db.query('UPDATE product SET deleted_at = now() WHERE prodcode = $1', [code]);
  const firstCode = async () => (await db.query('SELECT prodcode FROM product ORDER BY prodcode LIMIT 1')).rows[0].prodcode;

  test('deleted products are hidden by default', async () => {
    const code = await firstCode();
    await retire(code);
    const r = await (await viewer()).get('/api/products?pageSize=100');
    assert.ok(!r.body.products.some((p) => p.prodCode === code));
    assert.equal(r.body.total, await count('deleted_at IS NULL'));
  });

  test('status=inactive shows only deleted products, marked Inactive', async () => {
    const code = await firstCode();
    await retire(code);
    const r = await (await viewer()).get('/api/products?status=inactive');
    assert.equal(r.body.total, 1);
    assert.deepEqual(r.body.products.map((p) => [p.prodCode, p.status]), [[code, 'Inactive']]);
  });

  test('status=all shows both kinds', async () => {
    await retire(await firstCode());
    const r = await (await viewer()).get('/api/products?status=all&pageSize=100');
    assert.equal(r.body.total, await count());
    assert.ok(r.body.products.some((p) => p.status === 'Inactive'));
    assert.ok(r.body.products.some((p) => p.status === 'Active'));
  });

  test('counts give active / inactive / all and ignore the status filter', async () => {
    await retire(await firstCode());
    const c = await viewer();
    const total = await count();
    for (const status of ['active', 'inactive', 'all']) {
      const r = await c.get(`/api/products?status=${status}`);
      assert.deepEqual(r.body.counts, { active: total - 1, inactive: 1, all: total });
    }
  });

  test('counts follow the search and the unit filter', async () => {
    const code = await firstCode();
    await retire(code);
    const { rows } = await db.query('SELECT unit FROM product WHERE prodcode = $1', [code]);
    const unit = rows[0].unit;
    const r = await (await viewer()).get(`/api/products?unit=${unit}`);
    const all = await count('unit = $1', [unit]);
    assert.deepEqual(r.body.counts, { active: all - 1, inactive: 1, all });
  });

  test('an unknown status is refused with a field error (400)', async () => {
    const r = await (await viewer()).get('/api/products?status=deleted');
    assert.equal(r.status, 400);
    assert.ok(r.body.errors.status);
  });
});

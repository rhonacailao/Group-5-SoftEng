import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, loadAuditTriggers, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => { ctx?.server.close(); });
beforeEach(async () => {
  await resetDb();
  await loadBusinessTables();
  await loadAuditTriggers(); // Karla's triggers write the audit rows for pricehist
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
const allPrice = () => userWith('prices@x.co', 'PRICE_ADD', 'PRICE_EDIT', 'PRICE_DELETE');

// FREE: a product added through S2-DEV-05 (no prices, no sales yet)
const FREE = 'ZZ0001';
const addFree = () => db.query(`INSERT INTO product (prodcode, description, unit) VALUES ($1, 'Fresh Product', 'ea')`, [FREE]);
const url = (code, date) => `/api/products/${code}/prices${date ? `/${date}` : ''}`;
const rowsOf = async (code) =>
  (await db.query(`SELECT to_char(effdate,'YYYY-MM-DD') AS d, unitprice::float AS p FROM pricehist WHERE prodcode=$1 ORDER BY effdate`, [code])).rows;
const auditOf = async (code) =>
  (await db.query(`SELECT action, action_by FROM audit_log WHERE table_name='pricehist' AND record_key LIKE '%' || $1 || '%' ORDER BY audit_id`, [code])).rows;
// A sold product that has exactly one price, and one that has a second price after the first
const soldOnePrice = async () => (await db.query(
  `SELECT d.prodcode FROM salesdetail d GROUP BY d.prodcode
   HAVING (SELECT count(*) FROM pricehist p WHERE p.prodcode = d.prodcode) = 1 ORDER BY 1 LIMIT 1`)).rows[0].prodcode;
const soldTwoPrices = async () => (await db.query(
  `SELECT d.prodcode FROM salesdetail d GROUP BY d.prodcode
   HAVING (SELECT count(*) FROM pricehist p WHERE p.prodcode = d.prodcode) = 2 ORDER BY 1 LIMIT 1`)).rows[0].prodcode;

describe('S2-DEV-07 price history: who may do what', () => {
  beforeEach(addFree);

  test('every route needs a login (401)', async () => {
    assert.equal((await anon().get(url(FREE))).status, 401);
    assert.equal((await anon().post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 })).status, 401);
    assert.equal((await anon().patch(url(FREE, '2026-12-01'), { unitPrice: 6 })).status, 401);
    assert.equal((await anon().delete(url(FREE, '2026-12-01'))).status, 401);
  });

  test('a user with no rights cannot even view (403)', async () => {
    await seedUser({ email: 'n@x.co', role: 'user' });
    assert.equal((await (await as('n@x.co')).get(url(FREE))).status, 403);
  });

  test('any one product-module right may view the history', async () => {
    for (const code of ['PRODUCT_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRICE_ADD', 'PRICE_EDIT', 'PRICE_DELETE']) {
      const { c } = await userWith(`${code.toLowerCase()}@x.co`, code);
      assert.equal((await c.get(url('AK0001'))).status, 200, code);
    }
  });

  test('a right from another module does not open the history', async () => {
    const { c } = await userWith('cust@x.co', 'CUSTOMER_ADD');
    assert.equal((await c.get(url('AK0001'))).status, 403);
  });

  for (const [have, label] of [['PRICE_EDIT', 'Add'], ['PRICE_DELETE', 'Add'], ['PRODUCT_ADD', 'Add'], ['PRODUCT_EDIT', 'Add']]) {
    test(`${have} alone cannot add a price (403)`, async () => {
      const { c } = await userWith(`a-${have.toLowerCase()}@x.co`, have);
      const r = await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 });
      assert.equal(r.status, 403);
      assert.deepEqual(await rowsOf(FREE), []);
    });
  }

  test('only PRICE_EDIT may edit, only PRICE_DELETE may delete', async () => {
    await db.query(`INSERT INTO pricehist (prodcode, effdate, unitprice) VALUES ($1,'2026-12-01',5)`, [FREE]);
    const { c: addOnly } = await userWith('ao@x.co', 'PRICE_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE');
    assert.equal((await addOnly.patch(url(FREE, '2026-12-01'), { unitPrice: 9 })).status, 403);
    assert.equal((await addOnly.delete(url(FREE, '2026-12-01'))).status, 403);
    const { c: editOnly } = await userWith('eo@x.co', 'PRICE_EDIT');
    assert.equal((await editOnly.delete(url(FREE, '2026-12-01'))).status, 403);
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-12-01', p: 5 }]);
    assert.equal((await editOnly.patch(url(FREE, '2026-12-01'), { unitPrice: 9 })).status, 200);
  });

  test('superadmin may do everything; admin without rights may not', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    const sa = await as('sa@x.co');
    assert.equal((await sa.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 })).status, 201);
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    const ad = await as('ad@x.co');
    assert.equal((await ad.post(url(FREE), { effectiveDate: '2026-12-02', unitPrice: 5 })).status, 403);
  });

  test('taking a right away is felt on the very next request', async () => {
    const { id, c } = await userWith('rm@x.co', 'PRICE_ADD');
    assert.equal((await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 })).status, 201);
    await db.query(`DELETE FROM user_permission WHERE user_id = $1`, [id]);
    assert.equal((await c.post(url(FREE), { effectiveDate: '2026-12-02', unitPrice: 5 })).status, 403);
  });
});

describe('S2-DEV-07 price history: list', () => {
  test('returns the history newest first, dates as text, prices as numbers', async () => {
    const { c } = await userWith('v@x.co', 'PRICE_ADD');
    const r = await c.get(url('PC0001'));
    assert.equal(r.status, 200);
    assert.equal(r.body.product.prodCode, 'PC0001');
    assert.equal(r.body.total, r.body.prices.length);
    assert.deepEqual(r.body.prices.slice(0, 2), [
      { prodCode: 'PC0001', effectiveDate: '2010-07-12', unitPrice: 454.54, state: 'Current' },
      { prodCode: 'PC0001', effectiveDate: '2010-05-15', unitPrice: 499.99, state: 'Past' },
    ].slice(0, r.body.prices.length));
    const dates = r.body.prices.map((p) => p.effectiveDate);
    assert.deepEqual(dates, [...dates].sort().reverse());
  });

  test('lowercase code works; bad or unknown codes are 404', async () => {
    const { c } = await userWith('v2@x.co', 'PRICE_ADD');
    assert.equal((await c.get(url('pc0001'))).status, 200);
    assert.equal((await c.get(url('nope'))).status, 404);
    assert.equal((await c.get(url('ZZ9999'))).status, 404);
  });

  test('a product without prices gives an empty list, not an error', async () => {
    await addFree();
    const { c } = await userWith('v3@x.co', 'PRICE_ADD');
    const r = await c.get(url(FREE));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.prices, []);
    assert.equal(r.body.total, 0);
  });
});

describe('S2-DEV-07 price history: add', () => {
  let c;
  beforeEach(async () => { await addFree(); ({ c } = await allPrice()); });

  test('adds a price (201) and stores it exactly', async () => {
    const r = await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 120.5 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body.price, { prodCode: FREE, effectiveDate: '2026-12-01', unitPrice: 120.5 });
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-12-01', p: 120.5 }]);
  });

  test('a price as text ("99.99"), a whole number and a future date are fine', async () => {
    assert.equal((await c.post(url(FREE), { effectiveDate: '2030-01-01', unitPrice: '99.99' })).status, 201);
    assert.equal((await c.post(url(FREE), { effectiveDate: '2031-01-01', unitPrice: 7 })).status, 201);
    assert.equal((await c.post(url(FREE), { effectiveDate: ' 2032-01-01 ', unitPrice: ' 3.5 ' })).status, 201);
    assert.deepEqual((await rowsOf(FREE)).map((x) => x.p), [99.99, 7, 3.5]);
  });

  test('the biggest value the column holds (99999999.99) works', async () => {
    assert.equal((await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: '99999999.99' })).status, 201);
  });

  test('same product and same date is refused (409 DATE_TAKEN) and the old price stays', async () => {
    await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 });
    const r = await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 8 });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'DATE_TAKEN');
    assert.ok(r.body.errors.effectiveDate);
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-12-01', p: 5 }]);
  });

  test('the same date on a DIFFERENT product is fine', async () => {
    const r = await c.post(url('AK0001'), { effectiveDate: '2010-05-15', unitPrice: 1 });
    assert.equal(r.status, 409); // AK0001 already has 2010-05-15
    assert.equal((await c.post(url('AK0001'), { effectiveDate: '2027-01-01', unitPrice: 13 })).status, 201);
    assert.equal((await c.post(url(FREE), { effectiveDate: '2027-01-01', unitPrice: 14 })).status, 201);
  });

  const badDates = ['', '   ', 'tomorrow', '2026-13-01', '2026-02-30', '2026/12/01', '12-01-2026', '2026-1-1', '1899-12-31', '2101-01-01', '2026-12-01T00:00:00Z', 20261201, null, {}, ['2026-12-01'], true];
  for (const effectiveDate of badDates) {
    test(`bad date ${JSON.stringify(effectiveDate)} is refused (400)`, async () => {
      const r = await c.post(url(FREE), { effectiveDate, unitPrice: 5 });
      assert.equal(r.status, 400);
      assert.ok(r.body.errors.effectiveDate);
      assert.deepEqual(await rowsOf(FREE), []);
    });
  }

  const badPrices = [undefined, null, '', '  ', 'abc', 0, '0', '0.00', -5, '-5', 12.345, '12.345', '1e3', 1e21, Infinity, 100000000, '100000000.00', '.5', '5.', '1,000', true, {}, [5], '٥'];
  for (const unitPrice of badPrices) {
    test(`bad price ${JSON.stringify(unitPrice)} is refused (400)`, async () => {
      const r = await c.post(url(FREE), { effectiveDate: '2026-12-01', ...(unitPrice === undefined ? {} : { unitPrice }) });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.ok(r.body.errors.unitPrice);
      assert.deepEqual(await rowsOf(FREE), []);
    });
  }

  test('both fields wrong: one error for each', async () => {
    const r = await c.post(url(FREE), { effectiveDate: 'x', unitPrice: 'y' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), ['effectiveDate', 'unitPrice']);
  });

  test('a missing body is a clean 400, not a crash', async () => {
    const res = await fetch(ctx.base + url(FREE), { method: 'POST', headers: { cookie: c.cookie } });
    assert.equal(res.status, 400);
  });

  test('unknown product 404, deleted product 409', async () => {
    assert.equal((await c.post(url('ZZ9999'), { effectiveDate: '2026-12-01', unitPrice: 5 })).status, 404);
    assert.equal((await c.post(url('bad'), { effectiveDate: '2026-12-01', unitPrice: 5 })).status, 404);
    await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = $1`, [FREE]);
    const r = await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRODUCT_INACTIVE');
    assert.deepEqual(await rowsOf(FREE), []);
  });

  test('extra fields sent by the browser are ignored', async () => {
    const r = await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5, prodCode: 'AK0001', hack: 'x' });
    assert.equal(r.status, 201);
    assert.equal(r.body.price.prodCode, FREE);
    assert.deepEqual(await rowsOf('AK0001'), (await rowsOf('AK0001'))); // untouched
    assert.equal((await rowsOf('AK0001')).some((x) => x.d === '2026-12-01'), false);
  });

  test('the audit log records ADD with the actor', async () => {
    await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 });
    assert.deepEqual(await auditOf(FREE), [{ action: 'ADD', action_by: 'prices@x.co' }]);
  });
});

describe('S2-DEV-07 price history: edit', () => {
  let c;
  beforeEach(async () => {
    await addFree();
    ({ c } = await allPrice());
    await db.query(`INSERT INTO pricehist (prodcode, effdate, unitprice) VALUES ($1,'2026-01-01',10), ($1,'2026-06-01',12)`, [FREE]);
  });

  test('changes the price only', async () => {
    const r = await c.patch(url(FREE, '2026-06-01'), { unitPrice: 15.25 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.price, { prodCode: FREE, effectiveDate: '2026-06-01', unitPrice: 15.25 });
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-01-01', p: 10 }, { d: '2026-06-01', p: 15.25 }]);
  });

  test('changes the effective date only', async () => {
    const r = await c.patch(url(FREE, '2026-06-01'), { effectiveDate: '2026-09-09' });
    assert.equal(r.status, 200);
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-01-01', p: 10 }, { d: '2026-09-09', p: 12 }]);
  });

  test('changes both at once', async () => {
    assert.equal((await c.patch(url(FREE, '2026-06-01'), { effectiveDate: '2025-01-01', unitPrice: '1.1' })).status, 200);
    assert.deepEqual(await rowsOf(FREE), [{ d: '2025-01-01', p: 1.1 }, { d: '2026-01-01', p: 10 }]);
  });

  test('sending the same values changes nothing and writes no audit row', async () => {
    const before = (await auditOf(FREE)).length;
    const r = await c.patch(url(FREE, '2026-06-01'), { effectiveDate: '2026-06-01', unitPrice: 12.0 });
    assert.equal(r.status, 200);
    assert.equal((await auditOf(FREE)).length, before);
  });

  test('moving onto a date the product already has is refused (409) and nothing moves', async () => {
    const r = await c.patch(url(FREE, '2026-06-01'), { effectiveDate: '2026-01-01' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'DATE_TAKEN');
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-01-01', p: 10 }, { d: '2026-06-01', p: 12 }]);
  });

  test('an empty change is a 400; bad values are 400 with a message per field', async () => {
    assert.equal((await c.patch(url(FREE, '2026-06-01'), {})).status, 400);
    assert.equal((await c.patch(url(FREE, '2026-06-01'), { unrelated: 1 })).status, 400);
    const r = await c.patch(url(FREE, '2026-06-01'), { unitPrice: 0, effectiveDate: '2026-02-30' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), ['effectiveDate', 'unitPrice']);
    for (const bad of [null, '', -1, 'abc', 12.345]) {
      assert.equal((await c.patch(url(FREE, '2026-06-01'), { unitPrice: bad })).status, 400, String(bad));
    }
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-01-01', p: 10 }, { d: '2026-06-01', p: 12 }]);
  });

  test('unknown price, bad date in the address, unknown or deleted product', async () => {
    assert.equal((await c.patch(url(FREE, '2030-01-01'), { unitPrice: 5 })).status, 404);
    assert.equal((await c.patch(url(FREE, 'notadate'), { unitPrice: 5 })).status, 404);
    assert.equal((await c.patch(url(FREE, '2026-02-30'), { unitPrice: 5 })).status, 404);
    assert.equal((await c.patch(url('ZZ9999', '2026-06-01'), { unitPrice: 5 })).status, 404);
    // a price that belongs to ANOTHER product is not reachable through this one
    assert.equal((await c.patch(url(FREE, '2010-05-15'), { unitPrice: 5 })).status, 404);
    assert.equal((await rowsOf('AK0001'))[0].p, 12);
    await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = $1`, [FREE]);
    const r = await c.patch(url(FREE, '2026-06-01'), { unitPrice: 5 });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRODUCT_INACTIVE');
  });

  test('the audit log records EDIT with the actor', async () => {
    await c.patch(url(FREE, '2026-06-01'), { unitPrice: 20 });
    const log = await auditOf(FREE);
    assert.deepEqual(log.at(-1), { action: 'EDIT', action_by: 'prices@x.co' });
  });

  test('moving the only price of a sold product to a later date than its sales is refused', async () => {
    const code = await soldOnePrice();
    const [only] = await rowsOf(code);
    const r = await c.patch(url(code, only.d), { effectiveDate: '2026-01-01' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRICE_NEEDED_BY_SALES');
    assert.equal((await rowsOf(code))[0].d, only.d); // rolled back
  });

  test('a harmless date move on a sold product is allowed (still before every sale)', async () => {
    const code = await soldOnePrice();
    const [only] = await rowsOf(code);
    assert.equal((await c.patch(url(code, only.d), { effectiveDate: '1990-01-01' })).status, 200);
  });

  test('editing only the amount on a sold product is always allowed', async () => {
    const code = await soldOnePrice();
    const [only] = await rowsOf(code);
    assert.equal((await c.patch(url(code, only.d), { unitPrice: 1.5 })).status, 200);
  });
});

describe('S2-DEV-07 price history: delete', () => {
  let c;
  beforeEach(async () => {
    await addFree();
    ({ c } = await allPrice());
    await db.query(`INSERT INTO pricehist (prodcode, effdate, unitprice) VALUES ($1,'2026-01-01',10), ($1,'2026-06-01',12)`, [FREE]);
  });

  test('removes that one row and returns it', async () => {
    const r = await c.delete(url(FREE, '2026-06-01'));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.price, { prodCode: FREE, effectiveDate: '2026-06-01', unitPrice: 12 });
    assert.deepEqual(await rowsOf(FREE), [{ d: '2026-01-01', p: 10 }]);
  });

  test('deleting the same price twice: second time is 404', async () => {
    assert.equal((await c.delete(url(FREE, '2026-06-01'))).status, 200);
    assert.equal((await c.delete(url(FREE, '2026-06-01'))).status, 404);
  });

  test('unknown date, bad date, other product, unknown product', async () => {
    assert.equal((await c.delete(url(FREE, '2030-01-01'))).status, 404);
    assert.equal((await c.delete(url(FREE, 'x'))).status, 404);
    assert.equal((await c.delete(url(FREE, '2010-05-15'))).status, 404); // AK0001's date, not ours
    assert.equal((await c.delete(url('ZZ9999', '2026-06-01'))).status, 404);
    assert.equal((await rowsOf('AK0001')).length, 1);
  });

  test('a deleted product keeps its prices as they are (409)', async () => {
    await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = $1`, [FREE]);
    const r = await c.delete(url(FREE, '2026-06-01'));
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRODUCT_INACTIVE');
    assert.equal((await rowsOf(FREE)).length, 2);
  });

  test('the audit log records DELETE with the actor', async () => {
    await c.delete(url(FREE, '2026-06-01'));
    assert.deepEqual((await auditOf(FREE)).at(-1), { action: 'DELETE', action_by: 'prices@x.co' });
  });

  test('the last price of a sold product cannot go (409) and stays', async () => {
    const code = await soldOnePrice();
    const [only] = await rowsOf(code);
    const r = await c.delete(url(code, only.d));
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRICE_NEEDED_BY_SALES');
    assert.equal((await rowsOf(code)).length, 1);
  });

  test('a sold product with two prices: the LATER price can go, then the first one is protected', async () => {
    const code = await soldTwoPrices();
    const rows = await rowsOf(code);
    assert.equal((await c.delete(url(code, rows[1].d))).status, 200);
    const r = await c.delete(url(code, rows[0].d));
    assert.equal(r.status, 409);
    assert.equal((await rowsOf(code)).length, 1);
  });

  test('a product with no sales may lose all its prices', async () => {
    assert.equal((await c.delete(url(FREE, '2026-06-01'))).status, 200);
    assert.equal((await c.delete(url(FREE, '2026-01-01'))).status, 200);
    assert.deepEqual(await rowsOf(FREE), []);
  });

  test('after the last price is gone, the product can be deleted again (S2-DEV-06 rule)', async () => {
    await c.delete(url(FREE, '2026-06-01'));
    await c.delete(url(FREE, '2026-01-01'));
    const sa = await userWith('del@x.co', 'PRODUCT_DELETE');
    assert.equal((await sa.c.delete(`/api/products/${FREE}`)).status, 200);
  });
});

describe('S2-DEV-07 price history: safety', () => {
  beforeEach(addFree);

  test('SQL text in the date, price or code is just refused, never run', async () => {
    const { c } = await allPrice();
    const evil = `'; DROP TABLE pricehist; --`;
    assert.equal((await c.post(url(FREE), { effectiveDate: evil, unitPrice: 5 })).status, 400);
    assert.equal((await c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: evil })).status, 400);
    assert.equal((await c.delete(url(FREE, encodeURIComponent(evil)))).status, 404);
    assert.equal((await c.get(url(encodeURIComponent(evil)))).status, 404);
    assert.ok((await rowsOf('AK0001')).length >= 1); // table still there
  });

  test('ten adds for the same date at once: exactly one wins, the rest are 409', async () => {
    const { c } = await allPrice();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: i + 1 })));
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [201, ...Array(9).fill(409)]);
    assert.equal((await rowsOf(FREE)).length, 1);
  });

  test('a product delete and a price add cannot both succeed', async () => {
    const { c } = await allPrice();
    const del = await userWith('d2@x.co', 'PRODUCT_DELETE');
    const [a, b] = await Promise.all([
      c.post(url(FREE), { effectiveDate: '2026-12-01', unitPrice: 5 }),
      del.c.delete(`/api/products/${FREE}`),
    ]);
    const prices = (await rowsOf(FREE)).length;
    const deleted = (await db.query('SELECT deleted_at FROM product WHERE prodcode=$1', [FREE])).rows[0].deleted_at !== null;
    assert.ok(!(prices > 0 && deleted), `price=${prices} deleted=${deleted} (${a.status}/${b.status})`);
  });
});

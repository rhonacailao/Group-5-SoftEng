import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => { ctx?.server.close(); delete process.env.BUSINESS_TIMEZONE; });
beforeEach(async () => {
  delete process.env.BUSINESS_TIMEZONE;
  await resetDb();
  await loadBusinessTables();
});

const as = async (email) => { const c = client(ctx.base); const r = await c.login(email); assert.equal(r.status, 200); return c; };
const viewer = async () => {
  const id = await seedUser({ email: 'v@x.co', role: 'user' });
  await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code='PRICE_ADD'`, [id]);
  return as('v@x.co');
};
const FREE = 'ZZ0001';
const addFree = () => db.query(`INSERT INTO product (prodcode, description, unit) VALUES ($1, 'Fresh Product', 'ea')`, [FREE]);
const list = async (c, qs = 'pageSize=100') => (await c.get(`/api/products?${qs}`)).body;
const manila = async (offsetDays = 0) =>
  (await db.query(`SELECT to_char((now() AT TIME ZONE 'Asia/Manila')::date + $1::int, 'YYYY-MM-DD') AS d`, [offsetDays])).rows[0].d;
const priceOf = (body, code) => body.products.find((p) => p.prodCode === code)?.currentPrice;

describe('S2-DEV-08 current price on the product list', () => {
  test('every listed product has a currentPrice: { unitPrice, effectiveDate } or null', async () => {
    const c = await viewer();
    const body = await list(c);
    assert.ok(body.products.length > 0);
    for (const p of body.products) {
      if (p.currentPrice !== null) {
        assert.deepEqual(Object.keys(p.currentPrice), ['unitPrice', 'effectiveDate']);
        assert.equal(typeof p.currentPrice.unitPrice, 'number');
        assert.match(p.currentPrice.effectiveDate, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  test('the sample data: the NEWEST price already started is the current one (checked against SQL)', async () => {
    const c = await viewer();
    const body = await list(c);
    const expected = (await db.query(
      `SELECT DISTINCT ON (prodcode) prodcode, to_char(effdate,'YYYY-MM-DD') d, unitprice::float AS p
         FROM pricehist ORDER BY prodcode, effdate DESC`)).rows;
    assert.ok(expected.length > 20);
    for (const e of expected) {
      assert.deepEqual(priceOf(body, e.prodcode), { unitPrice: e.p, effectiveDate: e.d }, e.prodcode);
    }
    // PC0001 has two prices (2010-05-15 at 499.99 and 2010-07-12 at 454.54): the later one wins
    assert.deepEqual(priceOf(body, 'PC0001'), { unitPrice: 454.54, effectiveDate: '2010-07-12' });
  });

  test('a product with no price shows null, not an error', async () => {
    await addFree();
    const c = await viewer();
    assert.equal(priceOf(await list(c, `search=${FREE}`), FREE), null);
  });

  test('a price that starts in the future is NOT current yet; the older one still is', async () => {
    await addFree();
    await db.query(`INSERT INTO pricehist VALUES ($2, $1, 10), ($3, $1, 99)`, [FREE, await manila(-30), await manila(30)]);
    const c = await viewer();
    assert.deepEqual(priceOf(await list(c, `search=${FREE}`), FREE), { unitPrice: 10, effectiveDate: await manila(-30) });
  });

  test('only a future price: still null until its date', async () => {
    await addFree();
    await db.query(`INSERT INTO pricehist VALUES ($2, $1, 99)`, [FREE, await manila(1)]);
    assert.equal(priceOf(await list(await viewer(), `search=${FREE}`), FREE), null);
  });

  test('a price that starts TODAY is already current', async () => {
    await addFree();
    await db.query(`INSERT INTO pricehist VALUES ($2, $1, 10), ($3, $1, 55.5)`, [FREE, await manila(-5), await manila(0)]);
    assert.deepEqual(priceOf(await list(await viewer(), `search=${FREE}`), FREE), { unitPrice: 55.5, effectiveDate: await manila(0) });
  });

  test('"today" follows the company time zone, not the database clock (BUSINESS_TIMEZONE)', async () => {
    await addFree();
    const c = await viewer();
    // Kiritimati is the first place on Earth to start a day (UTC+14), Pago Pago the last (UTC-11):
    // for several hours every day they disagree about the date.
    const tz = async (zone) => (await db.query(`SELECT to_char((now() AT TIME ZONE $1)::date,'YYYY-MM-DD') d`, [zone])).rows[0].d;
    const early = await tz('Pacific/Kiritimati');
    const late = await tz('Pacific/Pago_Pago');
    assert.notEqual(early, late);
    await db.query(`INSERT INTO pricehist VALUES ($2, $1, 77)`, [FREE, early]); // starts "today" in Kiritimati only
    process.env.BUSINESS_TIMEZONE = 'Pacific/Kiritimati';
    assert.equal(priceOf(await list(c, `search=${FREE}`), FREE)?.unitPrice, 77);
    process.env.BUSINESS_TIMEZONE = 'Pacific/Pago_Pago';
    assert.equal(priceOf(await list(c, `search=${FREE}`), FREE), null);
  });

  test('works together with search, unit, status and paging', async () => {
    const c = await viewer();
    const page1 = await list(c, 'pageSize=5&page=1');
    const page2 = await list(c, 'pageSize=5&page=2');
    assert.equal(page1.products.length, 5);
    assert.notDeepEqual(page1.products.map((p) => p.prodCode), page2.products.map((p) => p.prodCode));
    assert.ok(page2.products.every((p) => 'currentPrice' in p));
    const unit = (await db.query(`SELECT unit FROM product WHERE prodcode='PC0001'`)).rows[0].unit;
    const found = await list(c, `search=PC0001&unit=${unit}`);
    assert.deepEqual(found.products.map((p) => p.prodCode), ['PC0001']);
    assert.equal(found.products[0].currentPrice.unitPrice, 454.54);
    assert.equal(found.total, 1);
    assert.deepEqual(found.counts, { active: 1, inactive: 0, all: 1 });
  });

  test('a deleted product listed under Inactive keeps showing its current price', async () => {
    await addFree();
    await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = $1`, [FREE]);
    const body = await list(await viewer(), `status=inactive`);
    assert.deepEqual(body.products.map((p) => [p.prodCode, p.currentPrice]), [[FREE, null]]);
  });

  test('a price change shows up on the very next list call', async () => {
    const id = await seedUser({ email: 'm@x.co', role: 'user' });
    await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code IN ('PRICE_ADD','PRICE_EDIT','PRICE_DELETE')`, [id]);
    const c = await as('m@x.co');
    assert.equal(priceOf(await list(c, 'search=AK0001'), 'AK0001').unitPrice, 12);
    assert.equal((await c.post('/api/products/AK0001/prices', { effectiveDate: await manila(-1), unitPrice: 15 })).status, 201);
    assert.equal(priceOf(await list(c, 'search=AK0001'), 'AK0001').unitPrice, 15);
    assert.equal((await c.patch(`/api/products/AK0001/prices/${await manila(-1)}`, { unitPrice: 16.5 })).status, 200);
    assert.equal(priceOf(await list(c, 'search=AK0001'), 'AK0001').unitPrice, 16.5);
    assert.equal((await c.delete(`/api/products/AK0001/prices/${await manila(-1)}`)).status, 200);
    assert.equal(priceOf(await list(c, 'search=AK0001'), 'AK0001').unitPrice, 12);
  });
});

describe('S2-DEV-08 current price on one product and in the price history', () => {
  test('GET /api/products/:code includes currentPrice', async () => {
    const c = await viewer();
    const r = await c.get('/api/products/pc0001');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.product.currentPrice, { unitPrice: 454.54, effectiveDate: '2010-07-12' });
    await addFree();
    assert.equal((await c.get(`/api/products/${FREE}`)).body.product.currentPrice, null);
  });

  test('the history marks one row Current, later ones Upcoming, older ones Past', async () => {
    await addFree();
    await db.query(`INSERT INTO pricehist VALUES ($2,$1,1), ($3,$1,2), ($4,$1,3), ($5,$1,4)`,
      [FREE, await manila(-100), await manila(-10), await manila(10), await manila(100)]);
    const r = await (await viewer()).get(`/api/products/${FREE}/prices`);
    assert.deepEqual(r.body.prices.map((p) => [p.unitPrice, p.state]), [[4, 'Upcoming'], [3, 'Upcoming'], [2, 'Current'], [1, 'Past']]);
    assert.deepEqual(r.body.currentPrice, { unitPrice: 2, effectiveDate: await manila(-10) });
  });

  test('currentPrice is null in the history when nothing has started yet', async () => {
    await addFree();
    const c = await viewer();
    await db.query(`INSERT INTO pricehist VALUES ($2,$1,9)`, [FREE, await manila(3)]);
    const r = await c.get(`/api/products/${FREE}/prices`);
    assert.equal(r.body.currentPrice, null);
    assert.deepEqual(r.body.prices.map((p) => p.state), ['Upcoming']);
    await db.query(`DELETE FROM pricehist WHERE prodcode=$1`, [FREE]);
    assert.deepEqual((await c.get(`/api/products/${FREE}/prices`)).body.prices, []);
  });

  test('the list and the history always agree on the current price', async () => {
    const c = await viewer();
    const body = await list(c);
    for (const p of body.products.slice(0, 15)) {
      const h = await c.get(`/api/products/${p.prodCode}/prices`);
      assert.deepEqual(h.body.currentPrice, p.currentPrice, p.prodCode);
    }
  });

  test('add/edit/delete answers keep their small shape (no state field)', async () => {
    await addFree();
    const id = await seedUser({ email: 'a@x.co', role: 'user' });
    await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code IN ('PRICE_ADD','PRICE_EDIT')`, [id]);
    const c = await as('a@x.co');
    const r = await c.post(`/api/products/${FREE}/prices`, { effectiveDate: '2026-01-01', unitPrice: 5 });
    assert.deepEqual(Object.keys(r.body.price), ['prodCode', 'effectiveDate', 'unitPrice']);
  });
});

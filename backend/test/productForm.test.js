import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, loadAuditTriggers, seedUser, client, db } from './helpers/setup.js';

let ctx;
before(async () => { ctx = await startApp(); });
after(() => { ctx?.server.close(); });
beforeEach(async () => {
  await resetDb();
  await loadBusinessTables();
  await loadAuditTriggers();
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
const count = async () => Number((await db.query('SELECT count(*) AS n FROM product')).rows[0].n);
const row = async (code) => (await db.query('SELECT prodcode, description, unit, deleted_at FROM product WHERE prodcode = $1', [code])).rows[0];
const audit = async (code) => (await db.query(`SELECT action, action_by FROM audit_log WHERE table_name = 'product' AND record_key = $1 ORDER BY audit_id`, [code])).rows;

const good = { prodCode: 'ZZ0001', description: 'Acme Widget 500', unit: 'pc' };

describe('S2-DEV-05 add product: permission check', () => {
  test('needs a login', async () => {
    assert.equal((await anon().post('/api/products', good)).status, 401);
  });

  test('a user with no rights is refused (403) and nothing is saved', async () => {
    await seedUser({ email: 'u@x.co', role: 'user' });
    const before = await count();
    assert.equal((await (await as('u@x.co')).post('/api/products', good)).status, 403);
    assert.equal(await count(), before);
  });

  test('Edit, Delete and price rights are not enough to add (403); Add is', async () => {
    const { c: other } = await userWith('e@x.co', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRICE_ADD');
    assert.equal((await other.post('/api/products', good)).status, 403);
    const { c: adder } = await userWith('a@x.co', 'PRODUCT_ADD');
    assert.equal((await adder.post('/api/products', good)).status, 201);
  });

  test('an admin with no product rights is refused (403)', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    assert.equal((await (await as('ad@x.co')).post('/api/products', good)).status, 403);
  });

  test('the superadmin can add', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    assert.equal((await (await as('sa@x.co')).post('/api/products', good)).status, 201);
  });
});

describe('S2-DEV-05 add product: saving', () => {
  let adder;
  beforeEach(async () => { adder = (await userWith('a@x.co', 'PRODUCT_ADD')).c; });

  test('saves the product as Active and answers 201', async () => {
    const before = await count();
    const r = await adder.post('/api/products', good);
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.product, { prodCode: 'ZZ0001', description: 'Acme Widget 500', unit: 'pc', status: 'Active' });
    assert.equal(await count(), before + 1);
    assert.equal((await row('ZZ0001')).deleted_at, null);
  });

  test('the new product shows in the list', async () => {
    await adder.post('/api/products', good);
    const r = await adder.get('/api/products?search=ZZ0001');
    assert.deepEqual(r.body.products.map((p) => p.prodCode), ['ZZ0001']);
  });

  test('spaces are trimmed, the code and unit can be typed in lower/upper case', async () => {
    const r = await adder.post('/api/products', { prodCode: ' zz0002 ', description: '  Spaced Out  ', unit: ' PKG ' });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.product, { prodCode: 'ZZ0002', description: 'Spaced Out', unit: 'pkg', status: 'Active' });
  });

  test('every unit the database allows is accepted', async () => {
    let n = 10;
    for (const unit of ['pc', 'ea', 'mtr', 'pkg', 'ltr']) {
      const r = await adder.post('/api/products', { prodCode: `ZU00${n++}`, description: `Unit ${unit}`, unit });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
  });

  test('the longest allowed description fits (30 characters); emoji count as one each', async () => {
    assert.equal((await adder.post('/api/products', { ...good, prodCode: 'ZZ0003', description: 'x'.repeat(30) })).status, 201);
    assert.equal((await adder.post('/api/products', { ...good, prodCode: 'ZZ0004', description: '😀'.repeat(30) })).status, 201);
    assert.equal((await adder.post('/api/products', { ...good, prodCode: 'ZZ0005', description: '😀'.repeat(31) })).status, 400);
  });

  test('a status sent in the body is ignored, the server decides', async () => {
    const r = await adder.post('/api/products', { ...good, status: 'Inactive', deleted_at: '2020-01-01' });
    assert.equal(r.status, 201);
    assert.equal(r.body.product.status, 'Active');
    assert.equal((await row('ZZ0001')).deleted_at, null);
  });

  test('a code that is already used is a 409 and nothing is overwritten', async () => {
    const { rows } = await db.query('SELECT prodcode, description, unit FROM product ORDER BY prodcode LIMIT 1');
    const taken = rows[0];
    const before = await count();
    const r = await adder.post('/api/products', { prodCode: taken.prodcode.toLowerCase(), description: 'Other thing', unit: 'ltr' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'CODE_TAKEN');
    assert.ok(r.body.errors.prodCode);
    assert.equal(await count(), before);
    assert.deepEqual(await row(taken.prodcode).then((x) => [x.description, x.unit]), [taken.description, taken.unit]);
  });

  test('a deleted product keeps its code, so it cannot be reused', async () => {
    await adder.post('/api/products', good);
    await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = 'ZZ0001'`);
    assert.equal((await adder.post('/api/products', good)).status, 409);
  });

  test('every problem is reported at once, per field, and nothing is saved', async () => {
    const before = await count();
    const r = await adder.post('/api/products', { prodCode: 'bad', description: '   ', unit: 'kg' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), ['description', 'prodCode', 'unit']);
    assert.equal(await count(), before);
  });

  test('a missing body and missing fields are all "required"', async () => {
    for (const body of [undefined, {}]) {
      const r = await adder.post('/api/products', body);
      assert.equal(r.status, 400);
      assert.ok(r.body.errors.prodCode && r.body.errors.description && r.body.errors.unit);
    }
    // A literal null is refused too (by the JSON reader or by the checks), and nothing is saved
    assert.equal((await adder.post('/api/products', null)).status, 400);
  });

  test('codes must be two letters and four digits', async () => {
    for (const prodCode of ['A0001', 'ABC001', 'AB001', 'AB00001', '123456', 'AB 001', 'AB-001', 'ÄB0001']) {
      const r = await adder.post('/api/products', { ...good, prodCode });
      assert.equal(r.status, 400, prodCode);
      assert.ok(r.body.errors.prodCode, prodCode);
    }
  });

  test('too long descriptions are refused with the limit in the message', async () => {
    const r = await adder.post('/api/products', { ...good, description: 'x'.repeat(31) });
    assert.equal(r.status, 400);
    assert.match(r.body.errors.description, /30/);
  });

  test('values that are not text (numbers, lists, objects) are refused, not turned into "[object Object]"', async () => {
    for (const bad of [123, ['a'], { a: 1 }, true]) {
      const r = await adder.post('/api/products', { prodCode: bad, description: bad, unit: bad });
      assert.equal(r.status, 400);
      assert.ok(r.body.errors.prodCode && r.body.errors.description && r.body.errors.unit);
    }
  });

  test('line breaks and other control characters are refused', async () => {
    for (const description of ['two\nlines', 'tab\there', 'nul\u0000byte']) {
      assert.equal((await adder.post('/api/products', { ...good, description })).status, 400);
    }
  });

  test('SQL typed into the form is stored as plain text and harms nothing', async () => {
    const description = "x'); DROP TABLE product;--";
    const r = await adder.post('/api/products', { ...good, description });
    assert.equal(r.status, 201);
    assert.equal((await row('ZZ0001')).description, description);
    assert.ok((await count()) > 1);
  });

  test('the audit log records who added it', async () => {
    await adder.post('/api/products', good);
    assert.deepEqual(await audit('ZZ0001'), [{ action: 'ADD', action_by: 'a@x.co' }]);
  });
});

describe('S2-DEV-05 edit product: permission check', () => {
  test('needs a login', async () => {
    assert.equal((await anon().patch('/api/products/AD0002', { unit: 'pc' })).status, 401);
  });

  test('Add and Delete rights are not enough to edit (403); Edit is. Nothing changes on a refusal', async () => {
    const before = await row('AD0002');
    const { c: other } = await userWith('o@x.co', 'PRODUCT_ADD', 'PRODUCT_DELETE', 'PRICE_EDIT');
    assert.equal((await other.patch('/api/products/AD0002', { unit: 'pc' })).status, 403);
    assert.deepEqual(await row('AD0002'), before);
    const { c: editor } = await userWith('e@x.co', 'PRODUCT_EDIT');
    assert.equal((await editor.patch('/api/products/AD0002', { unit: 'pc' })).status, 200);
  });

  test('taking the Edit right away stops editing on the very next request', async () => {
    const { id, c } = await userWith('t@x.co', 'PRODUCT_EDIT');
    assert.equal((await c.patch('/api/products/AD0002', { unit: 'pc' })).status, 200);
    await db.query('DELETE FROM user_permission WHERE user_id = $1', [id]);
    assert.equal((await c.patch('/api/products/AD0002', { unit: 'ea' })).status, 403);
  });

  test('an admin with no product rights is refused (403)', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    assert.equal((await (await as('ad@x.co')).patch('/api/products/AD0002', { unit: 'pc' })).status, 403);
  });
});

describe('S2-DEV-05 edit product: saving', () => {
  let editor;
  beforeEach(async () => { editor = (await userWith('e@x.co', 'PRODUCT_EDIT')).c; });

  test('changes only what was sent and returns the saved product', async () => {
    const was = await row('AD0002');
    const r = await editor.patch('/api/products/AD0002', { description: 'Renamed Drive' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.product, { prodCode: 'AD0002', description: 'Renamed Drive', unit: was.unit, status: 'Active' });
    assert.equal((await row('AD0002')).unit, was.unit);
  });

  test('can change both fields at once, and the code in the web address can be lower case', async () => {
    const r = await editor.patch('/api/products/ad0002', { description: 'Both Changed', unit: 'pkg' });
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.product.description, r.body.product.unit], ['Both Changed', 'pkg']);
  });

  test('the product code cannot be changed through the body', async () => {
    const r = await editor.patch('/api/products/AD0002', { prodCode: 'ZZ9999', description: 'Still AD0002' });
    assert.equal(r.status, 200);
    assert.equal(r.body.product.prodCode, 'AD0002');
    assert.equal(await row('ZZ9999'), undefined);
  });

  test('status cannot be changed through the body either (delete and restore are their own steps)', async () => {
    await editor.patch('/api/products/AD0002', { description: 'Status Try', status: 'Inactive', deleted_at: '2020-01-01' });
    assert.equal((await row('AD0002')).deleted_at, null);
  });

  test('sending the same values changes nothing and writes no audit row', async () => {
    const was = await row('AD0002');
    const r = await editor.patch('/api/products/AD0002', { description: `  ${was.description.trim()}  `, unit: was.unit });
    assert.equal(r.status, 200);
    assert.deepEqual(await audit('AD0002'), []);
  });

  test('a real change is written to the audit log with the editor', async () => {
    await editor.patch('/api/products/AD0002', { unit: 'ltr' });
    assert.deepEqual(await audit('AD0002'), [{ action: 'EDIT', action_by: 'e@x.co' }]);
  });

  test('bad values give field messages and leave the product alone', async () => {
    const was = await row('AD0002');
    const r = await editor.patch('/api/products/AD0002', { description: ' ', unit: 'kg' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), ['description', 'unit']);
    assert.deepEqual(await row('AD0002'), was);
  });

  test('an empty edit is a 400 "Nothing to change"', async () => {
    for (const body of [{}, undefined, { prodCode: 'AD0002' }]) {
      const r = await editor.patch('/api/products/AD0002', body);
      assert.equal(r.status, 400);
      assert.equal(r.body.message ?? r.body.error, 'Nothing to change.');
    }
  });

  test('a product that does not exist, or a code that is not shaped like one, is a 404', async () => {
    assert.equal((await editor.patch('/api/products/ZZ9999', { unit: 'pc' })).status, 404);
    assert.equal((await editor.patch('/api/products/nope', { unit: 'pc' })).status, 404);
  });

  test('a deleted (Inactive) product cannot be edited until it is restored (409)', async () => {
    await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = 'AD0002'`);
    const was = await row('AD0002');
    const r = await editor.patch('/api/products/AD0002', { unit: 'ltr' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRODUCT_INACTIVE');
    assert.deepEqual(await row('AD0002'), was);
  });

  test('two people editing the same product at once both succeed, one after the other', async () => {
    const { c: second } = await userWith('e2@x.co', 'PRODUCT_EDIT');
    const [a, b] = await Promise.all([
      editor.patch('/api/products/AD0002', { description: 'From editor one' }),
      second.patch('/api/products/AD0002', { unit: 'ltr' }),
    ]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    const now = await row('AD0002');
    assert.equal(now.description, 'From editor one');
    assert.equal(now.unit, 'ltr');
  });
});

describe('S2-DEV-05 get one product (fills the edit form)', () => {
  test('needs a login and at least one product-module right', async () => {
    assert.equal((await anon().get('/api/products/AD0002')).status, 401);
    await seedUser({ email: 'u@x.co', role: 'user' });
    assert.equal((await (await as('u@x.co')).get('/api/products/AD0002')).status, 403);
    const { c } = await userWith('p@x.co', 'PRICE_ADD');
    assert.equal((await c.get('/api/products/AD0002')).status, 200);
  });

  test('returns the product, deleted ones too (with their status)', async () => {
    const { c } = await userWith('p@x.co', 'PRODUCT_EDIT');
    await db.query(`UPDATE product SET deleted_at = now() WHERE prodcode = 'AD0002'`);
    const r = await c.get('/api/products/ad0002');
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body.product), ['prodCode', 'description', 'unit', 'status', 'currentPrice']);
    assert.equal(r.body.product.status, 'Inactive');
  });

  test('an unknown or malformed code is a 404', async () => {
    const { c } = await userWith('p@x.co', 'PRODUCT_EDIT');
    assert.equal((await c.get('/api/products/ZZ9999')).status, 404);
    assert.equal((await c.get('/api/products/nope')).status, 404);
  });
});

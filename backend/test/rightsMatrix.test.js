import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, resetDb, loadBusinessTables, seedUser, client, db } from './helpers/setup.js';
import customerRouter from '../src/routes/customer.routes.js';
import productRouter from '../src/routes/product.routes.js';

// S2-DEV-08: one table that says, for EVERY route of the Customer and Product modules, which
// rights open it. The tests below then try every right of both modules against every route, so a
// route that is too open, too closed or forgotten fails here.

const CUSTOMER = ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE'];
const PRODUCT = ['PRODUCT_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRICE_ADD', 'PRICE_EDIT', 'PRICE_DELETE'];
const VIEW_CUSTOMER = CUSTOMER; // any one customer right opens the screen
const VIEW_PRODUCT = PRODUCT;   // any one product-module right (products or prices) opens it

// Requests are harmless on purpose: unknown records or empty forms, so nothing is ever changed.
const ROUTES = [
  { name: 'list customers',        method: 'get',    url: '/api/customers',                    allowed: VIEW_CUSTOMER },
  { name: 'next customer number',  method: 'get',    url: '/api/customers/next-number',        allowed: ['CUSTOMER_ADD'] },
  { name: 'add customer',          method: 'post',   url: '/api/customers',                    allowed: ['CUSTOMER_ADD'] },
  { name: 'view customer',         method: 'get',    url: '/api/customers/C9999',              allowed: VIEW_CUSTOMER },
  { name: 'edit customer',         method: 'patch',  url: '/api/customers/C9999',              allowed: ['CUSTOMER_EDIT'] },
  { name: 'delete customer',       method: 'delete', url: '/api/customers/C9999',              allowed: ['CUSTOMER_DELETE'] },
  { name: 'restore customer',      method: 'patch',  url: '/api/customers/C9999/restore',      allowed: ['CUSTOMER_DELETE'] },
  { name: 'list products',         method: 'get',    url: '/api/products',                     allowed: VIEW_PRODUCT },
  { name: 'add product',           method: 'post',   url: '/api/products',                     allowed: ['PRODUCT_ADD'] },
  { name: 'view product',          method: 'get',    url: '/api/products/ZZ9999',              allowed: VIEW_PRODUCT },
  { name: 'edit product',          method: 'patch',  url: '/api/products/ZZ9999',              allowed: ['PRODUCT_EDIT'] },
  { name: 'delete product',        method: 'delete', url: '/api/products/ZZ9999',              allowed: ['PRODUCT_DELETE'] },
  { name: 'restore product',       method: 'patch',  url: '/api/products/ZZ9999/restore',      allowed: ['PRODUCT_DELETE'] },
  { name: 'list prices',           method: 'get',    url: '/api/products/ZZ9999/prices',       allowed: VIEW_PRODUCT },
  { name: 'add price',             method: 'post',   url: '/api/products/ZZ9999/prices',       allowed: ['PRICE_ADD'] },
  { name: 'edit price',            method: 'patch',  url: '/api/products/ZZ9999/prices/2026-01-01',  allowed: ['PRICE_EDIT'] },
  { name: 'delete price',          method: 'delete', url: '/api/products/ZZ9999/prices/2026-01-01',  allowed: ['PRICE_DELETE'] },
];

let ctx;
const users = new Map(); // right code (or 'none' / 'other' / 'superadmin' / 'admin') -> logged-in client

async function login(email) {
  const c = client(ctx.base);
  const r = await c.login(email);
  assert.equal(r.status, 200, `${email}: ${JSON.stringify(r.body)}`);
  return c;
}

before(async () => {
  ctx = await startApp();
  await resetDb();
  await loadBusinessTables();
  const make = async (key, role, rightCodes) => {
    const email = `${key.toLowerCase()}@matrix.co`;
    const id = await seedUser({ email, role });
    for (const code of rightCodes) {
      await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code=$2`, [id, code]);
    }
    users.set(key, await login(email));
  };
  for (const code of [...CUSTOMER, ...PRODUCT]) await make(code, 'user', [code]);
  await make('none', 'user', []);
  await make('other', 'user', ['SALES_ADD', 'EMPLOYEE_ADD'].filter(Boolean)); // rights of other modules only
  await make('admin', 'admin', []);
  await make('superadmin', 'superadmin', []);
});
after(() => { ctx?.server.close(); });

const send = (c, route) => c[route.method](route.url, route.method === 'get' || route.method === 'delete' ? undefined : {});

describe('S2-DEV-08 rights matrix: every route, every right', () => {
  test('the rights used by this table really exist in the database', async () => {
    const { rows } = await db.query(`SELECT right_code FROM rights`);
    const known = new Set(rows.map((r) => r.right_code));
    for (const code of [...CUSTOMER, ...PRODUCT]) assert.ok(known.has(code), code);
    // and the "other" user really holds rights of another module (otherwise that row proves nothing)
    const held = (await db.query(`SELECT count(*) n FROM user_permission up JOIN app_user u USING (user_id) WHERE u.email='other@matrix.co'`)).rows[0].n;
    assert.ok(Number(held) >= 1);
  });

  test('without a login every route says 401', async () => {
    const anon = client(ctx.base);
    for (const route of ROUTES) assert.equal((await send(anon, route)).status, 401, route.name);
  });

  for (const route of ROUTES) {
    describe(`${route.name} (${route.method.toUpperCase()} ${route.url})`, () => {
      for (const code of [...CUSTOMER, ...PRODUCT]) {
        const shouldPass = route.allowed.includes(code);
        test(`${code} alone -> ${shouldPass ? 'allowed' : '403'}`, async () => {
          const { status, body } = await send(users.get(code), route);
          if (shouldPass) assert.ok(status !== 403 && status !== 401, `got ${status} ${JSON.stringify(body)}`);
          else {
            assert.equal(status, 403, JSON.stringify(body));
            assert.equal(body.code, 'FORBIDDEN');
          }
        });
      }
      test('no rights at all -> 403', async () => assert.equal((await send(users.get('none'), route)).status, 403));
      test('rights of other modules only -> 403', async () => assert.equal((await send(users.get('other'), route)).status, 403));
      test('admin with no module rights -> 403 (being admin is not a module right)', async () => assert.equal((await send(users.get('admin'), route)).status, 403));
      test('superadmin -> allowed', async () => {
        const { status } = await send(users.get('superadmin'), route);
        assert.ok(status !== 403 && status !== 401, `got ${status}`);
      });
    });
  }
});

describe('S2-DEV-08 rights matrix: nothing is left unguarded', () => {
  // Walks the real Express routers. A new route added later without requirePermission fails here
  // even if nobody remembers to add it to the table above.
  function routesOf(router) {
    return router.stack.filter((layer) => layer.route).map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]),
      handlers: layer.route.stack.map((h) => h.name),
    }));
  }

  for (const [label, router] of [['customer', customerRouter], ['product', productRouter]]) {
    test(`every ${label} route has a requirePermission check`, () => {
      const found = routesOf(router);
      assert.ok(found.length >= 7);
      for (const r of found) assert.ok(r.handlers.includes('checkPermission'), `${r.methods} ${r.path} has no permission check`);
    });
    test(`the ${label} router asks for a login before anything else`, () => {
      assert.equal(router.stack[0].name, 'requireAuth');
    });
  }

  test('the table above lists every route of both routers (method + path shape)', () => {
    const shape = (url) => url.replace(/^\/api\/(customers|products)/, '').replace(/C9999|ZZ9999/, ':id').replace(/2026-01-01/, ':date');
    const tableKeys = new Set(ROUTES.map((r) => `${r.method.toUpperCase()} ${shape(r.url)}`));
    for (const router of [customerRouter, productRouter]) {
      for (const r of routesOf(router)) {
        for (const method of r.methods) {
          const path = r.path === '/' ? '' : r.path.replace(/:prodCode|:custNo/, ':id').replace(/:effDate/, ':date');
          const key = `${method.toUpperCase()} ${path}`;
          assert.ok(tableKeys.has(key), `missing in table: ${key}`);
        }
      }
    }
  });

  test('a right taken away stops working on the next request, for every action', async () => {
    const id = await seedUser({ email: 'rm@matrix.co', role: 'user' });
    const codes = ['CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE', 'PRODUCT_ADD', 'PRICE_EDIT'];
    for (const code of codes) await db.query(`INSERT INTO user_permission (user_id, right_id, stamp) SELECT $1, right_id, 'test' FROM rights WHERE right_code=$2`, [id, code]);
    const c = await login('rm@matrix.co');
    const probes = ROUTES.filter((r) => r.allowed.some((a) => codes.includes(a)) && r.allowed.length === 1);
    for (const r of probes) assert.notEqual((await send(c, r)).status, 403, `${r.name} before`);
    await db.query(`UPDATE user_permission SET status='Inactive', deleted_at=now() WHERE user_id=$1`, [id]);
    for (const r of ROUTES) assert.equal((await send(c, r)).status, 403, `${r.name} after`);
  });
});

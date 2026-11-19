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
const count = async () => Number((await db.query('SELECT count(*) AS n FROM customer')).rows[0].n);
const row = async (custNo) => (await db.query('SELECT custno, custname, address, payterm, deleted_at FROM customer WHERE custno = $1', [custNo])).rows[0];
const audit = async (custNo) => (await db.query(`SELECT action, action_by FROM audit_log WHERE table_name = 'customer' AND record_key = $1 ORDER BY audit_id`, [custNo])).rows;

const good = { custName: 'Acme Trading', address: '12 Pine St, Reno NV 89501', payTerm: '30D' };

describe('S2-DEV-02 add customer: permission check', () => {
  test('needs a login', async () => {
    assert.equal((await anon().post('/api/customers', good)).status, 401);
  });

  test('a user with no rights is refused (403) and nothing is saved', async () => {
    await seedUser({ email: 'u@x.co', role: 'user' });
    const before = await count();
    assert.equal((await (await as('u@x.co')).post('/api/customers', good)).status, 403);
    assert.equal(await count(), before);
  });

  test('Edit and Delete rights are not enough to add (403); Add is', async () => {
    const { c: editor } = await userWith('e@x.co', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE');
    assert.equal((await editor.post('/api/customers', good)).status, 403);
    const { c: adder } = await userWith('a@x.co', 'CUSTOMER_ADD');
    assert.equal((await adder.post('/api/customers', good)).status, 201);
  });

  test('an admin with no customer rights is refused (403)', async () => {
    await seedUser({ email: 'ad@x.co', role: 'admin' });
    assert.equal((await (await as('ad@x.co')).post('/api/customers', good)).status, 403);
  });

  test('the superadmin can add', async () => {
    await seedUser({ email: 'sa@x.co', role: 'superadmin' });
    assert.equal((await (await as('sa@x.co')).post('/api/customers', good)).status, 201);
  });

  test('the next-number preview also needs the Add right', async () => {
    const { c: editor } = await userWith('e@x.co', 'CUSTOMER_EDIT');
    assert.equal((await editor.get('/api/customers/next-number')).status, 403);
    const { c: adder } = await userWith('a@x.co', 'CUSTOMER_ADD');
    assert.equal((await adder.get('/api/customers/next-number')).status, 200);
  });
});

describe('S2-DEV-02 add customer: the form', () => {
  let c;
  beforeEach(async () => { c = (await userWith('a@x.co', 'CUSTOMER_ADD')).c; });

  test('saves the customer, gives the next free number and answers 201', async () => {
    const before = await count();
    const r = await c.post('/api/customers', good);
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.customer, { custNo: 'C0083', ...good, status: 'Active' });
    assert.equal(await count(), before + 1);
    assert.deepEqual(await row('C0083'), { custno: 'C0083', custname: good.custName, address: good.address, payterm: '30D', deleted_at: null });
  });

  test('numbers keep counting up and the new customer shows in the list', async () => {
    const a = await c.post('/api/customers', good);
    const b = await c.post('/api/customers', { ...good, custName: 'Second Co' });
    assert.deepEqual([a.body.customer.custNo, b.body.customer.custNo], ['C0083', 'C0084']);
    const list = await c.get('/api/customers?search=Second%20Co');
    assert.equal(list.body.total, 1);
    assert.equal(list.body.customers[0].custNo, 'C0084');
  });

  test('a deleted customer keeps its number, so the new one never reuses it', async () => {
    await db.query(`UPDATE customer SET deleted_at = now() WHERE custno = 'C0082'`);
    assert.equal((await c.post('/api/customers', good)).body.customer.custNo, 'C0083');
  });

  test('the preview shows the number the next save will get', async () => {
    assert.deepEqual((await c.get('/api/customers/next-number')).body, { ok: true, custNo: 'C0083' });
    await c.post('/api/customers', good);
    assert.equal((await c.get('/api/customers/next-number')).body.custNo, 'C0084');
  });

  test('ten people adding at the same moment all get different numbers', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => c.post('/api/customers', { ...good, custName: `Parallel ${i}` })),
    );
    assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.body)));
    const numbers = results.map((r) => r.body.customer.custNo);
    assert.equal(new Set(numbers).size, 10);
  });

  test('when C9999 is taken the answer is a clear 409', async () => {
    await db.query(`INSERT INTO customer (custno, custname, address, payterm) VALUES ('C9999', 'Last', 'Somewhere', 'COD')`);
    const r = await c.post('/api/customers', good);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'NUMBERS_USED_UP');
    assert.equal((await c.get('/api/customers/next-number')).status, 409);
  });

  test('spaces around the values are trimmed, and pay terms can be typed in lower case', async () => {
    const r = await c.post('/api/customers', { custName: '  Padded Co  ', address: '  1 Main St  ', payTerm: ' cod ' });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.customer, { custNo: 'C0083', custName: 'Padded Co', address: '1 Main St', payTerm: 'COD', status: 'Active' });
  });

  test('a number or status sent in the body is ignored, the server decides', async () => {
    const r = await c.post('/api/customers', { ...good, custNo: 'C0001', status: 'Inactive', deleted_at: '2020-01-01' });
    assert.equal(r.status, 201);
    assert.equal(r.body.customer.custNo, 'C0083');
    assert.equal(r.body.customer.status, 'Active');
    assert.equal((await row('C0001')).custname, 'Globus Medical, Inc'); // the real C0001 is untouched
  });

  test('the longest allowed values fit (20 and 50 characters)', async () => {
    const r = await c.post('/api/customers', { custName: 'N'.repeat(20), address: 'A'.repeat(50), payTerm: '45D' });
    assert.equal(r.status, 201);
  });

  test('emoji count as one character each, like the database counts them', async () => {
    const r = await c.post('/api/customers', { custName: '🙂'.repeat(20), address: 'x', payTerm: 'COD' });
    assert.equal(r.status, 201);
    assert.equal((await c.post('/api/customers', { custName: '🙂'.repeat(21), address: 'x', payTerm: 'COD' })).status, 400);
  });

  test('every problem is reported at once, per field, and nothing is saved', async () => {
    const before = await count();
    const r = await c.post('/api/customers', { custName: '', address: '   ', payTerm: '60D' });
    assert.equal(r.status, 400);
    assert.match(r.body.errors.custName, /required/);
    assert.match(r.body.errors.address, /required/);
    assert.match(r.body.errors.payTerm, /COD, 30D, 45D/);
    assert.equal(await count(), before);
  });

  test('a missing body and missing fields are all "required"', async () => {
    const r = await c.post('/api/customers', {});
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), ['address', 'custName', 'payTerm']);
  });

  test('too long values are refused with the limit in the message', async () => {
    const r = await c.post('/api/customers', { custName: 'N'.repeat(21), address: 'A'.repeat(51), payTerm: 'COD' });
    assert.equal(r.status, 400);
    assert.match(r.body.errors.custName, /at most 20/);
    assert.match(r.body.errors.address, /at most 50/);
  });

  test('values that are not text (numbers, lists, objects) are refused, not turned into "[object Object]"', async () => {
    for (const bad of [123, ['x'], { a: 1 }, null, true]) {
      const r = await c.post('/api/customers', { custName: bad, address: bad, payTerm: bad });
      assert.equal(r.status, 400, JSON.stringify(bad));
    }
  });

  test('line breaks and other control characters are refused', async () => {
    const r = await c.post('/api/customers', { ...good, custName: 'Two\nLines', address: 'Tab\there' });
    assert.equal(r.status, 400);
    assert.match(r.body.errors.custName, /not allowed/);
    assert.match(r.body.errors.address, /not allowed/);
  });

  test('SQL typed into the form is stored as plain text and harms nothing', async () => {
    const r = await c.post('/api/customers', { custName: "'; DROP TABLE x;--", address: "' OR '1'='1", payTerm: 'COD' });
    assert.equal(r.status, 201);
    assert.equal(r.body.customer.custName, "'; DROP TABLE x;--");
    assert.ok((await count()) > 82);
  });

  test('the audit log records who added it', async () => {
    const r = await c.post('/api/customers', good);
    assert.deepEqual(await audit(r.body.customer.custNo), [{ action: 'ADD', action_by: 'a@x.co' }]);
  });
});

describe('S2-DEV-02 edit customer', () => {
  test('needs a login', async () => {
    assert.equal((await anon().patch('/api/customers/C0001', { address: 'x' })).status, 401);
  });

  test('Add and Delete rights are not enough to edit (403); Edit is. Nothing changes on a refusal', async () => {
    const { c: adder } = await userWith('a@x.co', 'CUSTOMER_ADD', 'CUSTOMER_DELETE');
    assert.equal((await adder.patch('/api/customers/C0001', { custName: 'Hacked' })).status, 403);
    assert.equal((await row('C0001')).custname, 'Globus Medical, Inc');
    const { c: editor } = await userWith('e@x.co', 'CUSTOMER_EDIT');
    assert.equal((await editor.patch('/api/customers/C0001', { custName: 'Globus Medical' })).status, 200);
  });

  test('taking the Edit right away stops editing on the very next request', async () => {
    const { id, c } = await userWith('t@x.co', 'CUSTOMER_EDIT');
    assert.equal((await c.patch('/api/customers/C0001', { address: 'One' })).status, 200);
    await db.query('DELETE FROM user_permission WHERE user_id = $1', [id]);
    assert.equal((await c.patch('/api/customers/C0001', { address: 'Two' })).status, 403);
  });

  describe('with the Edit right', () => {
    let c;
    beforeEach(async () => { c = (await userWith('e@x.co', 'CUSTOMER_EDIT')).c; });

    test('changes only what was sent and returns the saved customer', async () => {
      const r = await c.patch('/api/customers/C0001', { address: '1 New Road, Reno NV' });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.customer, {
        custNo: 'C0001', custName: 'Globus Medical, Inc', address: '1 New Road, Reno NV', payTerm: '30D', status: 'Active',
      });
      assert.equal((await row('C0001')).address, '1 New Road, Reno NV');
    });

    test('can change all three fields at once, and the number in the web address can be lower case', async () => {
      const r = await c.patch('/api/customers/c0002', { custName: 'RF Industries', address: 'Elsewhere 1', payTerm: 'cod' });
      assert.equal(r.status, 200);
      assert.deepEqual(await row('C0002'), { custno: 'C0002', custname: 'RF Industries', address: 'Elsewhere 1', payterm: 'COD', deleted_at: null });
    });

    test('the customer number cannot be changed through the body', async () => {
      const r = await c.patch('/api/customers/C0001', { custNo: 'C0999', custName: 'Renamed' });
      assert.equal(r.status, 200);
      assert.equal(r.body.customer.custNo, 'C0001');
      assert.equal(await row('C0999'), undefined);
    });

    test('status cannot be changed through the body either (restore and delete are their own steps)', async () => {
      await c.patch('/api/customers/C0001', { status: 'Inactive', deleted_at: '2020-01-01', custName: 'Still Active' });
      assert.equal((await row('C0001')).deleted_at, null);
    });

    test('sending the same values changes nothing and writes no audit row', async () => {
      const r = await c.patch('/api/customers/C0001', { custName: 'Globus Medical, Inc', payTerm: '30D' });
      assert.equal(r.status, 200);
      assert.deepEqual(await audit('C0001'), []);
    });

    test('a real change is written to the audit log with the editor', async () => {
      await c.patch('/api/customers/C0001', { address: 'Audit Lane 5' });
      assert.deepEqual(await audit('C0001'), [{ action: 'EDIT', action_by: 'e@x.co' }]);
    });

    test('bad values give field messages and leave the customer alone', async () => {
      const r = await c.patch('/api/customers/C0001', { custName: 'N'.repeat(21), address: '', payTerm: 'NET' });
      assert.equal(r.status, 400);
      assert.match(r.body.errors.custName, /at most 20/);
      assert.match(r.body.errors.address, /required/);
      assert.match(r.body.errors.payTerm, /COD, 30D, 45D/);
      assert.equal((await row('C0001')).custname, 'Globus Medical, Inc');
    });

    test('an empty edit is a 400 "Nothing to change"', async () => {
      const r = await c.patch('/api/customers/C0001', {});
      assert.equal(r.status, 400);
      assert.equal(r.body.message, 'Nothing to change.');
      assert.equal((await c.patch('/api/customers/C0001', { unrelated: 'x' })).status, 400);
    });

    test('a customer that does not exist, or a number that is not shaped like one, is a 404', async () => {
      for (const id of ['C9000', 'X0001', 'C1', 'abc', '1', 'C00001', '%27']) {
        assert.equal((await c.patch(`/api/customers/${id}`, { address: 'x' })).status, 404, id);
      }
    });

    test('a deleted (Inactive) customer cannot be edited until it is restored (409)', async () => {
      await db.query(`UPDATE customer SET deleted_at = now() WHERE custno = 'C0004'`);
      const r = await c.patch('/api/customers/C0004', { address: 'x' });
      assert.equal(r.status, 409);
      assert.equal(r.body.code, 'CUSTOMER_INACTIVE');
      assert.equal((await row('C0004')).address, '1000 So Fremont Ave, Suite 225 Alhambara CA 91303');
    });

    test('two people editing the same customer at once both succeed, one after the other', async () => {
      const { c: other } = await userWith('e2@x.co', 'CUSTOMER_EDIT');
      const [a, b] = await Promise.all([
        c.patch('/api/customers/C0001', { custName: 'Name One' }),
        other.patch('/api/customers/C0001', { address: 'Address Two' }),
      ]);
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      const saved = await row('C0001');
      assert.equal(saved.custname, 'Name One');   // neither edit wipes the other
      assert.equal(saved.address, 'Address Two');
    });
  });
});

describe('S2-DEV-02 read one customer (fills the edit form)', () => {
  test('needs a login and at least one customer right', async () => {
    assert.equal((await anon().get('/api/customers/C0001')).status, 401);
    await seedUser({ email: 'n@x.co', role: 'user' });
    assert.equal((await (await as('n@x.co')).get('/api/customers/C0001')).status, 403);
  });

  test('returns the customer, deleted ones too (with their status)', async () => {
    const { c } = await userWith('d@x.co', 'CUSTOMER_DELETE');
    const r = await c.get('/api/customers/c0001');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.customer, {
      custNo: 'C0001', custName: 'Globus Medical, Inc', address: '2560 Gen Armistead Ave Audubon CA 94031', payTerm: '30D', status: 'Active',
    });
    await db.query(`UPDATE customer SET deleted_at = now() WHERE custno = 'C0004'`);
    assert.equal((await c.get('/api/customers/C0004')).body.customer.status, 'Inactive');
  });

  test('an unknown or malformed number is a 404', async () => {
    const { c } = await userWith('d@x.co', 'CUSTOMER_ADD');
    for (const id of ['C9000', 'nope', 'C1']) assert.equal((await c.get(`/api/customers/${id}`)).status, 404, id);
  });

  test('"next-number" is not mistaken for a customer number', async () => {
    const { c } = await userWith('a@x.co', 'CUSTOMER_ADD');
    const r = await c.get('/api/customers/next-number');
    assert.equal(r.status, 200);
    assert.ok(r.body.custNo);
  });
});

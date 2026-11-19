import { pool } from '../config/db.js';

// S2-DEV-01: reads Karla's customer table (custno, custname, address, payterm).
// "Active" or "Inactive" comes from her soft-delete column deleted_at
// (20261115131700_customer_product_active_views.sql): empty = active, a date = deleted.
// Every value goes in through a $1, $2 ... placeholder, never glued into the SQL text.
const STATUS_SQL = {
  active: 'deleted_at IS NULL',
  inactive: 'deleted_at IS NOT NULL',
  all: 'TRUE',
};

function toCustomer(row) {
  return {
    custNo: row.custno,
    custName: row.custname,
    address: row.address,
    payTerm: row.payterm, // COD, 30D or 45D
    status: row.deleted_at ? 'Inactive' : 'Active',
  };
}

// S2-DEV-02: one customer by number (null when there is none), deleted ones included.
// lock = true keeps other writers waiting until this transaction ends (used before an edit).
export async function findByNo(custNo, db = pool, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT custno, custname, address, payterm, deleted_at
       FROM customer
      WHERE custno = $1
      ${lock ? 'FOR UPDATE' : ''}`,
    [custNo],
  );
  return rows[0] ? toCustomer(rows[0]) : null;
}

// S2-DEV-02: the next free number, e.g. C0083. Only counts numbers shaped like C + 4 digits.
// Deleted customers still hold their number, so they are counted too.
export async function nextNumber(db = pool) {
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(substr(custno, 2)::int), 0) + 1 AS next
       FROM customer
      WHERE custno ~ '^C[0-9]{4}$'`,
  );
  return Number(rows[0].next);
}

// Makes two people adding a customer at the same moment wait for each other, so they cannot
// both be handed the same number. The lock is released by itself when the transaction ends.
export async function lockNumbering(db) {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('customer_number'))`);
}

export async function insert(db, { custNo, custName, address, payTerm }) {
  const { rows } = await db.query(
    `INSERT INTO customer (custno, custname, address, payterm)
     VALUES ($1, $2, $3, $4)
     RETURNING custno, custname, address, payterm, deleted_at`,
    [custNo, custName, address, payTerm],
  );
  return toCustomer(rows[0]);
}

// Changes only the fields given: { custName, address, payTerm }
export async function update(db, custNo, changes) {
  const columns = { custName: 'custname', address: 'address', payTerm: 'payterm' };
  const sets = [];
  const params = [custNo];
  for (const [field, column] of Object.entries(columns)) {
    if (changes[field] === undefined) continue;
    params.push(changes[field]);
    sets.push(`${column} = $${params.length}`);
  }
  const { rows } = await db.query(
    `UPDATE customer SET ${sets.join(', ')}
      WHERE custno = $1
      RETURNING custno, custname, address, payterm, deleted_at`,
    params,
  );
  return toCustomer(rows[0]);
}

// Search + filter + paging for the customer list.
//   search:  words to look for in the customer number, name or address (already escaped for LIKE)
//   payTerm: only customers with this pay term (COD, 30D or 45D)
//   status:  'active', 'inactive' or 'all'
// Also returns counts = how many customers are active / inactive / in total for the SAME
// search and pay terms, so the screen can show "Active (9)  Inactive (1)  All (10)".
export async function list({ search, payTerm, status, limit, offset }, db = pool) {
  const where = [];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`; // the placeholder for the value we just added
  };

  if (search) {
    const like = add(`%${search}%`);
    where.push(`(custno ILIKE ${like} OR custname ILIKE ${like} OR address ILIKE ${like})`);
  }
  if (payTerm) where.push(`payterm = ${add(payTerm)}`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // One query for the three tab numbers (before the status filter is applied)
  const { rows: counted } = await db.query(
    `SELECT count(*) FILTER (WHERE deleted_at IS NULL)     AS active,
            count(*) FILTER (WHERE deleted_at IS NOT NULL) AS inactive,
            count(*)                                       AS everyone
       FROM customer ${whereSql}`,
    params,
  );
  const counts = {
    active: Number(counted[0].active),
    inactive: Number(counted[0].inactive),
    all: Number(counted[0].everyone),
  };
  const total = counts[status];
  if (total === 0 || offset >= total) return { customers: [], total, counts };

  const statusSql = STATUS_SQL[status];
  const filters = [...where, statusSql].join(' AND ');
  const limitSql = add(limit);
  const offsetSql = add(offset);
  const { rows } = await db.query(
    `SELECT custno, custname, address, payterm, deleted_at
       FROM customer
      WHERE ${filters}
      ORDER BY custno
      LIMIT ${limitSql} OFFSET ${offsetSql}`,
    params,
  );
  return { customers: rows.map(toCustomer), total, counts };
}

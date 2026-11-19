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

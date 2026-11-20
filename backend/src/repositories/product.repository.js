import { pool } from '../config/db.js';

// S2-DEV-04: reads Karla's product table (prodcode, description, unit).
// "Active" or "Inactive" comes from her soft-delete column deleted_at
// (20261115131700_customer_product_active_views.sql): empty = active, a date = deleted.
// Every value goes in through a $1, $2 ... placeholder, never glued into the SQL text.
const STATUS_SQL = {
  active: 'deleted_at IS NULL',
  inactive: 'deleted_at IS NOT NULL',
  all: 'TRUE',
};

function toProduct(row) {
  return {
    prodCode: row.prodcode,
    description: (row.description ?? '').trim(), // the sample data has stray spaces at the end
    unit: row.unit, // pc, ea, mtr, pkg or ltr
    status: row.deleted_at ? 'Inactive' : 'Active',
  };
}

// S2-DEV-05: one product by code (null when there is none), deleted ones included.
// lock = true keeps other writers waiting until this transaction ends (used before an edit).
export async function findByCode(prodCode, db = pool, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT prodcode, description, unit, deleted_at
       FROM product
      WHERE prodcode = $1
      ${lock ? 'FOR UPDATE' : ''}`,
    [prodCode],
  );
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function insert(db, { prodCode, description, unit }) {
  const { rows } = await db.query(
    `INSERT INTO product (prodcode, description, unit)
     VALUES ($1, $2, $3)
     RETURNING prodcode, description, unit, deleted_at`,
    [prodCode, description, unit],
  );
  return toProduct(rows[0]);
}

// Changes only the fields given: { description, unit }. The product code never changes: sales and
// price history point at it.
export async function update(db, prodCode, changes) {
  const columns = { description: 'description', unit: 'unit' };
  const sets = [];
  const params = [prodCode];
  for (const [field, column] of Object.entries(columns)) {
    if (changes[field] === undefined) continue;
    params.push(changes[field]);
    sets.push(`${column} = $${params.length}`);
  }
  const { rows } = await db.query(
    `UPDATE product SET ${sets.join(', ')}
      WHERE prodcode = $1
      RETURNING prodcode, description, unit, deleted_at`,
    params,
  );
  return toProduct(rows[0]);
}

// Search + filter + paging for the product list.
//   search: words to look for in the product code or description (already escaped for LIKE)
//   unit:   only products sold in this unit (pc, ea, mtr, pkg or ltr)
//   status: 'active', 'inactive' or 'all'
// Also returns counts = how many products are active / inactive / in total for the SAME
// search and unit, so the screen can show "Active (56)  Inactive (1)  All (57)".
export async function list({ search, unit, status, limit, offset }, db = pool) {
  const where = [];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`; // the placeholder for the value we just added
  };

  if (search) {
    const like = add(`%${search}%`);
    where.push(`(prodcode ILIKE ${like} OR description ILIKE ${like})`);
  }
  if (unit) where.push(`unit = ${add(unit)}`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // One query for the three tab numbers (before the status filter is applied)
  const { rows: counted } = await db.query(
    `SELECT count(*) FILTER (WHERE deleted_at IS NULL)     AS active,
            count(*) FILTER (WHERE deleted_at IS NOT NULL) AS inactive,
            count(*)                                       AS everyone
       FROM product ${whereSql}`,
    params,
  );
  const counts = {
    active: Number(counted[0].active),
    inactive: Number(counted[0].inactive),
    all: Number(counted[0].everyone),
  };
  const total = counts[status];
  if (total === 0 || offset >= total) return { products: [], total, counts };

  const filters = [...where, STATUS_SQL[status]].join(' AND ');
  const limitSql = add(limit);
  const offsetSql = add(offset);
  const { rows } = await db.query(
    `SELECT prodcode, description, unit, deleted_at
       FROM product
      WHERE ${filters}
      ORDER BY prodcode
      LIMIT ${limitSql} OFFSET ${offsetSql}`,
    params,
  );
  return { products: rows.map(toProduct), total, counts };
}

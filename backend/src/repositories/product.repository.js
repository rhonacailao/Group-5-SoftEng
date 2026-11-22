import { pool } from '../config/db.js';
import { businessTimeZone, todaySql } from '../config/business.js';

// S2-DEV-04: reads Karla's product table (prodcode, description, unit).
// "Active" or "Inactive" comes from her soft-delete column deleted_at
// (20261115131700_customer_product_active_views.sql): empty = active, a date = deleted.
// Every value goes in through a $1, $2 ... placeholder, never glued into the SQL text.
const STATUS_SQL = {
  active: 'deleted_at IS NULL',
  inactive: 'deleted_at IS NOT NULL',
  all: 'TRUE',
};

// S2-DEV-08: joins each product with its current price (the newest price that has already started
// today, in the company time zone). LEFT JOIN, so a product with no price still shows up.
const CURRENT_PRICE_JOIN = (tzPlaceholder) => `
  LEFT JOIN LATERAL (
    SELECT to_char(h.effdate, 'YYYY-MM-DD') AS eff, h.unitprice
      FROM pricehist h
     WHERE h.prodcode = p.prodcode AND h.effdate <= ${todaySql(tzPlaceholder)}
     ORDER BY h.effdate DESC
     LIMIT 1
  ) cp ON TRUE`;

function toProduct(row) {
  return {
    prodCode: row.prodcode,
    description: (row.description ?? '').trim(), // the sample data has stray spaces at the end
    unit: row.unit, // pc, ea, mtr, pkg or ltr
    status: row.deleted_at ? 'Inactive' : 'Active',
    // S2-DEV-08: only the screens that show prices (list and one product) select these columns.
    // currentPrice = the price whose effective date is the latest one that is not in the future;
    // null when the product has no price in effect yet.
    ...('price_eff' in row
      ? {
          currentPrice: row.price_eff === null
            ? null
            : { unitPrice: Number(row.price_value), effectiveDate: row.price_eff },
        }
      : {}),
  };
}

// S2-DEV-05: one product by code (null when there is none), deleted ones included.
// lock = true keeps other writers waiting until this transaction ends (used before an edit).
// withPrice = true also fetches the current price (S2-DEV-08). It cannot be combined with lock.
export async function findByCode(prodCode, db = pool, { lock = false, withPrice = false } = {}) {
  const { rows } = withPrice
    ? await db.query(
        `SELECT p.prodcode, p.description, p.unit, p.deleted_at, cp.eff AS price_eff, cp.unitprice AS price_value
           FROM product p
           ${CURRENT_PRICE_JOIN('$2')}
          WHERE p.prodcode = $1`,
        [prodCode, businessTimeZone()],
      )
    : await db.query(
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

// S2-DEV-06: the records that still point at this product. The design rule (HopeDB_audit.sql,
// "a parent row cannot be soft-deleted while it still has active children") blocks a delete while
// the product has sale lines or price history. Neither table has a soft-delete column here yet,
// so every row counts.
export async function countChildren(db, prodCode) {
  const { rows } = await db.query(
    `SELECT (SELECT count(*) FROM salesdetail WHERE prodcode = $1) AS sale_lines,
            (SELECT count(*) FROM pricehist   WHERE prodcode = $1) AS prices`,
    [prodCode],
  );
  return { saleLines: Number(rows[0].sale_lines), prices: Number(rows[0].prices) };
}

// S2-DEV-06: soft delete = put a date in deleted_at; restore = empty it again. The row is never
// removed, so the product code and everything linked to it stay valid.
export async function setDeleted(db, prodCode, deleted) {
  const { rows } = await db.query(
    `UPDATE product SET deleted_at = ${deleted ? 'now()' : 'NULL'}
      WHERE prodcode = $1
      RETURNING prodcode, description, unit, deleted_at`,
    [prodCode],
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
  const tzSql = add(businessTimeZone());
  const limitSql = add(limit);
  const offsetSql = add(offset);
  const { rows } = await db.query(
    `SELECT p.prodcode, p.description, p.unit, p.deleted_at, cp.eff AS price_eff, cp.unitprice AS price_value
       FROM product p
       ${CURRENT_PRICE_JOIN(tzSql)}
      WHERE ${filters}
      ORDER BY p.prodcode
      LIMIT ${limitSql} OFFSET ${offsetSql}`,
    params,
  );
  return { products: rows.map(toProduct), total, counts };
}

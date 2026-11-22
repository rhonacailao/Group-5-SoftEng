import { pool } from '../config/db.js';

// S2-DEV-07: reads and writes Karla's pricehist table (effdate, prodcode, unitprice).
// A price row is identified by the product code + its effective date (that pair is the primary
// key). The table has no soft-delete column, so deleting a price really removes the row.
// Every value goes in through a $1, $2 ... placeholder, never glued into the SQL text.

// Dates go out as plain text ('2024-03-01') and prices as numbers, exactly what the screen needs
const COLUMNS = `to_char(effdate, 'YYYY-MM-DD') AS eff, prodcode, unitprice`;

function toPrice(row) {
  return {
    prodCode: row.prodcode,
    effectiveDate: row.eff,
    unitPrice: Number(row.unitprice), // DECIMAL(10,2) comes from pg as text; two decimals fit a number exactly
  };
}

// Newest effective date first, so the top row is the latest price
export async function listByProduct(prodCode, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM pricehist WHERE prodcode = $1 ORDER BY effdate DESC`,
    [prodCode],
  );
  return rows.map(toPrice);
}

// lock = true keeps other writers waiting until this transaction ends (used before an edit/delete)
export async function findOne(db, prodCode, effDate, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM pricehist WHERE prodcode = $1 AND effdate = $2::date ${lock ? 'FOR UPDATE' : ''}`,
    [prodCode, effDate],
  );
  return rows[0] ? toPrice(rows[0]) : null;
}

export async function insert(db, { prodCode, effectiveDate, unitPrice }) {
  const { rows } = await db.query(
    `INSERT INTO pricehist (prodcode, effdate, unitprice)
     VALUES ($1, $2::date, $3::numeric)
     RETURNING ${COLUMNS}`,
    [prodCode, effectiveDate, unitPrice],
  );
  return toPrice(rows[0]);
}

// Changes the price row found by (prodCode, current date). Send { effectiveDate, unitPrice } with
// the final values of BOTH fields.
export async function update(db, prodCode, currentDate, { effectiveDate, unitPrice }) {
  const { rows } = await db.query(
    `UPDATE pricehist SET effdate = $3::date, unitprice = $4::numeric
      WHERE prodcode = $1 AND effdate = $2::date
      RETURNING ${COLUMNS}`,
    [prodCode, currentDate, effectiveDate, unitPrice],
  );
  return toPrice(rows[0]);
}

export async function remove(db, prodCode, effDate) {
  await db.query(`DELETE FROM pricehist WHERE prodcode = $1 AND effdate = $2::date`, [prodCode, effDate]);
}

// How many sale lines of this product have NO price that was in effect on their sales date.
// Price history is what tells us what a line should have cost, so a delete or date change must
// not leave more such lines than before.
export async function countUnpricedSaleLines(db, prodCode) {
  const { rows } = await db.query(
    `SELECT count(*) AS n
       FROM salesdetail d
       JOIN sales s ON s.transno = d.transno
      WHERE d.prodcode = $1
        AND NOT EXISTS (
              SELECT 1 FROM pricehist p
               WHERE p.prodcode = d.prodcode AND p.effdate <= s.salesdate)`,
    [prodCode],
  );
  return Number(rows[0].n);
}

import { pool } from '../config/db.js';

export async function getProductPriceAsOf(productCode, asOfDate) {
  const code = String(productCode ?? '').trim().toUpperCase();
  const date = String(asOfDate ?? '').trim();
  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (!code || code.length > 6) {
    throw new TypeError('productCode must be 1 to 6 characters');
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new TypeError('asOfDate must be a valid YYYY-MM-DD date');
  }

  const { rows } = await pool.query(
    `SELECT
       prodcode AS "productCode",
       effdate AS "effectiveDate",
       unitprice AS "unitPrice"
     FROM public.pricehist
     WHERE prodcode = $1
       AND effdate <= $2::date
     ORDER BY effdate DESC
     LIMIT 1`,
    [code, date],
  );

  return rows[0] ?? null;
}
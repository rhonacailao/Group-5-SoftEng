import { pool, withTransaction } from '../config/db.js';
import * as products from '../repositories/product.repository.js';
import * as prices from '../repositories/price.repository.js';
import { HttpError } from '../utils/httpError.js';

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

// ---------- S2-DEV-07: price history add, edit and delete ----------
// Routes: /api/products/:prodCode/prices  (see product.routes.js)


const CODE_PATTERN = /^[A-Z]{2}\d{4}$/;
// DECIMAL(10,2): up to 8 digits before the point and 2 after it
const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const MIN_DATE = '1900-01-01'; // plain text dates compare correctly as text
const MAX_DATE = '2100-12-31';

// "2024-03-01" only, and it must be a real calendar day (no 2024-02-30)
function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function parseProdCode(raw) {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(value)) throw new HttpError(404, 'Product not found');
  return value;
}

// A date in the web address that is not a real date is the same as "no such price"
function parseUrlDate(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!isRealDate(value)) throw new HttpError(404, 'Price not found');
  return value;
}

function checkDate(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return { error: 'Effective date is required.' };
  if (!isRealDate(value)) return { error: 'Effective date must be a real date written as YYYY-MM-DD.' };
  if (value < MIN_DATE || value > MAX_DATE) return { error: `Effective date must be between ${MIN_DATE} and ${MAX_DATE}.` };
  return { value };
}

// Accepts 12.5, "12.50" ... but not "abc", "1e3", "-5", 0, Infinity, true, 12.345 or more than 99999999.99
function checkPrice(raw) {
  if (raw === undefined || raw === null || raw === '') return { error: 'Unit price is required.' };
  if (typeof raw !== 'number' && typeof raw !== 'string') return { error: 'Unit price must be a number.' };
  const text = typeof raw === 'number' ? String(raw) : raw.trim();
  if (!PRICE_PATTERN.test(text)) {
    return { error: 'Unit price must be a number with at most 2 decimal places (up to 99999999.99).' };
  }
  if (Number(text) <= 0) return { error: 'Unit price must be greater than zero.' };
  return { value: text };
}

function readFields(body, { creating }) {
  const input = body && typeof body === 'object' ? body : {};
  const checks = { effectiveDate: checkDate, unitPrice: checkPrice };
  const values = {};
  const errors = {};
  for (const [field, check] of Object.entries(checks)) {
    if (!creating && input[field] === undefined) continue;
    const result = check(input[field]);
    if (result.error) errors[field] = result.error;
    else values[field] = result.value;
  }
  if (Object.keys(errors).length > 0) throw new HttpError(400, 'Please check the form.', { errors });
  return values;
}

function dateTaken(prodCode, date) {
  const message = `${prodCode} already has a price starting ${date}. Edit that one or pick another date.`;
  return new HttpError(409, message, { errors: { effectiveDate: message }, code: 'DATE_TAKEN' });
}

// Finds the product (locked until the transaction ends) and makes sure it is still active.
// The lock also keeps a product delete and a price change for the same product in line.
async function lockActiveProduct(db, prodCode) {
  const product = await products.findByCode(prodCode, db, { lock: true });
  if (!product) throw new HttpError(404, 'Product not found');
  if (product.status === 'Inactive') {
    throw new HttpError(409, 'This product was deleted. Restore it before changing its prices.', { code: 'PRODUCT_INACTIVE' });
  }
  return product;
}

// A change that would leave a recorded sale without any price in effect is refused
async function assertSalesStillPriced(db, prodCode, before, action) {
  const after = await prices.countUnpricedSaleLines(db, prodCode);
  if (after > before) {
    throw new HttpError(
      409,
      `This price cannot be ${action}: earlier sales of ${prodCode} would be left without a price. Add an earlier price first.`,
      { code: 'PRICE_NEEDED_BY_SALES' },
    );
  }
}

// GET /api/products/:prodCode/prices : the whole history, newest effective date first
export async function list(rawProdCode) {
  const prodCode = parseProdCode(rawProdCode);
  const product = await products.findByCode(prodCode);
  if (!product) throw new HttpError(404, 'Product not found');
  const history = await prices.listByProduct(prodCode);
  const current = history.find((price) => price.state === 'Current') ?? null; // S2-DEV-08
  return {
    product,
    currentPrice: current && { unitPrice: current.unitPrice, effectiveDate: current.effectiveDate },
    prices: history,
    total: history.length,
  };
}

// POST /api/products/:prodCode/prices   { effectiveDate: '2026-12-01', unitPrice: 120.5 }
// A date in the future is fine: it is a price that starts later.
export async function create(actor, rawProdCode, body) {
  const prodCode = parseProdCode(rawProdCode);
  const fields = readFields(body, { creating: true });
  return withTransaction(actor.email, async (db) => {
    await lockActiveProduct(db, prodCode);
    try {
      return await prices.insert(db, { prodCode, ...fields });
    } catch (err) {
      if (err.code === '23505') throw dateTaken(prodCode, fields.effectiveDate); // same product + same date
      throw err;
    }
  });
}

// PATCH /api/products/:prodCode/prices/:effDate   send only what changed: effectiveDate, unitPrice
export async function update(actor, rawProdCode, rawEffDate, body) {
  const prodCode = parseProdCode(rawProdCode);
  const effDate = parseUrlDate(rawEffDate);
  const fields = readFields(body, { creating: false });
  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, 'Nothing to change.', { errors: { form: 'Send at least one of: effectiveDate, unitPrice.' } });
  }

  return withTransaction(actor.email, async (db) => {
    await lockActiveProduct(db, prodCode);
    const current = await prices.findOne(db, prodCode, effDate, { lock: true });
    if (!current) throw new HttpError(404, 'Price not found');

    const next = {
      effectiveDate: fields.effectiveDate ?? current.effectiveDate,
      unitPrice: fields.unitPrice ?? String(current.unitPrice),
    };
    // Leave the row (and the audit log) alone when nothing really changed
    if (next.effectiveDate === current.effectiveDate && Number(next.unitPrice) === current.unitPrice) return current;

    const movesDate = next.effectiveDate !== current.effectiveDate;
    const unpricedBefore = movesDate ? await prices.countUnpricedSaleLines(db, prodCode) : 0;
    let saved;
    try {
      saved = await prices.update(db, prodCode, effDate, next);
    } catch (err) {
      if (err.code === '23505') throw dateTaken(prodCode, next.effectiveDate);
      throw err;
    }
    if (movesDate) await assertSalesStillPriced(db, prodCode, unpricedBefore, 'moved to that date');
    return saved;
  });
}

// DELETE /api/products/:prodCode/prices/:effDate : really removes the row (pricehist has no soft delete)
export async function remove(actor, rawProdCode, rawEffDate) {
  const prodCode = parseProdCode(rawProdCode);
  const effDate = parseUrlDate(rawEffDate);

  return withTransaction(actor.email, async (db) => {
    await lockActiveProduct(db, prodCode);
    const current = await prices.findOne(db, prodCode, effDate, { lock: true });
    if (!current) throw new HttpError(404, 'Price not found');

    const unpricedBefore = await prices.countUnpricedSaleLines(db, prodCode);
    await prices.remove(db, prodCode, effDate);
    await assertSalesStillPriced(db, prodCode, unpricedBefore, 'deleted');
    return current;
  });
}

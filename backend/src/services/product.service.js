import { withTransaction } from '../config/db.js';
import * as products from '../repositories/product.repository.js';
import { HttpError } from '../utils/httpError.js';
import { escapeLike, toInt } from '../utils/validators.js';

// The same five values Karla's database allows (unit_ck check on product.unit)
export const UNITS = ['pc', 'ea', 'mtr', 'pkg', 'ltr'];
export const STATUSES = ['active', 'inactive', 'all'];

function badFilter(field, message) {
  return new HttpError(400, message, { errors: { [field]: message } });
}

// S2-DEV-04: GET /api/products?search=&unit=&status=&page=&pageSize=
export async function list(query) {
  const page = toInt(query.page, 1, 1, 1_000_000);
  const pageSize = toInt(query.pageSize, 20, 1, 100);

  // Only real strings count, so a search sent twice (a list) is simply ignored
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';

  let unit;
  if (query.unit !== undefined && query.unit !== '') {
    unit = typeof query.unit === 'string' ? query.unit.trim().toLowerCase() : '';
    if (!UNITS.includes(unit)) {
      throw badFilter('unit', `Unit must be one of: ${UNITS.join(', ')}.`);
    }
  }

  // Deleted products stay out of the list unless the screen asks for them
  let status = 'active';
  if (query.status !== undefined && query.status !== '') {
    status = typeof query.status === 'string' ? query.status.trim().toLowerCase() : '';
    if (!STATUSES.includes(status)) {
      throw badFilter('status', `Status must be one of: ${STATUSES.join(', ')}.`);
    }
  }

  const { products: rows, total, counts } = await products.list({
    search: search ? escapeLike(search) : '',
    unit,
    status,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { products: rows, total, counts, page, pageSize };
}

// ---------- S2-DEV-05: create and edit ----------

// The widths Karla's table allows: product.description VARCHAR(30). The code is VARCHAR(6) and
// every code in the sample data is two letters + four digits (AD0001, MD0003 ...), so that is the
// shape new codes must have.
const DESCRIPTION_MAX = 30;
const CODE_PATTERN = /^[A-Z]{2}\d{4}$/;

// Letters count, not bytes: an emoji is ONE character even though JavaScript's .length says 2
const lengthOf = (text) => Array.from(text).length;

function checkCode(raw) {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (value === '') return { error: 'Product code is required.' };
  if (!CODE_PATTERN.test(value)) {
    return { error: 'Product code must be two letters followed by four digits, like AD0001.' };
  }
  return { value };
}

function checkDescription(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { error: 'Description is required.' };
  const value = raw.trim();
  if (/[\u0000-\u001f\u007f]/.test(value)) return { error: 'Description has characters that are not allowed.' };
  if (lengthOf(value) > DESCRIPTION_MAX) return { error: `Description can be at most ${DESCRIPTION_MAX} characters.` };
  return { value };
}

function checkUnit(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!UNITS.includes(value)) return { error: `Unit must be one of: ${UNITS.join(', ')}.` };
  return { value };
}

// Checks the fields that were sent. Creating needs the code, description and unit; editing only
// looks at description and unit (the code is in the web address and cannot change), and only at
// the ones that were sent.
function readFields(body, { creating }) {
  const input = body && typeof body === 'object' ? body : {};
  const checks = {
    ...(creating ? { prodCode: checkCode } : {}),
    description: checkDescription,
    unit: checkUnit,
  };
  const values = {};
  const errors = {};
  for (const [field, check] of Object.entries(checks)) {
    if (!creating && input[field] === undefined) continue;
    const result = check(input[field]);
    if (result.error) errors[field] = result.error;
    else values[field] = result.value;
  }
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Please check the form.', { errors });
  }
  return values;
}

// "ad0007" or " AD0007 " -> "AD0007". Anything not shaped like a product code is a plain 404,
// as if the product did not exist.
function parseProdCode(raw) {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(value)) throw new HttpError(404, 'Product not found');
  return value;
}

// GET /api/products/:prodCode : fills the edit form
export async function get(rawProdCode) {
  const product = await products.findByCode(parseProdCode(rawProdCode));
  if (!product) throw new HttpError(404, 'Product not found');
  return product;
}

// POST /api/products
export async function create(actor, body) {
  const fields = readFields(body, { creating: true });
  try {
    return await withTransaction(actor.email, (db) => products.insert(db, fields));
  } catch (err) {
    // 23505 = that code already exists. A deleted product still holds its code, so it counts too.
    if (err.code === '23505') {
      const message = `Product code ${fields.prodCode} is already used (a deleted product keeps its code).`;
      throw new HttpError(409, message, { errors: { prodCode: message }, code: 'CODE_TAKEN' });
    }
    throw err;
  }
}

// PATCH /api/products/:prodCode : send only what changed
export async function update(actor, rawProdCode, body) {
  const prodCode = parseProdCode(rawProdCode);
  const fields = readFields(body, { creating: false });
  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, 'Nothing to change.', { errors: { form: 'Send at least one of: description, unit.' } });
  }

  return withTransaction(actor.email, async (db) => {
    const current = await products.findByCode(prodCode, db, { lock: true });
    if (!current) throw new HttpError(404, 'Product not found');
    if (current.status === 'Inactive') {
      throw new HttpError(409, 'This product was deleted. Restore it before editing.', { code: 'PRODUCT_INACTIVE' });
    }
    // Leave the row (and the audit log) alone when nothing really changed
    const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => current[key] !== value));
    if (Object.keys(changes).length === 0) return current;
    return products.update(db, prodCode, changes);
  });
}

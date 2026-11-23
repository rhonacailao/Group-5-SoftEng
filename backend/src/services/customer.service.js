import { withTransaction } from '../config/db.js';
import * as customers from '../repositories/customer.repository.js';
import * as audit from '../repositories/audit.repository.js';
import { addStamps } from './stamp.service.js';
import { HttpError } from '../utils/httpError.js';
import { escapeLike, toInt } from '../utils/validators.js';

// The same three values Karla's database allows (pay_ck check on customer.payterm)
export const PAY_TERMS = ['COD', '30D', '45D'];
export const STATUSES = ['active', 'inactive', 'all'];

function badFilter(field, message) {
  return new HttpError(400, message, { errors: { [field]: message } });
}

// S2-DEV-01: GET /api/customers?search=&payTerm=&status=&page=&pageSize=
export async function list(query, viewer) {
  const page = toInt(query.page, 1, 1, 1_000_000);
  const pageSize = toInt(query.pageSize, 20, 1, 100);

  // Only real strings count, so a search sent twice (a list) is simply ignored
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';

  let payTerm;
  if (query.payTerm !== undefined && query.payTerm !== '') {
    payTerm = typeof query.payTerm === 'string' ? query.payTerm.trim().toUpperCase() : '';
    if (!PAY_TERMS.includes(payTerm)) {
      throw badFilter('payTerm', `Pay terms must be one of: ${PAY_TERMS.join(', ')}.`);
    }
  }

  // Deleted customers stay out of the list unless the screen asks for them
  let status = 'active';
  if (query.status !== undefined && query.status !== '') {
    status = typeof query.status === 'string' ? query.status.trim().toLowerCase() : '';
    if (!STATUSES.includes(status)) {
      throw badFilter('status', `Status must be one of: ${STATUSES.join(', ')}.`);
    }
  }

  const { customers: rows, total, counts } = await customers.list({
    search: search ? escapeLike(search) : '',
    payTerm,
    status,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const withStamps = await addStamps(rows, 'customer', (c) => c.custNo, viewer);
  return { customers: withStamps, total, counts, page, pageSize };
}

// ---------- S2-DEV-02: create and edit ----------

// The widths Karla's table allows: customer.custname VARCHAR(20), customer.address VARCHAR(50)
const NAME_MAX = 20;
const ADDRESS_MAX = 50;
const NUMBER_PATTERN = /^C\d{4}$/;

// Letters count, not bytes: an emoji is ONE character even though JavaScript's .length says 2
const lengthOf = (text) => Array.from(text).length;

function checkText(raw, label, max) {
  if (typeof raw !== 'string' || raw.trim() === '') return { error: `${label} is required.` };
  const value = raw.trim();
  if (/[\u0000-\u001f\u007f]/.test(value)) return { error: `${label} has characters that are not allowed.` };
  if (lengthOf(value) > max) return { error: `${label} can be at most ${max} characters.` };
  return { value };
}

function checkPayTerm(raw) {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!PAY_TERMS.includes(value)) return { error: `Pay terms must be one of: ${PAY_TERMS.join(', ')}.` };
  return { value };
}

// Checks the fields that were sent. requireAll = true when creating (all three must be there);
// when editing, only the fields that were sent are checked and returned.
function readFields(body, { requireAll }) {
  const input = body && typeof body === 'object' ? body : {};
  const checks = {
    custName: (raw) => checkText(raw, 'Customer name', NAME_MAX),
    address: (raw) => checkText(raw, 'Address', ADDRESS_MAX),
    payTerm: checkPayTerm,
  };
  const values = {};
  const errors = {};
  for (const [field, check] of Object.entries(checks)) {
    if (!requireAll && input[field] === undefined) continue;
    const result = check(input[field]);
    if (result.error) errors[field] = result.error;
    else values[field] = result.value;
  }
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Please check the form.', { errors });
  }
  return values;
}

// "c0007" or " C0007 " -> "C0007". Anything not shaped like a customer number is a plain 404,
// as if the customer did not exist.
function parseCustNo(raw) {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!NUMBER_PATTERN.test(value)) throw new HttpError(404, 'Customer not found');
  return value;
}

const formatNumber = (n) => `C${String(n).padStart(4, '0')}`;

function assertNumberLeft(n) {
  if (n > 9999) {
    throw new HttpError(409, 'All customer numbers (C0001 to C9999) are used.', { code: 'NUMBERS_USED_UP' });
  }
}

// GET /api/customers/:custNo : fills the edit form
export async function get(rawCustNo, viewer) {
  const customer = await customers.findByNo(parseCustNo(rawCustNo));
  if (!customer) throw new HttpError(404, 'Customer not found');
  return (await addStamps([customer], 'customer', (c) => c.custNo, viewer))[0];
}

// GET /api/customers/next-number : shows "Customer no. C0083" on the Add form.
// It only looks; the number is really handed out when the customer is saved.
export async function previewNumber() {
  const next = await customers.nextNumber();
  assertNumberLeft(next);
  return { custNo: formatNumber(next) };
}

// POST /api/customers
export async function create(actor, body) {
  const fields = readFields(body, { requireAll: true });
  try {
    return await withTransaction(actor.email, async (db) => {
      await customers.lockNumbering(db);
      const next = await customers.nextNumber(db);
      assertNumberLeft(next);
      return customers.insert(db, { custNo: formatNumber(next), ...fields });
    });
  } catch (err) {
    // 23505 = that number already exists (only possible if someone inserted outside the app)
    if (err.code === '23505') {
      throw new HttpError(409, 'That customer number was just taken. Please try again.', { code: 'NUMBER_TAKEN' });
    }
    throw err;
  }
}

// PATCH /api/customers/:custNo : send only what changed
export async function update(actor, rawCustNo, body) {
  const custNo = parseCustNo(rawCustNo);
  const fields = readFields(body, { requireAll: false });
  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, 'Nothing to change.', { errors: { form: 'Send at least one of: custName, address, payTerm.' } });
  }

  return withTransaction(actor.email, async (db) => {
    const current = await customers.findByNo(custNo, db, { lock: true });
    if (!current) throw new HttpError(404, 'Customer not found');
    if (current.status === 'Inactive') {
      throw new HttpError(409, 'This customer was deleted. Restore it before editing.', { code: 'CUSTOMER_INACTIVE' });
    }
    // Leave the row (and the audit log) alone when nothing really changed
    const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => current[key] !== value));
    if (Object.keys(changes).length === 0) return current;
    return customers.update(db, custNo, changes);
  });
}

// ---------- S2-DEV-03: soft delete and restore ----------

// DELETE /api/customers/:custNo
// A soft delete only sets deleted_at, so nothing is lost and the customer can be restored.
// Same rule as the database design: a parent cannot be deleted while active child records exist,
// so a customer that still has sales is refused (the sales must be dealt with first).
export async function remove(actor, rawCustNo) {
  const custNo = parseCustNo(rawCustNo);

  return withTransaction(actor.email, async (db) => {
    // Lock the customer row first. A new sale for this customer needs a share lock on the same
    // row (foreign key), so it cannot sneak in between the count below and the update.
    const current = await customers.findByNo(custNo, db, { lock: true });
    if (!current) throw new HttpError(404, 'Customer not found');
    if (current.status === 'Inactive') {
      throw new HttpError(409, 'This customer is already deleted.', { code: 'ALREADY_DELETED' });
    }

    const sales = await customers.countSales(db, custNo);
    if (sales > 0) {
      throw new HttpError(
        409,
        `${custNo} cannot be deleted: it still has ${sales} active sale${sales === 1 ? '' : 's'}.`,
        { code: 'HAS_ACTIVE_CHILDREN' },
      );
    }

    const deleted = await customers.setDeleted(db, custNo, true);
    await audit.write(
      { tableName: 'customer', action: 'DELETE', recordKey: custNo, oldValues: { status: 'Active' }, newValues: { status: 'Inactive' }, actor },
      db,
    );
    return deleted;
  });
}

// PATCH /api/customers/:custNo/restore : puts a deleted customer back in the Active list
export async function restore(actor, rawCustNo) {
  const custNo = parseCustNo(rawCustNo);

  return withTransaction(actor.email, async (db) => {
    const current = await customers.findByNo(custNo, db, { lock: true });
    if (!current) throw new HttpError(404, 'Customer not found');
    if (current.status === 'Active') {
      throw new HttpError(409, 'This customer is not deleted.', { code: 'NOT_DELETED' });
    }

    const restored = await customers.setDeleted(db, custNo, false);
    await audit.write(
      { tableName: 'customer', action: 'RESTORE', recordKey: custNo, oldValues: { status: 'Inactive' }, newValues: { status: 'Active' }, actor },
      db,
    );
    return restored;
  });
}

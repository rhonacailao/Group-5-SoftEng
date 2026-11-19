import * as customers from '../repositories/customer.repository.js';
import { HttpError } from '../utils/httpError.js';
import { escapeLike, toInt } from '../utils/validators.js';

// The same three values Karla's database allows (pay_ck check on customer.payterm)
export const PAY_TERMS = ['COD', '30D', '45D'];
export const STATUSES = ['active', 'inactive', 'all'];

function badFilter(field, message) {
  return new HttpError(400, message, { errors: { [field]: message } });
}

// S2-DEV-01: GET /api/customers?search=&payTerm=&status=&page=&pageSize=
export async function list(query) {
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
  return { customers: rows, total, counts, page, pageSize };
}

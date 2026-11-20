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

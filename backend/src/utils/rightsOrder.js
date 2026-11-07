// The order rights are listed in (Rights dialog and main page tiles): Add, Edit, Delete per item, as in the sheet.
// The database does not remember the order they were seeded in, so it is written down here.
// A right that is not listed (added later) simply goes to the end of its module.
export const DISPLAY_ORDER = [
  'CUSTOMER_ADD', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
  'PRODUCT_ADD', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRICE_ADD', 'PRICE_EDIT', 'PRICE_DELETE',
  'JOB_ADD', 'JOB_EDIT', 'JOB_DELETE', 'DEPARTMENT_ADD', 'DEPARTMENT_EDIT', 'DEPARTMENT_DELETE',
  'EMPLOYEE_ADD', 'EMPLOYEE_EDIT', 'EMPLOYEE_DELETE',
  'JOB_HISTORY_VIEW', 'JOB_HISTORY_ADD', 'JOB_HISTORY_EDIT', 'JOB_HISTORY_DELETE',
  'SALE_ADD', 'SALE_EDIT', 'SALE_DELETE',
  'SALE_DETAIL_VIEW', 'SALE_DETAIL_ADD', 'SALE_DETAIL_EDIT', 'SALE_DETAIL_DELETE',
  'REPORT_TOP_CUSTOMERS', 'REPORT_PRODUCT_MASTER_LIST', 'REPORT_TOP_PRODUCTS', 'REPORT_ACTIVE_EMPLOYEES',
  'REPORT_ALL_EMPLOYEES', 'REPORT_EMPLOYEE_JOB_HISTORY', 'REPORT_TOP_SALES',
];

function position(code) {
  const index = DISPLAY_ORDER.indexOf(code);
  return index === -1 ? DISPLAY_ORDER.length : index;
}

// Modules keep their seeded order; rights inside a module follow DISPLAY_ORDER
export function inDisplayOrder(catalogue) {
  return [...catalogue].sort(
    (a, b) => a.moduleId - b.moduleId || position(a.rightCode) - position(b.rightCode) || a.rightId - b.rightId,
  );
}

// Groups the flat catalogue into the five modules the dialog shows.
// `held` is the set of right codes the user currently has.

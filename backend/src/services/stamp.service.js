import * as stamps from '../repositories/stamp.repository.js';

// Only an Admin or Superadmin sees stamps (Student Guide 3.4). The check lives here on the
// server, so a normal user cannot get them by calling the API directly.
const canSeeStamps = (viewer) => viewer?.role === 'admin' || viewer?.role === 'superadmin';

// A row that was loaded as sample data has no log line. We still show who it belongs to
// ("system") but never invent a date.
const UNKNOWN = Object.freeze({ action: 'CREATED', user: 'system', date: null });

// Adds `stamp` to each item and returns the new list; the originals are not changed.
//   table:  which audit_log.table_name to look in
//   keyOf:  how to get the record key from an item, e.g. (p) => p.prodCode
export async function addStamps(items, table, keyOf, viewer) {
  if (!canSeeStamps(viewer)) return items;
  const found = await stamps.latestFor(table, items.map(keyOf));
  return items.map((item) => ({ ...item, stamp: found.get(keyOf(item)) ?? { ...UNKNOWN } }));
}

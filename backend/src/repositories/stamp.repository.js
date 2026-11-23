import { pool } from '../config/db.js';
import { businessTimeZone } from '../config/business.js';

// S2 Stamp: "who did the last thing to this row, and when", read from Karla's audit_log.
// One query returns the newest log line for each of the given record keys.
//   table:  audit_log.table_name ('customer', 'product', 'pricehist')
//   keys:   audit_log.record_key values (custNo, prodCode, or 'YYYY-MM-DD|PRODCODE' for prices)
// Returns a Map: key -> { action, user, date }
//   action  CREATED | EDITED | DELETED | RESTORED   (the audit log says ADD | EDIT | DELETE | RESTORE)
//   user    the person's full name when the email belongs to a user, else what the log holds
//   date    'YYYY-MM-DD h:mm AM' in the company time zone, like 2026-10-30 12:37 PM

const ACTION_WORDS = { ADD: 'CREATED', EDIT: 'EDITED', DELETE: 'DELETED', RESTORE: 'RESTORED' };

export async function latestFor(table, keys, db = pool) {
  const stamps = new Map();
  if (keys.length === 0) return stamps;
  // Newest log line per key: sort so the newest comes first, DISTINCT ON keeps only that one.
  // (audit_id grows with every line, so it orders lines saved in the same second correctly.)
  const { rows } = await db.query(
    `SELECT DISTINCT ON (a.record_key)
            a.record_key,
            a.action,
            COALESCE(NULLIF(btrim(u.first_name || ' ' || u.last_name), ''), a.action_by) AS who,
            to_char(a.action_at AT TIME ZONE $3, 'YYYY-MM-DD FMHH12:MI AM') AS at
       FROM audit_log a
       LEFT JOIN app_user u ON lower(u.email) = lower(a.action_by)
      WHERE a.table_name = $1 AND a.record_key = ANY($2::text[])
      ORDER BY a.record_key, a.audit_id DESC`,
    [table, keys, businessTimeZone()],
  );
  for (const row of rows) {
    stamps.set(row.record_key, {
      action: ACTION_WORDS[row.action] ?? row.action,
      user: row.who === 'postgres' ? 'system' : row.who, // changes made straight in the database
      date: row.at,
    });
  }
  return stamps;
}

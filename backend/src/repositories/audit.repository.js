import { pool } from '../config/db.js';

// Adds one row to audit_log (same columns and actions as HopeDB_audit.sql).
// Pass the transaction `client` as `db`, so the log row is saved or rolled back together
// with the change it describes.
//   action: 'ADD' | 'EDIT' | 'DELETE' | 'RESTORE'
//   actor:  the user who did it (an object with an email)
// Never put passwords or tokens in oldValues / newValues.
export async function write({ tableName, action, recordKey, oldValues = null, newValues = null, actor }, db = pool) {
  await db.query(
    `INSERT INTO audit_log (table_name, action, record_key, old_values, new_values, action_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      tableName,
      action,
      String(recordKey).slice(0, 60),
      oldValues === null ? null : JSON.stringify(oldValues),
      newValues === null ? null : JSON.stringify(newValues),
      String(actor?.email ?? 'system').slice(0, 50), // action_by is VARCHAR(50)
    ],
  );
}

// Read-only check: is the backend connected to Supabase, and which migrations are in?
// Run from the backend folder:  node scripts/check-db.js
import 'dotenv/config';
import { pool } from '../src/config/db.js';

const WANT = [
  'app_user', 'role', 'module', 'rights', 'user_permission',
  'password_reset_token', 'user_session', 'audit_log',
];

try {
  const tables = await pool.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by 1",
  );
  const have = tables.rows.map((r) => r.table_name);
  console.log('Connected to the database.\n');
  for (const name of WANT) console.log(have.includes(name) ? '  found    ' : '  MISSING  ', name);

  if (have.includes('rights') && have.includes('role')) {
    const c = await pool.query('select (select count(*) from rights) as rights, (select count(*) from role) as roles');
    console.log(`\nSeed data: ${c.rows[0].rights} rights, ${c.rows[0].roles} roles (expected 36 and 3)`);
  }

  try {
    const m = await pool.query('select version from supabase_migrations.schema_migrations order by 1');
    console.log('\nMigrations recorded:', m.rows.map((r) => r.version).join(', ') || '(none)');
  } catch {
    console.log('\n(No migration history table, so which files were applied cannot be listed.)');
  }
} catch (err) {
  console.log('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
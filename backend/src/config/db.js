import pg from 'pg';

// Keep DATE columns as plain 'YYYY-MM-DD' text (type id 1082) instead of JS Date objects
pg.types.setTypeParser(1082, (value) => value);

// Pool = a few open DB connections that get reused (faster than reconnecting each time)
export let pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // one URL with host, user, password, db name
  ssl: { rejectUnauthorized: false },         // Supabase only accepts encrypted connections
  connectionTimeoutMillis: 10000,             // give up after 10 seconds instead of waiting forever
});

// Without this, a dropped idle connection would crash the whole server
pool.on('error', (err) => console.error('Idle database connection error:', err.message));

// The tests call this to swap in an in-memory database (other files see the new pool
// automatically because they import the live `pool` variable).
export function setPool(newPool) {
  pool = newPool;
}

// Runs `work(client)` as ONE all-or-nothing transaction: if anything throws, every
// change made inside is rolled back. `actorName` is who is acting; it is saved in the
// database setting app.username so the audit_user() function (S1-DBA-06) can read it.
export async function withTransaction(actorName, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (actorName) {
      // stamp columns are VARCHAR(60), so keep the name short
      await client.query("SELECT set_config('app.username', $1, true)", [String(actorName).slice(0, 30)]);
    }
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {}); // ignore a failed rollback, report the real error
    throw err;
  } finally {
    client.release(); // always hand the connection back to the pool
  }
}

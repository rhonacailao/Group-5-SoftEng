import pg from 'pg';

// Keep DATE columns as plain 'YYYY-MM-DD' text (type id 1082) instead of JS Date objects
pg.types.setTypeParser(1082, (value) => value);

// Pool = a few open DB connections that get reused (faster than reconnecting each time)
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // one URL with host, user, password, db name
  ssl: { rejectUnauthorized: false },         // Supabase only accepts encrypted connections
  connectionTimeoutMillis: 10000,             // give up after 10 seconds instead of waiting forever
});
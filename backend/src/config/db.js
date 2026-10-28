import pg from 'pg';

// Pool = a few open DB connections that get reused (faster than reconnecting each time)
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL, // one URL with host, user, password, db name
  ssl: { rejectUnauthorized: false },         // Supabase only accepts encrypted connections
});
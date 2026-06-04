import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Keep NUMERIC as JS numbers for the API surface (amounts fit well within float range here).
pg.types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));

const connectionString =
  process.env.DATABASE_URL || 'postgres://printshop:printshop@localhost:5432/printshop';

// Managed Postgres (Render, etc.) needs SSL when reached over its public host.
// The internal/localhost URLs do not, so only enable it when clearly required.
const needsSSL =
  process.env.DATABASE_SSL === 'true' ||
  /sslmode=require/i.test(connectionString) ||
  /render\.com/i.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {})
});

export const query = (text, params) => pool.query(text, params);

import dns from 'node:dns';
import net from 'node:net';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// Node's happy-eyeballs (autoSelectFamily) tries every Neon address and gives
// each only a few hundred milliseconds. From this network IPv6 is unreachable
// and IPv4 to us-east-1 often needs longer than that, so every attempt is
// reported as ETIMEDOUT and the API process crashes. Use one IPv4 address
// and let the normal TCP timeout apply.
dns.setDefaultResultOrder('ipv4first');
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

// Keep NUMERIC as JS numbers for the API surface (amounts fit well within float range here).
pg.types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));

const connectionString =
  process.env.DATABASE_URL || 'postgres://printshop:printshop@localhost:5432/printshop';

// Managed Postgres (Neon, Render, etc.) needs SSL when reached over its public
// host. The internal/localhost URLs do not, so only enable it when required.
const needsSSL =
  process.env.DATABASE_SSL === 'true' ||
  /sslmode=require/i.test(connectionString) ||
  /neon\.tech/i.test(connectionString) ||
  /render\.com/i.test(connectionString);

export const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 20000,
  ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {})
});

pool.on('error', (err) => {
  console.error('Idle database client error:', err);
});

export const query = (text, params) => pool.query(text, params);

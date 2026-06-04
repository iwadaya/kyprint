// Idempotent migration + seed runner.
//
// The schema lives as plain numbered SQL files in ../../db/migrations and a
// one-shot ../../db/seed.sql. Locally you can apply them with psql via
// db/run.sh, but on a managed host (Render, etc.) psql isn't guaranteed to be
// on PATH, so this runner applies the same files through the node-postgres pool
// we already use for the API.
//
// It is safe to run on every boot:
//   * each migration file is recorded in `_migrations` and never re-applied;
//   * an advisory lock serialises concurrent boots;
//   * the seed only loads when the `users` table is still empty.
//
// Usage: `node src/migrate.js`  (or imported as runMigrations()).
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(__dirname, '../../db');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');
const SEED_FILE = path.join(DB_DIR, 'seed.sql');

// Arbitrary constant so independent processes take the same lock.
const LOCK_KEY = 873214567;

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedSet(client) {
  const { rows } = await client.query('SELECT filename FROM _migrations');
  return new Set(rows.map((r) => r.filename));
}

async function applyMigrations(client) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const done = await appliedSet(client);

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    process.stdout.write(`  → applying ${file}\n`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }
  return applied;
}

async function maybeSeed(client) {
  // Only seed an empty database so redeploys never duplicate demo rows.
  const { rows } = await client.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_name = 'users') AS has_users`
  );
  if (!rows[0].has_users) return false;

  const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS n FROM users');
  if (countRows[0].n > 0) return false;
  if (!existsSync(SEED_FILE)) return false;

  process.stdout.write('  → loading seed data\n');
  await client.query('BEGIN');
  try {
    await client.query(readFileSync(SEED_FILE, 'utf8'));
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Seed failed: ${err.message}`);
  }
}

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await ensureMigrationsTable(client);
    const applied = await applyMigrations(client);
    const seeded = await maybeSeed(client);
    console.log(
      `Migrations up to date (${applied} applied this run)` +
        (seeded ? ', seed data loaded' : '')
    );
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

// Allow `node src/migrate.js` as a standalone command (e.g. a Render
// pre-deploy step) as well as being imported by the server on boot.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

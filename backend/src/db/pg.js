/**
 * PostgreSQL connection pool.
 * Enabled only when DATABASE_URL (or PG* vars) is set in .env
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function isPostgresEnabled() {
  return !!(
    process.env.DATABASE_URL ||
    (process.env.PGHOST && process.env.PGDATABASE)
  );
}

export function getPool() {
  if (!isPostgresEnabled()) return null;
  if (!pool) {
    pool = process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL })
      : new Pool({
          host: process.env.PGHOST || 'localhost',
          port: Number(process.env.PGPORT || 5432),
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || '',
          database: process.env.PGDATABASE || 'dashzw',
        });
    pool.on('error', (err) => {
      console.error('[DashZW PG] pool error', err.message);
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('PostgreSQL is not configured (set DATABASE_URL in .env)');
  return p.query(text, params);
}

/**
 * Idempotent, self-applying schema patches for columns that were added after
 * the original schema shipped. Safe to run on every boot; each statement is a
 * no-op when the column already exists. Keeps PG deployments working without a
 * separate migration runner.
 */
export async function ensureSchemaPatches() {
  if (!isPostgresEnabled()) return;
  const patches = [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ`,
  ];
  for (const sql of patches) {
    try {
      await query(sql);
    } catch (e) {
      console.error('[DashZW PG] schema patch failed:', sql, e.message);
    }
  }
}

export async function checkPostgres() {
  if (!isPostgresEnabled()) {
    return { enabled: false, ok: false, message: 'DATABASE_URL not set — using JSON files' };
  }
  try {
    const r = await query('SELECT COUNT(*)::int AS users FROM users');
    return {
      enabled: true,
      ok: true,
      message: 'connected',
      users: r.rows[0]?.users ?? 0,
    };
  } catch (e) {
    return { enabled: true, ok: false, message: e.message };
  }
}

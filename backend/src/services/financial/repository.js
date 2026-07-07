/**
 * Financial repository — ledger persistence (JSON + PostgreSQL).
 * Ledger is immutable; balances are derived from entries.
 */
import { getCollection, saveCollection } from '../../db/localDb.js';
import { isPostgresEnabled, query } from '../../db/pg.js';

const COLLECTIONS = {
  LEDGER: 'LedgerTransaction',
  AUDIT: 'FinancialAuditLog',
  FLOAT_TOPUP: 'FloatTopUp',
  SETTLEMENT_RUN: 'SettlementRun',
  MERCHANT_CONFIG: 'MerchantFinancialConfig',
  DRIVER_FLOAT: 'DriverFloatAccount',
};

function genId(prefix = 'fin') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── JSON collections ─────────────────────────────────────────────────────────

export function listLedger(filters = {}, limit = 500) {
  let rows = getCollection(COLLECTIONS.LEDGER);
  rows = rows.filter((r) =>
    Object.entries(filters).every(([k, v]) => {
      if (v == null || v === '') return true;
      return r[k] === v;
    })
  );
  return rows.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, limit);
}

export function findLedgerByIdempotency(key) {
  if (!key) return null;
  return getCollection(COLLECTIONS.LEDGER).find((r) => r.idempotency_key === key) || null;
}

export function insertLedgerEntries(entries) {
  const all = getCollection(COLLECTIONS.LEDGER);
  const stamped = entries.map((e) => ({
    ...e,
    id: e.id || genId('leg'),
    created_date: e.created_date || new Date().toISOString(),
    status: e.status || 'completed',
    currency: e.currency || 'USD',
  }));
  all.push(...stamped);
  saveCollection(COLLECTIONS.LEDGER, all);
  return stamped;
}

export function insertAuditLog(entry) {
  const all = getCollection(COLLECTIONS.AUDIT);
  const row = {
    id: genId('aud'),
    ...entry,
    created_date: new Date().toISOString(),
  };
  all.push(row);
  saveCollection(COLLECTIONS.AUDIT, all);
  return row;
}

export function getMerchantConfig(merchantEmail) {
  const all = getCollection(COLLECTIONS.MERCHANT_CONFIG);
  return all.find((c) => c.merchant_email === merchantEmail.toLowerCase()) || null;
}

export function upsertMerchantConfig(merchantEmail, patch) {
  const all = getCollection(COLLECTIONS.MERCHANT_CONFIG);
  const email = merchantEmail.toLowerCase();
  const idx = all.findIndex((c) => c.merchant_email === email);
  const base = {
    merchant_email: email,
    settlement_frequency: 'weekly',
    holding_hours: 0,
    updated_date: new Date().toISOString(),
  };
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch, updated_date: new Date().toISOString() };
    saveCollection(COLLECTIONS.MERCHANT_CONFIG, all);
    return all[idx];
  }
  const row = { ...base, ...patch, id: genId('mfc') };
  all.push(row);
  saveCollection(COLLECTIONS.MERCHANT_CONFIG, all);
  return row;
}

export function insertFloatTopUp(record) {
  const all = getCollection(COLLECTIONS.FLOAT_TOPUP);
  const row = { id: genId('ftu'), ...record, created_date: new Date().toISOString() };
  all.push(row);
  saveCollection(COLLECTIONS.FLOAT_TOPUP, all);
  return row;
}

export function insertSettlementRun(record) {
  const all = getCollection(COLLECTIONS.SETTLEMENT_RUN);
  const row = { id: genId('srn'), ...record, created_date: new Date().toISOString() };
  all.push(row);
  saveCollection(COLLECTIONS.SETTLEMENT_RUN, all);
  return row;
}

// ── PostgreSQL (when enabled) ────────────────────────────────────────────────

async function ensurePgTables() {
  if (!isPostgresEnabled()) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      reference_number TEXT,
      order_id TEXT,
      customer_id TEXT,
      driver_id TEXT,
      merchant_id TEXT,
      account_id TEXT NOT NULL,
      entry_side TEXT NOT NULL CHECK (entry_side IN ('debit', 'credit')),
      amount NUMERIC(14,2) NOT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'USD',
      balance_after NUMERIC(14,2),
      status TEXT NOT NULL DEFAULT 'completed',
      settlement_status TEXT,
      description TEXT,
      idempotency_key TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_txn_id ON ledger_transactions(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_order ON ledger_transactions(order_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_idempotency ON ledger_transactions(idempotency_key);
    CREATE TABLE IF NOT EXISTS financial_audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_email TEXT,
      target_type TEXT,
      target_id TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function insertLedgerEntriesPg(entries) {
  await ensurePgTables();
  const results = [];
  for (const e of entries) {
    const id = e.id || genId('leg');
    await query(
      `INSERT INTO ledger_transactions (
        id, transaction_id, transaction_type, reference_number, order_id,
        customer_id, driver_id, merchant_id, account_id, entry_side, amount,
        currency, balance_after, status, settlement_status, description,
        idempotency_key, created_by, completed_at, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        id, e.transaction_id, e.transaction_type, e.reference_number || null,
        e.order_id || null, e.customer_id || null, e.driver_id || null,
        e.merchant_id || null, e.account_id, e.entry_side, e.amount,
        e.currency || 'USD', e.balance_after ?? null, e.status || 'completed',
        e.settlement_status || null, e.description || null,
        e.idempotency_key || null, e.created_by || null,
        e.completed_date || new Date().toISOString(),
        JSON.stringify(e.metadata || {}),
      ]
    );
    results.push({ ...e, id });
  }
  return results;
}

export async function findLedgerByIdempotencyPg(key) {
  if (!key || !isPostgresEnabled()) return null;
  await ensurePgTables();
  const r = await query(
    `SELECT * FROM ledger_transactions WHERE idempotency_key = $1 LIMIT 1`,
    [key]
  );
  return r.rows[0] || null;
}

export async function listLedgerPg(filters = {}, limit = 500) {
  if (!isPostgresEnabled()) return listLedger(filters, limit);
  await ensurePgTables();
  const clauses = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === '') continue;
    const col = k === 'created_date' ? 'created_at' : k;
    clauses.push(`${col} = $${i++}`);
    params.push(v);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const r = await query(
    `SELECT * FROM ledger_transactions ${where} ORDER BY created_at DESC LIMIT $${i}`,
    [...params, limit]
  );
  return r.rows;
}

export async function persistLedgerEntries(entries) {
  if (isPostgresEnabled()) {
    await insertLedgerEntriesPg(entries);
  }
  return insertLedgerEntries(entries);
}

export async function findIdempotency(key) {
  if (isPostgresEnabled()) {
    const pg = await findLedgerByIdempotencyPg(key);
    if (pg) return pg;
  }
  return findLedgerByIdempotency(key);
}

export { genId, COLLECTIONS };

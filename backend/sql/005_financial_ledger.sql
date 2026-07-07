-- 005_financial_ledger.sql — Double-entry ledger & financial account tables
BEGIN;

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id                TEXT PRIMARY KEY,
  transaction_id    TEXT NOT NULL,
  transaction_type  TEXT NOT NULL,
  reference_number  TEXT,
  order_id          TEXT REFERENCES orders(id) ON DELETE SET NULL,
  customer_id       TEXT,
  driver_id         TEXT,
  merchant_id       TEXT,
  account_id        TEXT NOT NULL,
  entry_side        TEXT NOT NULL CHECK (entry_side IN ('debit', 'credit')),
  amount            NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'USD',
  balance_after     NUMERIC(14,2),
  status            TEXT NOT NULL DEFAULT 'completed',
  settlement_status TEXT,
  description       TEXT,
  idempotency_key   TEXT UNIQUE,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ledger_txn_id ON ledger_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON ledger_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_merchant ON ledger_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_driver ON ledger_transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS financial_audit_logs (
  id            TEXT PRIMARY KEY,
  action        TEXT NOT NULL,
  actor_email   TEXT,
  target_type   TEXT,
  target_id     TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_audit_created ON financial_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS driver_float_accounts (
  id              TEXT PRIMARY KEY,
  driver_email    CITEXT NOT NULL UNIQUE,
  float_balance   NUMERIC(14,2) NOT NULL DEFAULT 0,
  float_reserved  NUMERIC(14,2) NOT NULL DEFAULT 0,
  earnings        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tips            NUMERIC(14,2) NOT NULL DEFAULT 0,
  cod_collected   NUMERIC(14,2) NOT NULL DEFAULT 0,
  cod_liability   NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS float_top_ups (
  id              TEXT PRIMARY KEY,
  driver_email    CITEXT NOT NULL,
  merchant_email  CITEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  transaction_id  TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_financial_config (
  id                    TEXT PRIMARY KEY,
  merchant_email        CITEXT NOT NULL UNIQUE,
  settlement_frequency  TEXT NOT NULL DEFAULT 'weekly',
  holding_hours         INT NOT NULL DEFAULT 0,
  next_settlement_at    TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlement_runs (
  id              TEXT PRIMARY KEY,
  merchant_email  CITEXT,
  amount          NUMERIC(14,2) NOT NULL,
  method          TEXT,
  reference       TEXT,
  run_by          TEXT,
  status          TEXT NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_revenue_snapshots (
  id              TEXT PRIMARY KEY,
  revenue         NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending         NUMERIC(14,2) NOT NULL DEFAULT 0,
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMIT;

/**
 * Wallet Service — balances derived from ledger; legacy Wallet.json sync for compatibility.
 */
import { getCollection, saveCollection } from '../../db/localDb.js';
import { isPostgresEnabled, query } from '../../db/pg.js';
import { getLedgerBalance, postTransaction, invalidateBalanceCache } from './ledgerService.js';
import {
  accountId,
  platformAccount,
  ACCOUNT_BUCKET,
  TX_TYPE,
  PLATFORM_EMAIL,
} from './constants.js';
import { insertAuditLog } from './repository.js';

function legacyWalletKey(email, type) {
  return `${(email || '').toLowerCase()}:${type || 'customer'}`;
}

function syncLegacyWallet(email, type, balance) {
  const ownerType = type || 'customer';
  const wallets = getCollection('Wallet');
  let w = wallets.find(
    (x) => x.owner_email === email && x.owner_type === ownerType
  );
  if (!w) {
    w = {
      id: legacyWalletKey(email, ownerType).replace(/[^a-z0-9]/gi, '_') + '_wallet',
      owner_email: email,
      owner_type: ownerType,
      balance: 0,
      created_date: new Date().toISOString(),
    };
    wallets.push(w);
  }
  w.balance = parseFloat(balance.toFixed(2));
  w.updated_date = new Date().toISOString();
  saveCollection('Wallet', wallets);
  return w;
}

function syncLegacyTransaction(email, type, delta, reason) {
  const txs = getCollection('Transaction');
  txs.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    owner_email: email,
    owner_type: type,
    amount: delta,
    type: delta >= 0 ? 'credit' : 'debit',
    reason,
    balance_after: getLedgerBalance(accountId(type, email, resolveBucket(type, email))),
    created_date: new Date().toISOString(),
  });
  saveCollection('Transaction', txs);
}

function resolveBucket(ownerType, email) {
  switch (ownerType) {
    case 'customer': return ACCOUNT_BUCKET.CUSTOMER_WALLET;
    case 'partner': return ACCOUNT_BUCKET.MERCHANT_AVAILABLE;
    case 'driver': return ACCOUNT_BUCKET.DRIVER_EARNINGS;
    case 'platform': return ACCOUNT_BUCKET.PLATFORM_REVENUE;
    default: return ACCOUNT_BUCKET.CUSTOMER_WALLET;
  }
}

/**
 * Get balance for legacy owner_type API.
 * Customer → wallet bucket; partner → available; driver → earnings; platform → revenue.
 */
export async function getBalance(ownerEmail, ownerType = null) {
  if (!ownerEmail) return 0;
  const type = ownerType || 'customer';
  const bucket = resolveBucket(type, ownerEmail);
  const acct = accountId(type === 'partner' ? 'merchant' : type, ownerEmail, bucket);

  if (isPostgresEnabled() && type === 'customer') {
    const r = await query(
      `SELECT balance FROM wallets WHERE owner_email = $1 AND owner_type = $2`,
      [ownerEmail, type]
    );
    if (r.rows[0]) {
      const bal = Number(r.rows[0].balance);
      invalidateBalanceCache(acct);
      return bal;
    }
  }

  const ledgerBal = getLedgerBalance(acct);
  if (ledgerBal !== 0 || getCollection('LedgerTransaction').some((r) => r.account_id === acct)) {
    syncLegacyWallet(ownerEmail, type, ledgerBal);
    return ledgerBal;
  }

  const w = getCollection('Wallet').find(
    (x) => x.owner_email === ownerEmail && (!ownerType || x.owner_type === ownerType)
  );
  return w ? w.balance : 0;
}

async function ensurePgWallet(email, type) {
  await query(
    `INSERT INTO wallets (owner_email, owner_type, balance)
     VALUES ($1, $2, 0)
     ON CONFLICT (owner_email, owner_type) DO NOTHING`,
    [email, type]
  );
}

async function recordPgTransaction({ email, type, amount, txType, reason, orderId, walletId }) {
  try {
    await query(
      `INSERT INTO transactions (owner_email, owner_type, amount, type, reason, order_id, wallet_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [email, type, amount, txType, reason || null, orderId || null, walletId || null]
    );
  } catch (err) {
    console.warn('[DashZW] transaction log insert failed:', err.message);
  }
}

/** Customer wallets in PostgreSQL use the wallets table as source of truth. */
async function creditPgCustomerWallet(email, amount, reason, orderId = null) {
  const amt = parseFloat(Math.abs(amount).toFixed(2));
  await ensurePgWallet(email, 'customer');
  const r = await query(
    `UPDATE wallets SET balance = balance + $3, updated_at = NOW()
     WHERE owner_email = $1 AND owner_type = $2
     RETURNING id, balance`,
    [email, 'customer', amt]
  );
  const balance = Number(r.rows[0]?.balance ?? 0);
  await recordPgTransaction({
    email,
    type: 'customer',
    amount: amt,
    txType: 'credit',
    reason,
    orderId,
    walletId: r.rows[0]?.id,
  });
  syncLegacyWallet(email, 'customer', balance);
  syncLegacyTransaction(email, 'customer', amt, reason);
  return balance;
}

async function debitPgCustomerWallet(email, amount, reason, orderId = null) {
  const amt = parseFloat(Math.abs(amount).toFixed(2));
  await ensurePgWallet(email, 'customer');
  const r = await query(
    `UPDATE wallets SET balance = balance - $3, updated_at = NOW()
     WHERE owner_email = $1 AND owner_type = $2 AND balance >= $3
     RETURNING id, balance`,
    [email, 'customer', amt]
  );
  if (!r.rows[0]) {
    const balR = await query(
      `SELECT balance FROM wallets WHERE owner_email = $1 AND owner_type = 'customer'`,
      [email]
    );
    const available = Number(balR.rows[0]?.balance ?? 0);
    throw new Error(
      available > 0
        ? `Insufficient wallet balance. Available: $${available.toFixed(2)}`
        : 'Insufficient wallet balance'
    );
  }
  const balance = Number(r.rows[0].balance);
  await recordPgTransaction({
    email,
    type: 'customer',
    amount: -amt,
    txType: 'debit',
    reason,
    orderId,
    walletId: r.rows[0].id,
  });
  syncLegacyWallet(email, 'customer', balance);
  syncLegacyTransaction(email, 'customer', -amt, reason);
  return balance;
}

export async function creditWallet(email, type, amount, reason, txType = null, orderId = null) {
  const amt = parseFloat(Math.abs(amount).toFixed(2));
  if (amt <= 0) throw new Error('Credit amount must be positive');

  if (isPostgresEnabled() && type === 'customer') {
    const balance = await creditPgCustomerWallet(email, amt, reason, orderId);
    return { owner_email: email, owner_type: type, balance };
  }

  const bucket = resolveBucket(type, email);
  const acct = accountId(type === 'partner' ? 'merchant' : type, email, bucket);
  const escrow = platformAccount(ACCOUNT_BUCKET.PLATFORM_ESCROW);

  const result = await postTransaction({
    transactionType: txType || TX_TYPE.WALLET_CREDIT,
    legs: [
      { accountId: acct, side: 'credit', amount: amt, description: reason },
      { accountId: escrow, side: 'debit', amount: amt, description: reason },
    ],
    context: { customer_id: type === 'customer' ? email : null, merchant_id: type === 'partner' ? email : null },
    description: reason,
    idempotencyKey: `credit_${email}_${type}_${amt}_${Date.now()}`,
  });

  if (!result.duplicate) {
    syncLegacyWallet(email, type, getLedgerBalance(acct));
    syncLegacyTransaction(email, type, amt, reason);
  }
  return { owner_email: email, owner_type: type, balance: getLedgerBalance(acct) };
}

export async function debitWallet(email, type, amount, reason, txType = null, orderId = null) {
  const amt = parseFloat(Math.abs(amount).toFixed(2));
  if (amt <= 0) throw new Error('Debit amount must be positive');

  if (isPostgresEnabled() && type === 'customer') {
    const balance = await debitPgCustomerWallet(email, amt, reason, orderId);
    return { owner_email: email, owner_type: type, balance };
  }

  const bucket = resolveBucket(type, email);
  const acct = accountId(type === 'partner' ? 'merchant' : type, email, bucket);
  const balance = await getBalance(email, type);
  if (balance < amt) {
    throw new Error(
      balance > 0
        ? `Insufficient wallet balance. Available: $${balance.toFixed(2)}`
        : 'Insufficient wallet balance'
    );
  }
  const escrow = platformAccount(ACCOUNT_BUCKET.PLATFORM_ESCROW);

  const result = await postTransaction({
    transactionType: txType || TX_TYPE.WALLET_DEBIT,
    legs: [
      { accountId: acct, side: 'debit', amount: amt, description: reason },
      { accountId: escrow, side: 'credit', amount: amt, description: reason },
    ],
    context: { customer_id: type === 'customer' ? email : null },
    description: reason,
    idempotencyKey: `debit_${email}_${type}_${amt}_${reason?.slice(0, 20)}`,
  });

  if (!result.duplicate) {
    syncLegacyWallet(email, type, getLedgerBalance(acct));
    syncLegacyTransaction(email, type, -amt, reason);
  }
  return { owner_email: email, owner_type: type, balance: getLedgerBalance(acct) };
}

export function getAccountBalances(entityType, entityEmail) {
  const email = (entityEmail || '').toLowerCase();
  const prefix = entityType === 'merchant' ? 'merchant' : entityType;
  const buckets =
    entityType === 'driver'
      ? [
          ACCOUNT_BUCKET.DRIVER_FLOAT,
          ACCOUNT_BUCKET.DRIVER_FLOAT_RESERVED,
          ACCOUNT_BUCKET.DRIVER_EARNINGS,
          ACCOUNT_BUCKET.DRIVER_TIPS,
          ACCOUNT_BUCKET.DRIVER_COD_COLLECTED,
          ACCOUNT_BUCKET.DRIVER_COD_LIABILITY,
        ]
      : entityType === 'merchant'
        ? [
            ACCOUNT_BUCKET.MERCHANT_PENDING,
            ACCOUNT_BUCKET.MERCHANT_AVAILABLE,
            ACCOUNT_BUCKET.MERCHANT_SETTLED,
            ACCOUNT_BUCKET.MERCHANT_CASH_CREDIT,
          ]
        : entityType === 'platform'
          ? [ACCOUNT_BUCKET.PLATFORM_REVENUE, ACCOUNT_BUCKET.PLATFORM_PENDING, ACCOUNT_BUCKET.PLATFORM_ESCROW]
          : [ACCOUNT_BUCKET.CUSTOMER_WALLET];

  const out = {};
  for (const bucket of buckets) {
    const acct = accountId(prefix, email || PLATFORM_EMAIL, bucket);
    out[bucket] = getLedgerBalance(acct);
  }
  if (entityType === 'driver') {
    out.withdrawable = parseFloat(
      (out[ACCOUNT_BUCKET.DRIVER_EARNINGS] + out[ACCOUNT_BUCKET.DRIVER_TIPS]).toFixed(2)
    );
    out.available_float = parseFloat(
      (out[ACCOUNT_BUCKET.DRIVER_FLOAT] - out[ACCOUNT_BUCKET.DRIVER_FLOAT_RESERVED]).toFixed(2)
    );
  }
  return out;
}

export { PLATFORM_EMAIL };

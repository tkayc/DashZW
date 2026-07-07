/**
 * Financial Ledger Service — immutable double-entry ledger (source of truth).
 * Corrections use reversal transactions only.
 */
import {
  persistLedgerEntries,
  findIdempotency,
  insertAuditLog,
  genId,
  listLedger,
} from './repository.js';
import { getCollection } from '../../db/localDb.js';
import { TX_TYPE } from './constants.js';

const balanceCache = new Map();

function computeBalanceFromLedger(accountId) {
  const rows = getCollection('LedgerTransaction').filter((r) => r.account_id === accountId);
  let balance = 0;
  for (const r of rows) {
    const amt = parseFloat(r.amount) || 0;
    balance += r.entry_side === 'credit' ? amt : -amt;
  }
  return parseFloat(balance.toFixed(2));
}

/**
 * Get account balance from ledger (cached in-memory per process, recomputed from JSON).
 */
export function getLedgerBalance(accountId) {
  if (balanceCache.has(accountId)) {
    return balanceCache.get(accountId);
  }
  const bal = computeBalanceFromLedger(accountId);
  balanceCache.set(accountId, bal);
  return bal;
}

export function invalidateBalanceCache(accountId) {
  if (accountId) balanceCache.delete(accountId);
  else balanceCache.clear();
}

/**
 * Post a balanced double-entry transaction.
 * @param {object} params
 * @param {string} params.transactionType
 * @param {Array<{accountId, side: 'debit'|'credit', amount}>} params.legs
 * @param {object} params.context - order_id, customer_id, driver_id, merchant_id, etc.
 */
export async function postTransaction({
  transactionType,
  legs,
  context = {},
  description = '',
  createdBy = 'system',
  idempotencyKey = null,
}) {
  if (!legs?.length) throw new Error('Ledger transaction requires legs');

  const totalDebit = legs
    .filter((l) => l.side === 'debit')
    .reduce((s, l) => s + parseFloat(l.amount), 0);
  const totalCredit = legs
    .filter((l) => l.side === 'credit')
    .reduce((s, l) => s + parseFloat(l.amount), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Unbalanced ledger: debits ${totalDebit.toFixed(2)} != credits ${totalCredit.toFixed(2)}`
    );
  }

  for (const leg of legs) {
    if (leg.amount < 0) throw new Error('Negative amounts not allowed on ledger legs');
    const bal = getLedgerBalance(leg.accountId);
    const delta = leg.side === 'credit' ? leg.amount : -leg.amount;
    const newBal = parseFloat((bal + delta).toFixed(2));
    if (newBal < -0.001) {
      throw new Error(
        `Insufficient balance on ${leg.accountId}: would be ${newBal.toFixed(2)}`
      );
    }
  }

  if (idempotencyKey) {
    const existing = await findIdempotency(idempotencyKey);
    if (existing) {
      return { transactionId: existing.transaction_id, duplicate: true, entries: [] };
    }
  }

  const transactionId = genId('txn');
  const referenceNumber = context.reference_number || `REF-${transactionId.slice(-8).toUpperCase()}`;
  const now = new Date().toISOString();

  const entries = legs.map((leg) => {
    const prev = getLedgerBalance(leg.accountId);
    const delta = leg.side === 'credit' ? leg.amount : -leg.amount;
    const balanceAfter = parseFloat((prev + delta).toFixed(2));
    balanceCache.set(leg.accountId, balanceAfter);

    return {
      transaction_id: transactionId,
      transaction_type: transactionType,
      reference_number: referenceNumber,
      order_id: context.order_id || null,
      customer_id: context.customer_id || null,
      driver_id: context.driver_id || null,
      merchant_id: context.merchant_id || null,
      account_id: leg.accountId,
      entry_side: leg.side,
      amount: parseFloat(parseFloat(leg.amount).toFixed(2)),
      balance_after: balanceAfter,
      status: 'completed',
      settlement_status: context.settlement_status || 'settled',
      description: leg.description || description,
      idempotency_key: idempotencyKey,
      created_by: createdBy,
      completed_date: now,
      metadata: context.metadata || {},
    };
  });

  const saved = await persistLedgerEntries(entries);

  insertAuditLog({
    action: 'ledger_post',
    actor_email: createdBy,
    target_type: transactionType,
    target_id: transactionId,
    payload: { legs: legs.length, order_id: context.order_id, amount: totalDebit },
  });

  return { transactionId, duplicate: false, entries: saved };
}

/**
 * Reverse a prior transaction by posting opposite legs.
 */
export async function reverseTransaction(originalTransactionId, reason, createdBy = 'system') {
  const original = getCollection('LedgerTransaction').filter(
    (r) => r.transaction_id === originalTransactionId
  );
  if (!original.length) throw new Error('Original transaction not found');

  const legs = original.map((r) => ({
    accountId: r.account_id,
    side: r.entry_side === 'credit' ? 'debit' : 'credit',
    amount: r.amount,
    description: `Reversal: ${reason}`,
  }));

  return postTransaction({
    transactionType: TX_TYPE.REVERSAL,
    legs,
    context: {
      order_id: original[0].order_id,
      metadata: { reverses: originalTransactionId, reason },
    },
    description: `Reversal of ${originalTransactionId}: ${reason}`,
    createdBy,
    idempotencyKey: `rev_${originalTransactionId}`,
  });
}

export function listAccountEntries(accountId, limit = 100) {
  return getCollection('LedgerTransaction')
    .filter((r) => r.account_id === accountId)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, limit);
}

/**
 * Driver Float Service — security deposit for COD (NOT earnings, NOT withdrawable).
 * Required Float = Merchant Amount + Platform Fee = customer_subtotal
 */
import { getLedgerBalance, postTransaction } from './ledgerService.js';
import { getCollection } from '../../db/localDb.js';
import { accountId, ACCOUNT_BUCKET, TX_TYPE, platformAccount } from './constants.js';
import { insertFloatTopUp, insertAuditLog } from './repository.js';

function driverAccounts(email) {
  return {
    float: accountId('driver', email, ACCOUNT_BUCKET.DRIVER_FLOAT),
    reserved: accountId('driver', email, ACCOUNT_BUCKET.DRIVER_FLOAT_RESERVED),
    earnings: accountId('driver', email, ACCOUNT_BUCKET.DRIVER_EARNINGS),
    tips: accountId('driver', email, ACCOUNT_BUCKET.DRIVER_TIPS),
    codCollected: accountId('driver', email, ACCOUNT_BUCKET.DRIVER_COD_COLLECTED),
    codLiability: accountId('driver', email, ACCOUNT_BUCKET.DRIVER_COD_LIABILITY),
  };
}

export function getDriverFloatSummary(driverEmail) {
  const accts = driverAccounts(driverEmail);
  const floatBalance = getLedgerBalance(accts.float);
  const floatReserved = getLedgerBalance(accts.reserved);
  const availableFloat = parseFloat((floatBalance - floatReserved).toFixed(2));
  const earnings = getLedgerBalance(accts.earnings);
  const tips = getLedgerBalance(accts.tips);
  const codCollected = getLedgerBalance(accts.codCollected);
  const codLiability = getLedgerBalance(accts.codLiability);
  const outstandingLiability = parseFloat(
    Math.max(0, codLiability - earnings - tips).toFixed(2)
  );

  return {
    driver_email: driverEmail,
    float_balance: floatBalance,
    float_reserved: floatReserved,
    available_float: availableFloat,
    earnings,
    tips,
    withdrawable_balance: parseFloat((earnings + tips).toFixed(2)),
    cod_cash_collected: codCollected,
    cod_liability: codLiability,
    outstanding_cod_liability: outstandingLiability,
  };
}

export function getRequiredFloat(order) {
  return parseFloat((order.customer_subtotal || 0).toFixed(2));
}

export function canAcceptCodOrder(driverEmail, order) {
  if (order.payment_method !== 'cash_on_delivery') {
    return { ok: true, reason: null };
  }
  const required = getRequiredFloat(order);
  const { available_float } = getDriverFloatSummary(driverEmail);
  if (available_float < required) {
    return {
      ok: false,
      reason: `Insufficient float. Need ${required.toFixed(2)}, available ${available_float.toFixed(2)}.`,
      required_float: required,
      available_float,
    };
  }
  return { ok: true, required_float: required, available_float };
}

/** Async wrapper for domain invoke */
export async function canAcceptCodOrderAsync(driverEmail, order) {
  return canAcceptCodOrder(driverEmail, order);
}

/** @deprecated use canAcceptCodOrder */
export async function canDriverAcceptOrder(driverEmail, order) {
  return canAcceptCodOrder(driverEmail, order).ok;
}

export async function isDriverBlocked(driverEmail) {
  const { available_float, outstanding_cod_liability } = getDriverFloatSummary(driverEmail);
  return available_float <= 0 && outstanding_cod_liability > 0;
}

/**
 * Reserve float when driver accepts a COD order.
 */
export async function reserveFloatForOrder(driverEmail, order, createdBy = 'system') {
  if (order.payment_method !== 'cash_on_delivery') return { reserved: 0 };
  const required = getRequiredFloat(order);
  const check = canAcceptCodOrder(driverEmail, order);
  if (!check.ok) throw new Error(check.reason);

  const accts = driverAccounts(driverEmail);

  await postTransaction({
    transactionType: TX_TYPE.DRIVER_FLOAT_RESERVE,
    legs: [
      { accountId: accts.float, side: 'debit', amount: required },
      { accountId: accts.reserved, side: 'credit', amount: required },
    ],
    context: {
      order_id: order.id,
      driver_id: driverEmail,
      metadata: { required_float: required },
    },
    description: `Float reserved for COD order #${order.id?.slice(-6)}`,
    createdBy,
    idempotencyKey: `float_reserve_${order.id}_${driverEmail}`,
  });

  insertAuditLog({
    action: 'float_reserve',
    actor_email: createdBy,
    target_type: 'order',
    target_id: order.id,
    payload: { driverEmail, required },
  });

  return {
    reserved: required,
    remaining_float: getDriverFloatSummary(driverEmail).available_float,
  };
}

export async function releaseFloatForOrder(driverEmail, order, createdBy = 'system') {
  const required = getRequiredFloat(order);
  const accts = driverAccounts(driverEmail);

  await postTransaction({
    transactionType: TX_TYPE.DRIVER_FLOAT_RELEASE,
    legs: [
      { accountId: accts.reserved, side: 'debit', amount: required },
      { accountId: accts.float, side: 'credit', amount: required },
    ],
    context: { order_id: order.id, driver_id: driverEmail },
    description: `Float released for order #${order.id?.slice(-6)}`,
    createdBy,
    idempotencyKey: `float_release_${order.id}_${driverEmail}`,
  });

  return { released: required };
}

/**
 * Driver float top-up at merchant partner — physical cash received.
 */
export async function topUpDriverFloat({
  driverEmail,
  amount,
  merchantEmail,
  merchantName,
  createdBy,
}) {
  const amt = parseFloat(parseFloat(amount).toFixed(2));
  if (amt <= 0) throw new Error('Top-up amount must be positive');

  const accts = driverAccounts(driverEmail);
  const merchantCash = accountId('merchant', merchantEmail, ACCOUNT_BUCKET.MERCHANT_CASH_CREDIT);
  const clearing = platformAccount(ACCOUNT_BUCKET.PLATFORM_CLEARING);

  const result = await postTransaction({
    transactionType: TX_TYPE.DRIVER_FLOAT_TOPUP,
    legs: [
      { accountId: accts.float, side: 'credit', amount: amt },
      { accountId: merchantCash, side: 'credit', amount: amt },
      { accountId: clearing, side: 'debit', amount: amt * 2 },
    ],
    context: {
      driver_id: driverEmail,
      merchant_id: merchantEmail,
      metadata: { merchant_name: merchantName },
    },
    description: `Driver float top-up ${amt} at ${merchantName}`,
    createdBy,
    idempotencyKey: `float_topup_${driverEmail}_${merchantEmail}_${amt}_${Date.now()}`,
  });

  if (result.duplicate) throw new Error('Duplicate top-up detected');

  const record = insertFloatTopUp({
    driver_email: driverEmail,
    merchant_email: merchantEmail,
    merchant_name: merchantName,
    amount: amt,
    transaction_id: result.transactionId,
    created_by: createdBy,
  });

  return {
    ...getDriverFloatSummary(driverEmail),
    top_up: record,
  };
}

/** Legacy alias */
export async function topUpDriver(driverEmail, amount, byEmail) {
  return topUpDriverFloat({
    driverEmail,
    amount,
    merchantEmail: byEmail,
    merchantName: 'Partner',
    createdBy: byEmail,
  });
}

export function getCodReceivables() {
  const entries = getCollection('LedgerTransaction').filter(
    (r) => r.account_id?.includes(':cod_liability')
  );
  const byDriver = {};
  for (const e of entries) {
    const email = e.account_id.split(':')[1];
    if (!byDriver[email]) byDriver[email] = 0;
    byDriver[email] += e.entry_side === 'credit' ? e.amount : -e.amount;
  }
  return Object.values(byDriver).reduce((s, v) => s + Math.max(0, v), 0);
}

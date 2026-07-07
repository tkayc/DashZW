/**
 * Merchant Settlement Service — pending → available → paid out by admin.
 */
import { getLedgerBalance, postTransaction } from './ledgerService.js';
import { accountId, ACCOUNT_BUCKET, TX_TYPE, DEFAULT_SETTLEMENT_FREQUENCY } from './constants.js';
import {
  getMerchantConfig,
  upsertMerchantConfig,
  insertSettlementRun,
} from './repository.js';
import { getCollection, saveCollection } from '../../db/localDb.js';
import { createNotification } from '../notifications/notifications.js';

function merchantAccounts(email) {
  return {
    pending: accountId('merchant', email, ACCOUNT_BUCKET.MERCHANT_PENDING),
    available: accountId('merchant', email, ACCOUNT_BUCKET.MERCHANT_AVAILABLE),
    settled: accountId('merchant', email, ACCOUNT_BUCKET.MERCHANT_SETTLED),
    cashCredit: accountId('merchant', email, ACCOUNT_BUCKET.MERCHANT_CASH_CREDIT),
  };
}

export function getMerchantFinancialSummary(merchantEmail) {
  const accts = merchantAccounts(merchantEmail);
  const pending = getLedgerBalance(accts.pending);
  const available = getLedgerBalance(accts.available);
  const settled = getLedgerBalance(accts.settled);
  const cashCredit = getLedgerBalance(accts.cashCredit);
  const config = getMerchantConfig(merchantEmail) || {
    settlement_frequency: DEFAULT_SETTLEMENT_FREQUENCY,
  };

  const history = getCollection('Settlement')
    .filter((s) => s.partner_email === merchantEmail)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const lastSettlement = history[0] || null;
  const nextSettlement = computeNextSettlementDate(config.settlement_frequency);

  const lifetimeOrders = getCollection('LedgerTransaction').filter(
    (r) => r.merchant_id === merchantEmail && r.transaction_type === TX_TYPE.MERCHANT_PENDING_CREDIT
  );

  return {
    merchant_email: merchantEmail,
    pending_settlement: pending,
    available_settlement: available,
    settled_amount: settled,
    cash_credit: cashCredit,
    total_lifetime_earnings: parseFloat((pending + available + settled).toFixed(2)),
    platform_fees_paid: 0,
    refund_deductions: 0,
    settlement_frequency: config.settlement_frequency,
    last_settlement: lastSettlement,
    next_settlement_date: nextSettlement,
    settlement_history: history.slice(0, 20),
  };
}

function computeNextSettlementDate(frequency) {
  const now = new Date();
  const d = new Date(now);
  if (frequency === 'daily') {
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    d.setHours(0, 0, 0, 0);
  } else if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1, 1);
    d.setHours(0, 0, 0, 0);
  } else {
    return null;
  }
  return d.toISOString();
}

export async function movePendingToAvailable(merchantEmail, amount, orderId) {
  const amt = parseFloat(parseFloat(amount).toFixed(2));
  if (amt <= 0) return;
  const accts = merchantAccounts(merchantEmail);
  const clearing = accountId('platform', 'platform@dashzw.com', ACCOUNT_BUCKET.PLATFORM_CLEARING);

  await postTransaction({
    transactionType: TX_TYPE.MERCHANT_AVAILABLE_CREDIT,
    legs: [
      { accountId: accts.pending, side: 'debit', amount: amt },
      { accountId: accts.available, side: 'credit', amount: amt },
    ],
    context: { order_id: orderId, merchant_id: merchantEmail },
    description: `Pending → available for order #${orderId?.slice(-6)}`,
    idempotencyKey: `pending_avail_${orderId}_${merchantEmail}`,
  });
}

export function getSettlements() {
  return getCollection('Settlement').sort(
    (a, b) => new Date(b.created_date) - new Date(a.created_date)
  );
}

export function getPartnerSettlements(partnerEmail) {
  return getSettlements().filter((s) => s.partner_email === partnerEmail);
}

export async function settlePartnerWallet(partnerEmail, shopName, method, reference, adminEmail) {
  const accts = merchantAccounts(partnerEmail);
  const balance = getLedgerBalance(accts.available);
  if (balance <= 0) throw new Error('Nothing to settle — available balance is $0 or negative.');

  await postTransaction({
    transactionType: TX_TYPE.MERCHANT_SETTLEMENT,
    legs: [
      { accountId: accts.available, side: 'debit', amount: balance },
      { accountId: accts.settled, side: 'credit', amount: balance },
    ],
    context: { merchant_id: partnerEmail, metadata: { method, reference } },
    description: `Admin settlement via ${method}`,
    createdBy: adminEmail,
    idempotencyKey: `merchant_settle_${partnerEmail}_${reference}`,
  });

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    partner_email: partnerEmail,
    shop_name: shopName,
    amount: balance,
    method,
    reference,
    settled_by: adminEmail,
    status: 'completed',
    created_date: new Date().toISOString(),
  };
  const records = getCollection('Settlement');
  records.push(record);
  saveCollection('Settlement', records);

  insertSettlementRun({
    merchant_email: partnerEmail,
    amount: balance,
    method,
    reference,
    run_by: adminEmail,
  });

  await createNotification({
    recipient_email: partnerEmail,
    title: '💳 Wallet Settled',
    body: `${balance.toFixed(2)} paid via ${method.toUpperCase()} (ref: ${reference}).`,
    type: 'wallet_credited',
    link: '/partner',
  });

  return record;
}

export function setMerchantSettlementFrequency(merchantEmail, frequency) {
  return upsertMerchantConfig(merchantEmail, { settlement_frequency: frequency });
}

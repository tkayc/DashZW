/**
 * Payout Service — driver withdrawals (earnings + tips only).
 */
import { getLedgerBalance, postTransaction } from './ledgerService.js';
import { accountId, platformAccount, ACCOUNT_BUCKET, TX_TYPE, WITHDRAWAL_FEE, FEE_TO_PLATFORM, FEE_TO_PARTNER } from './constants.js';
import { getCollection, saveCollection } from '../../db/localDb.js';
import { createNotification } from '../notifications/notifications.js';
import { getDriverFloatSummary } from './driverFloatService.js';
import { insertAuditLog } from './repository.js';

export function getWithdrawals(driverEmail) {
  return getCollection('Withdrawal')
    .filter((w) => w.driver_email === driverEmail)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}

export function getAllWithdrawals() {
  return getCollection('Withdrawal').sort(
    (a, b) => new Date(b.created_date) - new Date(a.created_date)
  );
}

export async function driverWithdraw({ driverEmail, driverName, partnerEmail, shopName, amount }) {
  const amt = parseFloat(parseFloat(amount).toFixed(2));
  if (amt <= 0) throw new Error('Amount must be positive.');

  const summary = getDriverFloatSummary(driverEmail);
  if (summary.withdrawable_balance < amt) {
    throw new Error(
      `Insufficient withdrawable balance (${summary.withdrawable_balance.toFixed(2)}). Float and COD cash cannot be withdrawn.`
    );
  }

  const cashToDriver = parseFloat((amt - WITHDRAWAL_FEE).toFixed(2));
  if (cashToDriver <= 0) throw new Error(`Withdrawal must exceed ${WITHDRAWAL_FEE} fee.`);

  const earningsAcct = accountId('driver', driverEmail, ACCOUNT_BUCKET.DRIVER_EARNINGS);
  const tipsAcct = accountId('driver', driverEmail, ACCOUNT_BUCKET.DRIVER_TIPS);
  const clearing = platformAccount(ACCOUNT_BUCKET.PLATFORM_CLEARING);
  const merchantAvail = accountId('merchant', partnerEmail, ACCOUNT_BUCKET.MERCHANT_AVAILABLE);
  const platformRev = platformAccount(ACCOUNT_BUCKET.PLATFORM_REVENUE);

  const earnBal = getLedgerBalance(earningsAcct);
  const fromEarnings = Math.min(earnBal, amt);
  const fromTips = parseFloat((amt - fromEarnings).toFixed(2));

  const legs = [];
  if (fromEarnings > 0) legs.push({ accountId: earningsAcct, side: 'debit', amount: fromEarnings });
  if (fromTips > 0) legs.push({ accountId: tipsAcct, side: 'debit', amount: fromTips });
  legs.push({ accountId: clearing, side: 'credit', amount: cashToDriver });
  legs.push({ accountId: platformRev, side: 'credit', amount: FEE_TO_PLATFORM });
  legs.push({ accountId: merchantAvail, side: 'credit', amount: FEE_TO_PARTNER });

  const idempotencyKey = `withdraw_${driverEmail}_${Date.now()}_${amt}`;

  await postTransaction({
    transactionType: TX_TYPE.WITHDRAWAL,
    legs,
    context: { driver_id: driverEmail, merchant_id: partnerEmail },
    description: `Withdrawal ${cashToDriver} at ${shopName}`,
    idempotencyKey,
  });

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    driver_email: driverEmail,
    driver_name: driverName,
    partner_email: partnerEmail,
    shop_name: shopName,
    amount_requested: amt,
    fee: WITHDRAWAL_FEE,
    cash_to_driver: cashToDriver,
    fee_to_platform: FEE_TO_PLATFORM,
    fee_to_partner: FEE_TO_PARTNER,
    status: 'completed',
    idempotency_key: idempotencyKey,
    created_date: new Date().toISOString(),
  };
  const withdrawals = getCollection('Withdrawal');
  withdrawals.push(record);
  saveCollection('Withdrawal', withdrawals);

  insertAuditLog({
    action: 'driver_withdrawal',
    actor_email: partnerEmail,
    target_type: 'driver',
    target_id: driverEmail,
    payload: { amount: amt },
  });

  await createNotification({
    recipient_email: driverEmail,
    title: '💵 Withdrawal Processed',
    body: `Withdrew ${amt.toFixed(2)} at ${shopName}. Received ${cashToDriver.toFixed(2)} cash.`,
    type: 'wallet_credited',
    link: '/driver/profile',
  });

  return record;
}

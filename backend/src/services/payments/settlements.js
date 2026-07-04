/**
 * settlements.js — wallet settlement engine
 *
 * ════════════════════════════════════════════════════════════════
 * COD PROBLEM & SOLUTION
 * ════════════════════════════════════════════════════════════════
 * For COD orders:
 *   - Driver collects full cash from customer
 *   - Platform wallet gets credited digitally (platform_earning)
 *   - Partner wallet gets credited digitally (partner_payout)
 *   - BUT no real cash moved yet — it's all digital IOUs
 *
 * Solution — the "COD Settlement Queue":
 *   When a COD order is delivered, record a PendingCodSettlement:
 *     partner owes platform:  platform_earning  (e.g. $1.75)
 *     driver owes partner:    partner_payout    (e.g. $20.00)
 *     driver owes platform:   (already tracked via driver wallet debt)
 *
 *   In practice: the driver holds all the cash. They physically hand:
 *     - $20.00 to the partner (partner_payout)
 *     - $1.75  to the platform (when topping up or via partner)
 *   So the real-money flow happens when driver does a top-up/withdrawal.
 *
 *   For the PLATFORM's COD earnings:
 *     The platform's digital wallet balance from COD represents money
 *     the driver still owes (their negative wallet balance = platform debt).
 *     When a driver tops up or does a withdrawal, the real cash flows.
 *     Admin sees a "COD Receivables" figure = sum of all negative driver wallets.
 *
 * ════════════════════════════════════════════════════════════════
 * DRIVER WITHDRAWAL — CORRECTED MATH
 * ════════════════════════════════════════════════════════════════
 * Driver wants to withdraw X from their wallet at a partner shop.
 * Total deducted from driver wallet = X (the withdrawal is what they asked for)
 * BUT the $0.50 fee comes FROM the withdrawal amount, not on top:
 *
 *   Driver wallet decremented by: X
 *   Driver receives cash:         X - $0.50  (they pay the fee from what they get)
 *   Partner earns:                $0.20  (credited to partner wallet — settled later)
 *   Platform earns:               $0.30  (credited to platform wallet)
 *   Partner pays driver:          X - $0.50  cash
 *
 * So if driver has $10.00 and withdraws $10.00:
 *   Driver wallet: $10 → $0
 *   Driver gets:   $9.50 cash
 *   Partner wallet: +R0.20
 *   Platform wallet: +R0.30
 *   Partner pays $9.50 cash — but earns $0.20 digitally → net partner outlay $9.30
 *   That $9.30 + $0.20 partner earn + $0.30 platform earn = $9.80 ≠ $10 ???
 *
 * Wait — let's re-check: partner pays $9.50 cash to driver.
 *   Partner wallet +R0.20 (fee share) credited.
 *   Partner net cost = $9.50 - $0.20 = $9.30
 *   Platform gets $0.30
 *   Total out of driver wallet: $10.00 = $9.50 (driver gets) + $0.20 (partner) + $0.30 (platform) ✓
 *
 * Partner physically pays: $9.50 cash to driver.
 * Partner digitally earns: +R0.20 (credited to wallet, settled by admin later).
 * This $0.20 credit offsets some of partner's cash outflow.
 * Net partner real cost: $9.50 - $0.20 = $9.30 (until wallet is settled).
 * ════════════════════════════════════════════════════════════════
 *
 * PARTNER SETTLEMENT (admin → partner):
 *   Partner wallet = product sales + withdrawal fee shares accumulated.
 *   Admin pays this out (EcoCash / bank) and zeros the wallet.
 */

import { getCollection, saveCollection } from '../../db/localDb.js';
import { creditWallet, debitWallet, getBalance, PLATFORM_EMAIL } from './finance.js';
import { createNotification } from '../notifications/notifications.js';

const SETTLEMENT_KEY  = 'Settlement';
const WITHDRAWAL_KEY  = 'Withdrawal';
const WITHDRAWAL_FEE  = 0.50;
const FEE_TO_PLATFORM = 0.30;
const FEE_TO_PARTNER  = 0.20;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

// ── COD receivables ───────────────────────────────────────────────────────────

/**
 * COD "receivables" for the platform = total negative balances of all driver wallets.
 * This is what drivers owe the platform from cash they collected.
 */
export function getCodReceivables() {
  const wallets = getCollection('Wallet');
  return wallets
    .filter(w => w.owner_type === 'driver' && w.balance < 0)
    .reduce((sum, w) => sum + Math.abs(w.balance), 0);
}

// ── Partner Settlements ───────────────────────────────────────────────────────

export function getSettlements() {
  return getCollection(SETTLEMENT_KEY).sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
}

export function getPartnerSettlements(partnerEmail) {
  return getCollection(SETTLEMENT_KEY)
    .filter(s => s.partner_email === partnerEmail)
    .sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
}

export async function settlePartnerWallet(partnerEmail, shopName, method, reference, adminEmail) {
  const balance = await getBalance(partnerEmail);
  if (balance <= 0) throw new Error('Nothing to settle — balance is R0 or negative.');

  await debitWallet(partnerEmail, 'partner', balance,
    `Settlement by admin — ${method.toUpperCase()} ref: ${reference}`);

  const record = {
    id: genId(), partner_email: partnerEmail, shop_name: shopName,
    amount: balance, method, reference, settled_by: adminEmail,
    status: 'completed', created_date: new Date().toISOString(),
  };
  const records = getCollection(SETTLEMENT_KEY);
  records.push(record);
  saveCollection(SETTLEMENT_KEY, records);

  createNotification({
    recipient_email: partnerEmail,
    title: '💳 Wallet Settled',
    body: `${balance.toFixed(2)} paid to you via ${method.toUpperCase()} (ref: ${reference}). Wallet reset to $0.`,
    type: 'wallet_credited', link: '/partner',
  });
  return record;
}

// ── Driver Withdrawals ────────────────────────────────────────────────────────

export function getWithdrawals(driverEmail) {
  return getCollection(WITHDRAWAL_KEY)
    .filter(w => w.driver_email === driverEmail)
    .sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
}

export function getAllWithdrawals() {
  return getCollection(WITHDRAWAL_KEY)
    .sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
}

/**
 * Driver withdraws X from wallet at a partner shop.
 *
 * Wallet math:
 *   Driver wallet:   −X
 *   Driver receives: X − $0.50  (fee deducted from payout)
 *   Platform gets:   +R0.30  credited to platform wallet
 *   Partner gets:    +R0.20  credited to partner wallet
 *   Partner pays:    X − $0.50  cash to driver
 *
 * Verification: (X − 0.50) + 0.30 + 0.20 = X ✓
 */
export async function driverWithdraw({ driverEmail, driverName, partnerEmail, shopName, amount }) {
  if (amount <= 0) throw new Error('Amount must be positive.');
  const balance = await getBalance(driverEmail);

  if (balance < amount) {
    throw new Error(
      `Insufficient balance. Wallet: ${balance.toFixed(2)}, requested: ${amount.toFixed(2)}.`
    );
  }

  const cashToDriver   = parseFloat((amount - WITHDRAWAL_FEE).toFixed(2));
  if (cashToDriver <= 0) {
    throw new Error(`Withdrawal amount must be more than the ${WITHDRAWAL_FEE} fee.`);
  }

  await debitWallet(driverEmail, 'driver', amount,
    `Withdrawal ${cashToDriver.toFixed(2)} + ${WITHDRAWAL_FEE} fee at ${shopName}`);

  await creditWallet(PLATFORM_EMAIL, 'platform', FEE_TO_PLATFORM,
    `Withdrawal fee (platform) — ${driverName} at ${shopName}`);

  await creditWallet(partnerEmail, 'partner', FEE_TO_PARTNER,
    `Withdrawal fee (shop share) — ${driverName}`);

  const record = {
    id: genId(),
    driver_email: driverEmail, driver_name: driverName,
    partner_email: partnerEmail, shop_name: shopName,
    amount_requested: amount,
    fee: WITHDRAWAL_FEE,
    cash_to_driver: cashToDriver,
    fee_to_platform: FEE_TO_PLATFORM,
    fee_to_partner: FEE_TO_PARTNER,
    driver_wallet_before: parseFloat((balance).toFixed(2)),
    driver_wallet_after: parseFloat((balance - amount).toFixed(2)),
    status: 'completed',
    created_date: new Date().toISOString(),
  };

  const records = getCollection(WITHDRAWAL_KEY);
  records.push(record);
  saveCollection(WITHDRAWAL_KEY, records);

  createNotification({
    recipient_email: driverEmail,
    title: '💵 Withdrawal Processed',
    body: `You withdrew ${amount.toFixed(2)} at ${shopName}. Received: ${cashToDriver.toFixed(2)} cash (after ${WITHDRAWAL_FEE} fee). New balance: ${(balance - amount).toFixed(2)}`,
    type: 'wallet_credited', link: '/driver/profile',
  });

  return record;
}

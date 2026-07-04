/**
 * Payments / wallet engine for the merchant platform.
 * TODO(postgresql): Persist wallets, transactions, and settlements in SQL tables.
 */
import { notifyWalletCredited, notifyDriverBlocked } from '../notifications/notifications.js';
import { applyPlatformPromoSettlement } from '../admin/adminPromotions.js';
import { calcSurgeMultiplier, applySurge } from '../admin/surgePricing.js';
/**
 * finance.js — DashZW financial engine
 *
 * ═══════════════════════════════════════════════════════════
 * PRICING MODEL (every order)
 * ═══════════════════════════════════════════════════════════
 *
 *  partnerSubtotal  = items at partner's listed price        e.g. $20.00
 *  platformFee      = 5% of partnerSubtotal                  e.g. $1.00
 *  customerSubtotal = partnerSubtotal + platformFee          e.g. $21.00
 *  deliveryFee      = distance-based (see below)             e.g. $3.00
 *  serviceFee       = $0.75 flat per order
 *  customerTotal    = customerSubtotal + deliveryFee         e.g. $24.00
 *
 *  partnerPayout    = partnerSubtotal                        e.g. $20.00
 *  platformEarning  = platformFee + serviceFee               e.g. $1.75
 *  driverEarning    = deliveryFee − serviceFee               e.g. $2.25
 *
 * ═══════════════════════════════════════════════════════════
 * CASH ON DELIVERY settlement
 * ═══════════════════════════════════════════════════════════
 *
 *  Driver physically collects: customerTotal = $24.00 cash
 *
 *  Driver wallet movement:
 *    − customerSubtotal        (they owe this to platform/partner: −R21.00)
 *    + driverEarning           (their keep from delivery fee: +R2.25)
 *    net wallet change = −R18.75  (wallet: 0 → −R18.75)
 *
 *  Platform credits from the cash driver holds:
 *    + platformEarning         credited to platform wallet: +R1.75
 *
 *  Partner credits from the cash driver holds:
 *    + partnerPayout           credited to partner wallet: +R20.00
 *
 *  Reconciliation check:
 *    Driver owes (−wallet change abs): $18.75
 *    = partnerPayout (R20.00) + platformEarning (R1.75) − driverEarning (R2.25)
 *    = $19.50 ✓  (driver keeps $2.25, owes $21.75, net: holds $24.00 cash)
 *
 *  Cash the driver holds:       $24.00
 *  Driver pays platform:        $1.75  (service fee + 5%)
 *  Driver pays partner:         $20.00 (product cost)
 *  Driver keeps:                $2.25  (delivery earning)
 *  Total:                       $24.00 ✓
 *
 * ═══════════════════════════════════════════════════════════
 * BLOCKING RULE
 * ═══════════════════════════════════════════════════════════
 *  Driver is blocked if:
 *    currentBalance − (partnerSubtotal + platformFee) < −5
 *  i.e. if accepting this job would push their debt past $5
 *  for the cart value portion they owe.
 *
 *  At job acceptance time we check:
 *    wouldBeBalance = currentBalance − customerSubtotal
 *    if wouldBeBalance < BLOCK_THRESHOLD → reject
 *
 * ═══════════════════════════════════════════════════════════
 * ONLINE PAYMENT settlement
 * ═══════════════════════════════════════════════════════════
 *  Payment already collected from customer digitally.
 *  Driver just delivers — wallet gets +driverEarning only.
 *  Partner wallet: +partnerPayout
 *  Platform wallet: +platformEarning
 */

import { getCollection, saveCollection } from '../../db/localDb.js';
import { isPostgresEnabled, query } from '../../db/pg.js';

export const PLATFORM_PERCENT   = 0.05;   // 5% platform fee on cart
export const SERVICE_FEE_PER_TIER = 0.15;  // R0.15 per R1.50 delivery fee tier
export const SERVICE_FEE_TIER_SIZE = 1.50; // tier size
export const SERVICE_FEE_THRESHOLD = 1.15; // only charged above this

/** Platform service fee on the delivery fee (new tiered formula):
 *  - deliveryFee < $1.15: platform gets $0, driver keeps all
 *  - deliveryFee >= $1.15: platform gets floor(fee / $1.50) × $0.15
 *  e.g. $1.50→$0.15, $3.00→$0.30, $4.50→$0.45
 */
export function calcServiceFee(deliveryFee) {
  if (deliveryFee < SERVICE_FEE_THRESHOLD) return 0;
  const tiers = Math.floor(deliveryFee / SERVICE_FEE_TIER_SIZE);
  return parseFloat((tiers * SERVICE_FEE_PER_TIER).toFixed(2));
}

// Keep SERVICE_FEE as a backwards-compat alias (used in COD debt calc — update below)
export const SERVICE_FEE = 0; // deprecated — use calcServiceFee(deliveryFee)
export const PER_KM_RATE        = 0.75;   // R0.75 per km
export const MIN_DELIVERY_FEE   = 1.00;   // minimum R1 for < 1km
export const HIGH_DEMAND_COUNT  = 5;      // orders to trigger surge
export const HIGH_DEMAND_MULT   = 1.10;   // +10% surge
export const BLOCK_THRESHOLD    = 0.00;   // driver blocked at zero — must top up before COD
export const PLATFORM_EMAIL     = 'platform@dashzw.com';

// ── Delivery fee ─────────────────────────────────────────────────────────────

/** Round up to nearest R0.50 */
export function roundHalf(amount) {
  return Math.ceil(amount * 2) / 2;
}

/** Distance-based delivery fee */
export function calcDeliveryFee(distanceKm, activeOrderCount = 0) {
  let fee = distanceKm < 1
    ? MIN_DELIVERY_FEE
    : roundHalf(distanceKm * PER_KM_RATE);
  if (activeOrderCount >= HIGH_DEMAND_COUNT) {
    fee = roundHalf(fee * HIGH_DEMAND_MULT);
  }
  return parseFloat(fee.toFixed(2));
}

// ── Pricing breakdown ─────────────────────────────────────────────────────────

/**
 * Build full pricing breakdown from partner's product subtotal + delivery fee.
 * Returns every number needed for checkout display and settlement.
 */
export function buildPricing(partnerSubtotal, deliveryFee) {
  const platformFee      = parseFloat((partnerSubtotal * PLATFORM_PERCENT).toFixed(2));
  const customerSubtotal = parseFloat((partnerSubtotal + platformFee).toFixed(2));
  const customerTotal    = parseFloat((customerSubtotal + deliveryFee).toFixed(2));
  const serviceFee       = calcServiceFee(deliveryFee);
  const driverEarning    = parseFloat(Math.max(0, deliveryFee - serviceFee).toFixed(2));
  const platformEarning  = parseFloat((platformFee + serviceFee).toFixed(2));

  return {
    partnerSubtotal,          // what partner listed
    platformFee,              // 5% on top
    customerSubtotal,         // what customer pays for items
    deliveryFee,              // distance-based
    serviceFee,               // tiered: R0.15 per R1.50 of delivery fee
    customerTotal,            // grand total customer pays
    partnerPayout: partnerSubtotal,  // partner gets their price back
    platformEarning,          // platform keeps 5% + tiered service fee
    driverEarning,            // driver keeps delivery − service fee
  };
}

// ── Wallet helpers ────────────────────────────────────────────────────────────

function getWalletRow(ownerEmail) {
  return getCollection('Wallet').find(w => w.owner_email === ownerEmail) || null;
}

export async function getBalance(ownerEmail, ownerType = null) {
  if (isPostgresEnabled()) {
    if (ownerType) {
      const r = await query(
        `SELECT balance FROM wallets WHERE owner_email = $1 AND owner_type = $2`,
        [ownerEmail, ownerType]
      );
      return r.rows[0] ? Number(r.rows[0].balance) : 0;
    }
    const r = await query(
      `SELECT balance FROM wallets WHERE owner_email = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [ownerEmail]
    );
    return r.rows[0] ? Number(r.rows[0].balance) : 0;
  }
  if (ownerType) {
    const wallets = getCollection('Wallet');
    const w = wallets.find(w => w.owner_email === ownerEmail && w.owner_type === ownerType);
    return w ? w.balance : 0;
  }
  const w = getWalletRow(ownerEmail);
  return w ? w.balance : 0;
}

async function saveWalletChange(ownerEmail, ownerType, delta, reason, txType = null) {
  if (isPostgresEnabled()) {
    const type = ownerType || 'customer';
    let r = await query(
      `SELECT * FROM wallets WHERE owner_email = $1 AND owner_type = $2`,
      [ownerEmail, type]
    );
    let w = r.rows[0];
    if (!w) {
      const id = 'wal_' + ownerEmail.replace(/[^a-z0-9]/gi, '_');
      r = await query(
        `INSERT INTO wallets (id, owner_email, owner_type, balance) VALUES ($1,$2,$3,0) RETURNING *`,
        [id, ownerEmail, type]
      );
      w = r.rows[0];
    }
    const balance = parseFloat((Number(w.balance) + delta).toFixed(2));
    r = await query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [balance, w.id]
    );
    w = r.rows[0];
    await query(
      `INSERT INTO transactions (id, wallet_id, owner_email, owner_type, amount, type, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        'txn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        w.id,
        ownerEmail,
        type,
        delta,
        txType || (delta >= 0 ? 'credit' : 'debit'),
        reason,
      ]
    );
    return { ...w, balance: Number(w.balance), owner_email: ownerEmail, owner_type: type };
  }

  const wallets = getCollection('Wallet');
  let w = wallets.find(w => w.owner_email === ownerEmail && (!ownerType || w.owner_type === ownerType));
  if (!w) {
    w = {
      id: ownerEmail.replace(/[^a-z0-9]/gi, '_') + '_wallet',
      owner_email: ownerEmail,
      owner_type: ownerType,
      balance: 0,
      created_date: new Date().toISOString(),
    };
    wallets.push(w);
  }
  w.balance = parseFloat((w.balance + delta).toFixed(2));
  w.updated_date = new Date().toISOString();
  saveCollection('Wallet', wallets);

  const txs = getCollection('Transaction');
  txs.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    owner_email: ownerEmail,
    owner_type: ownerType,
    amount: delta,
    type: txType || (delta >= 0 ? 'credit' : 'debit'),
    reason,
    balance_after: w.balance,
    created_date: new Date().toISOString(),
  });
  saveCollection('Transaction', txs);

  return w;
}

/**
 * Internal wallet mutations — not for customer-facing invoke.
 * Customers must never call these via /api/domain/invoke (enforced in domain.js).
 */
export async function creditWallet(email, type, amount, reason, txType = null) {
  return saveWalletChange(email, type, Math.abs(amount), reason, txType || 'credit');
}

export async function debitWallet(email, type, amount, reason, txType = null) {
  return saveWalletChange(email, type, -Math.abs(amount), reason, txType || 'debit');
}

// ── Blocking logic ────────────────────────────────────────────────────────────

/**
 * Check if driver can accept a specific order.
 * Blocked if (currentBalance − customerSubtotal − serviceFee) < BLOCK_THRESHOLD (0)
 * i.e. if collecting this order's cash would push debt past $5.
 *
 * For online orders, driver never owes anything → always allowed.
 */
export async function canDriverAcceptOrder(driverEmail, order) {
  if (order.payment_method !== 'cash_on_delivery') return true;
  const currentBalance = await getBalance(driverEmail);
  const serviceFee = calcServiceFee(order.delivery_fee || 0);
  const debt = parseFloat(((order.customer_subtotal || 0) + serviceFee).toFixed(2));
  const projectedBalance = parseFloat((currentBalance - debt).toFixed(2));
  return projectedBalance >= BLOCK_THRESHOLD;
}

/** Hard block — driver owes too much regardless of new orders */
export async function isDriverBlocked(driverEmail) {
  return (await getBalance(driverEmail)) <= BLOCK_THRESHOLD;
}

// ── Settlement ────────────────────────────────────────────────────────────────

/**
 * settleOrder — called when driver marks order as DELIVERED.
 *
 * CASH ON DELIVERY:
 *   Driver physically holds: customerTotal cash
 *   - Driver wallet −= customerSubtotal  (they owe products + platform fee to platform)
 *   - Driver wallet += driverEarning     (their cut of delivery fee)
 *   - Platform wallet += platformEarning (5% + service fee)
 *   - Partner wallet += partnerPayout    (product cost)
 *
 *   Money flow verification:
 *     Cash driver holds: customerTotal = customerSubtotal + deliveryFee
 *     Driver pays out:   partnerPayout + platformEarning = customerSubtotal
 *     Driver keeps:      driverEarning = deliveryFee − serviceFee
 *     Total:             customerSubtotal + driverEarning = customerTotal ✓
 *
 * ONLINE PAYMENT (already collected from customer):
 *   - Partner wallet += partnerPayout
 *   - Platform wallet += platformEarning
 *   - Driver wallet += driverEarning
 */
export async function settleOrder(order) {
  const {
    id, driver_email, partner_email, payment_method,
    partner_payout, platform_earning, driver_earning,
    customer_subtotal, delivery_fee,
  } = order;

  const ref = `Order #${id?.slice(-6)}`;
  const isCash = payment_method === 'cash_on_delivery';

  if (isCash) {
    const driverDebt = parseFloat((customer_subtotal + calcServiceFee(delivery_fee || 0)).toFixed(2));

    if (driver_email) {
      await debitWallet(driver_email, 'driver', driverDebt,
        `COD — owes partner + platform (${driverDebt.toFixed(2)}) - ${ref}`);
    }

    await creditWallet(PLATFORM_EMAIL, 'platform', platform_earning,
      `Platform fee (5% + service) - ${ref}`);

    if (partner_email) {
      await creditWallet(partner_email, 'partner', partner_payout,
        `Product sales - ${ref}`);
    }

  } else {
    if (partner_email) {
      await creditWallet(partner_email, 'partner',  partner_payout,    `Product sales - ${ref}`);
    }
    await creditWallet(PLATFORM_EMAIL,  'platform', platform_earning,  `Platform fee - ${ref}`);
    if (driver_email) {
      await creditWallet(driver_email,  'driver',   driver_earning,    `Delivery earning - ${ref}`);
    }
  }

  await applyPlatformPromoSettlement(order);

  if (driver_email) {
    const wasBlocked = await _updateDriverBlockStatus(driver_email);
    if (wasBlocked) notifyDriverBlocked(driver_email);
  }
}

async function _updateDriverBlockStatus(driverEmail) {
  const balance = await getBalance(driverEmail);
  const shouldBlock = balance <= BLOCK_THRESHOLD;
  if (isPostgresEnabled()) {
    await query(
      `UPDATE driver_profiles SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
       WHERE email = $2`,
      [JSON.stringify({ is_blocked: shouldBlock }), driverEmail]
    );
  } else {
    const profiles = getCollection('DriverProfile');
    const idx = profiles.findIndex(p => p.email === driverEmail);
    if (idx >= 0) {
      profiles[idx].is_blocked = shouldBlock;
      profiles[idx].updated_date = new Date().toISOString();
      saveCollection('DriverProfile', profiles);
    }
  }
  return shouldBlock;
}

/** Top up driver wallet — partner collects cash, credits digitally */
export async function topUpDriver(driverEmail, amount, byEmail) {
  await creditWallet(driverEmail, 'driver', amount, `Top-up by ${byEmail}`);
  await _updateDriverBlockStatus(driverEmail);
  return getBalance(driverEmail);
}

/** Refund unavailable item to customer wallet */
export async function refundToCustomerWallet(customerEmail, amount, reason) {
  const result = await creditWallet(customerEmail, 'customer', amount, reason);
  notifyWalletCredited(customerEmail, amount, reason);
  return result;
}

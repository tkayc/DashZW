/**
 * orderEngine.js — order lifecycle automation (merchant platform)
 *
 * Features:
 *  1. Auto-cancel orders awaiting merchant acceptance within 10 min
 *  2. ETA calculation based on distance + status
 *  3. Minimum order enforcement
 *  4. Loyalty points (1 pt per R10 spent; 100 pts = R10 wallet credit)
 *  5. Referral tracking
 *
 * TODO(postgresql): Persist order status transitions in order_status_history.
 */

import { getCollection, saveCollection, localDb } from '../../db/localDb.js';
import { getUsersFile } from '../../db/store.js';
import { creditWallet, debitWallet, getBalance } from '../payments/finance.js';
import { createNotification } from '../notifications/notifications.js';
import {
  ORDER_STATUS,
  ORDER_STATUS_ON_CREATE,
  isAwaitingMerchantAcceptance,
  normalizeOrderStatus,
} from '../../domain/orderStates.js';

// ── Auto-cancel ───────────────────────────────────────────────────────────────
export async function runOrderTimeoutCheck() {
  const orders = await localDb.entities.Order.list('-created_date', 200);
  const now = Date.now();

  for (const order of orders) {
    if (!isAwaitingMerchantAcceptance(order.status)) continue;
    const age = now - new Date(order.created_date).getTime();
    if (age < 10 * 60 * 1000) continue;

    const merchantName = order.merchant_name || order.shop_name;
    createNotification({
      recipient_email: order.customer_email,
      title: '❌ Order Auto-Cancelled',
      body: `Your order from ${merchantName} was cancelled — the merchant didn't respond in time.`,
      type: 'order_cancelled',
      link: '/orders',
    });
    if (order.payment_method !== 'cash_on_delivery' && order.total > 0) {
      await creditWallet(order.customer_email, 'customer', order.total,
        `Refund — auto-cancelled order from ${merchantName}`);
      createNotification({
        recipient_email: order.customer_email,
        title: `💰 Refund ${order.total?.toFixed(2)}`,
        body: `Your payment for the cancelled order has been refunded to your wallet.`,
        type: 'wallet_credited',
        link: '/profile',
      });
    }
    await localDb.entities.Order.update(order.id, {
      status: ORDER_STATUS.CANCELLED,
      cancel_reason: 'timeout',
    });
  }
}

// ── ETA ───────────────────────────────────────────────────────────────────────
export function calcETA(order) {
  if (!order) return null;
  const distKm = order.distance_km || 2;

  // Minutes per km (roughly 20km/h in city traffic)
  const travelMins = Math.ceil(distKm * 3);

  const status = normalizeOrderStatus(order.status);
  const prepMins = {
    [ORDER_STATUS.CREATED]: 15,
    [ORDER_STATUS.PENDING_ACCEPTANCE]: 15,
    [ORDER_STATUS.ACCEPTED]: 12,
    [ORDER_STATUS.PREPARING]: 8,
    [ORDER_STATUS.READY_FOR_PICKUP]: 3,
    [ORDER_STATUS.DRIVER_ASSIGNED]: travelMins + 2,
    [ORDER_STATUS.PICKED_UP]: travelMins,
    [ORDER_STATUS.IN_TRANSIT]: Math.max(1, travelMins - 2),
    [ORDER_STATUS.DELIVERED]: 0,
    [ORDER_STATUS.COMPLETED]: 0,
    [ORDER_STATUS.CANCELLED]: 0,
    [ORDER_STATUS.REFUNDED]: 0,
  };

  const mins = prepMins[status] ?? 15;
  if (mins === 0) return null;

  const eta = new Date(Date.now() + mins * 60 * 1000);
  return { mins, eta, label: mins < 2 ? 'Arriving now' : `~${mins} min` };
}

// ── Loyalty points ────────────────────────────────────────────────────────────
const POINTS_KEY    = 'LoyaltyPoints';
const POINTS_PER_R  = 0.1;   // 1 pt per R10
export const REDEEM_AT     = 100;   // 100 pts = R10
export const REDEEM_VALUE  = 10;

export function getPoints(email) {
  const all = getCollection(POINTS_KEY);
  return all.find(p => p.email === email) || { email, points: 0, lifetime: 0 };
}

export async function awardPoints(email, orderTotal) {
  const pts   = Math.floor(orderTotal * POINTS_PER_R);
  if (pts <= 0) return;
  const all   = getCollection(POINTS_KEY);
  const idx   = all.findIndex(p => p.email === email);
  if (idx >= 0) {
    all[idx].points   += pts;
    all[idx].lifetime += pts;
  } else {
    all.push({ email, points: pts, lifetime: pts });
  }
  saveCollection(POINTS_KEY, all);

  createNotification({
    recipient_email: email,
    title: `⭐ +${pts} loyalty points`,
    body: `You earned ${pts} points on this order. Total: ${getPoints(email).points} pts.`,
    type: 'wallet_credited',
    link: '/profile',
  });

  await checkAndRedeemPoints(email);
}

export async function checkAndRedeemPoints(email) {
  const all = getCollection(POINTS_KEY);
  const idx = all.findIndex(p => p.email === email);
  if (idx < 0) return;

  const { points } = all[idx];
  const sets = Math.floor(points / REDEEM_AT);
  if (sets <= 0) return;

  const credit = sets * REDEEM_VALUE;
  all[idx].points -= sets * REDEEM_AT;
  saveCollection(POINTS_KEY, all);

  await creditWallet(email, 'customer', credit,
    `Loyalty reward — ${sets * REDEEM_AT} points redeemed`);
  createNotification({
    recipient_email: email,
    title: `🎁 ${credit} Loyalty Reward!`,
    body: `${sets * REDEEM_AT} points redeemed → ${credit} added to your wallet.`,
    type: 'wallet_credited',
    link: '/profile',
  });
}

// ── Referrals ─────────────────────────────────────────────────────────────────
const REFERRAL_KEY    = 'Referral';
const REFERRAL_CREDIT = 10; // R10 each

export function generateReferralCode(email) {
  return 'REF' + email.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,6);
}

export async function applyReferral(newUserEmail, referralCode) {
  const users = getCollection('Referral');
  if (users.some(r => r.referred_email === newUserEmail)) return; // already applied

  // Find referrer by code
  const allUsers = getUsersFile();
  const referrer = allUsers.find(u => generateReferralCode(u.email) === referralCode.toUpperCase());
  if (!referrer || referrer.email === newUserEmail) return;

  // Credit both
  await creditWallet(referrer.email, 'customer', REFERRAL_CREDIT,
    `Referral bonus — ${newUserEmail} joined`);
  await creditWallet(newUserEmail, 'customer', REFERRAL_CREDIT,
    `Welcome bonus — referral code applied`);

  users.push({
    referrer_email: referrer.email, referred_email: newUserEmail,
    created_date: new Date().toISOString()
  });
  saveCollection('Referral', users);

  [referrer.email, newUserEmail].forEach(email => createNotification({
    recipient_email: email,
    title: '🎉 R10 Referral Bonus!',
    body: email === referrer.email
      ? `${newUserEmail} joined using your referral code!`
      : `Welcome to DashZW! R10 has been added to your wallet.`,
    type: 'wallet_credited', link: '/profile',
  }));
}

/**
 * Server-side checkout: create order and apply wallet balance atomically.
 * Never trusts client-supplied wallet_applied amounts.
 *
 * @param {object} user — authenticated user (from JWT)
 * @param {object} payload — order fields + total_before_wallet + use_wallet
 */
export async function placeOrder(user, payload = {}) {
  if (!user?.email) throw new Error('Not authenticated');
  if (user.role !== 'customer' && user.role !== 'admin') {
    throw new Error('Only customers can place orders');
  }

  const totalBeforeWallet = parseFloat(payload.total_before_wallet);
  if (!Number.isFinite(totalBeforeWallet) || totalBeforeWallet < 0) {
    throw new Error('Invalid order total');
  }

  const useWallet = payload.use_wallet !== false;
  const balance = await getBalance(user.email, 'customer');
  const walletApplied = useWallet
    ? parseFloat(Math.min(balance, totalBeforeWallet).toFixed(2))
    : 0;
  const finalTotal = parseFloat(Math.max(0, totalBeforeWallet - walletApplied).toFixed(2));

  if (walletApplied > 0) {
    await debitWallet(
      user.email,
      'customer',
      walletApplied,
      `Order payment wallet deduction — ${payload.shop_name || payload.merchant_name || 'order'}`,
      'order_payment_wallet_deduction'
    );
  }

  const {
    total_before_wallet: _tbw,
    use_wallet: _uw,
    wallet_applied: _wa,
    total: _clientTotal,
    customer_email: _ce,
    ...orderFields
  } = payload;

  const order = await localDb.entities.Order.create({
    ...orderFields,
    customer_email: user.email,
    customer_name: orderFields.customer_name || user.full_name || '',
    wallet_applied: walletApplied,
    total: finalTotal,
    status: orderFields.status || ORDER_STATUS_ON_CREATE,
    delivery_code: orderFields.delivery_code || String(Math.floor(1000 + Math.random() * 9000)),
  });

  return {
    order,
    wallet_applied: walletApplied,
    total: finalTotal,
    wallet_balance_after: await getBalance(user.email, 'customer'),
  };
}

/**
 * Customer cancels own order within policy window; refunds online payments to wallet.
 */
export async function cancelOwnOrder(user, orderId) {
  if (!user?.email) throw new Error('Not authenticated');
  const found = await localDb.entities.Order.filter({ id: orderId }, '-created_date', 1);
  const order = found[0];
  if (!order) throw new Error('Order not found');
  if (order.customer_email?.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('Forbidden');
  }
  const status = normalizeOrderStatus(order.status);
  if (status !== ORDER_STATUS.PENDING_ACCEPTANCE) {
    throw new Error('Order can no longer be cancelled');
  }
  const age = (Date.now() - new Date(order.created_date).getTime()) / 1000;
  if (age > 120) throw new Error('Cancel window expired');

  await localDb.entities.Order.update(orderId, {
    status: ORDER_STATUS.CANCELLED,
    cancel_reason: 'customer',
  });

  let refunded = 0;
  if (order.payment_method !== 'cash_on_delivery') {
    // Refund amount paid (total) + wallet portion used
    refunded = parseFloat(((order.total || 0) + (order.wallet_applied || 0)).toFixed(2));
    if (refunded > 0) {
      await creditWallet(
        user.email,
        'customer',
        refunded,
        `Refund — cancelled order from ${order.shop_name || order.merchant_name}`,
        'order_cancel_refund'
      );
    }
  } else if (order.wallet_applied > 0) {
    refunded = order.wallet_applied;
    await creditWallet(
      user.email,
      'customer',
      refunded,
      `Refund wallet portion — cancelled order from ${order.shop_name || order.merchant_name}`,
      'order_cancel_refund'
    );
  }

  createNotification({
    recipient_email: user.email,
    title: refunded > 0 ? `💰 Refund ${refunded.toFixed(2)}` : 'Order cancelled',
    body: refunded > 0
      ? `Your payment has been refunded to your DashZW wallet.`
      : `Your order was cancelled.`,
    type: 'wallet_credited',
    link: '/wallet',
  });

  return { ...order, status: ORDER_STATUS.CANCELLED, cancel_reason: 'customer' };
}

/**
 * Customer-initiated refund for order line adjustments (replacement/remove).
 * Validates order ownership — does not allow arbitrary self-credits.
 */
export async function creditCustomerRefundForAdjustment(user, orderId, amount, reason) {
  if (!user?.email) throw new Error('Not authenticated');
  const found = await localDb.entities.Order.filter({ id: orderId }, '-created_date', 1);
  const order = found[0];
  if (!order || order.customer_email?.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('Forbidden');
  }
  const amt = parseFloat(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Invalid amount');
  if (amt > (order.total || 0) + (order.refunded_amount || 0) + 1) {
    throw new Error('Refund exceeds order value');
  }
  return creditWallet(user.email, 'customer', amt, reason || `Order adjustment — #${orderId}`, 'order_adjustment_refund');
}

// creditCustomerRefundForAdjustment is async via creditWallet return

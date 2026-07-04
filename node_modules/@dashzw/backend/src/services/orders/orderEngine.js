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

import { getCollection, saveCollection } from '../../db/localDb.js';
import { getUsersFile } from '../../db/store.js';
import { creditWallet } from '../payments/finance.js';
import { createNotification } from '../notifications/notifications.js';
import {
  ORDER_STATUS,
  isAwaitingMerchantAcceptance,
  normalizeOrderStatus,
} from '../../domain/orderStates.js';

// ── Auto-cancel ───────────────────────────────────────────────────────────────
export function runOrderTimeoutCheck() {
  const orders = getCollection('Order');
  const now    = Date.now();
  let changed  = false;

  const updated = orders.map(order => {
    if (!isAwaitingMerchantAcceptance(order.status)) return order;
    const age = now - new Date(order.created_date).getTime();
    if (age < 10 * 60 * 1000) return order; // < 10 min

    // Auto-cancel
    changed = true;
    const merchantName = order.merchant_name || order.shop_name;
    createNotification({
      recipient_email: order.customer_email,
      title: '❌ Order Auto-Cancelled',
      body: `Your order from ${merchantName} was cancelled — the merchant didn't respond in time.`,
      type: 'order_cancelled',
      link: '/orders',
    });
    // Refund to wallet for online payments
    if (order.payment_method !== 'cash_on_delivery' && order.total > 0) {
      creditWallet(order.customer_email, 'customer', order.total,
        `Refund — auto-cancelled order from ${merchantName}`);
      createNotification({
        recipient_email: order.customer_email,
        title: `💰 Refund R${order.total?.toFixed(2)}`,
        body: `Your payment for the cancelled order has been refunded to your wallet.`,
        type: 'wallet_credited',
        link: '/profile',
      });
    }
    return {
      ...order,
      status: ORDER_STATUS.CANCELLED,
      cancel_reason: 'timeout',
      updated_date: new Date().toISOString(),
    };
  });

  if (changed) saveCollection('Order', updated);
  return changed;
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

export function awardPoints(email, orderTotal) {
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

  // Auto-redeem if >= 100 pts
  checkAndRedeemPoints(email);
}

export function checkAndRedeemPoints(email) {
  const all = getCollection(POINTS_KEY);
  const idx = all.findIndex(p => p.email === email);
  if (idx < 0) return;

  const { points } = all[idx];
  const sets = Math.floor(points / REDEEM_AT);
  if (sets <= 0) return;

  const credit = sets * REDEEM_VALUE;
  all[idx].points -= sets * REDEEM_AT;
  saveCollection(POINTS_KEY, all);

  creditWallet(email, 'customer', credit,
    `Loyalty reward — ${sets * REDEEM_AT} points redeemed`);
  createNotification({
    recipient_email: email,
    title: `🎁 R${credit} Loyalty Reward!`,
    body: `${sets * REDEEM_AT} points redeemed → R${credit} added to your wallet.`,
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

export function applyReferral(newUserEmail, referralCode) {
  const users = getCollection('Referral');
  if (users.some(r => r.referred_email === newUserEmail)) return; // already applied

  // Find referrer by code
  const allUsers = getUsersFile();
  const referrer = allUsers.find(u => generateReferralCode(u.email) === referralCode.toUpperCase());
  if (!referrer || referrer.email === newUserEmail) return;

  // Credit both
  creditWallet(referrer.email, 'customer', REFERRAL_CREDIT,
    `Referral bonus — ${newUserEmail} joined`);
  creditWallet(newUserEmail, 'customer', REFERRAL_CREDIT,
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

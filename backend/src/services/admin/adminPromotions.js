/**
 * adminPromotions.js — Platform-level promotions managed by admin
 *
 * Unlike shop promotions (which apply to specific shops),
 * platform promotions apply globally across ALL shops.
 *
 * Types:
 *  free_delivery       — admin pays the delivery fee from platform wallet
 *  platform_discount   — admin funds a % or fixed discount
 *  new_user_discount   — discount for first order
 *  loyalty_reward      — reward after N orders
 *  flash_sale          — time-limited discount
 *  referral            — discount for referring a new user
 */

import { getCollection, saveCollection, localDb } from '../../db/localDb.js';
import { isPostgresEnabled } from '../../db/pg.js';
import { creditWallet, debitWallet, PLATFORM_EMAIL } from '../payments/finance.js';

const KEY = 'AdminPromotion';

function genId() {
  return 'adm_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getAdminPromotions() {
  if (isPostgresEnabled()) {
    return localDb.entities.AdminPromotion.list('-created_date', 100);
  }
  return getCollection(KEY).sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
}

export async function createAdminPromotion(data) {
  if (isPostgresEnabled()) {
    return localDb.entities.AdminPromotion.create({
      ...data,
      times_used: 0,
      is_active: data.is_active !== false,
    });
  }
  const promos = getCollection(KEY);
  const promo = {
    ...data,
    id: genId(),
    times_used: 0,
    is_active: true,
    created_by: 'admin@dashzw.com',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  };
  promos.push(promo);
  saveCollection(KEY, promos);
  return promo;
}

export async function updateAdminPromotion(id, data) {
  if (isPostgresEnabled()) {
    return localDb.entities.AdminPromotion.update(id, data);
  }
  const promos = getCollection(KEY);
  const idx = promos.findIndex(p => p.id === id);
  if (idx < 0) throw new Error('Promo not found');
  promos[idx] = { ...promos[idx], ...data, updated_date: new Date().toISOString() };
  saveCollection(KEY, promos);
  return promos[idx];
}

export async function deleteAdminPromotion(id) {
  if (isPostgresEnabled()) {
    return localDb.entities.AdminPromotion.delete(id);
  }
  saveCollection(KEY, getCollection(KEY).filter(p => p.id !== id));
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateAdminCoupon(code, customerEmail, orderSubtotal) {
  const promos = getCollection(KEY);
  const promo = promos.find(p =>
    p.coupon_code?.toUpperCase() === code?.toUpperCase() &&
    p.is_active
  );

  if (!promo) return { valid: false, error: 'Invalid coupon code.' };

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];

  if (promo.start_date && todayStr < promo.start_date)
    return { valid: false, error: 'This coupon is not active yet.' };
  if (promo.end_date && todayStr > promo.end_date)
    return { valid: false, error: 'This coupon has expired.' };
  if (promo.applicable_days?.length > 0 && !promo.applicable_days.includes(dayName))
    return { valid: false, error: `This coupon is only valid on: ${promo.applicable_days.join(', ')}.` };
  if (promo.min_order_amount && orderSubtotal < promo.min_order_amount)
    return { valid: false, error: `Minimum order ${promo.min_order_amount.toFixed(2)} required.` };
  if (promo.max_uses && promo.times_used >= promo.max_uses)
    return { valid: false, error: 'This coupon has reached its usage limit.' };
  if (promo.new_users_only) {
    const pastOrders = getCollection('Order').filter(o => o.customer_email === customerEmail && o.status === 'delivered');
    if (pastOrders.length > 0) return { valid: false, error: 'This coupon is for new customers only.' };
  }

  return { valid: true, promo };
}

// ── Settlement: platform-funded discounts ─────────────────────────────────────

/**
 * Called at order delivery settlement.
 * If a platform promo was applied, the platform wallet funds it.
 */
export async function applyPlatformPromoSettlement(order) {
  if (!order.admin_promo_id) return;

  const promos = getCollection(KEY);
  const promo = promos.find(p => p.id === order.admin_promo_id);
  if (!promo) return;

  const ref = `Platform promo "${promo.title}" - Order #${order.id?.slice(-6)}`;

  if (promo.promo_type === 'free_delivery') {
    await debitWallet(PLATFORM_EMAIL, 'platform', order.driver_earning || 0,
      `Free delivery funded - Order #${order.id?.slice(-6)}`);
    if (order.driver_email) {
      await creditWallet(order.driver_email, 'driver', order.driver_earning || 0,
        `Delivery earning (platform-funded free delivery) - Order #${order.id?.slice(-6)}`);
    }
  } else if (['platform_discount','new_user_discount','flash_sale','loyalty_reward','referral'].includes(promo.promo_type)) {
    const discount = order.admin_discount_amount || 0;
    if (discount > 0) {
      await debitWallet(PLATFORM_EMAIL, 'platform', discount, ref);
    }
  }

  // Increment usage
  const idx = promos.findIndex(p => p.id === promo.id);
  if (idx >= 0) {
    promos[idx].times_used = (promos[idx].times_used || 0) + 1;
    saveCollection(KEY, promos);
  }
}

// ── Calc discount ─────────────────────────────────────────────────────────────

export function calcAdminPromoDiscount(promo, subtotal, deliveryFee) {
  if (!promo) return { discountAmount: 0, freeDelivery: false };

  switch (promo.promo_type) {
    case 'free_delivery':
      return { discountAmount: 0, freeDelivery: true };
    case 'platform_discount':
    case 'new_user_discount':
    case 'flash_sale':
    case 'loyalty_reward':
    case 'referral':
      if (promo.discount_type === 'percentage')
        return { discountAmount: parseFloat((subtotal * promo.discount_value / 100).toFixed(2)), freeDelivery: false };
      if (promo.discount_type === 'fixed')
        return { discountAmount: Math.min(promo.discount_value, subtotal), freeDelivery: false };
      return { discountAmount: 0, freeDelivery: false };
    default:
      return { discountAmount: 0, freeDelivery: false };
  }
}

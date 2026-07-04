/**
 * etaEngine.js — Predictive ETA with merchant prep time + traffic factor
 *
 * Algorithm:
 *   ETA = merchantPrepTime + travelTime × trafficMultiplier + handoffBuffer
 *
 * Prep time: based on item count and merchant category
 * Travel time: distance / average speed (adjusted by time of day)
 * Traffic multiplier: peaks at lunch (12-14h) and dinner (18-20h)
 * Handoff buffer: 2 min for driver to receive order at merchant branch
 *
 * TODO(postgresql): Optionally cache ETA snapshots on orders table.
 */

import {
  ORDER_STATUS,
  normalizeOrderStatus,
  isTerminalOrderStatus,
} from '@/domain/orderStates.js';

function getAverageSpeedKmh() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 9) return 18;
  if (hour >= 11 && hour < 14) return 20;
  if (hour >= 17 && hour < 20) return 16;
  if (hour >= 22 || hour < 6) return 35;
  return 28;
}

export function getTrafficLabel() {
  const hour = new Date().getHours();
  if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 20)) {
    return { label: 'Heavy traffic', color: 'text-red-600', emoji: '🚦' };
  }
  if (hour >= 11 && hour < 14) {
    return { label: 'Moderate traffic', color: 'text-orange-500', emoji: '🟠' };
  }
  if (hour >= 22 || hour < 6) {
    return { label: 'Clear roads', color: 'text-green-600', emoji: '🟢' };
  }
  return { label: 'Normal traffic', color: 'text-green-500', emoji: '🟢' };
}

/** Prep minutes by merchant category (not food-only). */
function calcMerchantPrepMins(items = [], merchantCategory = '') {
  const itemCount = items.reduce((s, i) => s + (i.quantity || 1), 0);

  const basePrepByCategory = {
    fast_food: 8,
    bakery: 6,
    drinks: 5,
    desserts: 7,
    grocery: 4,
    pharmacy: 5,
    convenience: 4,
    flowers: 6,
    hardware: 8,
    electronics: 10,
    restaurant: 15,
    other: 12,
  };

  const base = basePrepByCategory[merchantCategory] || 12;
  const itemExtra = Math.max(0, itemCount - 2) * 1.5;
  return Math.round(base + itemExtra);
}

export function calcAccurateETA(order) {
  if (!order) return null;
  const status = normalizeOrderStatus(order.status);
  if (isTerminalOrderStatus(status)) return null;

  const distKm = order.distance_km || 2;
  const speedKmh = getAverageSpeedKmh();
  const travelMin = Math.ceil((distKm / speedKmh) * 60);
  const category = order.merchant_category || order.shop_category || '';
  const prepMin = calcMerchantPrepMins(order.items, category);
  const handoff = 2;

  let remainingMins;
  const ageMin = (Date.now() - new Date(order.created_date).getTime()) / 60000;

  switch (status) {
    case ORDER_STATUS.CREATED:
    case ORDER_STATUS.PENDING_ACCEPTANCE:
      remainingMins = Math.max(2, prepMin + travelMin + handoff - ageMin);
      break;
    case ORDER_STATUS.ACCEPTED:
      remainingMins = Math.max(2, prepMin + travelMin + handoff);
      break;
    case ORDER_STATUS.PREPARING:
      remainingMins = Math.max(2, prepMin * 0.6 + travelMin + handoff);
      break;
    case ORDER_STATUS.READY_FOR_PICKUP:
      remainingMins = Math.max(2, travelMin + handoff);
      break;
    case ORDER_STATUS.DRIVER_ASSIGNED:
      remainingMins = Math.max(2, travelMin + handoff);
      break;
    case ORDER_STATUS.PICKED_UP:
      remainingMins = Math.max(2, travelMin);
      break;
    case ORDER_STATUS.IN_TRANSIT:
      remainingMins = Math.max(1, travelMin * 0.5);
      break;
    default:
      remainingMins = Math.max(2, prepMin + travelMin);
  }

  const mins = Math.round(remainingMins);
  const eta = new Date(Date.now() + mins * 60 * 1000);
  return {
    mins,
    eta,
    label: mins < 2 ? 'Arriving now' : `~${mins} min`,
    prepMin,
    travelMin,
  };
}

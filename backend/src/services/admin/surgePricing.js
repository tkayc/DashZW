/**
 * surgePricing.js — Automated delivery fee multiplier
 *
 * Triggers:
 *  - High demand: >N active orders in the system
 *  - Rush hour: time-based surge
 *  - Bad weather: manually set by admin
 *  - Low driver supply: few online drivers vs active orders
 *
 * Multiplier range: 1.0x (normal) → 2.0x (max)
 * Customer sees: "Surge pricing in effect" with reason
 */

import { getCollection } from '../../db/localDb.js';
import { getMeta, setMeta, getUsersFile } from '../../db/store.js';
import { isActiveOrderStatus } from '../../domain/orderStates.js';

const SURGE_KEY = 'dashzw_surge_config';

export function getSurgeConfig() {
  return getMeta(SURGE_KEY) || {};
}

export function setSurgeConfig(config) {
  setMeta(SURGE_KEY, {
    ...getSurgeConfig(),
    ...config,
    updated_at: new Date().toISOString(),
  });
}

export function calcSurgeMultiplier() {
  const config = getSurgeConfig();

  // Manual weather/event override from admin
  if (config.manual_surge && config.manual_multiplier > 1) {
    return {
      multiplier: Math.min(2.0, config.manual_multiplier),
      active: true,
      reason: config.manual_reason || 'High demand',
      source: 'manual',
    };
  }

  // Auto: time-based rush hour
  const hour = new Date().getHours();
  const isLunchRush  = hour >= 12 && hour <= 13;
  const isDinnerRush = hour >= 18 && hour <= 20;

  if ((isLunchRush || isDinnerRush) && config.auto_time_surge !== false) {
    // Check active orders vs drivers
    const orders  = getCollection('Order').filter(o => isActiveOrderStatus(o.status));
    const drivers = getUsersFile().filter((u) => u.role === 'driver');

    const ratio = drivers.length > 0 ? orders.length / drivers.length : 0;
    if (ratio > 2) { // more than 2 orders per driver
      return {
        multiplier: Math.min(1.5, 1.0 + ratio * 0.1),
        active: true,
        reason: isDinnerRush ? 'Dinner rush' : 'Lunch rush',
        source: 'auto',
        orders: orders.length,
        drivers: drivers.length,
      };
    }
  }

  // High demand: many active orders
  if (config.auto_demand_surge !== false) {
    const activeOrders = getCollection('Order').filter(o => isActiveOrderStatus(o.status));
    const threshold = config.demand_threshold || 10;
    if (activeOrders.length >= threshold) {
      const extra = Math.floor((activeOrders.length - threshold) / 5) * 0.1;
      return {
        multiplier: Math.min(1.8, 1.1 + extra),
        active: true,
        reason: 'High demand',
        source: 'auto',
        activeOrders: activeOrders.length,
      };
    }
  }

  return { multiplier: 1.0, active: false, reason: null, source: null };
}

/** Apply surge to a delivery fee */
export function applySurge(deliveryFee, surge) {
  if (!surge?.active || surge.multiplier <= 1) return deliveryFee;
  return parseFloat((deliveryFee * surge.multiplier).toFixed(2));
}

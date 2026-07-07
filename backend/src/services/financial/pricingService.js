/**
 * Pricing Service — pure pricing calculations (no DB).
 */
import {
  PLATFORM_PERCENT,
  SERVICE_FEE_PER_TIER,
  SERVICE_FEE_TIER_SIZE,
  SERVICE_FEE_THRESHOLD,
  PER_KM_RATE,
  MIN_DELIVERY_FEE,
  HIGH_DEMAND_COUNT,
  HIGH_DEMAND_MULT,
} from './constants.js';

export {
  PLATFORM_PERCENT,
  SERVICE_FEE_PER_TIER,
  SERVICE_FEE_TIER_SIZE,
  SERVICE_FEE_THRESHOLD,
  PER_KM_RATE,
  MIN_DELIVERY_FEE,
  HIGH_DEMAND_COUNT,
  HIGH_DEMAND_MULT,
  BLOCK_THRESHOLD,
  PLATFORM_EMAIL,
} from './constants.js';

export const SERVICE_FEE = 0;

export function calcServiceFee(deliveryFee) {
  if (deliveryFee < SERVICE_FEE_THRESHOLD) return 0;
  const tiers = Math.floor(deliveryFee / SERVICE_FEE_TIER_SIZE);
  return parseFloat((tiers * SERVICE_FEE_PER_TIER).toFixed(2));
}

export function roundHalf(amount) {
  return Math.ceil(amount * 2) / 2;
}

export function calcDeliveryFee(distanceKm, activeOrderCount = 0) {
  let fee = distanceKm < 1
    ? MIN_DELIVERY_FEE
    : roundHalf(distanceKm * PER_KM_RATE);
  if (activeOrderCount >= HIGH_DEMAND_COUNT) {
    fee = roundHalf(fee * HIGH_DEMAND_MULT);
  }
  return parseFloat(fee.toFixed(2));
}

export function buildPricing(partnerSubtotal, deliveryFee) {
  const platformFee = parseFloat((partnerSubtotal * PLATFORM_PERCENT).toFixed(2));
  const customerSubtotal = parseFloat((partnerSubtotal + platformFee).toFixed(2));
  const customerTotal = parseFloat((customerSubtotal + deliveryFee).toFixed(2));
  const serviceFee = calcServiceFee(deliveryFee);
  const driverEarning = parseFloat(Math.max(0, deliveryFee - serviceFee).toFixed(2));
  const platformEarning = parseFloat((platformFee + serviceFee).toFixed(2));

  return {
    partnerSubtotal,
    platformFee,
    customerSubtotal,
    deliveryFee,
    serviceFee,
    customerTotal,
    partnerPayout: partnerSubtotal,
    platformEarning,
    driverEarning,
  };
}

/** Customer receipt line items — merchant price NEVER combined with platform fee */
export function buildCustomerReceipt(orderOrPricing) {
  const p = orderOrPricing.partner_subtotal != null
    ? {
        partnerSubtotal: orderOrPricing.partner_subtotal,
        platformFee: orderOrPricing.platform_fee,
        deliveryFee: orderOrPricing.delivery_fee || 0,
        serviceFee: orderOrPricing.service_fee,
        driverTip: orderOrPricing.driver_tip || 0,
        discount: orderOrPricing.discount_amount || 0,
        walletApplied: orderOrPricing.wallet_applied || 0,
      }
    : {
        partnerSubtotal: orderOrPricing.partnerSubtotal,
        platformFee: orderOrPricing.platformFee,
        deliveryFee: orderOrPricing.deliveryFee || 0,
        serviceFee: orderOrPricing.serviceFee,
        driverTip: 0,
        discount: 0,
        walletApplied: 0,
      };

  const itemsSubtotal = p.partnerSubtotal;
  const platformFee = p.platformFee;
  const deliveryFee = p.deliveryFee;
  const serviceFee = p.serviceFee;
  const tip = p.driverTip;
  const coupon = p.discount;
  const wallet = p.walletApplied;

  const subtotalBeforeDiscount = parseFloat(
    (itemsSubtotal + platformFee + deliveryFee).toFixed(2)
  );
  const total = parseFloat(
    Math.max(0, subtotalBeforeDiscount - coupon + tip - wallet).toFixed(2)
  );

  return {
    lines: [
      { key: 'items', label: 'Items', amount: itemsSubtotal },
      { key: 'platform_fee', label: 'Platform Fee (5%)', amount: platformFee },
      { key: 'delivery_fee', label: 'Delivery Fee', amount: deliveryFee },
      ...(serviceFee > 0
        ? [{ key: 'service_fee', label: 'Service Fee', amount: serviceFee, includedIn: 'delivery_fee' }]
        : []),
      ...(tip > 0 ? [{ key: 'tip', label: 'Driver Tip', amount: tip }] : []),
      ...(coupon > 0 ? [{ key: 'coupon', label: 'Coupon', amount: -coupon }] : []),
      ...(wallet > 0 ? [{ key: 'wallet', label: 'Wallet Credit', amount: -wallet }] : []),
    ],
    items_subtotal: itemsSubtotal,
    platform_fee: platformFee,
    delivery_fee: deliveryFee,
    service_fee: serviceFee,
    driver_tip: tip,
    coupon_discount: coupon,
    wallet_credit: wallet,
    total,
  };
}

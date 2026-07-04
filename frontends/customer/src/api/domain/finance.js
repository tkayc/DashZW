import { invoke } from '../client.js';

export const PLATFORM_PERCENT = 0.05;
export const PLATFORM_EMAIL = 'platform@dashzw.com';

export const calcServiceFee = (df) => invoke('finance', 'calcServiceFee', [df]);
export const calcDeliveryFee = (d, c) => invoke('finance', 'calcDeliveryFee', [d, c]);
export const buildPricing = (s, d) => invoke('finance', 'buildPricing', [s, d]);
export const getBalance = (e, t) => invoke('finance', 'getBalance', [e, t]);
/** @deprecated Customers cannot call these — server returns 403. Use placeOrder / cancelOwnOrder. */
export const creditWallet = (e, t, a, r) => invoke('finance', 'creditWallet', [e, t, a, r]);
/** @deprecated Customers cannot call these — server returns 403. Use placeOrder. */
export const debitWallet = (e, t, a, r) => invoke('finance', 'debitWallet', [e, t, a, r]);
export const canDriverAcceptOrder = (e, o) => invoke('finance', 'canDriverAcceptOrder', [e, o]);
export const isDriverBlocked = (e) => invoke('finance', 'isDriverBlocked', [e]);
export const settleOrder = (o) => invoke('finance', 'settleOrder', [o]);
export const topUpDriver = (e, a, b) => invoke('finance', 'topUpDriver', [e, a, b]);
export const refundToCustomerWallet = (e, a, r) => invoke('finance', 'refundToCustomerWallet', [e, a, r]);

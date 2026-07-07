/**
 * payments/finance.js — backward-compatible facade over financial module.
 */
export {
  PLATFORM_PERCENT,
  SERVICE_FEE,
  SERVICE_FEE_PER_TIER,
  SERVICE_FEE_TIER_SIZE,
  SERVICE_FEE_THRESHOLD,
  PER_KM_RATE,
  MIN_DELIVERY_FEE,
  HIGH_DEMAND_COUNT,
  HIGH_DEMAND_MULT,
  BLOCK_THRESHOLD,
  PLATFORM_EMAIL,
  calcServiceFee,
  roundHalf,
  calcDeliveryFee,
  buildPricing,
  getBalance,
  creditWallet,
  debitWallet,
  canDriverAcceptOrder,
  isDriverBlocked,
  settleOrder,
  topUpDriver,
  refundToCustomerWallet,
} from '../financial/index.js';

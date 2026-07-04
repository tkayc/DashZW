/**
 * Driver Service — driver wallet checks and COD eligibility.
 * Core wallet math lives in Payments; this module is the driver-facing surface.
 */
export {
  getBalance,
  canDriverAcceptOrder,
  isDriverBlocked,
  topUpDriver,
  settleOrder,
} from '../payments/finance.js';

export { driverWithdraw, getWithdrawals } from '../payments/settlements.js';

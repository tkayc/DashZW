/**
 * payments/settlements.js — backward-compatible facade over financial module.
 */
export {
  getCodReceivables,
  getSettlements,
  getPartnerSettlements,
  settlePartnerWallet,
  getWithdrawals,
  getAllWithdrawals,
  driverWithdraw,
} from '../financial/index.js';

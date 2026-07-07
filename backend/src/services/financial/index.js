/**
 * Financial module — public API and backward-compatible facade.
 */
export * from './constants.js';
export * from './pricingService.js';
export * from './ledgerService.js';
export * from './walletService.js';
export * from './driverFloatService.js';
export * from './settlementService.js';
export * from './merchantSettlementService.js';
export * from './platformRevenueService.js';
export * from './payoutService.js';
export * from './transactionService.js';
export * from './accountingService.js';

import { notifyWalletCredited, notifyDriverBlocked } from '../notifications/notifications.js';
import { creditWallet, getBalance } from './walletService.js';
import { isDriverBlocked as _isBlocked } from './driverFloatService.js';

export async function refundToCustomerWallet(customerEmail, amount, reason) {
  const result = await creditWallet(customerEmail, 'customer', amount, reason);
  notifyWalletCredited(customerEmail, amount, reason);
  return result;
}

async function _updateDriverBlockStatus(driverEmail) {
  const shouldBlock = await _isBlocked(driverEmail);
  const { getCollection, saveCollection } = await import('../../db/localDb.js');
  const { isPostgresEnabled, query } = await import('../../db/pg.js');
  if (isPostgresEnabled()) {
    await query(
      `UPDATE driver_profiles SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
       WHERE email = $2`,
      [JSON.stringify({ is_blocked: shouldBlock }), driverEmail]
    );
  } else {
    const profiles = getCollection('DriverProfile');
    const idx = profiles.findIndex((p) => p.email === driverEmail);
    if (idx >= 0) {
      profiles[idx].is_blocked = shouldBlock;
      profiles[idx].updated_date = new Date().toISOString();
      saveCollection('DriverProfile', profiles);
    }
  }
  return shouldBlock;
}

export { _updateDriverBlockStatus };

// Re-export settlements compat
export {
  getSettlements,
  getPartnerSettlements,
  settlePartnerWallet,
} from './merchantSettlementService.js';

export {
  getWithdrawals,
  getAllWithdrawals,
  driverWithdraw,
} from './payoutService.js';

export { getCodReceivables } from './driverFloatService.js';

export { buildCustomerReceipt } from './pricingService.js';
export { getFinancialDashboard, getAuditLogs } from './accountingService.js';
export { getDriverFloatSummary, canAcceptCodOrder, canAcceptCodOrderAsync, reserveFloatForOrder, topUpDriverFloat } from './driverFloatService.js';
export { getMerchantFinancialSummary } from './merchantSettlementService.js';
export { getPlatformRevenueSummary } from './platformRevenueService.js';
export { filterTransactions } from './transactionService.js';

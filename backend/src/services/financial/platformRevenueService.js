/**
 * Platform Revenue Service — aggregate platform financial position.
 */
import { getCollection } from '../../db/localDb.js';
import { getLedgerBalance } from './ledgerService.js';
import { platformAccount, ACCOUNT_BUCKET, TX_TYPE } from './constants.js';
import { getCodReceivables } from './driverFloatService.js';

export function getPlatformRevenueSummary() {
  const revenue = getLedgerBalance(platformAccount(ACCOUNT_BUCKET.PLATFORM_REVENUE));
  const pending = getLedgerBalance(platformAccount(ACCOUNT_BUCKET.PLATFORM_PENDING));
  const clearing = getLedgerBalance(platformAccount(ACCOUNT_BUCKET.PLATFORM_CLEARING));

  const ledger = getCollection('LedgerTransaction');
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  function sumInPeriod(start, typeFilter = null) {
    return ledger
      .filter((r) => {
        if (new Date(r.created_date) < start) return false;
        if (typeFilter && r.transaction_type !== typeFilter) return false;
        return r.account_id === platformAccount(ACCOUNT_BUCKET.PLATFORM_REVENUE) && r.entry_side === 'credit';
      })
      .reduce((s, r) => s + (r.amount || 0), 0);
  }

  const merchantLiability = ledger
    .filter((r) => r.account_id?.startsWith('merchant:') && r.account_id?.endsWith(':pending') && r.entry_side === 'credit')
    .reduce((s, r) => s + r.amount, 0);

  const driverFloatTotal = ledger
    .filter((r) => r.account_id?.includes(':float') && !r.account_id?.includes('reserved') && r.entry_side === 'credit')
    .reduce((s, r) => s + r.amount, 0)
    - ledger
      .filter((r) => r.account_id?.includes(':float') && !r.account_id?.includes('reserved') && r.entry_side === 'debit')
      .reduce((s, r) => s + r.amount, 0);

  const withdrawableDriverEarnings = ledger
    .filter((r) => (r.account_id?.endsWith(':earnings') || r.account_id?.endsWith(':tips')) && r.entry_side === 'credit')
    .reduce((s, r) => s + r.amount, 0)
    - ledger
      .filter((r) => (r.account_id?.endsWith(':earnings') || r.account_id?.endsWith(':tips')) && r.entry_side === 'debit')
      .reduce((s, r) => s + r.amount, 0);

  return {
    platform_revenue: revenue,
    pending_revenue: pending,
    clearing_balance: clearing,
    merchant_liability: parseFloat(merchantLiability.toFixed(2)),
    driver_float_total: parseFloat(driverFloatTotal.toFixed(2)),
    outstanding_cod_liability: getCodReceivables(),
    withdrawable_driver_earnings: parseFloat(withdrawableDriverEarnings.toFixed(2)),
    daily_revenue: parseFloat(sumInPeriod(dayStart).toFixed(2)),
    weekly_revenue: parseFloat(sumInPeriod(weekStart).toFixed(2)),
    monthly_revenue: parseFloat(sumInPeriod(monthStart).toFixed(2)),
    delivery_revenue: parseFloat(
      ledger
        .filter((r) => r.transaction_type === TX_TYPE.DELIVERY_FEE)
        .reduce((s, r) => s + r.amount, 0)
        .toFixed(2)
    ),
    platform_fees: parseFloat(
      ledger
        .filter((r) => r.transaction_type === TX_TYPE.PLATFORM_FEE)
        .reduce((s, r) => s + r.amount, 0)
        .toFixed(2)
    ),
    refunds: parseFloat(
      ledger
        .filter((r) => r.transaction_type === TX_TYPE.REFUND)
        .reduce((s, r) => s + r.amount, 0)
        .toFixed(2)
    ),
  };
}

/**
 * Accounting Service — financial dashboard aggregates and reports.
 */
import { getCollection } from '../../db/localDb.js';
import { getPlatformRevenueSummary } from './platformRevenueService.js';
import { getMerchantFinancialSummary } from './merchantSettlementService.js';
import { getDriverFloatSummary } from './driverFloatService.js';
import { filterTransactions } from './transactionService.js';
import { getSettlements } from './merchantSettlementService.js';
import { getAllWithdrawals } from './payoutService.js';
import { normalizeOrderStatus, ORDER_STATUS } from '../../domain/orderStates.js';

function isSuccessfulOrder(order) {
  const s = normalizeOrderStatus(order.status);
  return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED;
}

export function getFinancialDashboard(filters = {}) {
  const platform = getPlatformRevenueSummary();
  const orders = getCollection('Order');
  const successful = orders.filter(isSuccessfulOrder);

  const settlementQueue = getSettlements().filter((s) => s.status === 'pending');
  const withdrawals = getAllWithdrawals().slice(0, 50);
  const recentTransactions = filterTransactions({ ...filters, limit: 100 });

  const merchants = [...new Set(successful.map((o) => o.partner_email).filter(Boolean))];
  const merchantSummaries = merchants.slice(0, 20).map((e) => getMerchantFinancialSummary(e));

  const drivers = [...new Set(successful.map((o) => o.driver_email).filter(Boolean))];
  const driverSummaries = drivers.slice(0, 20).map((e) => getDriverFloatSummary(e));

  const gmv = successful.reduce((s, o) => s + (o.customer_subtotal || 0) + (o.delivery_fee || 0), 0);

  return {
    platform,
    gmv: parseFloat(gmv.toFixed(2)),
    total_orders: orders.length,
    completed_orders: successful.length,
    settlement_queue: settlementQueue,
    recent_withdrawals: withdrawals,
    recent_transactions: recentTransactions,
    merchant_summaries: merchantSummaries,
    driver_summaries: driverSummaries,
    cash_flow: {
      inflows: platform.platform_revenue + platform.monthly_revenue,
      outflows: settlementsTotal(),
      net: platform.platform_revenue - settlementsTotal(),
    },
  };
}

function settlementsTotal() {
  return getSettlements()
    .filter((s) => s.status === 'completed')
    .reduce((s, r) => s + (r.amount || 0), 0);
}

export function getAuditLogs(limit = 100) {
  return getCollection('FinancialAuditLog')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, limit);
}

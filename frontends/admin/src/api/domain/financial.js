import { invoke } from '../client.js';

export const getFinancialDashboard = (filters) =>
  invoke('financial', 'getFinancialDashboard', [filters || {}]);
export const getAuditLogs = (limit) =>
  invoke('financial', 'getAuditLogs', [limit || 100]);
export const getDriverFloatSummary = (email) =>
  invoke('financial', 'getDriverFloatSummary', [email]);
export const getMerchantFinancialSummary = (email) =>
  invoke('financial', 'getMerchantFinancialSummary', [email]);
export const getPlatformRevenueSummary = () =>
  invoke('financial', 'getPlatformRevenueSummary', []);
export const filterTransactions = (filters) =>
  invoke('financial', 'filterTransactions', [filters || {}]);
export const buildCustomerReceipt = (order) =>
  invoke('financial', 'buildCustomerReceipt', [order], { public: true });
export const canAcceptCodOrder = (driverEmail, order) =>
  invoke('financial', 'canAcceptCodOrder', [driverEmail, order]);
export const topUpDriverFloat = (payload) =>
  invoke('financial', 'topUpDriverFloat', [payload]);

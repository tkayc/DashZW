import { invoke } from '../client.js';

export const getDriverFloatSummary = (email) =>
  invoke('financial', 'getDriverFloatSummary', [email]);
export const canAcceptCodOrder = (driverEmail, order) =>
  invoke('financial', 'canAcceptCodOrder', [driverEmail, order]);
export const getMerchantFinancialSummary = (email) =>
  invoke('financial', 'getMerchantFinancialSummary', [email]);
export const topUpDriverFloat = (payload) =>
  invoke('financial', 'topUpDriverFloat', [payload]);

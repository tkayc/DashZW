import { invoke } from '../client.js';

export const getMerchantFinancialSummary = (email) =>
  invoke('financial', 'getMerchantFinancialSummary', [email]);
export const topUpDriverFloat = (payload) =>
  invoke('financial', 'topUpDriverFloat', [payload]);

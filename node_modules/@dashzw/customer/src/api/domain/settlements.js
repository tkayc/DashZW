import { invoke } from '../client.js';

export const getCodReceivables = () => invoke('settlements', 'getCodReceivables', []);
export const getSettlements = () => invoke('settlements', 'getSettlements', []);
export const getPartnerSettlements = (e) => invoke('settlements', 'getPartnerSettlements', [e]);
export const settlePartnerWallet = (...a) => invoke('settlements', 'settlePartnerWallet', a);
export const getWithdrawals = (e) => invoke('settlements', 'getWithdrawals', [e]);
export const driverWithdraw = (p) => invoke('settlements', 'driverWithdraw', [p]);

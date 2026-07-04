import { invoke } from '../client.js';

export const REDEEM_AT = 100;
export const REDEEM_VALUE = 10;
export const getPoints = (e) => invoke('orderEngine', 'getPoints', [e]);
export const awardPoints = (e, t) => invoke('orderEngine', 'awardPoints', [e, t]);
export const generateReferralCode = (e) => invoke('orderEngine', 'generateReferralCode', [e]);

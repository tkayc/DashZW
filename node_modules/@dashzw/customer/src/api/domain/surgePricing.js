import { invoke } from '../client.js';

export const getSurgeConfig = () => invoke('surgePricing', 'getSurgeConfig', []);
export const setSurgeConfig = (c) => invoke('surgePricing', 'setSurgeConfig', [c]);
export const calcSurgeMultiplier = () =>
  invoke('surgePricing', 'calcSurgeMultiplier', [], { public: true });

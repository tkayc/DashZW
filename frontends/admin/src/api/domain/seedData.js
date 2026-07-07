import { invoke } from '../client.js';

export const resetOrderData = () => invoke('seedData', 'resetOrderData', []);
export const factoryReset = () => invoke('seedData', 'factoryReset', []);

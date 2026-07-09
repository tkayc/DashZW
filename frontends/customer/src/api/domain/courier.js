import { invoke } from '../client.js';

export const placeCourierOrder = (payload) => invoke('courier', 'placeCourierOrder', [payload]);

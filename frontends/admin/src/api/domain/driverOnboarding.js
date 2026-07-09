import { invoke } from '../client.js';

export const listPendingDrivers = () =>
  invoke('driverOnboarding', 'listPendingDrivers', []);

export const setDriverVerification = (driverEmail, { status, reason } = {}) =>
  invoke('driverOnboarding', 'setDriverVerification', [driverEmail, { status, reason }]);

export const getDriverOnboardingStatus = (email) =>
  invoke('driverOnboarding', 'getDriverOnboardingStatus', email ? [email] : []);

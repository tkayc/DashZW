import { invoke, apiFetch } from '../client.js';

export const registerDriver = (payload) =>
  invoke('driverOnboarding', 'registerDriver', [payload], { public: true });

export const getDriverOnboardingStatus = (email) =>
  invoke('driverOnboarding', 'getDriverOnboardingStatus', email ? [email] : []);

export const getRoadSafetyQuiz = () =>
  invoke('driverOnboarding', 'getRoadSafetyQuiz', [], { public: true });

export const submitRoadSafetyQuiz = (answers) =>
  invoke('driverOnboarding', 'submitRoadSafetyQuiz', [answers]);

export const listPendingDrivers = () =>
  invoke('driverOnboarding', 'listPendingDrivers', []);

export const setDriverVerification = (driverEmail, { status, reason } = {}) =>
  invoke('driverOnboarding', 'setDriverVerification', [driverEmail, { status, reason }]);

export async function uploadDriverDocument(dataUrl, docType, filename) {
  return apiFetch('/api/uploads/driver-document', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, docType, filename }),
  });
}

export async function assertDriverCanAcceptJobs() {
  const status = await getDriverOnboardingStatus();
  if (status.needs_registration) throw new Error('Complete driver registration first');
  if (status.verification_status !== 'approved') {
    throw new Error('Your documents are still under review (usually 24–72 hours).');
  }
  if (!status.quiz_passed) {
    throw new Error('Complete the road safety quiz to activate your account.');
  }
  return status;
}

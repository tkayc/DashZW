import { createLocationApi } from '@location/api/locationApi.js';
import { getApiBaseUrl, getToken } from './client.js';

export const locationApi = createLocationApi({ getApiBaseUrl, getToken });
export * from '@location/services/index.js';

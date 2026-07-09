import { createUseRealtimeQuery } from '@shared/hooks/useRealtimeQuery.js';
import { invalidateCollection } from '../client.js';

export const useRealtimeQuery = createUseRealtimeQuery(invalidateCollection);

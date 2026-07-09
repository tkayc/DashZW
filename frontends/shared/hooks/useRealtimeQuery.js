import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { subscribeSse } from '../realtime/sseHub.js';
import { invalidateQueriesForCollection } from '../realtime/queryInvalidation.js';

/**
 * React Query + server SSE (v16) — mirrors v15 BroadcastChannel instant invalidation.
 *
 * @param {object} options — useQuery options
 * @param {function} [invalidateCollection] — app client cache bust (from api/client.js)
 */
export function createUseRealtimeQuery(invalidateCollection) {
  return function useRealtimeQuery(options) {
    const qc = useQueryClient();

    useEffect(() => {
      return subscribeSse(({ collection }) => {
        invalidateQueriesForCollection(qc, collection, invalidateCollection);
        if (options.queryKey) {
          qc.invalidateQueries({ queryKey: options.queryKey });
        }
      });
    }, [qc, JSON.stringify(options.queryKey)]);

    const { refetchInterval: userInterval, ...rest } = options;
    const refetchInterval =
      userInterval ??
      (isOrderRelatedQuery(options.queryKey) ? 2000 : 5000);

    return useQuery({
      staleTime: 0,
      refetchInterval,
      refetchOnWindowFocus: true,
      ...rest,
    });
  };
}

function isOrderRelatedQuery(queryKey) {
  const root = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  if (typeof root !== 'string') return false;
  return (
    root === 'order' ||
    root === 'myOrders' ||
    root.startsWith('partner-orders') ||
    root.startsWith('driver-')
  );
}

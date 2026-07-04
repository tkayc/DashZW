/**
 * useRealtimeQuery.js
 * Drop-in wrapper around react-query's useQuery that also
 * re-fetches whenever another tab writes to the shared DB
 * via BroadcastChannel — giving real-time cross-app updates.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { subscribeToDbChanges } from '@/api';

export function useRealtimeQuery(options) {
  const qc = useQueryClient();

  useEffect(() => {
    const unsub = subscribeToDbChanges(() => {
      qc.invalidateQueries({ queryKey: options.queryKey });
    });
    return unsub;
  }, [JSON.stringify(options.queryKey)]);

  return useQuery({
    refetchInterval: 3000, // fallback polling
    ...options,
  });
}

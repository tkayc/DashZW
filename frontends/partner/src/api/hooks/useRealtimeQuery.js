import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getApiBaseUrl, invalidateCollection } from '../client.js';

export function useRealtimeQuery(options) {
  const qc = useQueryClient();

  useEffect(() => {
    const url = `${getApiBaseUrl()}/api/events`;
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      try {
        const { collection } = JSON.parse(ev.data);
        if (collection) invalidateCollection(collection);
      } catch {}
      qc.invalidateQueries({ queryKey: options.queryKey });
    };
    return () => es.close();
  }, [JSON.stringify(options.queryKey)]);

  return useQuery({
    refetchInterval: 3000,
    ...options,
  });
}

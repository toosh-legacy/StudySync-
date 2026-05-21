import { useEffect, useState } from 'react';
import { getConnections } from '../lib/api';
import {
  getStorage,
  setStorage,
  type ConnectionStatus,
} from '../lib/storage';

const FIVE_MIN = 5 * 60 * 1000;

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getStorage('connections_cache');
      const cachedAt = (await getStorage('connections_cached_at')) ?? 0;
      if (cached && Date.now() - cachedAt < FIVE_MIN) {
        if (!cancelled) setConnections(cached.filter((c) => c.connected));
        return;
      }
      try {
        const fresh = await getConnections();
        await setStorage({
          connections_cache: fresh,
          connections_cached_at: Date.now(),
        });
        if (!cancelled) setConnections(fresh.filter((c) => c.connected));
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load connections');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { connections, error };
}

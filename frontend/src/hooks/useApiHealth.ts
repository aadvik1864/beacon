import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiHealth, type ApiHealth } from '../lib/api';

export function useApiHealth() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [state, setState] = useState<'checking' | 'connected' | 'offline'>('checking');
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const id = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    setState('checking');
    try {
      const result = await getApiHealth(controller.signal);
      if (id === generation.current) {
        setHealth(result);
        setState('connected');
      }
    } catch {
      if (id === generation.current) {
        setHealth(null);
        setState('offline');
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { generation.current++; request.current?.abort(); };
  }, [refresh]);

  return { health, state, refresh };
}

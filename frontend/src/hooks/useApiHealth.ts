import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiHealth } from '../lib/api';

export function useApiHealth(enabled = true) {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [state, setState] = useState<'checking' | 'connected' | 'offline'>('checking');
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    setState('checking');
    try {
      const { getApiHealth } = await import('../lib/api');
      controller.signal.throwIfAborted();
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
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refresh();
    return () => { generation.current++; request.current?.abort(); };
  }, [refresh, enabled]);

  return { health, state, refresh };
}

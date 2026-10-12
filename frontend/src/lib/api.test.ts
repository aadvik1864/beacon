import { describe, expect, it, vi } from 'vitest';
import { getApiHealth, runSimulation, clearApiCaptures } from './api';
import { baselineRecord } from '../test/runFixture';
import { simulationInputSchema } from './experiment';

describe('local health response validation', () => {
  it('does not accept an unexpected cloud-enabled backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      status: 'ok', product: 'Beacon', version: '0.2.0', stage: 'local-simulation', aws_enabled: true, paid_inference_enabled: true,
    }) }));
    await expect(getApiHealth(new AbortController().signal)).rejects.toThrow('Unexpected API configuration');
  });

  it('reports unsuccessful requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(getApiHealth(new AbortController().signal)).rejects.toThrow('successful response');
  });
});

describe('private API requests', () => {
  const token = 'synthetic-csrf-token-with-no-server-secret';
  const input = () => simulationInputSchema.parse({ mode: 'simulation', idempotency_key: crypto.randomUUID(), policy: 'Employees receive 20 days of leave.', question: 'Leave?', behavior: 'follow', target: 'protected' });

  it('uses same-origin HttpOnly cookies and a fresh CSRF token per action', async () => {
    const record = await baselineRecord();
    const fetch = vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url === '/api/session' ? { token } : record }));
    vi.stubGlobal('fetch', fetch);
    await runSimulation(input(), new AbortController().signal);
    await runSimulation(input(), new AbortController().signal);
    expect(fetch.mock.calls.filter(([url]) => url === '/api/session')).toHaveLength(2);
    for (const [, options] of fetch.mock.calls) {
      expect(options.credentials).toBe('same-origin');
      expect(options.cache).toBe('no-store');
    }
    expect(fetch.mock.calls[1][1].headers['X-Beacon-Token']).toBe(token);
    expect(fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('reports expired SSO without retrying or accepting a fabricated result', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetch);
    await expect(runSimulation(input(), new AbortController().signal)).rejects.toThrow('Sign-in expired');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears the authenticated API cache with a protected same-origin request', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token }) }).mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetch);
    await clearApiCaptures(new AbortController().signal);
    expect(fetch.mock.calls[1][0]).toBe('/api/captures/clear');
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'X-Beacon-Token': token } });
  });

  it('does not claim server deletion if it cannot be confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ token }) }).mockResolvedValueOnce({ ok: false, status: 403 }));
    await expect(clearApiCaptures(new AbortController().signal)).rejects.toThrow('could not be confirmed');
  });
});

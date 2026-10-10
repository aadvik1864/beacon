import { describe, expect, it, vi } from 'vitest';
import { getApiHealth } from './api';

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

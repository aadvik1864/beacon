import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiHealth, type ApiHealth } from '../lib/api';
import { useApiHealth } from './useApiHealth';

vi.mock('../lib/api', () => ({ getApiHealth: vi.fn() }));

const health: ApiHealth = {
  status: 'ok', product: 'Beacon', version: '0.2.0', stage: 'local-simulation',
  aws_enabled: false, paid_inference_enabled: false,
};

beforeEach(() => {
  vi.mocked(getApiHealth).mockReset();
});

describe('API readiness', () => {
  it('does not check or refresh the API in browser-demo mode', async () => {
    const { result } = renderHook(() => useApiHealth(false));
    await act(() => result.current.refresh());
    expect(getApiHealth).not.toHaveBeenCalled();
    expect(result.current.health).toBeNull();
  });

  it('reports a successful health check', async () => {
    vi.mocked(getApiHealth).mockResolvedValue(health);
    const { result } = renderHook(() => useApiHealth());
    await waitFor(() => expect(result.current.state).toBe('connected'));
    expect(result.current.health).toEqual(health);
  });

  it('reports a failed check as offline', async () => {
    vi.mocked(getApiHealth).mockRejectedValue(new Error('API offline'));
    const { result } = renderHook(() => useApiHealth());
    await waitFor(() => expect(result.current.state).toBe('offline'));
    expect(result.current.health).toBeNull();
  });

  it('does not send a request after unmounting during module loading', async () => {
    const { unmount } = renderHook(() => useApiHealth());
    unmount();
    await act(async () => {});
    expect(getApiHealth).not.toHaveBeenCalled();
  });
});

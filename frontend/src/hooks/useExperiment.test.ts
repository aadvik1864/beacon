import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExperiment } from './useExperiment';
import { runSimulation } from '../lib/api';
import { baselineRecord } from '../test/runFixture';
import type { RunRecord } from '../lib/experiment';

vi.mock('../lib/api', () => ({ runSimulation: vi.fn() }));

beforeEach(() => { vi.mocked(runSimulation).mockReset(); });

describe('experiment controls', () => {
  it('blocks overlapping submissions and captures immutable inputs', async () => {
    const record = await baselineRecord();
    let finish!: (record: RunRecord) => void;
    vi.mocked(runSimulation).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useExperiment());
    let pending!: Promise<void>;
    act(() => { pending = result.current.run('protected'); void result.current.run('protected'); });
    expect(runSimulation).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(true);
    await act(async () => { finish(record); await pending; });
    expect(result.current.record).toEqual(record);
    act(() => result.current.setPolicy('Employees receive 28 days of annual leave.'));
    expect(result.current.dirty).toBe(true);
    expect(result.current.record?.input.policy).toEqual(record.input.policy);
  });

  it('preserves an existing capture if a later request fails', async () => {
    vi.mocked(runSimulation).mockResolvedValueOnce(await baselineRecord()).mockRejectedValueOnce(new Error('API offline'));
    const { result } = renderHook(() => useExperiment());
    await act(() => result.current.run('protected'));
    const captured = result.current.record;
    await act(() => result.current.run('protected'));
    expect(result.current.error).toBe('API offline');
    expect(result.current.record).toBe(captured);
    expect(result.current.busy).toBe(false);
  });

  it('rejects invalid drafts before contacting the API', async () => {
    const { result } = renderHook(() => useExperiment());
    act(() => result.current.setPolicy(' '));
    await act(() => result.current.run('both'));
    expect(runSimulation).not.toHaveBeenCalled();
    expect(result.current.error).toContain('non-empty');
  });

  it('blocks execution during import and marks valid imports as unverified replay', async () => {
    const record = await baselineRecord();
    let readFile!: (text: string) => void;
    const file = { size: 100, text: () => new Promise<string>(resolve => { readFile = resolve; }) } as File;
    const { result } = renderHook(() => useExperiment());
    let pending!: Promise<void>;
    act(() => { pending = result.current.importRecord(file); void result.current.run('both'); });
    expect(runSimulation).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(true);
    await act(async () => { readFile(JSON.stringify(record)); await pending; });
    expect(result.current.origin).toBe('imported');
    expect(result.current.record).toEqual(record);
    expect(result.current.busy).toBe(false);
  });

  it('rejects oversized imports without reading them', async () => {
    const text = vi.fn();
    const { result } = renderHook(() => useExperiment());
    await act(() => result.current.importRecord({ size: 262145, text } as unknown as File));
    expect(text).not.toHaveBeenCalled();
    expect(result.current.error).toContain('256 KiB');
  });

  it('pauses replay on selection and clears captured state', async () => {
    vi.mocked(runSimulation).mockResolvedValueOnce(await baselineRecord());
    const { result } = renderHook(() => useExperiment());
    await act(() => result.current.run('protected'));
    act(() => result.current.togglePlayback());
    expect(result.current.playing).toBe(true);
    expect(result.current.cursor).toBe(0);
    act(() => result.current.selectEvent(2));
    expect(result.current.playing).toBe(false);
    expect(result.current.cursor).toBe(2);
    act(() => result.current.clear());
    await waitFor(() => expect(result.current.record).toBeNull());
  });
});

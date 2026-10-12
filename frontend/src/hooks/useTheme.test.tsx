import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('theme preference', () => {
  it('honors a saved preference and ignores unknown values', () => {
    localStorage.setItem('beacon.theme', 'dark');
    const hook = renderHook(useTheme);
    expect(hook.result.current.theme).toBe('dark');
    hook.unmount();
    localStorage.setItem('beacon.theme', 'unknown');
    expect(renderHook(useTheme).result.current.preference).toBe('system');
  });

  it('remains usable when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    const { result } = renderHook(useTheme);
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('syncs changes and removals from another tab', () => {
    const { result } = renderHook(useTheme);
    localStorage.setItem('beacon.theme', 'dark');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'beacon.theme', newValue: 'dark' })));
    expect(result.current.theme).toBe('dark');
    localStorage.clear();
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(result.current.preference).toBe('system');
  });

  it('follows live device changes only when using the device theme', () => {
    let change: (() => void) | undefined;
    const media = { matches: false, media: '(prefers-color-scheme: dark)', addEventListener: vi.fn((_, listener: () => void) => { change = listener; }), removeEventListener: vi.fn() };
    vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList);
    const { result } = renderHook(useTheme);
    act(() => { media.matches = true; change?.(); });
    expect(result.current.theme).toBe('dark');
    act(() => result.current.chooseTheme('light'));
    act(() => { media.matches = false; change?.(); media.matches = true; change?.(); });
    expect(result.current.theme).toBe('light');
    act(() => result.current.chooseTheme('system'));
    expect(result.current.theme).toBe('dark');
  });
});

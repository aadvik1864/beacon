import { useEffect, useLayoutEffect, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

export type ThemePreference = 'system' | 'light' | 'dark';
const key = 'beacon.theme';

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(key);
    if (value === 'light' || value === 'dark') return value;
  } catch {}
  return 'system';
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = preference === 'system' ? systemDark ? 'dark' : 'light' : preference;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#161e32' : '#f4f6fa');
  }, [theme]);

  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setPreference(readPreference()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function chooseTheme(next: ThemePreference) {
    setPreference(next);
    try { localStorage.setItem(key, next); } catch {}
  }

  return { theme, preference, chooseTheme, toggleTheme: () => chooseTheme(theme === 'dark' ? 'light' : 'dark') };
}

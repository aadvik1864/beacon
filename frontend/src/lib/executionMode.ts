export type ExecutionMode = 'api' | 'browser-demo';

export function parseExecutionMode(value: unknown): ExecutionMode {
  if (value === undefined || value === 'api') return 'api';
  if (value === 'browser-demo') return 'browser-demo';
  throw new Error('Set VITE_BEACON_EXECUTION_MODE to api or browser-demo.');
}

// Build configuration only. Network failures and URL parameters never select a mode.
export const executionMode = parseExecutionMode(import.meta.env?.VITE_BEACON_EXECUTION_MODE);
export const isBrowserDemo = executionMode === 'browser-demo';

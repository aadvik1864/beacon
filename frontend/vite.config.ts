import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { parseExecutionMode } from './src/lib/executionMode.ts';

export default defineConfig(({ mode }) => {
  // Invalid configuration fails the build instead of producing an accidental API demo.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  parseExecutionMode(process.env.VITE_BEACON_EXECUTION_MODE ?? env.VITE_BEACON_EXECUTION_MODE);
  return {
  plugins: [react(), tailwindcss()],
  build: { sourcemap: false },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.BEACON_API_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
  };
});

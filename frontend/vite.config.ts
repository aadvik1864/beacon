import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { parseExecutionMode } from './src/lib/executionMode.ts';

export default defineConfig(({ mode }) => {
  // Invalid configuration fails the build instead of producing an accidental API demo.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  parseExecutionMode(process.env.VITE_BEACON_EXECUTION_MODE ?? env.VITE_BEACON_EXECUTION_MODE);
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'license-notices',
        apply: 'build',
        generateBundle() {
          const licenses = [
            ['React-Bits.txt', './THIRD_PARTY_NOTICES.md'],
            ['IBM-Plex-Sans.txt', './node_modules/@fontsource/ibm-plex-sans/LICENSE'],
            ['IBM-Plex-Mono.txt', './node_modules/@fontsource/ibm-plex-mono/LICENSE'],
          ];
          for (const [name, path] of licenses) {
            this.emitFile({
              type: 'asset',
              fileName: `licenses/${name}`,
              source: readFileSync(new URL(path, import.meta.url), 'utf8'),
            });
          }
        },
      },
    ],
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

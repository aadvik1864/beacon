import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import config from '../../vercel.json';

describe('Vercel showcase configuration', () => {
  it('builds only the explicit browser demo', () => {
    expect(config.framework).toBe('vite');
    expect(config.installCommand).toBe('npm ci --ignore-scripts');
    expect(config.buildCommand).toBe('npm run build:demo');
    expect(config.outputDirectory).toBe('dist');
    expect(config).not.toHaveProperty('functions');
    expect(config).not.toHaveProperty('rewrites');
  });

  it('matches the tested Pages security headers on every route', () => {
    const pages = readFileSync('public/_headers', 'utf8');
    const expected = Object.fromEntries(pages.split('\n').filter(line => line.startsWith('  ')).map(line => {
      const split = line.indexOf(':');
      return [line.slice(0, split).trim(), line.slice(split + 1).trim()];
    }));
    expect(config.headers).toHaveLength(1);
    expect(config.headers[0].source).toBe('/(.*)');
    expect(Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]))).toEqual(expected);
  });

  it('keeps releases manual rather than racing GitHub verification', () => {
    expect(config.git.deploymentEnabled).toBe(false);
  });
});

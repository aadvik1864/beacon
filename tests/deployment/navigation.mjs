import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';

// Fixture-only readiness. An anonymous success is a security failure, not a
// reason to wait longer. No request bodies or redirect locations are logged.
export async function waitForPrivateStack(request, base, delay = pause) {
  for (let attempt = 0; attempt < 10; attempt++) {
    let response;
    try {
      response = await request.get(base + '/api/health', { timeout: 2000, maxRedirects: 0 });
    } catch (error) {
      if (!/\b(?:ECONNREFUSED|ECONNRESET)\b/.test(error.message) || attempt === 9) throw error;
    }
    if (response) {
      const status = response.status();
      await response.dispose();
      if (![502, 503, 504].includes(status)) {
        assert.equal(status, 401, 'Anonymous API access must be rejected before browser checks');
        return;
      }
      if (attempt === 9) throw new Error('Synthetic HTTPS/SSO stack did not become ready');
    }
    await delay(300);
  }
}

// Docker bridge changes can briefly invalidate Chromium's network state on CI.
// Retry only this read-only pre-login navigation, never an assertion, callback,
// POST, certificate error, timeout, or other network failure.
export async function navigateToLogin(page, base, delay = pause) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch (error) {
      if (!/\bnet::ERR_NETWORK_CHANGED\b/.test(error.message) || attempt === 2) throw error;
      console.warn('Retrying synthetic pre-login GET after a browser network change.');
      await delay(300 * (attempt + 1));
    }
  }
}

import { chromium } from '../../frontend/node_modules/@playwright/test/index.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { navigateToLogin, waitForPrivateStack } from './navigation.mjs';

const base = 'https://localhost:38443';
const browser = await chromium.launch();
const contexts = [];
async function context() {
  const next = await browser.newContext({ ignoreHTTPSErrors: true }); // Isolated test certificates only.
  contexts.push(next);
  return next;
}
async function login(identity) {
  const ctx = await context();
  const page = await ctx.newPage();
  const loadedAssets = new Set();
  const errors = [];
  const failedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/assets/') || path === '/theme.js') failedAssets.push({ path, error: request.failure()?.errorText });
  });
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/assets/')) loadedAssets.add(path);
  });
  await navigateToLogin(page, base);
  await page.getByRole('link', { name: identity, exact: true }).click();
  return { ctx, page, loadedAssets, errors, failedAssets };
}
async function session(ctx) {
  const response = await ctx.request.get(base + '/api/session');
  assert.equal(response.status(), 200);
  return (await response.json()).token;
}
async function run(ctx, token, data, extra = {}) {
  return ctx.request.post(base + '/api/simulations', { data, headers: { Origin: base, 'X-Beacon-Token': token, ...extra } });
}

try {
  const anonymous = await context();
  await waitForPrivateStack(anonymous.request, base);
  for (const path of ['/api/health', '/api/session', '/api/capabilities']) {
    const response = await anonymous.request.get(base + path, { headers: { 'X-Beacon-Identity': 'alice@example.com', 'X-Forwarded-Email': 'alice@example.com', 'X-Beacon-Gateway': 'forged' } });
    assert.equal(response.status(), 401);
    assert.equal(response.headers()['cache-control'], 'no-store');
  }
  for (const path of ['/healthz', '/ping', '/ready']) assert.equal((await anonymous.request.get(base + path)).status(), 404);
  const { ctx: alice, page, loadedAssets, errors, failedAssets } = await login('alice');
  await page.getByRole('button', { name: 'Run comparison' }).waitFor().catch(async error => {
    console.error('Synthetic SSO landing page:', await page.locator('body').innerText());
    console.error('Synthetic browser load failures:', { errors, failedAssets });
    throw error;
  });
  assert.ok(![...loadedAssets].some(path => path.includes('experimentValidation-')), 'Validation must stay out of initial page loading');
  const themeScript = await alice.request.get(base + '/theme.js');
  assert.equal(themeScript.status(), 200);
  assert.match(themeScript.headers()['content-type'], /javascript/);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.reload();
  await page.getByRole('button', { name: 'Switch to light mode' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['beacon.theme']);
  const health = await alice.request.get(base + '/api/health');
  assert.equal((await health.json()).access_mode, 'sso');
  const cookies = await alice.cookies();
  const cookie = cookies.find(item => item.name === '__Host-beacon_sso');
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.path === '/' && cookie.sameSite === 'Lax');
  const response = await alice.request.get(base);
  assert.match(response.headers()['content-security-policy'], /script-src 'self'/);
  assert.equal(response.headers()['x-frame-options'], 'DENY');
  assert.equal(response.headers()['cache-control'], 'no-store');
  assert.ok(!response.headers().server);
  assert.equal((await alice.request.get(base + '/.env')).status(), 404);
  assert.equal((await alice.request.get(base + '/api/openapi.json')).status(), 404);
  const aliceToken = await session(alice);
  const data = { mode: 'simulation', idempotency_key: randomUUID(), policy: 'Employees receive 20 days of annual leave. BEACON_PRIVATE_INPUT_MARKER', question: 'How much leave?', behavior: 'follow', target: 'both' };
  const first = await run(alice, aliceToken, data);
  assert.equal(first.status(), 200);
  const aliceRecord = await first.json();
  const spoofed = await run(alice, aliceToken, data, { 'X-Forwarded-Email': 'bob@example.com', 'X-Beacon-Identity': 'bob@example.com', 'X-Beacon-Gateway': 'forged' });
  assert.deepEqual(await spoofed.json(), aliceRecord);
  const { ctx: bob } = await login('bob');
  assert.equal((await run(bob, aliceToken, data)).status(), 403);
  const bobResponse = await run(bob, await session(bob), data);
  assert.equal(bobResponse.status(), 200);
  assert.notEqual((await bobResponse.json()).id, aliceRecord.id);
  assert.equal((await run(alice, aliceToken, data, { Origin: 'https://evil.example' })).status(), 403);
  const missingOrigin = await alice.request.post(base + '/api/simulations', { data, headers: { 'X-Beacon-Token': aliceToken } });
  assert.equal(missingOrigin.status(), 403);
  const rawCredential = 'AKIA' + 'A'.repeat(16);
  const invalid = await run(alice, aliceToken, { ...data, policy: rawCredential });
  assert.equal(invalid.status(), 422);
  assert.ok(!(await invalid.text()).includes(rawCredential));
  const large = await run(alice, aliceToken, { ...data, policy: 'x'.repeat(40000) });
  assert.equal(large.status(), 413);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.beaconInlineScriptExecuted = true';
    document.body.append(script);
  });
  assert.equal(await page.evaluate(() => window.beaconInlineScriptExecuted), undefined);
  await page.getByRole('button', { name: 'Run comparison' }).click();
  await page.getByRole('button', { name: 'Clear capture' }).waitFor();
  assert.ok([...loadedAssets].some(path => path.includes('experimentValidation-')), 'A run must load the strict validator');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/api'));
  // Wait for the sign-out response rather than relying on navigation initiation.
  await page.waitForLoadState('domcontentloaded');
  assert.equal((await alice.request.get(base + '/api/session')).status(), 401);
  const replayedLogoutCookie = await context();
  await replayedLogoutCookie.addCookies([cookie]);
  assert.equal((await replayedLogoutCookie.request.get(base + '/api/session')).status(), 401);
  for (const identity of ['unlisted', 'unverified', 'bad-nonce', 'bad-signature']) {
    const { ctx } = await login(identity);
    assert.equal((await ctx.request.get(base + '/api/session')).status(), 401);
  }
  const tampered = await context();
  await tampered.addCookies([{ ...cookie, value: cookie.value.slice(0, -2) + 'xx' }]);
  assert.equal((await tampered.request.get(base + '/api/session')).status(), 401);
  const { ctx: failedLoader, page: failedPage } = await login('alice');
  await failedPage.getByRole('button', { name: 'Run comparison' }).waitFor();
  await failedPage.route('**/assets/experimentValidation-*.js', route => route.abort('failed'));
  let submissions = 0;
  failedPage.on('request', request => { if (new URL(request.url()).pathname === '/api/simulations') submissions++; });
  await failedPage.getByRole('button', { name: 'Run comparison' }).click();
  await failedPage.getByRole('alert').waitFor();
  assert.equal(submissions, 0, 'A missing validator must fail before submitting a simulation');
  assert.equal(await failedPage.getByRole('button', { name: 'Clear capture' }).count(), 0);
  await failedLoader.close();
  console.log('SSO, PKCE, nonce/signature/email checks, CSRF, ownership, logout, CSP, redaction, and responsive UI passed.');
} finally {
  for (const ctx of contexts) await ctx.close();
  await browser.close();
}

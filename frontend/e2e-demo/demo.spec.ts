import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const observed: string[] = []; issues.set(page, observed);
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/') || path.startsWith('/oauth2/')) observed.push(`Unexpected backend call: ${path}`);
  });
  page.on('pageerror', error => observed.push(error.message));
  page.on('console', message => { if (message.type() === 'error') observed.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.addEventListener('securitypolicyviolation', event => {
    (window as Window & { demoCspViolations?: string[] }).demoCspViolations ??= [];
    (window as Window & { demoCspViolations: string[] }).demoCspViolations.push(event.violatedDirective);
  }));
});
test.afterEach(async ({ page }) => {
  expect(issues.get(page)).toEqual([]);
  expect(await page.evaluate(() => (window as Window & { demoCspViolations?: string[] }).demoCspViolations ?? [])).toEqual([]);
});

async function exportJson(page: Page) {
  await page.locator('.export-menu>summary').click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  return JSON.parse(await readFile((await (await downloading).path())!, 'utf8'));
}

test('static host applies the tested security policy and visitors need no connection or sign-in', async ({ page }) => {
  const response = await page.request.get('/');
  expect(response.headers()['content-security-policy']).toContain("connect-src 'none'");
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['content-security-policy']).not.toContain("'unsafe-eval'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  await expect(page.getByRole('heading', { name: 'Learn why AI needs access limits.' })).toBeVisible();
  await expect(page.locator('.lab-safety')).toContainText('Browser simulation');
  await expect(page.locator('.lab-safety')).toContainText('not genuine AWS permission enforcement');
  await page.goto('/#setup');
  await expect(page.getByText('No connection or sign-in is needed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check connection' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
});

test('walkthrough prepares a hidden instruction and paired browser results export provenance', async ({ page }) => {
  await page.getByRole('button', { name: 'Show me an example' }).click();
  await page.getByRole('button', { name: 'Add a hidden instruction', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Use this example' }).click();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveValue(/SECURITY TEST INSTRUCTION/);
  await expect(page.locator('.capture-source')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.locator('.capture-source')).toHaveText('Browser simulation');
  await expect(page.getByText('Fictional data exposed', { exact: true })).toBeVisible();
  await expect(page.getByText('Private file blocked', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.protected .result-answer')).not.toContainText('DEMO-101');
  const record = await exportJson(page);
  expect(record.execution_source).toBe('browser-simulation');
  expect(record.aws_used).toBe(false);
  expect(record.model_is_live).toBe(false);
  expect(record.events.every((event: { source: string }) => event.source === 'browser-simulation')).toBe(true);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  const report = await readFile((await (await downloading).path())!, 'utf8');
  expect(report).toContain('Browser simulation');
  expect(report).toContain('not genuine AWS permission enforcement');
});

test('graph inspection, event replay, clearing and validated import stay in the browser', async ({ page }) => {
  await page.getByRole('button', { name: 'Load hidden instruction example' }).click();
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.locator('.capture-source')).toHaveText('Browser simulation');
  await page.getByRole('button', { name: 'Inspect run' }).click();
  await page.getByRole('tab', { name: 'Access path' }).click();
  await expect(page.locator('[data-id="payroll-vulnerable"] .beacon-graph-node')).toHaveAttribute('data-stage', 'exposed');
  await expect(page.locator('[data-id="payroll-protected"] .beacon-graph-node')).toHaveAttribute('data-stage', 'denied');
  await page.getByRole('tab', { name: 'Events', exact: true }).click();
  await page.getByRole('slider', { name: 'Scrub recorded events' }).press('Home');
  await expect(page.getByText('Event 1 /', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Play replay' }).click();
  await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause replay' }).click();
  const record = await exportJson(page);
  await page.getByRole('button', { name: 'Clear capture' }).click();
  await expect(page.locator('.capture-source')).toHaveCount(0);
  await page.getByLabel('Import simulation replay').setInputFiles({ name: 'browser.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.locator('.capture-source')).toContainText('Imported result. Source not verified.');
  await expect(page.locator('.capture-source')).toContainText('Claimed Browser simulation');
  await page.locator('.export-menu>summary').click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  expect(await readFile((await (await downloading).path())!, 'utf8')).toContain('file authenticity is unverified');
});

test('clean, ignored, read-only and single-target runs keep their distinct outcomes', async ({ page }) => {
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('No private file requested', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Load hidden instruction example' }).click();
  await page.locator('.advanced-options>summary').click();
  await page.getByLabel('What the demo does').selectOption('ignore');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('No private file requested', { exact: true })).toHaveCount(2);
  await page.getByLabel('What the demo does').selectOption('retrieve_only');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Private file read, but not shown', { exact: true })).toBeVisible();
  await page.getByLabel('Versions to compare').selectOption('protected');
  await page.getByRole('button', { name: 'Run limited access', exact: true }).click();
  await expect(page.locator('.protected .result-outcome')).toContainText('Private file blocked');
  await expect(page.locator('.vulnerable')).toContainText('Not included in this run.');
});

test('fictional edits work while credentials, byte overflow and forged live imports are rejected', async ({ page }) => {
  await page.getByLabel('policies/leave-policy.txt').fill('Employees receive 28 days of annual leave.');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.locator('.result-answer').first()).toContainText('28 days');
  await page.getByLabel('policies/leave-policy.txt').fill('AKIA' + 'A'.repeat(16));
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('credentials are not accepted');
  await expect(page.locator('.result-answer').first()).toContainText('28 days');
  await page.getByLabel('policies/leave-policy.txt').fill('é'.repeat(5000));
  await expect(page.getByRole('button', { name: 'Run comparison', exact: true })).toBeDisabled();
  await page.getByLabel('Import simulation replay').setInputFiles({ name: 'live.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ mode: 'aws', aws_used: true })) });
  await expect(page.getByRole('alert')).toContainText('Invalid replay');
});

test('light and dark themes, keyboard, mobile layout and reduced motion work under CSP', async ({ page }) => {
  await expect(page.locator('.app-shell')).toHaveAttribute('data-reduced-motion', 'true');
  for (const theme of ['dark', 'light']) {
    const toggle = page.getByRole('button', { name: `Switch to ${theme} mode`, exact: true });
    if (await toggle.isVisible()) { await toggle.focus(); await page.keyboard.press('Enter'); }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 780 });
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.locator('.capture-source')).toHaveText('Browser simulation');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

test('real local API captures paired simulation results and replay', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Beacon home', includeHidden: true })).toBeAttached();
  await page.getByRole('button', { name: 'Load attack example' }).click();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveValue(/SECURITY TEST INSTRUCTION/);
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/simulations') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const record = await response.json();
  expect(record.mode).toBe('simulation');
  expect(record.aws_used).toBe(false);
  expect(record.model_is_live).toBe(false);
  await expect(page.getByText('Synthetic data exposed', { exact: true })).toBeVisible();
  await expect(page.getByText('Blocked locally', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.protected .result-answer')).not.toContainText('BEACON_SYNTHETIC');
  const vulnerablePath = page.locator('[data-id="payroll-vulnerable"] .beacon-graph-node');
  const protectedPath = page.locator('[data-id="payroll-protected"] .beacon-graph-node');
  await expect(vulnerablePath).toBeVisible();
  await expect(vulnerablePath).toHaveAttribute('data-stage', 'exposed');
  await expect(protectedPath).toHaveAttribute('data-stage', 'denied');
  await protectedPath.click();
  await expect(page.locator('.graph-inspector')).toContainText('A denied local request must not return payroll contents');
  await page.getByRole('button', { name: 'Previous event' }).click();
  await page.getByRole('slider', { name: 'Scrub recorded events' }).press('Home');
  await expect(page.getByText('Event 1 /', { exact: false })).toBeVisible();
  await expect(vulnerablePath).toHaveAttribute('data-stage', 'idle');
  await expect(protectedPath).toHaveAttribute('data-stage', 'idle');
  await page.getByRole('button', { name: 'Play replay' }).click();
  await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause replay' }).click();
  await page.getByLabel('Filter events by actor').selectOption('protected');
  await page.getByLabel('Filter events by type').selectOption('access_denied');
  await expect(page.getByText('1 matching events')).toBeVisible();
  const downloads = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloads;
  expect(download.suggestedFilename()).toMatch(/^beacon-.*\.json$/);
  const downloadPath = await download.path();
  expect(JSON.parse(await readFile(downloadPath!, 'utf8'))).toEqual(record);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('clean baseline and ignored fixture do not claim IAM enforcement', async ({ page }) => {
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Not triggered', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Load attack example' }).click();
  await page.getByLabel('Scripted assistant behavior').selectOption('ignore');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Not triggered', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Blocked locally', { exact: true })).toHaveCount(0);
});

test('draft changes cannot silently rewrite a captured result', async ({ page }) => {
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Captured from the local API', { exact: true })).toBeVisible();
  await page.getByLabel('policies/leave-policy.txt').fill('Employees receive 28 days of annual leave.');
  await expect(page.getByText('Draft changed. These results belong to the previous snapshot.')).toBeVisible();
  await expect(page.locator('.result-answer').first()).toContainText('20 days');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.locator('.result-answer').first()).toContainText('28 days');
});

test('document HTML stays inert and invalid replay cannot claim AWS execution', async ({ page }) => {
  await page.getByLabel('policies/leave-policy.txt').fill('<img src=x onerror="window.beaconXss=true">');
  await page.getByRole('button', { name: 'Compare with clean policy' }).click();
  expect(await page.evaluate(() => 'beaconXss' in window)).toBe(false);
  await page.getByLabel('Import simulation replay').setInputFiles({ name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ mode: 'aws', aws_used: true })) });
  await expect(page.getByRole('alert')).toContainText('Invalid replay');
});

test('valid replay imports without execution and exports unverified provenance', async ({ page }) => {
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/simulations') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  const record = await (await responsePromise).json();
  await expect(page.getByText('Captured from the local API', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear capture' }).click();
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/simulations')) calls++; });
  await page.getByLabel('Import simulation replay').setInputFiles({ name: 'capture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.getByText('Imported replay · authenticity unverified')).toBeVisible();
  expect(calls).toBe(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report' }).click();
  const path = await (await downloading).path();
  const report = await readFile(path!, 'utf8');
  expect(report).toContain('file authenticity is unverified');
  expect(report).toContain('not AWS IAM');
  expect(report).toContain(record.document_hash);
});

test('API failure preserves the capture and never invents a replacement result', async ({ page }) => {
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Captured from the local API', { exact: true })).toBeVisible();
  const original = await page.locator('.result-answer').first().textContent();
  await page.route('**/api/simulations', route => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach the local Beacon API');
  await expect(page.locator('.result-answer').first()).toHaveText(original!);
});

test('editor enforces UTF-8 bounds and results fit a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByLabel('policies/leave-policy.txt').fill('é'.repeat(5000));
  await expect(page.getByRole('button', { name: 'Run comparison', exact: true })).toBeDisabled();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Load attack example' }).click();
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Synthetic data exposed', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

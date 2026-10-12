import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
});

test('real local API captures paired simulation results and replay', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Beacon home', includeHidden: true })).toBeAttached();
  await page.getByRole('button', { name: 'Load hidden instruction example' }).click();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveValue(/SECURITY TEST INSTRUCTION/);
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/simulations') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const record = await response.json();
  expect(record.mode).toBe('simulation');
  expect(record.aws_used).toBe(false);
  expect(record.model_is_live).toBe(false);
  await expect(page.getByText('Fictional data exposed', { exact: true })).toBeVisible();
  await expect(page.getByText('Private file blocked', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.protected .result-answer')).not.toContainText('BEACON_SYNTHETIC');
  await page.getByRole('button', { name: 'Inspect run' }).click();
  await page.getByRole('tab', { name: 'Access path' }).click();
  const vulnerablePath = page.locator('[data-id="payroll-vulnerable"] .beacon-graph-node');
  const protectedPath = page.locator('[data-id="payroll-protected"] .beacon-graph-node');
  await expect(vulnerablePath).toBeVisible();
  await expect(vulnerablePath).toHaveAttribute('data-stage', 'exposed');
  await expect(protectedPath).toHaveAttribute('data-stage', 'denied');
  await protectedPath.click();
  await expect(page.locator('.graph-inspector')).toContainText('A denied local request must not return payroll contents');
  const limitedNode = page.locator('.react-flow__node[data-id="protected"]');
  await limitedNode.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.graph-inspector')).toContainText('application-side permission checks, not AWS IAM');
  await page.getByRole('tab', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Previous event' }).click();
  await page.getByRole('slider', { name: 'Scrub recorded events' }).press('Home');
  await expect(page.getByText('Event 1 /', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Access path' }).click();
  await expect(vulnerablePath).toHaveAttribute('data-stage', 'idle');
  await expect(protectedPath).toHaveAttribute('data-stage', 'idle');
  await page.getByRole('tab', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Play replay' }).click();
  await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause replay' }).click();
  await page.getByLabel('Filter events by actor').selectOption('protected');
  await page.getByLabel('Filter events by type').selectOption('access_denied');
  await expect(page.getByText('1 matching events')).toBeVisible();
  await page.locator('.export-menu>summary').click();
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
  await expect(page.getByText('No private file requested', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Load hidden instruction example' }).click();
  await page.locator('.advanced-options>summary').click();
  await page.getByLabel('What the demo does').selectOption('ignore');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('No private file requested', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Private file blocked', { exact: true })).toHaveCount(0);
});

test('draft changes cannot silently rewrite a captured result', async ({ page }) => {
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Recorded simulation', { exact: true })).toBeVisible();
  await page.getByLabel('policies/leave-policy.txt').fill('Employees receive 28 days of annual leave.');
  await expect(page.getByText('Draft changed. Run again to update these results.')).toBeVisible();
  await expect(page.locator('.result-answer').first()).toContainText('20 days');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.locator('.result-answer').first()).toContainText('28 days');
});

test('document HTML stays inert and invalid replay cannot claim AWS execution', async ({ page }) => {
  await page.getByLabel('policies/leave-policy.txt').fill('<img src=x onerror="window.beaconXss=true">');
  await page.locator('.advanced-options>summary').click();
  await page.getByRole('button', { name: 'Compare with clean policy' }).click();
  expect(await page.evaluate(() => 'beaconXss' in window)).toBe(false);
  await page.getByLabel('Import simulation replay').setInputFiles({ name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ mode: 'aws', aws_used: true })) });
  await expect(page.getByRole('alert')).toContainText('Invalid replay');
});

test('valid replay imports without execution and exports unverified provenance', async ({ page }) => {
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/simulations') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  const record = await (await responsePromise).json();
  await expect(page.getByText('Recorded simulation', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear capture' }).click();
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/api/simulations')) calls++; });
  await page.getByLabel('Import simulation replay').setInputFiles({ name: 'capture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
  await expect(page.getByText('Imported result. Source not verified.')).toBeVisible();
  expect(calls).toBe(0);
  await page.locator('.export-menu>summary').click();
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
  await expect(page.getByText('Recorded simulation', { exact: true })).toBeVisible();
  const original = await page.locator('.result-answer').first().textContent();
  await page.route('**/api/simulations', route => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot reach the Beacon API');
  await expect(page.locator('.result-answer').first()).toHaveText(original!);
});

test('editor enforces UTF-8 bounds and results fit a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByLabel('policies/leave-policy.txt').fill('é'.repeat(5000));
  await expect(page.getByRole('button', { name: 'Run comparison', exact: true })).toBeDisabled();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Load hidden instruction example' }).click();
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Fictional data exposed', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('default workspace has no secondary panels or decorative copy', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Learn why AI needs access limits.');
  await expect(page.getByText('No results yet', { exact: true })).toBeVisible();
  await expect(page.getByLabel('What the demo does')).not.toBeVisible();
  await expect(page.locator('.access-graph-panel')).toHaveCount(0);
  await expect(page.locator('.timeline-panel')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/[—–]/);
  expect(await page.getByLabel('policies/leave-policy.txt').inputValue()).not.toMatch(/[—–]/);
});

test('access details and inspection are optional and keyboard accessible', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()); });
  await page.getByRole('button', { name: 'Load hidden instruction example' }).click();
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('Fictional data exposed', { exact: true })).toBeVisible();
  await expect(page.locator('.vulnerable .result-measurements')).not.toBeVisible();
  await page.locator('.protected .result-details>summary').click();
  await expect(page.locator('.protected .result-measurements')).toBeVisible();
  await expect(page.locator('.protected .result-measurements')).toContainText('Payroll readNo');
  await expect(page.getByRole('button', { name: 'Inspect run' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Inspect run' }).click();
  await page.getByLabel('Filter events by actor').selectOption('protected');
  const eventsTab = page.getByRole('tab', { name: 'Events', exact: true });
  await eventsTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Access path' })).toBeFocused();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await page.keyboard.press('Home');
  await expect(eventsTab).toBeFocused();
  await expect(page.getByLabel('Filter events by actor')).toHaveValue('protected');
  await page.getByRole('button', { name: 'Play replay' }).click();
  await page.getByRole('button', { name: 'Inspect run' }).click();
  await expect(page.locator('.timeline-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect run' }).click();
  await expect(page.getByRole('button', { name: 'Play replay' })).toBeVisible();
  expect(requests).toHaveLength(1);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('permission preview and spring selectors are interactive without execution', async ({ page }) => {
  const executions: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') executions.push(request.url()); });
  const policy = await page.getByLabel('policies/leave-policy.txt').inputValue();
  await page.getByRole('button', { name: 'Preview leave policy access' }).click();
  await expect(page.getByText('Both versions can read the leave policy.')).toBeVisible();
  await expect(page.getByText('Can read this file', { exact: true })).toHaveCount(2);
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'Preview payroll access' })).toBeFocused();
  await expect(page.getByText('Cannot read this file', { exact: true })).toBeVisible();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveValue(policy);
  await page.getByRole('button', { name: 'Restore original policy' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Load hidden instruction example' })).toBeFocused();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveValue(/SECURITY TEST INSTRUCTION/);
  await page.getByLabel('policies/leave-policy.txt').fill('My custom policy');
  await expect(page.getByRole('group', { name: 'Policy templates' })).toHaveAttribute('data-unselected', 'true');
  await expect(page.getByRole('button', { name: 'Load hidden instruction example' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('No results yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Private file blocked', { exact: true })).toHaveCount(0);
  expect(executions).toHaveLength(0);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('React Bits lighting and click feedback respond to input and reduced motion', async ({ page }) => {
  await page.addInitScript(() => {
    let count = 0;
    Object.defineProperty(window, 'beaconSparkStrokes', { get: () => count });
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (path?: Path2D) {
      count++;
      Reflect.apply(stroke, this, path ? [path] : []);
    };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  const editor = page.locator('.editor-surface');
  const box = (await editor.boundingBox())!;
  await page.mouse.move(box.x + 15, box.y + 15);
  await expect(editor).toHaveAttribute('data-spotlight', 'pointer');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  await expect(page.getByText('No private file requested', { exact: true })).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'beaconSparkStrokes'))).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.bits-click-spark canvas').evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext('2d')!;
    return context.getImageData(0, 0, node.width, node.height).data.every(value => value === 0);
  })).toBe(true);
  const drawn = await page.evaluate(() => Reflect.get(window, 'beaconSparkStrokes'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(editor).toHaveAttribute('data-spotlight-reduced', 'true');
  await expect(page.locator('.bits-click-spark')).toHaveAttribute('data-reduced', 'true');
  await expect(page.getByRole('group', { name: 'Policy templates' })).toHaveAttribute('data-reduced', 'true');
  const response = page.waitForResponse(response => response.url().endsWith('/api/simulations') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run comparison', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByText('No private file requested', { exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => Reflect.get(window, 'beaconSparkStrokes'))).toBe(drawn);
});

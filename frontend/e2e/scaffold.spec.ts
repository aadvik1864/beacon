import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function navigate(page: Page, name: RegExp) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  else if (!await page.getByRole('button', { name }).isVisible()) await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', product: 'Beacon', version: '0.2.0', stage: 'local-simulation', aws_enabled: false, paid_inference_enabled: false }),
  }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Beacon home' })).toBeVisible({ timeout: 15000 });
});

test('workbench remains honest and responsive', async ({ page }) => {
  await navigate(page, /Architecture/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Architecture');
  await expect(page.getByText('Planned AWS setup. No resources are deployed.')).toBeVisible();
  await page.getByRole('button', { name: /AI assistant/ }).click();
  await expect(page.getByText('The model proposes an action.')).toBeVisible();
  await page.getByRole('button', { name: /Synthetic payroll/ }).click();
  await expect(page.getByText('private/payroll.csv')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('React Bits component preview is interactive without cloud requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) requests.push(request.url()); });
  await navigate(page, /Component bench/);
  await page.getByRole('button', { name: 'Failed', exact: true }).click();
  await page.getByRole('button', { name: /Reset preview/ }).click();
  await expect(page.getByRole('button', { name: 'Queued', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const list = page.getByRole('listbox', { name: 'React Bits components' });
  await list.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('heading', { name: 'StatusMark' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(list).not.toBeFocused();
  expect(requests.every(url => url.endsWith('/api/health'))).toBe(true);
});

test('guide supports step navigation and Escape dismissal', async ({ page }) => {
  await navigate(page, /Quick guide/);
  const dialog = page.getByRole('dialog', { name: 'Quick guide' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Step 2: Permissions' }).click();
  await expect(dialog.getByRole('heading', { name: 'Compare access' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('local setup displays health and keeps cloud disabled', async ({ page }) => {
  await navigate(page, /Local setup/);
  await expect(page.getByText('Connected (v0.2.0)')).toBeVisible();
  await expect(page.getByText('Runs on your machine. AWS and paid inference are disabled.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('respects reduced motion and has no browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await navigate(page, /Component bench/);
  await page.getByRole('option', { name: /StatusMark/ }).click();
  await page.getByRole('button', { name: 'Running', exact: true }).click();
  await expect(page.locator('.bits-status-mark')).toHaveAttribute('data-reduced', '');
  expect(errors).toEqual([]);
});

test('secondary navigation opens on demand and Escape returns focus', async ({ page }) => {
  const mobileMenu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
    const navigation = page.getByRole('dialog', { name: 'Navigation', exact: true });
    await expect(navigation).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(navigation.getByRole('button', { name: 'Reduce motion' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(navigation).toHaveCount(0);
    await expect(mobileMenu).toBeFocused();
  } else {
    const more = page.getByText('More', { exact: true });
    await more.click();
    await expect(page.getByRole('button', { name: 'Local setup' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Local setup' })).not.toBeVisible();
    await expect(more).toBeFocused();
  }
});

test('main views pass automated WCAG checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const name of [null, /Architecture/, /Component bench/, /Local setup/]) {
    if (name) await navigate(page, name);
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  }
  await navigate(page, /Quick guide/);
  const guide = page.getByRole('dialog', { name: 'Quick guide' });
  await expect(guide).toBeVisible();
  const guideResult = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(guideResult.violations).toEqual([]);
});

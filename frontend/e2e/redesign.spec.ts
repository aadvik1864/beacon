import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  else if (!await page.getByRole('button', { name, exact: true }).isVisible()) await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/');
});

test('walkthrough teaches the example and prepares it without execution', async ({ page }) => {
  const executions: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') executions.push(request.url()); });
  await page.getByRole('button', { name: 'Show me an example' }).click();
  const guide = page.getByRole('dialog', { name: 'A quick walkthrough' });
  await guide.getByRole('button', { name: 'Add a hidden instruction' }).click();
  await expect(guide.getByText('A hidden instruction', { exact: true })).toBeVisible();
  await expect(guide.getByText(/is called prompt injection/)).toBeVisible();
  await guide.getByRole('button', { name: 'Remove the hidden instruction' }).click();
  await expect(guide.getByText('A hidden instruction', { exact: true })).toHaveCount(0);
  await guide.getByRole('button', { name: 'Add a hidden instruction' }).click();
  await guide.getByRole('button', { name: 'Continue' }).click();
  await guide.getByRole('button', { name: 'Preview leave policy access' }).click();
  await expect(guide.getByText('Both versions can read the leave policy.')).toBeVisible();
  await guide.getByRole('button', { name: 'Continue' }).click();
  await expect(guide.getByText('Illustration only, not a recorded result.', { exact: false })).toBeVisible();
  await guide.getByRole('button', { name: 'Use this example' }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveValue(/SECURITY TEST INSTRUCTION/);
  await expect(page.getByLabel('policies/leave-policy.txt')).toBeFocused();
  await expect(page.getByText('No results yet', { exact: true })).toBeVisible();
  expect(executions).toEqual([]);
  await page.getByRole('button', { name: 'Run comparison' }).click();
  await expect(page.getByText('Fictional data exposed', { exact: true })).toBeVisible();
  await expect(page.getByText('Private file blocked', { exact: true })).toBeVisible();
  expect(executions).toHaveLength(1);
});

test('walkthrough resets execution options but preserves the existing capture', async ({ page }) => {
  await page.getByRole('button', { name: 'Run comparison' }).click();
  await expect(page.getByText('Recorded simulation', { exact: true })).toBeVisible();
  const answer = await page.locator('.result-answer').first().textContent();
  await page.locator('.advanced-options>summary').click();
  await page.getByLabel('What the demo does').selectOption('ignore');
  await page.getByLabel('Versions to compare').selectOption('protected');
  await page.getByLabel('Question', { exact: true }).fill('A changed question');
  await navigate(page, 'How it works');
  await page.getByRole('button', { name: 'Try the walkthrough' }).click();
  const guide = page.getByRole('dialog');
  await guide.getByRole('button', { name: 'Add a hidden instruction' }).click();
  await guide.getByRole('button', { name: 'Step 3: Try it' }).click();
  await guide.getByRole('button', { name: 'Use this example' }).click();
  await expect(page.getByRole('button', { name: 'Run comparison' })).toBeVisible();
  await expect(page.locator('.result-answer').first()).toHaveText(answer!);
  await expect(page.getByText('Draft changed. Run again to update these results.')).toBeVisible();
  await expect(page.getByLabel('Question', { exact: true })).toHaveValue('How many days of annual leave can I take?');
  await page.locator('.advanced-options>summary').click();
  await expect(page.getByLabel('What the demo does')).toHaveValue('follow');
  await expect(page.getByLabel('Versions to compare')).toHaveValue('both');
});

test('theme follows the device, persists explicit choices and can return to automatic', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('beacon.theme'))).toBe('light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#161e32');
  await navigate(page, 'Use device theme');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('theme changes synchronize between tabs', async ({ page, context }) => {
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: 'light' });
  await other.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await other.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
});

test('unavailable preference storage does not break the website', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Unavailable', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'SecurityError'); };
  });
  await page.reload();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Run comparison' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('direct links, back and forward preserve the draft and page titles', async ({ page }) => {
  await page.getByLabel('policies/leave-policy.txt').fill('My fictional policy');
  await navigate(page, 'How it works');
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(page).toHaveTitle('How it works | Beacon');
  await page.goBack();
  await expect(page.getByLabel('policies/leave-policy.txt')).toHaveValue('My fictional policy');
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How it works');
  await page.goto('/#interactions');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Interaction studio');
  await expect(page).toHaveTitle('Interaction studio | Beacon');
});

test('magnetic content attracts and repels without moving the hit area', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await navigate(page, 'Interaction studio');
  await page.getByRole('option', { name: /Magnet/ }).click();
  const attract = page.getByRole('button', { name: 'Try attraction' });
  const repel = page.getByRole('button', { name: 'Try repulsion' });
  const original = (await attract.boundingBox())!;
  const displacement = (button: typeof attract) => button.locator('.magnetic-content').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41);
  if (isMobile) {
    await expect(attract).toHaveAttribute('data-motion-static', 'true');
    await attract.tap();
    expect(await displacement(attract)).toBe(0);
  } else {
    await page.mouse.move(original.x + original.width - 8, original.y + original.height / 2);
    await expect.poll(() => displacement(attract)).toBeGreaterThan(1);
    expect(await displacement(attract)).toBeLessThanOrEqual(5);
    expect(await attract.boundingBox()).toEqual(original);
    const reverse = (await repel.boundingBox())!;
    await page.mouse.move(reverse.x + reverse.width - 8, reverse.y + reverse.height / 2);
    await expect.poll(() => displacement(repel)).toBeLessThan(-1);
    await page.mouse.move(0, 0);
    await expect.poll(() => displacement(repel)).toBe(0);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(attract).toHaveAttribute('data-motion-static', 'true');
  expect(await displacement(attract)).toBe(0);
  await page.getByRole('button', { name: 'Try attraction' }).focus();
  await page.keyboard.press('Enter');
  await expect(attract).toBeFocused();
  await expect(attract).toHaveAttribute('aria-pressed', 'true');
});

test('both themes pass WCAG checks across all views and walkthrough steps at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    for (const name of ['Try it', 'How it works', 'Interaction studio', 'Run locally']) {
      await navigate(page, name);
      await page.evaluate(() => document.fonts.ready);
      if (name === 'Try it') await page.locator('.advanced-options>summary').click();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations, `${theme}: ${name}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await navigate(page, 'Walkthrough');
    const guide = page.getByRole('dialog');
    for (const name of ['Step 1: Document', 'Step 2: Access', 'Step 3: Try it']) {
      await guide.getByRole('button', { name }).click();
      await expect(guide.getByRole('button', { name })).toHaveAttribute('aria-current', 'step');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations, `${theme}: ${name}`).toEqual([]);
      expect(await guide.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await page.keyboard.press('Escape');
  }
});

test('limited-only and read-without-disclosure results remain distinct in dark mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: 'Load hidden instruction example' }).click();
  await page.locator('.advanced-options>summary').click();
  await page.getByLabel('Versions to compare').selectOption('protected');
  await page.getByRole('button', { name: 'Run limited access' }).click();
  await expect(page.getByText('Private file blocked', { exact: true })).toBeVisible();
  await expect(page.getByText('Not included in this run.')).toBeVisible();
  await page.getByLabel('Versions to compare').selectOption('both');
  await page.getByLabel('What the demo does').selectOption('retrieve_only');
  await page.getByRole('button', { name: 'Run comparison' }).click();
  await expect(page.getByText('Private file read, but not shown', { exact: true })).toBeVisible();
  await page.locator('.vulnerable .result-details>summary').click();
  await expect(page.locator('.vulnerable .result-measurements')).toContainText('Payroll readYes');
  await expect(page.locator('.vulnerable .result-measurements')).toContainText('Included in answerNo');
  await page.getByRole('button', { name: 'Inspect run' }).click();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('walkthrough returns focus to its trigger and has a centered, scrollable dialog', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Show me an example' });
  await trigger.click();
  const guide = page.getByRole('dialog');
  const geometry = await guide.evaluate(element => ({ left: element.getBoundingClientRect().left, width: element.getBoundingClientRect().width, viewport: innerWidth }));
  expect(Math.abs(geometry.left - (geometry.viewport - geometry.width) / 2)).toBeLessThan(2);
  await guide.getByRole('button', { name: 'Add a hidden instruction' }).click();
  await guide.getByRole('button', { name: 'Step 3: Try it' }).click();
  await expect(guide.getByRole('button', { name: 'Finish guide' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

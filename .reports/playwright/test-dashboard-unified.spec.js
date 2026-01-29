const { test, expect } = require('@playwright/test');
const { installTestHooks } = require('./hud-test-utils.cjs');

test.beforeEach(async ({ page }) => {
  await installTestHooks(page);
});

async function ensureLoggedIn(page) {
  const loginForm = page.locator('#login-form');
  if (await loginForm.isVisible().catch(() => false)) {
    await page.fill('#password-input', 'savonie21');
    await page.click('#login-form button[type="submit"]');
  }
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10_000 });
}

async function gotoDashboard(page, url = '/EN/dashboard.html?demo=1') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ensureLoggedIn(page);
}

async function openTab(page, name) {
  await page.click(`.tab-btn[data-tab="${name}"]`);
  await expect(page.locator(`#tab-${name}`)).toHaveClass(/active/);
}

test.describe('Unified dashboard tabs', () => {
  test('tabs render and switch via click + hash', async ({ page }) => {
    await gotoDashboard(page);

    await openTab(page, 'console');
    await expect(page).toHaveURL(/#console/);

    await gotoDashboard(page, '/EN/dashboard.html?demo=1#network');
    await expect(page.locator('#tab-network')).toHaveClass(/active/);
  });

  test('console tab captures logs and clears', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await gotoDashboard(page);
    await openTab(page, 'console');

    await page.evaluate(() => {
      console.log('dash-test-log');
      console.warn('dash-test-warn');
      console.error('dash-test-error');
    });

    await expect(page.locator('#console-output .console-entry')).toHaveCount(3, { timeout: 5_000 });

    await page.click('#console-clear');
    await expect(page.locator('#console-output .console-entry')).toHaveCount(0);
  });

  test('network tab captures fetch and clears', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await gotoDashboard(page);
    await openTab(page, 'network');

    await page.evaluate(() => fetch('/robots.txt').catch(() => null));
    await expect(page.locator('#network-tbody tr')).toHaveCount(1, { timeout: 10_000 });

    await page.click('#network-clear');
    await expect(page.locator('#network-tbody tr')).toHaveCount(1);
    await expect(page.locator('#network-tbody')).toContainText('No requests');
  });

  test('performance tab populates baseline metrics', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await gotoDashboard(page);
    await openTab(page, 'performance');

    await expect(page.locator('#perf-dcl')).not.toHaveText('—', { timeout: 5_000 });
  });

  test('redirects tab runs diagnostics and renders results', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await gotoDashboard(page);
    await openTab(page, 'redirects');

    await page.click('#redirect-run-diagnostics');
    await expect(page.locator('#redirect-log')).toContainText('Diagnostics complete', { timeout: 20_000 });
    await expect(page.locator('#redirect-results .redirect-test')).toHaveCount(5, { timeout: 20_000 });
  });

  test('storage tab renders tables and sw status', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await gotoDashboard(page);
    await openTab(page, 'storage');

    await expect(page.locator('#storage-ls-table')).toBeVisible();
    await expect(page.locator('#storage-ss-table')).toBeVisible();
    await expect(page.locator('#storage-cookies-table')).toBeVisible();
    await expect(page.locator('#storage-sw-status')).toBeVisible();
  });

  test('system tab shows UA, copies report, clears data', async ({ page }) => {
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await gotoDashboard(page);

    // Seed some data
    await openTab(page, 'console');
    await page.evaluate(() => console.log('seed-log'));
    await openTab(page, 'network');
    await page.evaluate(() => fetch('/robots.txt').catch(() => null));

    await openTab(page, 'system');
    await expect(page.locator('#sys-ua')).not.toHaveText('—');

    await page.click('#sys-copy-report');
    const clipboardText = await page.evaluate(() => (window.__testClipboard ? window.__testClipboard.text : ''));
    expect(clipboardText).toContain('Debug Report');

    await page.click('#sys-clear-all');
    await openTab(page, 'console');
    await expect(page.locator('#console-output .console-entry')).toHaveCount(0);
  });
});

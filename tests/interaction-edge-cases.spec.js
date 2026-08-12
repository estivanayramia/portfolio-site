const { test, expect } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500';

async function removeCinematicIntro(page) {
  const intro = page.locator('#cinematic-intro');
  await intro.waitFor({ state: 'attached', timeout: 1500 }).catch(() => {});
  if (await intro.count()) {
    await page.getByRole('button', { name: /skip intro/i }).click({ force: true });
    await intro.waitFor({ state: 'detached' });
  }
}

async function focusWithKeyboard(page, selector) {
  const target = page.locator(selector);
  const focusSetup = await target.evaluate((element) => {
    const focusable = Array.from(document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((candidate) => {
      if (!(candidate instanceof HTMLElement)) return false;
      if (candidate.inert || candidate.closest('[inert]')) return false;
      const style = getComputedStyle(candidate);
      return style.display !== 'none' && style.visibility !== 'hidden' && candidate.getClientRects().length > 0;
    });
    const index = focusable.indexOf(element);
    if (index < 0) throw new Error(`Target ${element.id} is not keyboard focusable`);
    const previous = focusable[(index - 1 + focusable.length) % focusable.length];
    previous.focus();
    return {
      index,
      previous: previous.id || previous.getAttribute('aria-label') || previous.tagName,
      total: focusable.length,
    };
  });
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => document.activeElement === element && element.matches(':focus-visible'))) return;
  }
  const active = await page.evaluate(() => {
    const element = document.activeElement;
    const scrollButton = document.getElementById('scroll-to-top');
    return {
      element: element && (element.id || element.getAttribute('aria-label') || element.tagName),
      scrollButton: scrollButton && {
        ariaHidden: scrollButton.getAttribute('aria-hidden'),
        className: scrollButton.className,
        tabIndex: scrollButton.tabIndex,
        visibility: getComputedStyle(scrollButton).visibility,
      },
    };
  });
  throw new Error(`Keyboard focus missed ${selector}: ${JSON.stringify({ focusSetup, active })}`);
}

test('storage denial does not stop theme, menu, or chat controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException('Storage is disabled for this test', 'SecurityError');
        },
      });
    }
  });

  await page.goto(`${baseUrl}/EN/index.html`, { waitUntil: 'domcontentloaded' });
  await removeCinematicIntro(page);

  const themeToggle = page.locator('#theme-toggle');
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await themeToggle.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', initialTheme);

  const menuToggle = page.locator('#mobile-menu-toggle');
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Control+K');
  await expect(page.locator('#chat-window')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#chat-input')).toBeFocused();
  expect(pageErrors).toEqual([]);
});

test('dashboard form, filter, and modal controls have accessible names', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, authConfigured: true }),
  }));
  await page.goto(`${baseUrl}/dashboard?force_real=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#password-input')).toBeVisible();
  await expect(page.locator('#password-input')).toHaveAccessibleName(/password/i);

  await page.goto(`${baseUrl}/dashboard?demo=1`, { waitUntil: 'domcontentloaded' });

  await page.locator('[data-tab="console"]').click();
  await expect(page.locator('#console-filter')).toHaveAccessibleName(/filter console logs/i);
  await expect(page.locator('#console-level')).toHaveAccessibleName(/console level/i);
  await page.locator('[data-tab="network"]').click();
  await expect(page.locator('#network-method')).toHaveAccessibleName(/network method/i);
  await expect(page.locator('#network-status')).toHaveAccessibleName(/network status/i);
  await page.locator('[data-tab="errors"]').click();
  await page.getByRole('button', { name: 'View' }).first().click();
  await expect(page.locator('#modal-category')).toHaveAccessibleName(/error category/i);
  await expect(page.locator('#modal-status')).toHaveAccessibleName(/error status/i);
  await expect(page.locator('#close-modal')).toHaveAccessibleName(/close error details/i);
  await expect(page.locator('#close-modal')).toHaveJSProperty('tagName', 'BUTTON');
  const closeBox = await page.locator('#close-modal').boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox.y).toBeGreaterThanOrEqual(0);
  expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(844);
  expect(await page.locator('#close-modal').evaluate((element) => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('#close-modal') === element;
  })).toBe(true);
});

test('rapid dashboard pagination cannot skip a page', async ({ page }) => {
  const errors = Array.from({ length: 120 }, (_, index) => ({
    id: index + 1,
    type: 'EdgeCaseError',
    message: `Synthetic error ${index + 1}`,
    url: 'https://www.estivanayramia.com/test',
    filename: 'test.js',
    line: index + 1,
    stack: `Error: Synthetic error ${index + 1}`,
    category: 'code_bug',
    status: 'new',
    user_agent: 'Playwright',
    is_bot: false,
    timestamp: Date.now() - index * 1000,
  }));
  let requestCount = 0;

  await page.route('**/api/errors*', async (route) => {
    requestCount += 1;
    if (requestCount > 1) await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ errors, total: errors.length }),
    });
  });

  await page.goto(`${baseUrl}/404.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => sessionStorage.setItem('dashboard_token', 'qa-token'));
  await page.goto(`${baseUrl}/dashboard?force_real=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect.poll(() => requestCount).toBeGreaterThan(0);
  await expect(page.locator('#page-info')).toHaveText('Page 1 of 3');

  const next = page.locator('#next-page');
  await next.evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.locator('#page-info')).toHaveText('Page 2 of 3');
  await expect.poll(() => requestCount).toBe(2);
  await expect(next).toBeEnabled();
  await page.waitForTimeout(100);
  expect(requestCount).toBe(2);
});

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`open chat isolates the page and exposes visible, large focus targets at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${baseUrl}/EN/index.html`, { waitUntil: 'domcontentloaded' });
    await removeCinematicIntro(page);

    const toggle = page.locator('#chat-toggle');
    if (viewport.name === 'mobile') {
      await page.locator('footer').scrollIntoViewIfNeeded();
      await expect(toggle).toBeVisible();
    }
    await focusWithKeyboard(page, '#chat-toggle');
    expect(await toggle.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await expect(toggle).toHaveCSS('outline-color', 'rgb(225, 212, 194)');
    await page.keyboard.press('Enter');

    await expect(page.locator('#chat-window')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('main')).toHaveJSProperty('inert', true);
    await expect(toggle).toHaveJSProperty('inert', true);
    await expect(toggle).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#chat-input')).toBeFocused();

    const close = page.locator('#close-chat');
    const closeBox = await close.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox.width).toBeGreaterThanOrEqual(44);
    expect(closeBox.height).toBeGreaterThanOrEqual(44);
    await focusWithKeyboard(page, '#close-chat');
    expect(await close.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await expect(close).toHaveCSS('outline-color', 'rgb(225, 212, 194)');
    await close.click();

    await expect(page.locator('main')).toHaveJSProperty('inert', false);
    await expect(toggle).toHaveJSProperty('inert', false);
    await expect(toggle).not.toHaveAttribute('aria-hidden', 'true');
    await expect(toggle).toBeFocused();
  });
}

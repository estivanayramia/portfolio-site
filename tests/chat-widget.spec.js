const { test, expect } = require('@playwright/test');

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500').replace(/\/$/, '');
const pageForLanguage = (language) => `${baseUrl}/${language}/index.html`;

async function installNetworkGate(page, responses = [{ status: 200, body: { reply: 'Test reply' } }], options = {}) {
  let callCount = 0;
  await page.unrouteAll({ behavior: 'wait' });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (/(?:\/|^)chat(?:\?|$)/i.test(new URL(url).pathname)) {
      const response = responses[Math.min(callCount, responses.length - 1)];
      callCount += 1;
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      await route.fulfill({
        status: response.status,
        headers: response.headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(response.body === undefined ? {} : response.body)
      });
      return;
    }
    if (url.startsWith(baseUrl)) {
      await route.continue();
      return;
    }
    await route.abort();
  });
  return () => callCount;
}

async function openChat(page) {
  await page.locator('#chat-toggle').click();
  await expect(page.locator('#chat-window')).toHaveAttribute('aria-hidden', 'false');
}

async function waitForWidget(page) {
  await page.locator('#chat-toggle').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.documentElement.dataset.savonieInit === '1');
}

test.describe('Savonie chat widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('ea_intro_seen', '1');
      } catch (_) {
      }
    });
  });

  test('keeps the closed mobile trigger out of content until the footer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installNetworkGate(page);
    await page.goto(pageForLanguage('EN'));
    await page.waitForFunction(() => document.documentElement.dataset.savonieInit === '1');

    const widget = page.locator('#chat-widget');
    await expect(widget).toHaveClass(/chat-widget--deferred/);
    await expect(widget).toHaveAttribute('aria-hidden', 'true');

    await page.evaluate(() => window.scrollTo(0, 420));
    await expect(widget).toHaveClass(/chat-widget--deferred/);

    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect(widget).not.toHaveClass(/chat-widget--deferred/);
    await expect(page.locator('#chat-toggle')).toBeVisible();
  });

  test('coordinates menu/chat focus, Escape, inert state, and Ctrl/Cmd+K', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installNetworkGate(page);
    await page.goto(pageForLanguage('EN'));
    await waitForWidget(page);

    await page.locator('#mobile-menu-toggle').click();
    await expect(page.locator('#mobile-menu-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#chat-widget')).toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('Control+K');
    await expect(page.locator('#mobile-menu-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#chat-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#chat-input')).toBeInViewport();
    await expect(page.locator('#chat-input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-menu-toggle')).toBeFocused();
    await expect(page.locator('#chat-window')).toHaveAttribute('aria-hidden', 'true');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#chat-toggle').click();
    await expect(page.locator('#chat-input')).toBeFocused();
    await page.locator('#close-chat').click();
    await expect(page.locator('#chat-toggle')).toBeFocused();
  });

  test('drives pending status and disables rendered suggestion controls', async ({ page }) => {
    await installNetworkGate(page, [{ status: 200, body: { reply: 'Delayed reply' } }], { delayMs: 400 });
    await page.goto(pageForLanguage('EN'));
    await waitForWidget(page);
    await openChat(page);
    await page.locator('#chat-input').fill('pending check');
    const sendPromise = page.locator('#send-btn').click();
    await expect(page.locator('#chat-input')).toBeDisabled();
    await expect(page.locator('#send-btn')).toBeDisabled();
    await expect(page.locator('#chat-status')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#chat-status')).toContainText('Thinking');
    await expect(page.locator('#chat-chips button')).toHaveCount(5);
    await expect(page.locator('#chat-chips button').first()).toBeDisabled();
    await sendPromise;
    await expect(page.locator('#chat-input')).toBeEnabled();
    await expect(page.locator('#chat-chips button').first()).toBeEnabled();
  });

  test('shows localized pending status in Spanish and Arabic', async ({ page }) => {
    const cases = [
      { language: 'es', thinking: 'Pensando' },
      { language: 'ar', thinking: '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u0641\u0643\u064a\u0631' }
    ];
    for (const item of cases) {
      await installNetworkGate(page, [{ status: 200, body: { reply: 'Respuesta' } }], { delayMs: 350 });
      await page.goto(pageForLanguage(item.language));
      await waitForWidget(page);
      await openChat(page);
      await page.locator('#chat-input').fill('status');
      const sendPromise = page.locator('#send-btn').click();
      await expect(page.locator('#chat-status')).toContainText(item.thinking);
      await sendPromise;
      await expect(page.locator('#chat-input')).toBeEnabled();
    }
  });

  test('uses versioned history TTL and clears only the active language with focus restore', async ({ page }) => {
    await installNetworkGate(page);
    await page.goto(pageForLanguage('EN'));
    await waitForWidget(page);
    await page.evaluate(() => {
      localStorage.setItem('savonie_history:en', JSON.stringify({ version: 2, language: 'en', updatedAt: Date.now() - 31 * 86400000, items: [{ kind: 'text', sender: 'user', text: 'expired', timestamp: Date.now() - 31 * 86400000 }] }));
      localStorage.setItem('savonie_history:es', JSON.stringify({ version: 2, language: 'es', updatedAt: Date.now(), items: [{ kind: 'text', sender: 'user', text: 'hola', timestamp: Date.now() }] }));
    });
    await page.reload();
    await waitForWidget(page);
    expect(await page.evaluate(() => localStorage.getItem('savonie_history:en'))).toBeNull();
    await openChat(page);
    await page.on('dialog', (dialog) => dialog.accept());
    await page.locator('#chat-clear').click();
    await expect(page.locator('#chat-input')).toBeFocused();
    expect(await page.evaluate(() => ({ en: localStorage.getItem('savonie_history:en'), es: localStorage.getItem('savonie_history:es') }))).toEqual({ en: null, es: expect.any(String) });
  });

  test('localizes controls for EN/ES/AR and preserves RTL', async ({ page }) => {
    const cases = [
      { language: 'EN', close: 'Close chat', dir: 'ltr' },
      { language: 'es', close: 'Cerrar chat', dir: 'ltr' },
      { language: 'ar', close: 'إغلاق الدردشة', dir: 'rtl' }
    ];
    await installNetworkGate(page);
    for (const item of cases) {
      await page.goto(pageForLanguage(item.language));
      await waitForWidget(page);
      await openChat(page);
      await expect(page.locator('#close-chat')).toHaveAttribute('aria-label', item.close);
      await expect(page.locator('#suggestions-btn')).toHaveAttribute('aria-controls', 'chat-chips');
      await expect(page.locator('#suggestions-btn')).toHaveAttribute('aria-expanded', 'true');
      expect(await page.locator('html').getAttribute('dir')).toBe(item.dir);
    }
  });

  test('terminal 5xx makes one request and exposes manual retry; 429 respects Retry-After', async ({ page }) => {
    const calls = await installNetworkGate(page, [
      { status: 500, body: { error: 'upstream' } },
      { status: 200, body: { reply: 'Recovered' } }
    ]);
    await page.goto(pageForLanguage('EN'));
    await waitForWidget(page);
    await openChat(page);
    await page.locator('#chat-input').fill('server failure');
    await page.locator('#send-btn').click();
    await expect(page.locator('.chat-retry-btn')).toBeVisible();
    expect(calls()).toBe(1);
    await page.locator('.chat-retry-btn').click();
    await expect(page.locator('#chat-messages')).toContainText('Recovered');
    expect(calls()).toBe(2);

    const rateCalls = await installNetworkGate(page, [{
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': baseUrl,
        'Access-Control-Expose-Headers': 'Retry-After',
        'Retry-After': '2'
      },
      body: {}
    }]);
    await page.locator('#chat-input').fill('rate limited');
    await page.locator('#send-btn').click();
    await expect(page.locator('.chat-retry-btn')).toContainText('2');
    await expect(page.locator('.chat-retry-btn')).toBeDisabled();
    expect(rateCalls()).toBe(1);
  });

  test('rejects malformed 2xx payloads with localized retry and no ready success', async ({ page }) => {
    const invalidPayloads = [{}, { reply: '' }, { reply: null }, null, 'not an object'];
    for (const payload of invalidPayloads) {
      await installNetworkGate(page, [{ status: 200, body: payload }]);
      await page.goto(pageForLanguage('EN'));
      await waitForWidget(page);
      await openChat(page);
      await page.locator('#chat-input').fill('keep this prompt');
      await page.locator('#send-btn').click();
      await expect(page.locator('.chat-retry-btn')).toBeVisible();
      await expect(page.locator('#chat-status')).toContainText('response was not understood');
      await expect(page.locator('#chat-status')).not.toContainText('Ready');
    }
  });

  test('surfaces metadata notices and strips unsafe links/HTML', async ({ page }) => {
    await installNetworkGate(page, [{ status: 200, body: { reply: '[bad](javascript:alert(1)) <script>bad</script>', fallback_mode: true, truncated: true, continuation_hint: true } }]);
    await page.goto(pageForLanguage('EN'));
    await waitForWidget(page);
    await openChat(page);
    await page.locator('#chat-input').fill('metadata');
    await page.locator('#send-btn').click();
    await expect(page.locator('#chat-messages')).toContainText('Showing a fallback answer.');
    await expect(page.locator('#chat-messages')).toContainText('This answer was shortened.');
    await expect(page.locator('#chat-messages')).toContainText('Ask a follow-up to continue.');
    await expect(page.locator('#chat-messages script')).toHaveCount(0);
    await expect(page.locator('#chat-messages a[href^="javascript:"]')).toHaveCount(0);
  });
});

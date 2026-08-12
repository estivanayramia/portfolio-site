const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500').replace(/\/$/, '');
const localOrigin = new URL(baseUrl).origin;
const reportPath = path.join(process.cwd(), '.reports', 'edge-qa', 'site-wide-controls.json');
const sources = execFileSync('git', ['ls-files', '-z', '--', '*.html'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];
const sharedControlIds = new Set([
  'theme-toggle',
  'mobile-menu-toggle',
  'scroll-to-top',
  'chat-toggle',
  'close-chat',
  'suggestions-btn',
  'send-btn',
]);
const results = [];

test.use({ serviceWorkers: 'block' });
test.describe.configure({ mode: 'serial' });

function surfaceUrl(source) {
  const encodedPath = source.split('/').map(encodeURIComponent).join('/');
  const query = source === 'EN/dashboard.html' ? '?demo=1' : '';
  return `${baseUrl}/${encodedPath}${query}`;
}

function mockJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installNetworkBoundary(page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'POST' && url.pathname === '/chat') {
      return mockJson(route, { reply: 'QA reply from the local route matrix.', chips: [] });
    }
    if (url.origin === localOrigin) {
      if (request.method() === 'POST' && url.pathname === '/api/chat') {
        return mockJson(route, { reply: 'QA reply from the local route matrix.', chips: [] });
      }
      if (url.pathname === '/api/health') {
        return mockJson(route, { ok: true, authConfigured: true });
      }
      if (url.pathname === '/api/auth') {
        return mockJson(route, { token: 'site-wide-qa-token' });
      }
      if (url.pathname === '/api/contact') {
        return mockJson(route, { success: true, recorded: true, receiptId: 'site-wide-receipt' });
      }
      if (url.pathname === '/api/errors' && request.method() === 'GET') {
        return mockJson(route, {
          errors: [{
            id: 1,
            type: 'SiteWideQaError',
            message: 'Synthetic dashboard row',
            url: `${localOrigin}/qa`,
            filename: 'site-wide-controls.spec.js',
            line: 1,
            stack: 'Error: Synthetic dashboard row',
            category: 'code_bug',
            status: 'new',
            user_agent: 'Playwright',
            is_bot: false,
            timestamp: Date.now(),
          }],
          total: 1,
        });
      }
      if (url.pathname.startsWith('/api/errors/') || url.pathname === '/api/error-report') {
        return mockJson(route, { ok: true });
      }
      return route.continue();
    }

    if (url.hostname === 'formspree.io') {
      return mockJson(route, { ok: true, next: '/thanks' });
    }
    if (/google-analytics\.com$|googletagmanager\.com$|clarity\.ms$/.test(url.hostname)) {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 204, body: '' });
  });
}

async function dismissIntro(page) {
  const intro = page.locator('#cinematic-intro');
  await intro.waitFor({ state: 'attached', timeout: 1200 }).catch(() => {});
  if (!(await intro.count())) return;
  const skip = page.getByRole('button', { name: /skip intro/i });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click({ force: true });
  } else {
    await page.keyboard.press('Escape');
  }
  await intro.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
}

async function exerciseSharedControls(page) {
  const actions = [];
  const theme = page.locator('#theme-toggle');
  if (await theme.isVisible().catch(() => false)) {
    const initial = await page.locator('html').getAttribute('data-theme');
    await theme.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', initial);
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', initial || 'light');
    actions.push('theme-toggle:2');
  }

  const menu = page.locator('#mobile-menu-toggle');
  if (await menu.isVisible().catch(() => false)) {
    for (let index = 0; index < 2; index += 1) {
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    }
    actions.push('mobile-menu-toggle:4');
  }

  const chatToggle = page.locator('#chat-toggle');
  const chatWindow = page.locator('#chat-window');
  if (await chatToggle.isVisible().catch(() => false)) {
    for (let index = 0; index < 2; index += 1) {
      await chatToggle.click();
      await expect(chatWindow).toHaveAttribute('aria-hidden', 'false');
      const suggestions = page.locator('#suggestions-btn');
      if (await suggestions.isVisible().catch(() => false)) {
        const suggestionsContainer = page.locator('[data-chat-suggestions="container"]');
        for (let suggestionClick = 0; suggestionClick < 2; suggestionClick += 1) {
          const wasVisible = await suggestionsContainer.isVisible();
          const clickResult = await suggestions.evaluate((button) => {
            const box = button.getBoundingClientRect();
            const hitTarget = document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            );
            const startedAt = performance.now();
            button.click();
            return {
              duration: performance.now() - startedAt,
              hitTarget: hitTarget?.closest('#suggestions-btn') === button,
            };
          });
          expect(clickResult.hitTarget).toBe(true);
          expect(clickResult.duration).toBeLessThan(250);
          if (wasVisible) {
            await expect(suggestionsContainer).toBeHidden();
          } else {
            await expect(suggestionsContainer).toBeVisible();
          }
        }
      }
      if (index === 0) {
        await page.locator('#chat-input').fill('Run the site-wide QA check.');
        await page.locator('#send-btn').click();
        await expect(page.locator('#chat-messages')).toContainText('QA reply from the local route matrix.');
      }
      await page.locator('#close-chat').click();
      await expect(chatWindow).toHaveAttribute('aria-hidden', 'true');
    }
    actions.push('chat-open-close:2', 'suggestions-toggle:4', 'chat-send:1');
  }

  const scroll = page.locator('#scroll-to-top');
  if (await scroll.count()) {
    for (let index = 0; index < 2; index += 1) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(80);
      if (await scroll.isVisible().catch(() => false)) {
        await scroll.click();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
      }
    }
    actions.push('scroll-to-top:2');
  }
  return actions;
}

async function auditFrameControls(frame) {
  const controls = frame.locator('button, input[type="button"], input[type="submit"]');
  const audit = await controls.evaluateAll((elements) => elements.map((element, index) => {
    if (!element.dataset.edgeControlId) element.dataset.edgeControlId = `control-${index}`;
    const labelledBy = element.getAttribute('aria-labelledby');
    const labelledText = labelledBy
      ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ')
      : '';
    const name = (
      element.getAttribute('aria-label') ||
      labelledText ||
      element.textContent ||
      element.getAttribute('title') ||
      element.value ||
      ''
    ).replace(/\s+/g, ' ').trim();
    const style = getComputedStyle(element);
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    return {
      key: element.dataset.edgeControlId,
      id: element.id,
      name,
      visible,
      disabled: element.disabled || element.getAttribute('aria-disabled') === 'true',
      html: element.outerHTML.slice(0, 300),
    };
  }));
  return { controls, audit };
}

async function exerciseFrameControls(page, frame) {
  const { audit } = await auditFrameControls(frame);
  const unnamed = audit.filter((control) => !control.name);
  expect(unnamed, `${frame.url()} unnamed buttons`).toEqual([]);

  let visibleActions = 0;
  let hiddenActions = 0;
  let detachedControls = 0;
  for (const control of audit) {
    if (control.disabled || sharedControlIds.has(control.id)) continue;
    const locator = frame.locator(`[data-edge-control-id="${control.key}"]`);
    if (!(await locator.count())) {
      detachedControls += 1;
      continue;
    }
    if (await locator.isVisible().catch(() => false)) {
      await locator.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
      let clicked = false;
      try {
        await locator.click({ timeout: 1000 });
        clicked = true;
      } catch {
        await page.keyboard.press('Escape').catch(() => {});
        if (!(await locator.count())) {
          detachedControls += 1;
          continue;
        }
        try {
          await locator.click({ timeout: 1000, force: true });
          clicked = true;
        } catch (error) {
          if (!(await locator.count())) {
            detachedControls += 1;
            continue;
          }
          throw error;
        }
      }
      if (clicked) visibleActions += 1;
      await page.keyboard.press('Escape').catch(() => {});
    } else {
      await locator.evaluate((element) => {
        element.click();
        element.click();
      }).then(() => {
        hiddenActions += 2;
      }).catch(() => {
        detachedControls += 1;
      });
    }
  }
  return { total: audit.length, visibleActions, hiddenActions, detachedControls };
}

test.beforeAll(() => {
  expect(sources).toHaveLength(60);
});

test.afterAll(() => {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({ sources: sources.length, viewports, results }, null, 2)}\n`);
});

test('an open achievements panel accepts repeated live updates', async ({ page }) => {
  await installNetworkBoundary(page);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  await page.goto(surfaceUrl('EN/hobbies-games.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.toggleAchievements === 'function');

  for (let index = 0; index < 2; index += 1) {
    await page.evaluate(() => window.toggleAchievements(true));
    await expect(page.locator('#achievements-modal')).not.toHaveClass(/hidden/);
    await page.evaluate(() => window.ArcadeAchievements.updateUI());
    const close = page.getByRole('button', { name: 'Close panel' });
    expect(await close.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('#achievements-close') === button;
    })).toBe(true);
    await close.click();
    await expect(page.locator('#achievements-modal')).toHaveClass(/hidden/);
  }

  expect(pageErrors).toEqual([]);
});

for (const source of sources) {
  test(`${source} loads and its controls work twice`, async ({ browser }) => {
    test.setTimeout(120000);

    for (const viewport of viewports) {
      const context = await browser.newContext({
        serviceWorkers: 'block',
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      await installNetworkBoundary(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));
      page.on('popup', (popup) => popup.close().catch(() => {}));
      const pageErrors = [];
      const consoleErrors = [];
      const localFailures = [];
      const resourceFailures = [];
      const onPageError = (error) => pageErrors.push(error.stack || error.message);
      const onConsole = (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      };
      const onResponse = (response) => {
        const url = new URL(response.url());
        if (response.status() >= 400) {
          resourceFailures.push(`${response.status()} ${url.href}`);
          if (url.origin === localOrigin) {
            localFailures.push(`${response.status()} ${url.pathname}`);
          }
        }
      };
      page.on('pageerror', onPageError);
      page.on('console', onConsole);
      page.on('response', onResponse);

      const url = surfaceUrl(source);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      expect(response, `${source} document response`).not.toBeNull();
      expect(response.status(), `${source} document status`).toBeLessThan(400);
      await dismissIntro(page);
      await expect(page.locator('body')).toHaveCount(1);
      expect(await page.locator('body').evaluate((body) => body.childElementCount), `${source} body elements`).toBeGreaterThan(0);
      await expect(page.locator('meta[name="build-version"]')).toHaveCount(1);

      await page.waitForTimeout(100);
      const baselineConsoleErrors = consoleErrors.filter((message) =>
        !/favicon\.ico|Failed to load resource.*(?:google|clarity|doubleclick)/i.test(message)
      );
      expect(pageErrors, `${source} ${viewport.name} startup page errors`).toEqual([]);
      expect([...new Set(localFailures)], `${source} ${viewport.name} startup local response failures`).toEqual([]);
      expect(
        baselineConsoleErrors,
        `${source} ${viewport.name} startup console errors; failed responses: ${resourceFailures.join(', ')}`,
      ).toEqual([]);
      pageErrors.length = 0;
      consoleErrors.length = 0;
      localFailures.length = 0;

      const sharedActions = await exerciseSharedControls(page);
      const frameResults = [];
      for (const frame of page.frames()) {
        if (frame.isDetached()) continue;
        if (frame !== page.mainFrame()) {
          frameResults.push({ url: frame.url(), integrationOnly: true });
          continue;
        }
        frameResults.push({ url: frame.url(), ...(await exerciseFrameControls(page, frame)) });
      }

      await page.waitForTimeout(100);
      page.removeListener('pageerror', onPageError);
      page.removeListener('console', onConsole);
      page.removeListener('response', onResponse);

      const meaningfulConsoleErrors = consoleErrors.filter((message) =>
        !/favicon\.ico|Failed to load resource.*(?:google|clarity|doubleclick)/i.test(message)
      ).filter((message) => source !== 'EN/dashboard.html' ||
        !/invalid form control|Test error message|Caught synthetic error|Failed to load resource:.*404/i.test(message)
      );
      expect(pageErrors, `${source} ${viewport.name} page errors`).toEqual([]);
      expect(meaningfulConsoleErrors, `${source} ${viewport.name} console errors`).toEqual([]);
      if (source !== 'EN/dashboard.html') {
        expect([...new Set(localFailures)], `${source} ${viewport.name} local response failures`).toEqual([]);
      }

      results.push({
        source,
        viewport: viewport.name,
        finalUrl: page.url(),
        sharedActions,
        frames: frameResults,
        inducedConsoleErrors: consoleErrors,
        inducedLocalFailures: [...new Set(localFailures)],
      });
      await context.close();
    }
  });
}

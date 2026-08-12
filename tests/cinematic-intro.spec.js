const { test, expect } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500';
const homeUrl = `${baseUrl}/`;
const nonHomeUrl = `${baseUrl}/EN/about.html`;

async function installAudioProbe(page) {
  await page.addInitScript(() => {
    window.__introAudioStartCalls = 0;
    let api;
    Object.defineProperty(window, '__introAudio', {
      configurable: true,
      get: () => api,
      set: (value) => {
        if (value && typeof value.start === 'function') {
          value.isAvailable = () => true;
          value.start = () => {
            window.__introAudioStartCalls += 1;
            return Promise.resolve(false);
          };
        }
        api = value;
      }
    });
  });
}

test.describe('Cinematic intro opt-in', () => {
  test('homepage is immediately usable and does not touch audio before activation', async ({ page }) => {
    await installAudioProbe(page);
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.watch-trailer-btn')).toBeVisible();
    await expect(page.locator('#cinematic-intro')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/intro-active/);
    await expect.poll(() => page.evaluate(() => window.__introAudioStartCalls || 0), { timeout: 500 }).toBe(0);
  });

  test('explicit CTA opens the intro and starts audio only from that interaction', async ({ page }) => {
    await installAudioProbe(page);
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });

    await page.locator('.watch-trailer-btn').click();

    await expect(page.locator('#cinematic-intro')).toBeVisible();
    expect(await page.evaluate(() => window.__introAudioStartCalls)).toBe(1);
  });

  test('Escape exits the intro, restores focus, and the CTA can open it again', async ({ page }) => {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.watch-trailer-btn').click();
    await expect(page.locator('#cinematic-intro')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('#cinematic-intro')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('html')).not.toHaveClass(/intro-active/);
    await expect(page.locator('.watch-trailer-btn')).toBeFocused();

    await page.locator('.watch-trailer-btn').click();
    await expect(page.locator('#cinematic-intro')).toBeVisible();
  });

  test('Enter skips when the dialog itself is focused without overriding native button activation', async ({ page }) => {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.watch-trailer-btn').click();
    const intro = page.locator('#cinematic-intro');
    await expect(intro).toBeVisible();

    await intro.focus();
    await page.keyboard.press('Enter');
    await expect(intro).toHaveCount(0, { timeout: 3000 });
  });

  test('reduced motion never creates a blocking overlay', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.watch-trailer-btn')).toBeHidden();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#cinematic-intro')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/intro-active/);
    await context.close();
  });

  test('skip and keyboard navigation do not start audio', async ({ page }) => {
    await installAudioProbe(page);
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.watch-trailer-btn').click();
    await expect(page.locator('#cinematic-intro')).toBeVisible();
    expect(await page.evaluate(() => window.__introAudioStartCalls)).toBe(1);

    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => window.__introAudioStartCalls)).toBe(1);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.__introAudioStartCalls)).toBe(1);
  });

  test('non-home routes expose no replay affordance or replay API', async ({ page }) => {
    await page.goto(nonHomeUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.watch-trailer-btn')).toHaveCount(0);
    expect(await page.evaluate(() => typeof window.__replayIntro)).toBe('undefined');
  });

  test('homepage replay API launches directly without a reload', async ({ page }) => {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
    let navigations = 0;
    page.on('framenavigated', () => { navigations += 1; });

    await page.evaluate(() => window.__replayIntro());

    await expect(page.locator('#cinematic-intro')).toBeVisible();
    expect(navigations).toBe(0);
  });
});

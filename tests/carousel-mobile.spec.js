const { test, expect, devices } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500';
const projectUrl = `${baseUrl}/EN/projects/`;

const iphoneUserAgent = devices['iPhone 14']?.userAgent;
const androidUserAgent = devices['Pixel 7']?.userAgent;
const tabletUserAgent = devices['iPad (gen 7)']?.userAgent || devices['iPad Mini']?.userAgent || iphoneUserAgent;

const touchProfiles = [
  {
    name: 'iPhone Small',
    category: 'iphone',
    use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, userAgent: iphoneUserAgent }
  },
  {
    name: 'iPhone Standard',
    category: 'iphone',
    use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: iphoneUserAgent }
  },
  {
    name: 'iPhone Large',
    category: 'iphone',
    use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, userAgent: iphoneUserAgent }
  },
  {
    name: 'Android Small',
    category: 'android',
    use: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: androidUserAgent }
  },
  {
    name: 'Android Standard',
    category: 'android',
    use: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: androidUserAgent }
  },
  {
    name: 'Android Large',
    category: 'android',
    use: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, userAgent: androidUserAgent }
  },
  {
    name: 'Tablet Portrait',
    category: 'tablet',
    use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, userAgent: tabletUserAgent }
  },
  {
    name: 'Tablet Landscape',
    category: 'tablet',
    use: { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true, userAgent: tabletUserAgent }
  }
];

const desktopProfiles = [
  {
    name: 'Desktop 1920',
    use: { viewport: { width: 1920, height: 1080 }, hasTouch: false, isMobile: false }
  },
  {
    name: 'Laptop 1440',
    use: { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false }
  },
  {
    name: 'Laptop 1366',
    use: { viewport: { width: 1366, height: 768 }, hasTouch: false, isMobile: false }
  }
];

const hybridProfile = {
  name: 'Hybrid Touch Laptop',
  use: { viewport: { width: 1366, height: 768 }, hasTouch: true, isMobile: false, userAgent: androidUserAgent }
};

async function prepareCarousel(page) {
  await page.goto(projectUrl);
  await page.evaluate(() => {
    const banner = document.querySelector('[role="dialog"][aria-label="Diagnostics consent"]');
    if (banner) {
      banner.style.pointerEvents = 'none';
      banner.setAttribute('aria-hidden', 'true');
    }
  });
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });

  const carousel = page.locator('[data-luxury-coverflow]');
  await expect(carousel).toBeVisible({ timeout: 10000 });
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: 10000 });
  await page.waitForSelector('.coverflow-card', { state: 'visible', timeout: 10000 });

  await carousel.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.querySelector('[data-luxury-coverflow]')?.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(250);
}

async function getActiveCard(page) {
  return page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
}

async function getActiveIndex(page) {
  const activeCard = await getActiveCard(page);
  return (await activeCard.getAttribute('data-index')) || '';
}

async function ensureCarouselInView(page) {
  const carousel = page.locator('[data-luxury-coverflow]');
  await carousel.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.querySelector('[data-luxury-coverflow]')?.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(150);
}

async function swipeCarousel(page, direction, options = {}) {
  const {
    axis = 'horizontal',
    distanceRatio = 0.56,
    steps = 10,
    settleMs = 850
  } = options;

  await ensureCarouselInView(page);
  const track = page.locator('.coverflow-track').first();
  const box = await track.boundingBox();
  const startX = Math.round(box.x + box.width * 0.5);
  const startY = Math.round(box.y + box.height * 0.5);

  const deltaX = axis === 'horizontal'
    ? Math.round(box.width * distanceRatio) * (direction === 'left' ? -1 : 1)
    : 0;
  const deltaY = axis === 'vertical'
    ? Math.round(box.height * distanceRatio) * (direction === 'up' ? -1 : 1)
    : 0;

  await track.evaluate(async (node, payload) => {
    const { startX: sx, startY: sy, deltaX: dx, deltaY: dy, steps: moveSteps } = payload;
    const fire = (type, clientX, clientY, buttons) => {
      node.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        button: type === 'pointerup' ? -1 : 0,
        buttons,
        clientX,
        clientY
      }));
    };

    fire('pointerdown', sx, sy, 1);

    for (let step = 1; step <= moveSteps; step += 1) {
      const currentX = Math.round(sx + (dx * step) / moveSteps);
      const currentY = Math.round(sy + (dy * step) / moveSteps);
      fire('pointermove', currentX, currentY, 1);
      await new Promise((resolve) => setTimeout(resolve, 16));
    }

    fire('pointerup', sx + dx, sy + dy, 0);
  }, { startX, startY, deltaX, deltaY, steps });

  await page.waitForTimeout(settleMs);
}

async function wheelCarousel(page, direction) {
  await ensureCarouselInView(page);
  const track = page.locator('.coverflow-track').first();
  const box = await track.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(direction === 'next' ? 320 : -320, 0);
  await page.waitForTimeout(500);
}

async function triggerRoulette(page, pointerMode = 'click') {
  await ensureCarouselInView(page);
  const rouletteBtn = page.locator('[data-roulette-trigger], .roulette-trigger-btn').first();
  await expect(rouletteBtn).toBeVisible();
  if (pointerMode === 'tap') {
    await rouletteBtn.tap();
  } else {
    await rouletteBtn.click();
  }
  await expect(page.locator('.luxury-roulette-overlay')).toHaveAttribute('aria-hidden', 'false', { timeout: 10000 });
}

for (const profile of touchProfiles) {
  test.describe(`${profile.name} — Touch Matrix`, () => {
    test.use(profile.use);

    test.beforeEach(async ({ page }) => {
      await prepareCarousel(page);
    });

    test('keeps one active card fully on screen', async ({ page }) => {
      const cards = page.locator('.coverflow-card--active, .coverflow-card.is-center');
      await expect(cards).toHaveCount(1);

      const cardBox = await cards.first().boundingBox();
      const viewport = page.viewportSize();
      expect(cardBox.x).toBeGreaterThanOrEqual(-4);
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 4);
    });

    test('horizontal swipe left advances exactly one card', async ({ page }) => {
      const initialIndex = Number(await getActiveIndex(page));
      await swipeCarousel(page, 'left');
      const finalIndex = Number(await getActiveIndex(page));
      expect(finalIndex).toBe((initialIndex + 1) % 6);
    });

    test('horizontal swipe right reverses exactly one card', async ({ page }) => {
      await swipeCarousel(page, 'left');
      const initialIndex = Number(await getActiveIndex(page));
      await swipeCarousel(page, 'right');
      const finalIndex = Number(await getActiveIndex(page));
      expect(finalIndex).toBe((initialIndex + 5) % 6);
    });

    test('vertical swipe does not advance the carousel', async ({ page }) => {
      const initialIndex = await getActiveIndex(page);
      await swipeCarousel(page, 'up', { axis: 'vertical', distanceRatio: 0.5, settleMs: 650 });
      expect(await getActiveIndex(page)).toBe(initialIndex);
    });

    test('roulette tap opens overlay without advancing a card', async ({ page }) => {
      const initialIndex = await getActiveIndex(page);
      await triggerRoulette(page, 'tap');
      expect(await getActiveIndex(page)).toBe(initialIndex);

      const closeButton = page.locator('.luxury-roulette-close');
      await expect(closeButton).toBeVisible();
      await page.waitForTimeout(400);
      await closeButton.tap();
      await expect(page.locator('.luxury-roulette-overlay')).toHaveAttribute('aria-hidden', 'true');
    });

    if (profile.category === 'tablet') {
      test('orientation flip preserves a single centered active card', async ({ page }) => {
        const originalViewport = profile.use.viewport;
        await page.setViewportSize({ width: originalViewport.height, height: originalViewport.width });
        await page.waitForTimeout(350);
        await page.setViewportSize(originalViewport);
        await page.waitForTimeout(350);
        await expect(page.locator('.coverflow-card--active, .coverflow-card.is-center')).toHaveCount(1);
      });
    }
  });
}

test.describe('Repeated Touch Stability', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: iphoneUserAgent });

  test.beforeEach(async ({ page }) => {
    await prepareCarousel(page);
  });

  test('20 consecutive swipes remain deterministic', async ({ page }) => {
    let expectedIndex = Number(await getActiveIndex(page));
    for (let step = 0; step < 20; step += 1) {
      await swipeCarousel(page, 'left', { settleMs: 650 });
      expectedIndex = (expectedIndex + 1) % 6;
      expect(Number(await getActiveIndex(page))).toBe(expectedIndex);
    }
  });
});

for (const profile of desktopProfiles) {
  test.describe(`${profile.name} — Desktop Matrix`, () => {
    test.use(profile.use);

    test.beforeEach(async ({ page }) => {
      await prepareCarousel(page);
    });

    test('next and previous buttons move exactly one card', async ({ page }) => {
      const nextButton = page.locator('.coverflow-btn-next').first();
      const previousButton = page.locator('.coverflow-btn-prev').first();
      const initialIndex = Number(await getActiveIndex(page));

      await nextButton.click();
      await page.waitForTimeout(450);
      expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % 6);

      await previousButton.click();
      await page.waitForTimeout(450);
      expect(Number(await getActiveIndex(page))).toBe(initialIndex);
    });

    test('wheel interaction advances and reverses cleanly', async ({ page }) => {
      const initialIndex = Number(await getActiveIndex(page));
      await wheelCarousel(page, 'next');
      expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % 6);

      await wheelCarousel(page, 'prev');
      expect(Number(await getActiveIndex(page))).toBe(initialIndex);
    });

    test('keyboard navigation remains stable', async ({ page }) => {
      await ensureCarouselInView(page);
      const activeCard = await getActiveCard(page);
      await activeCard.focus();
      const initialIndex = Number(await getActiveIndex(page));

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(450);
      expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % 6);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(450);
      expect(Number(await getActiveIndex(page))).toBe(initialIndex);
    });

    test('roulette click opens and closes without corrupting carousel state', async ({ page }) => {
      const initialIndex = await getActiveIndex(page);
      await triggerRoulette(page, 'click');
      expect(await getActiveIndex(page)).toBe(initialIndex);

      await page.keyboard.press('Escape');
      await expect(page.locator('.luxury-roulette-overlay')).toHaveAttribute('aria-hidden', 'true');
      await expect(getActiveCard(page)).resolves.toBeTruthy();
    });
  });
}

test.describe(`${hybridProfile.name} — Hybrid Input`, () => {
  test.use(hybridProfile.use);

  test.beforeEach(async ({ page }) => {
    await prepareCarousel(page);
  });

  test('touch swipe followed by button click does not double-advance', async ({ page }) => {
    const nextButton = page.locator('.coverflow-btn-next').first();
    const initialIndex = Number(await getActiveIndex(page));

    await swipeCarousel(page, 'left');
    expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % 6);

    await nextButton.click();
    await page.waitForTimeout(450);
    expect(Number(await getActiveIndex(page))).toBe((initialIndex + 2) % 6);
  });
});

test.describe('Reduced Motion Tier', () => {
  test('reduced motion still initializes and slides correctly', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    await prepareCarousel(page);
    await expect(page.locator('[data-luxury-coverflow]')).toHaveAttribute('data-coverflow-ready', 'true');

    const initialIndex = Number(await getActiveIndex(page));
    await page.locator('.coverflow-btn-next').click();
    await page.waitForTimeout(300);
    expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % 6);
    await context.close();
  });
});

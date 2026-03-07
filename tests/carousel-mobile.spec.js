const { test, expect, devices } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500';
const projectUrl = `${baseUrl}/EN/projects/`;
const aboutUrl = `${baseUrl}/EN/about.html`;
const gamesUrl = `${baseUrl}/EN/hobbies-games.html`;
const whispersUrl = `${baseUrl}/EN/hobbies/whispers.html`;
const photographyUrl = `${baseUrl}/EN/hobbies/photography.html`;
const meUrl = `${baseUrl}/EN/hobbies/me.html`;
const cookingUrl = `${baseUrl}/EN/hobbies/cooking.html`;
const carUrl = `${baseUrl}/EN/hobbies/car.html`;
const gymUrl = `${baseUrl}/EN/hobbies/gym.html`;
const readingUrl = `${baseUrl}/EN/hobbies/reading.html`;

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

const responsiveProfiles = [
  {
    name: 'Phone',
    use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: iphoneUserAgent }
  },
  {
    name: 'Tablet',
    use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, userAgent: tabletUserAgent }
  },
  {
    name: 'Laptop',
    use: { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false }
  },
  {
    name: 'Desktop',
    use: { viewport: { width: 1920, height: 1080 }, hasTouch: false, isMobile: false }
  }
];

const premiumPages = [
  { name: 'Projects', url: projectUrl, selector: '[data-luxury-coverflow]', expectRoulette: true },
  { name: 'About', url: aboutUrl, selector: '#about-carousel-section', expectRoulette: true },
  { name: 'Games', url: gamesUrl, selector: '#arcade-featured-carousel', expectRoulette: false }
];

const miniPages = [
  { name: 'Whispers', url: whispersUrl },
  { name: 'Photography', url: photographyUrl },
  { name: 'Me', url: meUrl },
  { name: 'Cooking', url: cookingUrl },
  { name: 'Car', url: carUrl },
  { name: 'Gym', url: gymUrl },
  { name: 'Reading', url: readingUrl }
];

const responsiveMiniPages = [
  { name: 'Whispers', url: whispersUrl },
  { name: 'Photography', url: photographyUrl },
  { name: 'Me', url: meUrl }
];

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

async function prepareCarouselAt(page, url, selector = '[data-luxury-coverflow]') {
  await page.goto(url);
  await page.evaluate(() => {
    const banner = document.querySelector('[role="dialog"][aria-label="Diagnostics consent"]');
    if (banner) {
      banner.style.pointerEvents = 'none';
      banner.setAttribute('aria-hidden', 'true');
    }
  });

  const carousel = page.locator(selector);
  await expect(carousel).toBeVisible({ timeout: 10000 });
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: 10000 });
  await carousel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
}

async function prepareMiniCarouselAt(page, url, selector = '[data-mini-carousel]') {
  await page.goto(url);
  await page.evaluate(() => {
    const banner = document.querySelector('[role="dialog"][aria-label="Diagnostics consent"]');
    if (banner) {
      banner.style.pointerEvents = 'none';
      banner.setAttribute('aria-hidden', 'true');
    }
  });

  const carousel = page.locator(selector);
  await expect(carousel).toBeVisible({ timeout: 10000 });
  await expect(carousel).toHaveAttribute('data-gallery-coverflow-init', 'true', { timeout: 10000 });
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: 10000 });
  await carousel.scrollIntoViewIfNeeded();
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

async function ensureMiniCarouselInView(page, selector = '[data-mini-carousel]') {
  const carousel = page.locator(selector).first();
  await carousel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
}

async function getMiniState(page, selector = '[data-mini-carousel]') {
  return page.locator(selector).first().evaluate((section) => {
    const slides = Array.from(section.querySelectorAll('.carousel-slide'));
    const active = section.querySelector('.carousel-slide.coverflow-card--active, .carousel-slide.is-center');
    const track = section.querySelector('.carousel-track');
    const buttons = Array.from(section.querySelectorAll('.carousel-btn')).map((button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const dots = Array.from(section.querySelectorAll('.carousel-dot')).map((dot) => ({
      active: dot.classList.contains('active') || dot.getAttribute('aria-current') === 'true',
      index: dot.getAttribute('data-index') || ''
    }));

    return {
      activeIndex: slides.indexOf(active),
      activeCount: section.querySelectorAll('.carousel-slide.coverflow-card--active, .carousel-slide.is-center').length,
      mode: section.dataset.miniCarouselMode || '',
      ready: section.dataset.coverflowReady || '',
      surface: section.dataset.gallerySurface || section.dataset.coverflowSurface || '',
      variant: section.dataset.galleryVariant || '',
      trackTransform: track ? getComputedStyle(track).transform : '',
      sectionRect: section.getBoundingClientRect().toJSON(),
      activeRect: active ? active.getBoundingClientRect().toJSON() : null,
      activeLabel: active ? active.getAttribute('aria-label') || '' : '',
      activeDotCount: dots.filter((dot) => dot.active).length,
      dots,
      buttons
    };
  });
}

async function clickMiniButton(page, direction, selector = '[data-mini-carousel]') {
  const button = page.locator(`${selector} ${direction === 'next' ? '.carousel-btn-next' : '.carousel-btn-prev'}`).first();
  await button.click();
  await page.waitForTimeout(450);
}

async function wheelMiniCarousel(page, deltaX, deltaY, selector = '[data-mini-carousel]') {
  await ensureMiniCarouselInView(page, selector);
  const track = page.locator(`${selector} .carousel-track`).first();
  const box = await track.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, deltaY);
  await page.waitForTimeout(500);
}

async function swipeMiniCarousel(page, direction, options = {}) {
  const {
    axis = 'horizontal',
    selector = '[data-mini-carousel]',
    distanceRatio = 0.52,
    steps = 10,
    settleMs = 700
  } = options;

  await ensureMiniCarouselInView(page, selector);
  const track = page.locator(`${selector} .carousel-track`).first();
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

    const buildTouch = (clientX, clientY) => new Touch({
      identifier: 1,
      target: node,
      clientX,
      clientY,
      pageX: clientX,
      pageY: clientY,
      radiusX: 2,
      radiusY: 2,
      force: 0.5
    });

    const fire = (type, clientX, clientY) => {
      const touch = buildTouch(clientX, clientY);
      node.dispatchEvent(new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches: type === 'touchend' ? [] : [touch],
        targetTouches: type === 'touchend' ? [] : [touch],
        changedTouches: [touch]
      }));
    };

    fire('touchstart', sx, sy);

    for (let step = 1; step <= moveSteps; step += 1) {
      const currentX = Math.round(sx + (dx * step) / moveSteps);
      const currentY = Math.round(sy + (dy * step) / moveSteps);
      fire('touchmove', currentX, currentY);
      await new Promise((resolve) => setTimeout(resolve, 16));
    }

    fire('touchend', sx + dx, sy + dy);
  }, { startX, startY, deltaX, deltaY, steps });

  await page.waitForTimeout(settleMs);
}

async function expectSectionWithinViewport(page, selector) {
  const state = await page.locator(selector).first().evaluate((section) => {
    const rect = section.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth
    };
  });

  expect(state.left).toBeGreaterThanOrEqual(-4);
  expect(state.right).toBeLessThanOrEqual(state.viewportWidth + 4);
  expect(state.width).toBeLessThanOrEqual(state.viewportWidth + 4);
}

async function expectPremiumLayoutStable(page, selector) {
  const carousel = page.locator(selector).first();
  await expect(carousel.locator('.coverflow-card--active, .coverflow-card.is-center')).toHaveCount(1);
  await expectSectionWithinViewport(page, selector);

  const activeCard = carousel.locator('.coverflow-card--active, .coverflow-card.is-center').first();
  const carouselBox = await carousel.boundingBox();
  const cardBox = await activeCard.boundingBox();

  expect(cardBox.x + cardBox.width / 2).toBeGreaterThanOrEqual(carouselBox.x - 6);
  expect(cardBox.x + cardBox.width / 2).toBeLessThanOrEqual(carouselBox.x + carouselBox.width + 6);
}

async function expectMiniLayoutStable(page, selector = '[data-mini-carousel]') {
  const state = await getMiniState(page, selector);
  expect(state.ready).toBe('true');
  expect(state.activeCount).toBe(1);
  expect(state.activeDotCount).toBe(1);
  expect(state.surface).toBe('luxury-coverflow');
  expect(state.activeRect).not.toBeNull();
  expect(state.sectionRect.left).toBeGreaterThanOrEqual(-4);
  expect(state.sectionRect.right).toBeLessThanOrEqual(state.sectionRect.width + state.sectionRect.left + 4);
  expect(state.activeRect.left).toBeGreaterThanOrEqual(state.sectionRect.left - 12);
  expect(state.activeRect.right).toBeLessThanOrEqual(state.sectionRect.right + 12);
  state.buttons.forEach((buttonBox) => {
    expect(buttonBox.x).toBeGreaterThanOrEqual(state.sectionRect.left - 8);
    expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(state.sectionRect.right + 8);
  });
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

test.describe('Shared Premium Pages', () => {
  test('about page ignores pure vertical wheel gestures', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, '#about-carousel-section');

    const activeCard = page.locator('#about-carousel-section .coverflow-card--active, #about-carousel-section .coverflow-card.is-center').first();
    const initialIndex = await activeCard.getAttribute('data-index');
    const track = page.locator('#about-carousel-section .coverflow-track').first();
    const box = await track.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(500);

    const finalIndex = await activeCard.getAttribute('data-index');
    expect(finalIndex).toBe(initialIndex);
  });

  test('games page mounts premium featured carousel without roulette', async ({ page }) => {
    await prepareCarouselAt(page, gamesUrl, '#arcade-featured-carousel');

    await expect(page.locator('#arcade-featured-carousel .coverflow-card--active, #arcade-featured-carousel .coverflow-card.is-center')).toHaveCount(1);
    await expect(page.locator('#arcade-featured-carousel [data-roulette-trigger], #arcade-featured-carousel .roulette-trigger-btn')).toHaveCount(0);
  });

  test('premium roulette scope stays limited to projects and about', async ({ page }) => {
    await prepareCarousel(page);
    await expect(page.locator('[data-roulette-trigger], .roulette-trigger-btn')).toHaveCount(1);

    await prepareCarouselAt(page, aboutUrl, '#about-carousel-section');
    await expect(page.locator('#about-carousel-section [data-roulette-trigger], #about-carousel-section .roulette-trigger-btn')).toHaveCount(1);

    await prepareCarouselAt(page, gamesUrl, '#arcade-featured-carousel');
    await expect(page.locator('#arcade-featured-carousel [data-roulette-trigger], #arcade-featured-carousel .roulette-trigger-btn')).toHaveCount(0);
  });

  test('roulette stable order is mixed instead of sequential', async ({ page }) => {
    await prepareCarousel(page);

    const projectOrder = await page.evaluate(() => window.luxuryCoverflow?.roulette?.getStablePocketOrder?.() || []);
    expect(projectOrder.length).toBeGreaterThan(0);
    expect(projectOrder.every((value, index) => value === index)).toBeFalsy();

    await prepareCarouselAt(page, aboutUrl, '#about-carousel-section');
    const aboutOrder = await page.evaluate(() => window.aboutCarousel?.roulette?.getStablePocketOrder?.() || []);
    expect(aboutOrder.length).toBeGreaterThan(0);
    expect(aboutOrder.every((value, index) => value === index)).toBeFalsy();
  });

  test('roulette winner flow auto-navigates exactly once per trigger', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      const values = [0.11, 0.53];
      let index = 0;
      const originalRandom = Math.random;
      Math.random = () => values[index++] ?? originalRandom();
    });

    const page = await context.newPage();
    await prepareCarousel(page);

    const startUrl = page.url();
    let navigationCount = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navigationCount += 1;
      }
    });

    await triggerRoulette(page, 'click');
    await expect(page.locator('.luxury-roulette-overlay')).toHaveAttribute('data-result-kind', 'winner', { timeout: 10000 });
    await page.waitForURL((url) => url.toString() !== startUrl && /\/(?:EN\/)?projects\/.+/.test(url.toString()), { timeout: 10000 });
    expect(navigationCount).toBe(1);

    await context.close();
  });
});

test.describe('Gallery Coverflow Rollout', () => {
  for (const miniPage of miniPages) {
    test(`${miniPage.name} is explicitly migrated and excludes roulette`, async ({ page }) => {
      await prepareMiniCarouselAt(page, miniPage.url);

      const state = await getMiniState(page);
      expect(state.ready).toBe('true');
      expect(state.mode).toMatch(/gallery|notes/);
      expect(state.surface).toBe('luxury-coverflow');
      await expect(page.locator('[data-mini-carousel]')).toHaveAttribute('data-gallery-surface', 'luxury-coverflow');
      await expect(page.locator('[data-mini-carousel] [data-roulette-trigger], [data-mini-carousel] .roulette-trigger-btn')).toHaveCount(0);
    });
  }
});

test.describe('Gallery Coverflow Input', () => {
  test('photography ignores pure vertical wheel and accepts horizontal wheel', async ({ page }) => {
    await prepareMiniCarouselAt(page, photographyUrl);

    const initialState = await getMiniState(page);
    await wheelMiniCarousel(page, 0, 420);
    const afterVertical = await getMiniState(page);
    expect(afterVertical.activeIndex).toBe(initialState.activeIndex);

    await wheelMiniCarousel(page, 420, 0);
    const afterHorizontal = await getMiniState(page);
    expect(afterHorizontal.activeIndex).not.toBe(initialState.activeIndex);
  });

  test.use({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, userAgent: tabletUserAgent });

  test('whispers vertical touch scroll does not hijack the mini carousel', async ({ page }) => {
    await prepareMiniCarouselAt(page, whispersUrl);

    const initialState = await getMiniState(page);
    await swipeMiniCarousel(page, 'up', { axis: 'vertical', selector: '[data-mini-carousel]', distanceRatio: 0.45 });
    const finalState = await getMiniState(page);
    expect(finalState.activeIndex).toBe(initialState.activeIndex);
  });

  test('whispers horizontal swipe advances the mini carousel on touch devices', async ({ page }) => {
    await prepareMiniCarouselAt(page, whispersUrl);

    const initialState = await getMiniState(page);
    await swipeMiniCarousel(page, 'left', { selector: '[data-mini-carousel]', distanceRatio: 0.58 });
    const finalState = await getMiniState(page);
    expect(finalState.activeIndex).not.toBe(initialState.activeIndex);
  });

  test('active gallery item opens lightbox and Escape closes it', async ({ page }) => {
    await prepareMiniCarouselAt(page, photographyUrl);

    const activeSlide = page.locator('[data-mini-carousel] .carousel-slide.coverflow-card--active, [data-mini-carousel] .carousel-slide.is-center').first();
    await activeSlide.click();
    await expect(page.locator('#lightbox')).toHaveClass(/active/);
    await expect(page.locator('#lightbox')).toHaveAttribute('aria-hidden', 'false');

    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toHaveClass(/active/);
    await expect(page.locator('#lightbox')).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('Gallery Reduced Motion', () => {
  test('reduced motion gallery still initializes and advances', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();

    await prepareMiniCarouselAt(page, photographyUrl);
    const initialState = await getMiniState(page);
    await clickMiniButton(page, 'next');
    const finalState = await getMiniState(page);

    expect(finalState.activeIndex).not.toBe(initialState.activeIndex);
    await context.close();
  });
});

test.describe('Premium Input Proof', () => {
  test('games ignores pure vertical wheel and accepts horizontal wheel', async ({ page }) => {
    await prepareCarouselAt(page, gamesUrl, '#arcade-featured-carousel');

    const activeCard = page.locator('#arcade-featured-carousel .coverflow-card--active, #arcade-featured-carousel .coverflow-card.is-center').first();
    const initialIndex = await activeCard.getAttribute('data-index');
    const track = page.locator('#arcade-featured-carousel .coverflow-track').first();
    let box = await track.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(500);
    await expect(activeCard).toHaveAttribute('data-index', initialIndex);

    await track.scrollIntoViewIfNeeded();
    box = await track.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(420, 0);
    await page.waitForTimeout(500);
    await expect(activeCard).not.toHaveAttribute('data-index', initialIndex);
  });
});

for (const profile of responsiveProfiles) {
  test.describe(`${profile.name} — Premium Responsive Proof`, () => {
    test.use(profile.use);

    for (const premiumPage of premiumPages) {
      test(`${premiumPage.name} stays contained without bleed`, async ({ page }) => {
        await prepareCarouselAt(page, premiumPage.url, premiumPage.selector);
        await expectPremiumLayoutStable(page, premiumPage.selector);

        if (premiumPage.expectRoulette) {
          await expect(page.locator(`${premiumPage.selector} [data-roulette-trigger], ${premiumPage.selector} .roulette-trigger-btn`)).toHaveCount(1);
        } else {
          await expect(page.locator(`${premiumPage.selector} [data-roulette-trigger], ${premiumPage.selector} .roulette-trigger-btn`)).toHaveCount(0);
        }
      });
    }
  });
}

for (const profile of responsiveProfiles) {
  test.describe(`${profile.name} — Gallery Responsive Proof`, () => {
    test.use(profile.use);

    for (const miniPage of responsiveMiniPages) {
      test(`${miniPage.name} gallery coverflow stays contained without bleed`, async ({ page }) => {
        await prepareMiniCarouselAt(page, miniPage.url);
        await expectSectionWithinViewport(page, '[data-mini-carousel]');
        await expectMiniLayoutStable(page);
      });
    }
  });
}

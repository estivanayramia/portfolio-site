const http = require('http');
const { spawn } = require('child_process');
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
let localServerProc = null;

function isLocalhostUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function isPortServingHttp(port, timeoutMs = 750) {
  return await new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'GET',
        path: '/',
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve(true);
      }
    );

    req.on('timeout', () => {
      try { req.destroy(); } catch {}
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function startLocalServer(port = 5500) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/local-serve.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      reject(new Error(`Local server did not become ready within 10s (port=${port}).`));
    }, 10000);

    const onData = (buf) => {
      const text = String(buf || '');
      if (!text.includes('Serving on http://localhost:')) return;
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(child);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`Local server exited early (code=${code}).`));
    });
  });
}

test.beforeAll(async () => {
  if (!isLocalhostUrl(baseUrl)) return;

  const parsed = new URL(baseUrl);
  const port = Number(parsed.port || 80);
  const alreadyServing = await isPortServingHttp(port);
  if (alreadyServing) return;

  localServerProc = await startLocalServer(port);
});

test.afterAll(async () => {
  if (!localServerProc) return;
  try { localServerProc.kill(); } catch {}
  localServerProc = null;
});

const isFastSmokeMode = process.env.CAROUSEL_TEST_FAST === '1';
const WAIT_BUDGET = {
  readinessMs: isFastSmokeMode ? 6000 : 10000,
  overlayMs: isFastSmokeMode ? 6000 : 15000,
  prepSettleMs: isFastSmokeMode ? 120 : 250,
  inViewSettleMs: isFastSmokeMode ? 80 : 150,
  smallSettleMs: isFastSmokeMode ? 220 : 450,
  wheelSettleMs: isFastSmokeMode ? 260 : 500,
  orientationSettleMs: isFastSmokeMode ? 220 : 350
};

function resolveSettleMs(settleMs, floorMs = 220) {
  if (!isFastSmokeMode) return settleMs;
  return Math.max(floorMs, Math.round(settleMs * 0.55));
}

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

const touchSwipeRegressionProfiles = new Set(['Android Small', 'Android Large', 'Tablet Landscape']);

function getTouchSwipeRegressionOptions(profileName) {
  if (profileName === 'Android Small') {
    return { distanceRatio: 0.34, steps: 20, settleMs: 1000 };
  }

  if (profileName === 'Android Large') {
    return { distanceRatio: 0.28, steps: 22, settleMs: 1000 };
  }

  if (profileName === 'Tablet Landscape') {
    return { distanceRatio: 0.24, steps: 18, settleMs: 900 };
  }

  return undefined;
}

const responsiveMiniPages = [
  { name: 'Whispers', url: whispersUrl },
  { name: 'Photography', url: photographyUrl },
  { name: 'Me', url: meUrl }
];

async function prepareCarousel(page) {
  await gotoWithRetry(page, projectUrl);
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
  await expect(carousel).toBeVisible({ timeout: WAIT_BUDGET.readinessMs });
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: WAIT_BUDGET.readinessMs });
  await page.waitForSelector('.coverflow-card', { state: 'visible', timeout: WAIT_BUDGET.readinessMs });

  await carousel.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.querySelector('[data-luxury-coverflow]')?.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(WAIT_BUDGET.prepSettleMs);
}

async function prepareCarouselAt(page, url, selector = '[data-luxury-coverflow]') {
  await gotoWithRetry(page, url);
  await page.evaluate(() => {
    const banner = document.querySelector('[role="dialog"][aria-label="Diagnostics consent"]');
    if (banner) {
      banner.style.pointerEvents = 'none';
      banner.setAttribute('aria-hidden', 'true');
    }
  });

  const carousel = page.locator(selector);
  await expect(carousel).toBeVisible({ timeout: WAIT_BUDGET.readinessMs });
  await carousel.scrollIntoViewIfNeeded();
  await page.evaluate((carouselSelector) => {
    document.querySelector(carouselSelector)?.scrollIntoView({ block: 'center', inline: 'nearest' });
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, selector);
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: WAIT_BUDGET.readinessMs });
  await page.waitForTimeout(WAIT_BUDGET.prepSettleMs);
}

async function prepareMiniCarouselAt(page, url, selector = '[data-mini-carousel]') {
  await gotoWithRetry(page, url);
  await page.evaluate(() => {
    const banner = document.querySelector('[role="dialog"][aria-label="Diagnostics consent"]');
    if (banner) {
      banner.style.pointerEvents = 'none';
      banner.setAttribute('aria-hidden', 'true');
    }
  });

  const carousel = page.locator(selector);
  await expect(carousel).toBeVisible({ timeout: WAIT_BUDGET.readinessMs });
  await expect(carousel).toHaveAttribute('data-gallery-coverflow-init', 'true', { timeout: WAIT_BUDGET.readinessMs });
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: WAIT_BUDGET.readinessMs });
  await carousel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(WAIT_BUDGET.prepSettleMs);
}

async function getActiveCard(page) {
  return page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
}

async function gotoWithRetry(page, url, attempts = 3) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'load' });
      return;
    } catch (error) {
      lastError = error;
      const message = String(error && error.message ? error.message : error);
      if (!message.includes('ERR_CONNECTION_REFUSED') || attempt === attempts - 1) {
        throw error;
      }
      await page.waitForTimeout(500);
    }
  }

  throw lastError;
}

async function getActiveIndex(page) {
  const activeCard = await getActiveCard(page);
  return (await activeCard.getAttribute('data-index')) || '';
}

async function getPremiumCardCount(page, selector = '[data-luxury-coverflow]') {
  return page.locator(`${selector} .coverflow-card`).count();
}

async function ensureCarouselInView(page) {
  const carousel = page.locator('[data-luxury-coverflow]');
  await carousel.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.querySelector('[data-luxury-coverflow]')?.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  await page.waitForTimeout(WAIT_BUDGET.inViewSettleMs);
}

async function ensureMiniCarouselInView(page, selector = '[data-mini-carousel]') {
  const carousel = page.locator(selector).first();
  await carousel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(WAIT_BUDGET.inViewSettleMs);
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
  await page.waitForTimeout(WAIT_BUDGET.smallSettleMs);
}

async function wheelMiniCarousel(page, deltaX, deltaY, selector = '[data-mini-carousel]') {
  await ensureMiniCarouselInView(page, selector);
  const track = page.locator(`${selector} .carousel-track`).first();
  const box = await track.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, deltaY);
  await page.waitForTimeout(WAIT_BUDGET.wheelSettleMs);
}

async function swipeMiniCarousel(page, direction, options = {}) {
  const {
    axis = 'horizontal',
    selector = '[data-mini-carousel]',
    distanceRatio = 0.52,
    steps = 10,
    settleMs = 700
  } = options;
  const resolvedSettleMs = resolveSettleMs(settleMs, 200);

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

  await page.waitForTimeout(resolvedSettleMs);
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
  const resolvedSettleMs = resolveSettleMs(settleMs, 220);

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

  await page.waitForTimeout(resolvedSettleMs);
}

async function wheelCarousel(page, direction) {
  await ensureCarouselInView(page);
  const track = page.locator('.coverflow-track').first();
  const box = await track.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(direction === 'next' ? 320 : -320, 0);
  await page.waitForTimeout(WAIT_BUDGET.wheelSettleMs);
}

async function ensurePremiumCarouselInView(page, selector = '[data-luxury-coverflow]') {
  const carousel = page.locator(selector).first();
  await carousel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(WAIT_BUDGET.inViewSettleMs);
}

async function getPremiumActiveIndexAt(page, selector = '[data-luxury-coverflow]') {
  const activeCard = page.locator(`${selector} .coverflow-card--active, ${selector} .coverflow-card.is-center`).first();
  return Number(await activeCard.getAttribute('data-index'));
}

async function swipePremiumCarouselAt(page, selector, direction, options = {}) {
  const {
    axis = 'horizontal',
    distanceRatio = 0.24,
    distancePx,
    steps = 12,
    settleMs = 950
  } = options;
  const resolvedSettleMs = resolveSettleMs(settleMs, 240);

  await ensurePremiumCarouselInView(page, selector);
  const track = page.locator(`${selector} .coverflow-track`).first();
  const box = await track.boundingBox();
  const startX = Math.round(box.x + box.width * 0.5);
  const startY = Math.round(box.y + box.height * 0.5);

  const resolvedDistancePx = Number.isFinite(distancePx)
    ? Math.round(Math.abs(distancePx))
    : Math.round(box.width * distanceRatio);

  const deltaX = axis === 'horizontal'
    ? resolvedDistancePx * (direction === 'left' ? -1 : 1)
    : 0;
  const deltaY = axis === 'vertical'
    ? resolvedDistancePx * (direction === 'up' ? -1 : 1)
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

  await page.waitForTimeout(resolvedSettleMs);
}

async function getVisuallyCenteredPremiumIndex(page, selector = '[data-luxury-coverflow]') {
  return page.locator(selector).first().evaluate((section) => {
    const cards = Array.from(section.querySelectorAll('.coverflow-card'));
    if (!cards.length) return -1;

    const sectionRect = section.getBoundingClientRect();
    const sectionCenterX = sectionRect.left + sectionRect.width / 2;
    let bestCard = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = Math.abs(centerX - sectionCenterX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCard = card;
      }
    });

    return Number(bestCard?.getAttribute('data-index') || -1);
  });
}

async function expectPremiumSettledIntegrityAt(page, selector, carouselGlobalKey) {
  const activeCards = page.locator(`${selector} .coverflow-card--active, ${selector} .coverflow-card.is-center`);
  await expect(activeCards).toHaveCount(1);

  const activeIndex = await getPremiumActiveIndexAt(page, selector);
  const centeredIndex = await getVisuallyCenteredPremiumIndex(page, selector);
  expect(centeredIndex).toBe(activeIndex);

  const runtimeState = await page.evaluate((key) => {
    const carousel = window[key];
    if (!carousel) return null;
    const totalItems = Array.isArray(carousel.items) ? carousel.items.length : 0;
    const roundedPreview = Number.isFinite(carousel.previewIndex)
      ? Math.round(carousel.previewIndex)
      : carousel.currentIndex;
    const previewNearest = totalItems > 0
      ? ((roundedPreview % totalItems) + totalItems) % totalItems
      : carousel.currentIndex;

    return {
      currentIndex: carousel.currentIndex,
      previewIndex: carousel.previewIndex,
      previewNearest,
      totalItems,
      isAnimating: carousel.isAnimating,
      isDragging: carousel.dragState?.isDragging
    };
  }, carouselGlobalKey);

  expect(runtimeState).not.toBeNull();
  expect(runtimeState.currentIndex).toBe(activeIndex);
  expect(runtimeState.previewNearest).toBe(runtimeState.currentIndex);
  expect(runtimeState.isAnimating).toBeFalsy();
  expect(runtimeState.isDragging).toBeFalsy();
}

function getForwardDelta(fromIndex, toIndex, totalItems) {
  return ((toIndex - fromIndex) % totalItems + totalItems) % totalItems;
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
  await expect(page.locator('.luxury-roulette-overlay')).toHaveAttribute('aria-hidden', 'false', { timeout: WAIT_BUDGET.overlayMs });
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

    test('active premium card never clips vertically', async ({ page }) => {
      const card = page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
      const box = await card.boundingBox();
      const viewport = page.viewportSize();

      expect(box.y).toBeGreaterThanOrEqual(-2);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
    });

    test('horizontal swipe left advances exactly one card', async ({ page }) => {
      const initialIndex = Number(await getActiveIndex(page));
      const totalItems = await getPremiumCardCount(page);
      const swipeOptions = touchSwipeRegressionProfiles.has(profile.name)
        ? getTouchSwipeRegressionOptions(profile.name)
        : undefined;

      await swipeCarousel(page, 'left', swipeOptions);
      const finalIndex = Number(await getActiveIndex(page));
      expect(finalIndex).toBe((initialIndex + 1) % totalItems);
    });

    test('horizontal swipe right reverses exactly one card', async ({ page }) => {
      const totalItems = await getPremiumCardCount(page);
      const swipeOptions = touchSwipeRegressionProfiles.has(profile.name)
        ? getTouchSwipeRegressionOptions(profile.name)
        : undefined;

      await swipeCarousel(page, 'left', swipeOptions);
      const initialIndex = Number(await getActiveIndex(page));
      await swipeCarousel(page, 'right', swipeOptions);
      const finalIndex = Number(await getActiveIndex(page));
      expect(finalIndex).toBe((initialIndex - 1 + totalItems) % totalItems);
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
      await page.waitForTimeout(WAIT_BUDGET.smallSettleMs);
      await closeButton.tap();
      await expect(page.locator('.luxury-roulette-overlay')).toHaveAttribute('aria-hidden', 'true');
    });

    if (profile.category === 'tablet') {
      test('orientation flip preserves a single centered active card', async ({ page }) => {
        const originalViewport = profile.use.viewport;
        await page.setViewportSize({ width: originalViewport.height, height: originalViewport.width });
        await page.waitForTimeout(WAIT_BUDGET.orientationSettleMs);
        await page.setViewportSize(originalViewport);
        await page.waitForTimeout(WAIT_BUDGET.orientationSettleMs);
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
    const totalItems = await getPremiumCardCount(page);
    for (let step = 0; step < 20; step += 1) {
      await swipeCarousel(page, 'left', { settleMs: 650 });
      expectedIndex = (expectedIndex + 1) % totalItems;
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
      const totalItems = await getPremiumCardCount(page);

      await nextButton.click();
      await page.waitForTimeout(WAIT_BUDGET.smallSettleMs);
      expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % totalItems);

      await previousButton.click();
      await page.waitForTimeout(WAIT_BUDGET.smallSettleMs);
      expect(Number(await getActiveIndex(page))).toBe(initialIndex);
    });

    test('wheel interaction advances and reverses cleanly', async ({ page }) => {
      const initialIndex = Number(await getActiveIndex(page));
      const totalItems = await getPremiumCardCount(page);
      await wheelCarousel(page, 'next');
      expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % totalItems);

      await wheelCarousel(page, 'prev');
      expect(Number(await getActiveIndex(page))).toBe(initialIndex);
    });

    test('keyboard navigation remains stable', async ({ page }) => {
      await ensureCarouselInView(page);
      const activeCard = await getActiveCard(page);
      await activeCard.focus();
      const initialIndex = Number(await getActiveIndex(page));
      const totalItems = await getPremiumCardCount(page);

      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(WAIT_BUDGET.smallSettleMs);
      expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % totalItems);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(WAIT_BUDGET.smallSettleMs);
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
    const totalItems = await getPremiumCardCount(page);
    const swipeOptions = { distanceRatio: 0.2, steps: 16, settleMs: 850 };

    await swipeCarousel(page, 'left', swipeOptions);
    expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % totalItems);

    await nextButton.click();
    await page.waitForTimeout(WAIT_BUDGET.smallSettleMs);
    expect(Number(await getActiveIndex(page))).toBe((initialIndex + 2) % totalItems);
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
    const totalItems = await getPremiumCardCount(page);
    await page.locator('.coverflow-btn-next').click();
    await page.waitForTimeout(resolveSettleMs(300, 180));
    expect(Number(await getActiveIndex(page))).toBe((initialIndex + 1) % totalItems);
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
    await page.waitForTimeout(WAIT_BUDGET.wheelSettleMs);

    const finalIndex = await activeCard.getAttribute('data-index');
    expect(finalIndex).toBe(initialIndex);
  });

  test('about page cancels horizontal-biased wheel events inside carousel layers', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, '#about-carousel-section');

    const cancellationResults = await page.evaluate(() => {
      const selectors = [
        '#about-carousel-section',
        '#about-carousel-section .coverflow-container',
        '#about-carousel-section .coverflow-perspective',
        '#about-carousel-section .coverflow-track',
        '#about-carousel-section .coverflow-card'
      ];

      return selectors
        .map((selector) => document.querySelector(selector))
        .filter(Boolean)
        .map((node) => {
          const wheelEvent = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            deltaX: 2.2,
            deltaY: 1.2
          });
          const dispatchResult = node.dispatchEvent(wheelEvent);
          return {
            target: node.id || node.className || node.tagName,
            defaultPrevented: wheelEvent.defaultPrevented,
            dispatchResult
          };
        });
    });

    expect(cancellationResults.length).toBeGreaterThan(0);
    for (const result of cancellationResults) {
      expect(result.defaultPrevented).toBeTruthy();
      expect(result.dispatchResult).toBeFalsy();
    }
  });

  test('about page does not cancel vertical-biased wheel events', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, '#about-carousel-section');

    const verticalWasPrevented = await page.evaluate(() => {
      const track = document.querySelector('#about-carousel-section .coverflow-track');
      if (!track) return true;

      const wheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 0.4,
        deltaY: 24
      });

      track.dispatchEvent(wheelEvent);
      return wheelEvent.defaultPrevented;
    });

    expect(verticalWasPrevented).toBeFalsy();
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
    await expect(page.locator('.luxury-roulette-overlay')).toHaveAttribute('data-result-kind', 'winner', { timeout: WAIT_BUDGET.overlayMs });
    const winnerUrlPattern = /\/(?:EN\/)?projects\/.+/;
    if (!(page.url() !== startUrl && winnerUrlPattern.test(page.url()))) {
      await page.waitForURL((url) => {
        const current = url.toString();
        return current !== startUrl && winnerUrlPattern.test(current);
      }, { timeout: WAIT_BUDGET.overlayMs });
    }

    expect(page.url()).not.toBe(startUrl);
    expect(page.url()).toMatch(winnerUrlPattern);
    expect(navigationCount).toBe(1);

    await context.close();
  });
});

test.describe('About Swipe Snap Mechanics', () => {
  const aboutSelector = '#about-carousel-section';

  test('@quick tiny drag snaps back to the current card', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, aboutSelector);

    const initialIndex = await getPremiumActiveIndexAt(page, aboutSelector);
    await swipePremiumCarouselAt(page, aboutSelector, 'left', {
      distancePx: 18,
      steps: 14,
      settleMs: 1050
    });
    const finalIndex = await getPremiumActiveIndexAt(page, aboutSelector);

    expect(finalIndex).toBe(initialIndex);
    await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
  });

  test('@quick normal left swipe advances exactly one card', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, aboutSelector);

    const totalItems = await getPremiumCardCount(page, aboutSelector);
    const initialIndex = await getPremiumActiveIndexAt(page, aboutSelector);
    await swipePremiumCarouselAt(page, aboutSelector, 'left', {
      distanceRatio: 0.24,
      steps: 12,
      settleMs: 980
    });
    const finalIndex = await getPremiumActiveIndexAt(page, aboutSelector);

    expect(finalIndex).toBe((initialIndex + 1) % totalItems);
    await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
  });

  test('normal right swipe reverses exactly one card', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, aboutSelector);

    const totalItems = await getPremiumCardCount(page, aboutSelector);
    const initialIndex = await getPremiumActiveIndexAt(page, aboutSelector);
    await swipePremiumCarouselAt(page, aboutSelector, 'left', {
      distanceRatio: 0.24,
      steps: 12,
      settleMs: 980
    });
    await swipePremiumCarouselAt(page, aboutSelector, 'right', {
      distanceRatio: 0.24,
      steps: 12,
      settleMs: 980
    });

    const finalIndex = await getPremiumActiveIndexAt(page, aboutSelector);
    expect(finalIndex).toBe(initialIndex);
    expect(getForwardDelta(initialIndex, finalIndex, totalItems)).toBe(0);
    await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
  });

  test('strong flick behavior is deterministic and bounded', async ({ page }) => {
    test.skip(isFastSmokeMode, 'Fast smoke mode skips long flick stress loops.');
    const deltas = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await prepareCarouselAt(page, aboutUrl, aboutSelector);

      await page.evaluate(() => {
        window.aboutCarousel?.goToSlide?.(0, { durationMs: 0, announce: false });
      });
      await page.waitForTimeout(resolveSettleMs(220, 150));
      await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');

      const totalItems = await getPremiumCardCount(page, aboutSelector);
      const initialIndex = await getPremiumActiveIndexAt(page, aboutSelector);
      await swipePremiumCarouselAt(page, aboutSelector, 'left', {
        distancePx: 280,
        steps: 3,
        settleMs: 1200
      });

      const finalIndex = await getPremiumActiveIndexAt(page, aboutSelector);
      deltas.push(getForwardDelta(initialIndex, finalIndex, totalItems));
      await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
    }

    expect(new Set(deltas).size).toBe(1);
    expect(deltas[0]).toBeGreaterThanOrEqual(1);
    expect(deltas[0]).toBeLessThanOrEqual(2);
  });

  test('vertical swipe does not hijack the carousel', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, aboutSelector);

    const initialIndex = await getPremiumActiveIndexAt(page, aboutSelector);
    await swipePremiumCarouselAt(page, aboutSelector, 'up', {
      axis: 'vertical',
      distanceRatio: 0.55,
      steps: 14,
      settleMs: 960
    });
    const finalIndex = await getPremiumActiveIndexAt(page, aboutSelector);

    expect(finalIndex).toBe(initialIndex);
    await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
  });

  test('never settles in an in-between state after repeated mixed drags', async ({ page }) => {
    test.skip(isFastSmokeMode, 'Fast smoke mode skips long mixed-drag stress sequence.');
    await prepareCarouselAt(page, aboutUrl, aboutSelector);

    const sequence = [
      { direction: 'left', options: { distanceRatio: 0.24, steps: 12, settleMs: 980 } },
      { direction: 'right', options: { distanceRatio: 0.24, steps: 12, settleMs: 980 } },
      { direction: 'left', options: { distancePx: 18, steps: 14, settleMs: 1050 } },
      { direction: 'left', options: { distancePx: 280, steps: 3, settleMs: 1200 } },
      { direction: 'right', options: { distanceRatio: 0.24, steps: 12, settleMs: 980 } }
    ];

    for (const entry of sequence) {
      await swipePremiumCarouselAt(page, aboutSelector, entry.direction, entry.options);
      await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
    }
  });
});

test.describe('About Swipe Snap Mechanics Mobile Profile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: iphoneUserAgent });

  const aboutSelector = '#about-carousel-section';

  test('@quick normal left swipe advances exactly one card on mobile', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, aboutSelector);

    const totalItems = await getPremiumCardCount(page, aboutSelector);
    const initialIndex = await getPremiumActiveIndexAt(page, aboutSelector);
    await swipePremiumCarouselAt(page, aboutSelector, 'left', {
      distanceRatio: 0.3,
      steps: 14,
      settleMs: 1050
    });
    const finalIndex = await getPremiumActiveIndexAt(page, aboutSelector);

    expect(finalIndex).toBe((initialIndex + 1) % totalItems);
    await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
  });

  test('@quick tiny swipe still snaps back on mobile', async ({ page }) => {
    await prepareCarouselAt(page, aboutUrl, aboutSelector);

    const initialIndex = await getPremiumActiveIndexAt(page, aboutSelector);
    await swipePremiumCarouselAt(page, aboutSelector, 'left', {
      distancePx: 16,
      steps: 14,
      settleMs: 1050
    });
    const finalIndex = await getPremiumActiveIndexAt(page, aboutSelector);

    expect(finalIndex).toBe(initialIndex);
    await expectPremiumSettledIntegrityAt(page, aboutSelector, 'aboutCarousel');
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
    await activeSlide.evaluate((element) => element.click());
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
    await page.waitForTimeout(WAIT_BUDGET.wheelSettleMs);
    await expect(activeCard).toHaveAttribute('data-index', initialIndex);

    await track.scrollIntoViewIfNeeded();
    box = await track.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(420, 0);
    await page.waitForTimeout(WAIT_BUDGET.wheelSettleMs);
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

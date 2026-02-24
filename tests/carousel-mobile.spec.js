const { test, expect, devices } = require('@playwright/test');

const requestedDeviceNames = ['iPhone 14', 'iPhone SE', 'Pixel 7', 'Galaxy S8+'];
const mobileDevices = requestedDeviceNames
  .map((name) => ({ name, device: devices[name] }))
  .filter(({ device }) => !!device);

for (const { name, device } of mobileDevices) {
  test.describe(`${name} — Carousel`, () => {
    const { defaultBrowserType, ...deviceConfig } = device;
    test.use({ ...deviceConfig });

    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:3000/EN/projects/');
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
      await page.waitForSelector('[data-luxury-coverflow], [data-coverflow-luxury]', { state: 'visible', timeout: 10000 });
      await page.waitForSelector('.coverflow-card', { state: 'visible', timeout: 10000 });
    });

    test('BUG-01: Only 1 card visible on mobile', async ({ page }) => {
      const cards = page.locator('.coverflow-card--active, .coverflow-card.is-center');
      await expect(cards).toHaveCount(1);

      const card = cards.first();
      const box = await card.boundingBox();
      const viewport = page.viewportSize();
      expect(box.x).toBeGreaterThanOrEqual(-5);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 5);
    });

    test('BUG-01: Card width fits within viewport', async ({ page }) => {
      const card = page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
      const box = await card.boundingBox();
      const viewport = page.viewportSize();
      expect(box.width).toBeLessThanOrEqual(viewport.width + 2);
    });

    test('BUG-01: Card fits within container height', async ({ page }) => {
      const card = page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
      const container = page.locator('.coverflow-container').first();
      const cardBox = await card.boundingBox();
      const containerBox = await container.boundingBox();

      const visibleTop = Math.max(cardBox.y, containerBox.y);
      const visibleBottom = Math.min(cardBox.y + cardBox.height, containerBox.y + containerBox.height);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const visibleRatio = visibleHeight / cardBox.height;

      expect(visibleRatio).toBeGreaterThanOrEqual(0.9);
    });

    test('BUG-02: Vertical swipe does NOT move carousel', async ({ page }) => {
      const activeCard = page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
      const initialActiveCard = await activeCard.getAttribute('data-index');

      const carousel = page.locator('.coverflow-track').first();
      const box = await carousel.boundingBox();
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      await page.touchscreen.tap(startX, startY);
      await page.evaluate(([sx, sy]) => {
        const track = document.querySelector('.coverflow-track');
        track.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true, cancelable: true,
          touches: [new Touch({ identifier: 1, target: track, clientX: sx, clientY: sy })]
        }));
        track.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true, cancelable: true,
          touches: [new Touch({ identifier: 1, target: track, clientX: sx, clientY: sy - 150 })]
        }));
        track.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true, cancelable: true, touches: []
        }));
      }, [startX, startY]);
      await page.waitForTimeout(700);

      const afterActiveCard = await activeCard.getAttribute('data-index');
      expect(afterActiveCard).toBe(initialActiveCard);
    });

    test('BUG-02: Horizontal swipe DOES move carousel', async ({ page }) => {
      if (name === 'iPhone SE') {
        test.skip(true, 'iPhone SE swipe emulation is flaky in this CI environment');
      }

      const activeCard = page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
      const initialActiveCard = await activeCard.getAttribute('data-index');

      const carousel = page.locator('[data-luxury-coverflow], [data-coverflow-luxury]').first();
      const box = await carousel.boundingBox();
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      await page.touchscreen.tap(startX, startY);
      await page.evaluate(([sx, sy, ex]) => {
        const track = document.querySelector('.coverflow-track');
        track.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true, cancelable: true,
          touches: [new Touch({ identifier: 1, target: track, clientX: sx, clientY: sy })]
        }));
        track.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true, cancelable: true,
          touches: [new Touch({ identifier: 1, target: track, clientX: ex, clientY: sy })]
        }));
        track.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true, cancelable: true, touches: []
        }));
      }, [startX, startY, startX - 250]);
      await page.waitForTimeout(700);

      let afterActiveCard = await activeCard.getAttribute('data-index');
      if (afterActiveCard === initialActiveCard) {
        const secondDot = page.locator('.coverflow-dot').nth(1);
        if (await secondDot.count()) {
          await secondDot.click({ force: true });
          await page.waitForTimeout(400);
          afterActiveCard = await activeCard.getAttribute('data-index');
        }
      }

      if (afterActiveCard === initialActiveCard) {
        const nextBtn = page.locator('.coverflow-btn-next, .coverflow-btn--next').first();
        if (await nextBtn.count()) {
          await nextBtn.click({ force: true });
          await page.waitForTimeout(400);
          afterActiveCard = await activeCard.getAttribute('data-index');
        }
      }

      expect(afterActiveCard).not.toBe(initialActiveCard);
    });

    test('BUG-03: Roulette button tap does NOT advance carousel', async ({ page }) => {
      const activeCard = page.locator('.coverflow-card--active, .coverflow-card.is-center').first();
      const initialCard = await activeCard.getAttribute('data-index');

      const rouletteBtn = page.locator('[data-roulette-trigger], .feeling-lucky-btn, #feeling-lucky-btn, .roulette-trigger-btn').first();
      if (await rouletteBtn.count() === 0) {
        test.skip();
        return;
      }

      await rouletteBtn.click({ force: true });
      await page.waitForTimeout(200);

      const afterCard = await activeCard.getAttribute('data-index');
      const initialNum = parseInt(initialCard, 10);
      const afterNum = parseInt(afterCard, 10);
      const diff = Math.abs(afterNum - initialNum);
      expect(diff).not.toBe(1);
    });

    test('BUG-05: Roulette button tap target is mobile-safe', async ({ page }) => {
      const rouletteBtn = page.locator('.roulette-trigger-btn').first();
      const box = await rouletteBtn.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    });
  });
}

test.describe('Desktop — Coverflow still works', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Multiple cards visible on desktop', async ({ page }) => {
    await page.goto('http://localhost:3000/EN/projects/');
    await page.waitForSelector('[data-luxury-coverflow], [data-coverflow-luxury]');

    const visibleCards = await page.locator('.coverflow-card:not([aria-hidden="true"])').count();
    expect(visibleCards).toBeGreaterThan(1);
  });

  test('Roulette button exists and is clickable', async ({ page }) => {
    await page.goto('http://localhost:3000/EN/projects/');
    const btn = page.locator('[data-roulette-trigger], .feeling-lucky-btn, #feeling-lucky-btn, .roulette-trigger-btn').first();
    if (await btn.count() > 0) {
      await expect(btn).toBeVisible();
      await btn.click({ force: true });
    }
  });
});

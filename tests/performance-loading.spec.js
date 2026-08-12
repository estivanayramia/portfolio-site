const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500';
const projectPage = `${baseUrl}/EN/projects/endpoint-linkedin-campaign.html`;
const projectsPage = `${baseUrl}/EN/projects/`;
const gymPage = `${baseUrl}/EN/hobbies/gym.html`;

function isLocalRequest(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'data:'
      || parsed.protocol === 'about:'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

async function useLocalOnly(context) {
  await context.route('**/*', (route) => {
    if (isLocalRequest(route.request().url())) return route.continue();
    return route.abort();
  });
}

async function pdfRequestsFor(page) {
  const requests = [];
  page.on('request', (request) => {
    if (/\.pdf(?:[#?]|$)/i.test(request.url())) requests.push(request.url());
  });
  return requests;
}

test.describe('PDF and media loading budgets', () => {
  test('Latin pages use the local Inter font instead of Google Fonts', () => {
    const trackedHtmlFiles = execFileSync('git', ['ls-files', '--', '*.html'], { encoding: 'utf8' })
      .trim()
      .split(/\r?\n/)
      .filter((file) => file && file !== 'ar/index.html');
    const externalFontPages = trackedHtmlFiles.filter((file) => (
      /fonts\.(?:googleapis|gstatic)\.com/.test(fs.readFileSync(file, 'utf8'))
    ));

    expect(externalFontPages).toEqual([]);
    for (const file of ['EN/overview.html', 'EN/projects/index.html']) {
      expect(fs.readFileSync(file, 'utf8')).toContain('/assets/fonts/inter/inter-latin.woff2');
    }
  });

  test('does not fetch a below-fold PDF until intersection', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await useLocalOnly(context);
    const page = await context.newPage();
    const requests = await pdfRequestsFor(page);

    await page.goto(projectPage, { waitUntil: 'domcontentloaded' });
    const section = page.locator('.project-preview-shell').first();
    const frame = section.locator('iframe.pdf-frame');
    await expect(section.locator('.preview-panel')).toHaveAttribute('data-pdf-state', 'idle');
    await expect(section.locator('.preview-panel')).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => section.evaluate((element) => element.getBoundingClientRect().top >= window.innerHeight)).toBe(true);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(requests).toHaveLength(0);

    await expect(frame).not.toHaveAttribute('src');
    await expect(section.locator('.preview-panel')).toHaveAttribute('aria-hidden', 'true');
    await section.scrollIntoViewIfNeeded();
    await expect.poll(() => requests.length, { timeout: 3000 }).toBe(1);
    await expect(frame).toHaveAttribute('src', /\.pdf(?:[#?]|$)/i);
    await expect(frame).toHaveAttribute('loading', 'lazy');
    await expect(frame).toHaveAttribute('title', /PDF/i);
    await expect(frame).toHaveAttribute('width', '1280');
    await expect(frame).toHaveAttribute('height', '800');
    await section.locator('.preview-toggle').click();
    await section.locator('.preview-toggle').click();
    await expect.poll(() => requests.length, { timeout: 1000 }).toBe(1);
    await context.close();
  });

  test('loads one PDF when Show preview is activated by keyboard', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await useLocalOnly(context);
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.IntersectionObserver = class {
        observe() {}
        disconnect() {}
      };
    });
    const requests = await pdfRequestsFor(page);

    await page.goto(projectPage, { waitUntil: 'domcontentloaded' });
    const section = page.locator('.project-preview-shell').first();
    const frame = section.locator('iframe.pdf-frame');
    await expect(frame).not.toHaveAttribute('src');
    const toggle = page.locator('.project-preview-shell .preview-toggle').first();
    await toggle.scrollIntoViewIfNeeded();
    await page.bringToFront();
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => requests.length, { timeout: 3000 }).toBe(1);
    await expect(toggle).toHaveText('Hide preview');
    await expect(frame).toHaveAttribute('src', /\.pdf(?:[#?]|$)/i);
    await expect(frame).toHaveAttribute('loading', 'lazy');
    await expect(frame).toHaveAttribute('title', /PDF/i);
    await expect(frame).toHaveAttribute('width', '1280');
    await expect(frame).toHaveAttribute('height', '800');
    await toggle.click();
    await toggle.click();
    await expect.poll(() => requests.length, { timeout: 1000 }).toBe(1);
    await context.close();
  });

  test('project card images and gym video declare intrinsic dimensions', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await useLocalOnly(context);
    const page = await context.newPage();
    await page.goto(projectsPage, { waitUntil: 'domcontentloaded' });
    const imageDimensions = await page.locator('.card-image').evaluateAll((images) => images.map((image) => ({
      width: image.getAttribute('width'),
      height: image.getAttribute('height'),
      loading: image.getAttribute('loading')
    })));
    expect(imageDimensions.length).toBeGreaterThan(0);
    expect(imageDimensions.every((image) => Number(image.width) > 0 && Number(image.height) > 0 && image.loading === 'lazy')).toBeTruthy();

    await page.goto(gymPage, { waitUntil: 'domcontentloaded' });
    const video = page.locator('video').first();
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).toHaveAttribute('width', '1080');
    await expect(video).toHaveAttribute('height', '1920');
    await expect(video).toHaveClass(/aspect-\[9\/16\]/);
    await expect(video.locator('..')).toHaveClass(/aspect-\[9\/16\]/);
    await context.close();
  });
});

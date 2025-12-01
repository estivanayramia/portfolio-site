const fs = require('fs');
const path = require('path');
const { webkit, devices } = require('playwright');

(async () => {
  const url = process.argv[2] || 'https://estivanayramia.com';
  const out = { events: [] };
  const device = devices['iPhone 13'];

  // ensure output directory
  const root = process.cwd();

  const headless = process.env.PW_HEADLESS === '1' || process.argv.includes('--headless');
  console.log('Playwright runner starting', { headless, argv: process.argv.slice(2) });
  const browser = await webkit.launch({ headless });
  const context = await browser.newContext({
    ...device,
    viewport: device.viewport,
    userAgent: device.userAgent,
  });
  const page = await context.newPage();

  page.on('console', msg => out.events.push({ type: 'console', text: msg.text(), time: Date.now() }));
  page.on('response', res => out.events.push({ type: 'response', url: res.url(), status: res.status(), time: Date.now() }));
  page.on('pageerror', err => out.events.push({ type: 'pageerror', message: (err && err.message) || String(err), time: Date.now() }));

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    const samples = [];
    const sampleInterval = 150;
    const sampleWorker = setInterval(async () => {
      try {
        const y = await page.evaluate(() => window.scrollY || window.pageYOffset || 0);
        const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight || 0, document.body.scrollHeight || 0));
        samples.push({ time: Date.now(), y, h });
        if (samples.length > 1) {
          const prev = samples[samples.length - 2].y;
          if (prev - y > 120) out.events.push({ type: 'abrupt-jump', from: prev, to: y, time: Date.now() });
        }
      } catch (e) {
        out.events.push({ type: 'error', message: e.message, time: Date.now() });
      }
    }, sampleInterval);

    // automated scroll sequence (simulate user gesture using window.scrollBy for mobile WebKit)
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => { window.scrollBy(0, 400); });
      await page.waitForTimeout(350);
    }

    // allow manual interaction: leave window open for a bit
    await page.waitForTimeout(6000);

    clearInterval(sampleWorker);

    const screenshotPath = path.join(root, 'playwright-debug-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    out.samples = samples;
    const logPath = path.join(root, 'playwright-debug-log.json');
    fs.writeFileSync(logPath, JSON.stringify(out, null, 2));

    console.log('Saved:', logPath);
    console.log('Saved:', screenshotPath);
  } catch (err) {
    console.error('Runner error:', err);
  } finally {
    try { await browser.close(); } catch (_) {}
  }

})();

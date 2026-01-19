/* eslint-disable no-console */
/**
 * Arcade route audit (Playwright)
 *
 * Purpose:
 * - Reproduce production-like route loads (/hobbies-games/:slug)
 * - Capture console errors + page errors (stack traces) + network failures
 * - Run a "soft refresh" (page.reload) and a "hard refresh" (new context)
 *
 * This is intentionally minimal and CI-friendly.
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5510';
const ROUTES = [
  '/hobbies-games/snake',
  '/hobbies-games/block-breaker',
  '/hobbies-games/2048',
  '/hobbies-games/space-invaders'
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeError(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = err.message || String(err);
    const stack = err.stack || '';
    return stack ? `${message}\n${stack}` : message;
  }
  return String(err);
}

function isSameOrigin(url) {
  try {
    const u = new URL(url);
    return u.origin === new URL(BASE_URL).origin;
  } catch {
    return false;
  }
}

function attachEvidenceCollectors(page, bucket) {
  page.on('console', (msg) => {
    const type = msg.type();
    // Only collect warnings/errors to keep output actionable.
    if (type === 'warning' || type === 'error') {
      bucket.console.push({
        ts: nowIso(),
        type,
        text: msg.text(),
        location: msg.location && msg.location() ? msg.location() : undefined
      });
    }
  });

  page.on('pageerror', (err) => {
    bucket.pageErrors.push({ ts: nowIso(), error: normalizeError(err) });
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    // Ignore external telemetry etc; we care about same-origin failures.
    if (!isSameOrigin(url)) return;
    bucket.requestFailures.push({
      ts: nowIso(),
      url,
      method: req.method(),
      resourceType: req.resourceType(),
      failure: req.failure() || null
    });
  });

  page.on('response', (res) => {
    const url = res.url();
    if (!isSameOrigin(url)) return;
    const status = res.status();
    if (status >= 400) {
      bucket.httpErrors.push({
        ts: nowIso(),
        url,
        status,
        statusText: res.statusText(),
        fromServiceWorker: res.fromServiceWorker()
      });
    }
  });

  page.on('framenavigated', (frame) => {
    // Helpful for debugging iframe mini-games; the URL will show here.
    // Only capture non-main frames.
    if (frame === page.mainFrame()) return;
    bucket.frames.push({ ts: nowIso(), url: frame.url() });
  });
}

async function unregisterServiceWorkers(page) {
  try {
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    });
  } catch {
    // Ignore.
  }
}

async function runOnce(label, route, page, options) {
  const bucket = {
    label,
    route,
    console: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    frames: []
  };

  attachEvidenceCollectors(page, bucket);

  if (options && options.unregisterSW) {
    await unregisterServiceWorkers(page);
  }

  const url = `${BASE_URL}${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  // Let modules finish and late network settle.
  await page.waitForTimeout(1500);

  // Basic sanity assertions to detect "blank" loads.
  const basics = await page.evaluate(() => {
    return {
      title: document.title,
      hasCanvas: !!document.querySelector('canvas'),
      moduleScripts: Array.from(document.querySelectorAll('script[type="module"]')).map((s) => s.getAttribute('src')).filter(Boolean),
    };
  });
  bucket.basics = basics;

  return bucket;
}

function printBucket(bucket) {
  console.log('============================================================');
  console.log(`[Arcade Audit] ${bucket.label} ${bucket.route}`);
  if (bucket.basics) {
    console.log(`[Basics] title=${JSON.stringify(bucket.basics.title)} hasCanvas=${bucket.basics.hasCanvas}`);
    if (bucket.basics.moduleScripts && bucket.basics.moduleScripts.length) {
      console.log('[Basics] moduleScripts:');
      for (const s of bucket.basics.moduleScripts) console.log(`  - ${s}`);
    }
  }

  if (bucket.frames.length) {
    console.log('[Frames]');
    for (const f of bucket.frames) console.log(`  - ${f.ts} ${f.url}`);
  }

  if (bucket.httpErrors.length) {
    console.log('[HTTP >= 400]');
    for (const e of bucket.httpErrors) {
      console.log(`  - ${e.ts} ${e.status} ${e.statusText} sw=${e.fromServiceWorker} ${e.url}`);
    }
  }

  if (bucket.requestFailures.length) {
    console.log('[Request Failed]');
    for (const f of bucket.requestFailures) {
      console.log(`  - ${f.ts} ${f.method} ${f.resourceType} ${f.url}`);
      if (f.failure) console.log(`    failure: ${JSON.stringify(f.failure)}`);
    }
  }

  if (bucket.console.length) {
    console.log('[Console (warn/error)]');
    for (const c of bucket.console) {
      console.log(`  - ${c.ts} ${c.type}: ${c.text}`);
      if (c.location && (c.location.url || c.location.lineNumber)) {
        console.log(`    at ${c.location.url || ''}:${c.location.lineNumber || ''}:${c.location.columnNumber || ''}`);
      }
    }
  }

  if (bucket.pageErrors.length) {
    console.log('[Page Errors]');
    for (const p of bucket.pageErrors) {
      console.log(`  - ${p.ts}`);
      console.log(p.error);
    }
  }

  const totalProblems = bucket.httpErrors.length + bucket.requestFailures.length + bucket.console.length + bucket.pageErrors.length;
  console.log(`[Summary] problems=${totalProblems}`);
}

async function main() {
  console.log(`[Arcade Audit] BASE_URL=${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of ROUTES) {
      // Pass 1: normal navigation (SW allowed)
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        const bucket = await runOnce('load', route, page, { unregisterSW: false });
        printBucket(bucket);
        await context.close();
      }

      // Pass 2: soft refresh (reload) in same context
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        const bucket = await runOnce('soft-load', route, page, { unregisterSW: false });
        // Reload and re-check
        const reloadBucket = {
          label: 'soft-reload',
          route,
          console: [],
          pageErrors: [],
          requestFailures: [],
          httpErrors: [],
          frames: []
        };
        attachEvidenceCollectors(page, reloadBucket);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForTimeout(1500);
        reloadBucket.basics = await page.evaluate(() => ({
          title: document.title,
          hasCanvas: !!document.querySelector('canvas'),
          moduleScripts: Array.from(document.querySelectorAll('script[type="module"]')).map((s) => s.getAttribute('src')).filter(Boolean),
        }));

        printBucket(bucket);
        printBucket(reloadBucket);
        await context.close();
      }

      // Pass 3: hard refresh simulation (new context + no prior SW registrations)
      {
        const context = await browser.newContext();
        const page = await context.newPage();
        const bucket = await runOnce('hard-load', route, page, { unregisterSW: true });
        printBucket(bucket);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[Arcade Audit] Fatal error');
  console.error(normalizeError(err));
  process.exitCode = 1;
});

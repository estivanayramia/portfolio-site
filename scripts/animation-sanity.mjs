import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';

const ROUTES = ['/', '/about', '/overview', '/contact', '/projects/'];

const BASE_URL = process.env.BASE_URL || 'http://localhost:5500';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchStatus(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function waitForUrl(url, timeoutMs = 15000, intervalMs = 250) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await fetchStatus(url, 1200);
    if (status && status >= 200 && status < 500) return true;
    await sleep(intervalMs);
  }
  return false;
}

function getPort(baseUrl) {
  try {
    const u = new URL(baseUrl);
    if (u.port) return Number(u.port);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return 5500;
  }
}

async function ensureLocalServer(baseUrl) {
  const ok = await waitForUrl(baseUrl);
  if (ok) return { stop: async () => {} };

  const port = getPort(baseUrl);
  const child = spawn(process.execPath, ['scripts/local-serve.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // Drain output to avoid buffer backpressure.
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});

  const ready = await waitForUrl(baseUrl);
  if (!ready) {
    try { child.kill(); } catch {}
    throw new Error(`Local server did not become ready at ${baseUrl}`);
  }

  return {
    stop: async () => {
      try {
        child.kill('SIGTERM');
      } catch {}
      await sleep(300);
      try {
        if (!child.killed) child.kill('SIGKILL');
      } catch {}
    },
  };
}

async function checkRoute(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Give GSAP init/failsafe time to run.
  await sleep(3100);

  const stuck = await page.evaluate(() => document.documentElement.classList.contains('gsap-prep'));
  if (stuck) {
    throw new Error(`gsap-prep still present after 3s: ${url}`);
  }

  // Controlled scroll, then wait for triggers/IO callbacks.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await sleep(1200);

  const result = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-gsap]'));
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;

    let hiddenNear = 0;
    const samples = [];

    const parseTy = (transform) => {
      try {
        if (!transform || transform === 'none') return 0;
        const m = transform.match(/^matrix\(([^)]+)\)$/);
        if (m) {
          const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
          return parts.length === 6 ? parts[5] : 0;
        }
        const m3 = transform.match(/^matrix3d\(([^)]+)\)$/);
        if (m3) {
          const parts = m3[1].split(',').map((s) => parseFloat(s.trim()));
          // matrix3d ty is index 13
          return parts.length === 16 ? parts[13] : 0;
        }
        return 0;
      } catch {
        return 0;
      }
    };

    for (const el of els) {
      const rect = el.getBoundingClientRect();
      const nearViewport = rect.top < vh * 1.15;
      if (!nearViewport) continue;

      const cs = getComputedStyle(el);
      const opacity = parseFloat(cs.opacity || '1');
      const ty = parseTy(cs.transform);

      const hidden = opacity <= 0.01 || (opacity <= 0.01 && Math.abs(ty) > 1);
      if (hidden) {
        hiddenNear += 1;
        if (samples.length < 6) {
          samples.push({
            tag: el.tagName,
            id: el.id || null,
            cls: el.className || null,
            opacity,
            transform: cs.transform,
            top: rect.top,
          });
        }
      }
    }

    return { hiddenNear, total: els.length, samples };
  });

  if (result.hiddenNear !== 0) {
    throw new Error(
      `Hidden [data-gsap] near viewport after scroll on ${url}: ${result.hiddenNear} (total targets: ${result.total})\n` +
      JSON.stringify(result.samples, null, 2)
    );
  }
}

async function main() {
  let stopServer = async () => {};
  try {
    const srv = await ensureLocalServer(BASE_URL);
    stopServer = srv.stop;

    const browser = await puppeteer.launch({
      headless: 'new',
    });

    try {
      const page = await browser.newPage();
      // Keep it consistent with typical desktop checks.
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

      for (const route of ROUTES) {
        const url = `${BASE_URL}${route}`;
        await checkRoute(page, url);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await stopServer();
  }
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exit(1);
});

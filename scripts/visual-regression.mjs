import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getBrowserLaunchConfig } from './browser-path.mjs';
import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const ROUTES = [
  { name: 'home', path: '/', readySelector: 'main' },
  { name: 'about', path: '/about', readySelector: '#about-carousel-section[data-coverflow-ready="true"]', initSelector: '#about-carousel-section' },
  { name: 'overview', path: '/overview', readySelector: 'main' },
  { name: 'contact', path: '/contact', readySelector: 'main' },
  { name: 'projects', path: '/projects/', readySelector: '[data-luxury-coverflow][data-coverflow-ready="true"]', initSelector: '[data-luxury-coverflow]' },
];

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpProbe(url, timeoutMs) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const lib = target.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        method: 'GET',
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        headers: {
          'user-agent': 'visual-regression',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      (res) => {
        res.resume();
        resolve({
          status: res.statusCode || 0,
          headers: res.headers || {},
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', () => resolve({ status: 0, headers: {} }));
    req.end();
  });
}

async function waitForUrl(url, timeoutMs, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;

  // Retry loop
  while (Date.now() < deadline) {
    // Small per-attempt timeout so we can retry quickly
    // eslint-disable-next-line no-await-in-loop
    const probe = await httpProbe(url, Math.min(1500, Math.max(250, intervalMs * 2)));
    lastStatus = probe.status;
    if (lastStatus >= 200 && lastStatus < 400) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }

  throw new Error(`Timeout waiting for ${url} (last HTTP status: ${lastStatus || 'unreachable'})`);
}

async function stopChildProcess(child, timeoutMs = 4_000) {
  if (!child) return;
  if (child.exitCode !== null) return;

  const closed = new Promise((resolve) => {
    child.once('close', resolve);
    child.once('error', resolve);
  });

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }

  const softDeadline = Date.now() + timeoutMs;
  while (child.exitCode === null && Date.now() < softDeadline) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.race([closed, sleep(200)]);
  }

  if (child.exitCode !== null) return;

  try {
    child.kill('SIGKILL');
  } catch {
    // ignore
  }

  const hardDeadline = Date.now() + timeoutMs;
  while (child.exitCode === null && Date.now() < hardDeadline) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.race([closed, sleep(200)]);
  }
}

async function startManagedLocalServer(baseUrl) {
  const normalized = ensureTrailingSlash(baseUrl);
  const rootUrl = new URL('/', normalized).toString();
  const u = new URL(normalized);
  const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
  const serverScript = path.join(REPO_ROOT, 'scripts', 'local-serve.js');

  // eslint-disable-next-line no-console
  console.log(`BASE_URL not reachable; starting local server: node ${path.relative(REPO_ROOT, serverScript)} (PORT=${port})`);

  const child = spawn(process.execPath, [serverScript], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (buf) => {
    stdout += String(buf || '');
  });
  child.stderr?.on('data', (buf) => {
    stderr += String(buf || '');
  });

  try {
    await waitForUrl(rootUrl, 15_000, 300);
  } catch (err) {
    await stopChildProcess(child);
    throw new Error(`${err.message}\n${stdout}\n${stderr}`.trim());
  }

  return { child, rootUrl };
}

async function ensureLocalServerUp(baseUrl, options = {}) {
  const { requireLocalServeIdentity = false, preferManagedServer = false } = options;
  const normalized = ensureTrailingSlash(baseUrl);
  const rootUrl = new URL('/', normalized).toString();

  if (!preferManagedServer) {
    const existingProbe = await httpProbe(rootUrl, 1_200);
    if (existingProbe.status >= 200 && existingProbe.status < 400) {
      const serverIdentity = String(existingProbe.headers['x-portfolio-server'] || '');
      if (!requireLocalServeIdentity || serverIdentity === 'local-serve') {
        return {
          started: false,
          ensureReady: async () => {
            await waitForUrl(rootUrl, 2_000, 250);
          },
          restart: async () => {},
          stop: async () => {},
        };
      }
      throw new Error(
        `BASE_URL ${rootUrl} is already serving from a different runtime. Expected X-Portfolio-Server=local-serve, received ${serverIdentity || 'none'}.`
      );
    }
  }

  let managed = await startManagedLocalServer(baseUrl);

  return {
    started: true,
    ensureReady: async () => {
      await waitForUrl(rootUrl, 2_000, 250);
    },
    restart: async () => {
      await stopChildProcess(managed.child);
      managed = await startManagedLocalServer(baseUrl);
    },
    stop: async () => {
      // eslint-disable-next-line no-console
      console.log('Stopping auto-started local server...');
      await stopChildProcess(managed.child);
    },
  };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (const raw of argv) {
    if (raw.startsWith('--threshold=')) {
      args.threshold = Number(raw.split('=')[1]);
      continue;
    }
    if (raw.startsWith('--baseUrl=')) {
      args.baseUrl = raw.split('=')[1];
      continue;
    }
    args._.push(raw);
  }
  return args;
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

async function isPortAvailable(port, host = '127.0.0.1') {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ port, host }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function getDefaultVisualBaseUrl(startPort = 5512, attempts = 12) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port);
    if (available) return `http://127.0.0.1:${port}`;
  }

  return `http://127.0.0.1:${startPort}`;
}

function pct(n) {
  return `${n.toFixed(3)}%`;
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function readPng(filePath) {
  const data = await fsp.readFile(filePath);
  return PNG.sync.read(data);
}

async function writePng(filePath, png) {
  await ensureDir(path.dirname(filePath));
  const buf = PNG.sync.write(png);
  await fsp.writeFile(filePath, buf);
}

function makeShotName(viewportName, routeName) {
  return `${viewportName}_${routeName}.png`;
}

async function waitForRouteReady(page, routeName) {
  const selectors = {
    about: '#about-carousel-section[data-coverflow-ready="true"]',
    projects: '[data-luxury-coverflow][data-coverflow-ready="true"]'
  };

  const selector = selectors[routeName];
  if (selector) {
    try {
      await page.waitForSelector(selector, { timeout: 12_000 });
    } catch {
      // Fall through: capture can still proceed, but the route likely remains flaky.
    }
  }

  await page.waitForFunction(() => {
    const images = Array.from(document.images || []);
    const imagesReady = images.every((img) => img.complete);
    const animating = document.querySelectorAll('[data-gsap-state="animating"]').length === 0;
    return imagesReady && animating;
  }, { timeout: 12_000 }).catch(() => {});

  await page.waitForFunction((name) => {
    if (name === 'home' || name === 'about') {
      return Array.from(document.querySelectorAll('.spine-route-card')).every((card) => card.textContent.trim().length > 20);
    }
    if (name === 'projects') {
      return Array.from(document.querySelectorAll('.spine-fact-card')).every((card) => card.textContent.trim().length > 20);
    }
    return true;
  }, routeName, { timeout: 12_000 }).catch(() => {});

  if (routeName === 'about' || routeName === 'projects') {
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('.coverflow-card img.card-image'));
      images.forEach((img) => {
        img.loading = 'eager';
        img.decoding = 'sync';
        img.fetchPriority = 'high';
      });

      await Promise.all(images.map(async (img) => {
        try {
          if (typeof img.decode === 'function') {
            await img.decode();
          }
        } catch {
          // ignore decode failures for already-painted images
        }
      }));
    }).catch(() => {});

    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('.coverflow-card img.card-image'));
      return images.length > 0 && images.every((img) => img.complete && img.naturalWidth > 0);
    }, { timeout: 12_000 }).catch(() => {});
  }
}

async function waitForStablePageGeometry(page, timeoutMs = 6_000) {
  await page.evaluate(() => {
    window.__visualStableGeometry = { marker: '', count: 0 };
  });

  await page.waitForFunction(() => {
    const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const marker = `${width}x${height}`;
    const state = window.__visualStableGeometry || (window.__visualStableGeometry = { marker: '', count: 0 });

    if (state.marker === marker) {
      state.count += 1;
    } else {
      state.marker = marker;
      state.count = 1;
    }

    return state.count >= 4;
  }, { timeout: timeoutMs }).catch(() => {});
}

async function captureScreenshots({ baseUrl, outDir, server }) {
  await ensureDir(outDir);

  const launchConfig = getBrowserLaunchConfig();
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: null,
    executablePath: launchConfig.executablePath,
    args: [...launchConfig.args, ...['--no-sandbox', '--disable-setuid-sandbox']],
  });

  try {
    for (const viewport of VIEWPORTS) {
      for (const route of ROUTES) {
        const page = await browser.newPage();
        if (typeof page.setBypassServiceWorker === 'function') {
          await page.setBypassServiceWorker(true);
        }
        await page.emulateMediaFeatures([
          { name: 'prefers-color-scheme', value: 'light' },
        ]);
        await page.evaluateOnNewDocument(() => {
          try {
            window.__EA_VISUAL_CAPTURE__ = true;
            document.documentElement.setAttribute('data-visual-capture', '1');
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('ea_intro_seen', '1');
            localStorage.setItem('theme', 'light');
            localStorage.setItem('theme_manual', 'true');
            sessionStorage.setItem('savonie_bubble_count', '99');
          } catch {
            // Ignore storage failures in restricted contexts.
          }
        });
        await page.setViewport(viewport);
        await page.setCacheEnabled(false);

        if (server?.ensureReady) {
          try {
            await server.ensureReady();
          } catch (error) {
            if (!server?.restart) throw error;
            await server.restart();
            await server.ensureReady();
          }
        }
        const targetUrl = new URL(route.path.replace(/^\//, ''), ensureTrailingSlash(baseUrl)).toString();

        try {
          await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60_000 });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes('ERR_CONNECTION_REFUSED') || !server?.restart) {
            throw error;
          }
          await server.restart();
          await server.ensureReady?.();
          await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60_000 });
        }
        if (route.readySelector) {
          await page.waitForSelector(route.readySelector, { timeout: 20_000 });
        }
        await page.evaluate(async () => {
          if (document.fonts?.load) {
            const requestedFaces = [
              '400 16px Inter',
              '500 16px Inter',
              '600 16px Inter',
              '700 16px Inter',
            ];
            await Promise.all(requestedFaces.map((face) => document.fonts.load(face).catch(() => {})));
          }
          if (document.fonts?.ready) await document.fonts.ready;
          window.scrollTo(0, 0);
        });
        await page.evaluate(() => {
          window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        });
        await waitForRouteReady(page, route.name);
        await waitForStablePageGeometry(page);

        // Stabilize animations for deterministic screenshots (capture-only)
        await page.evaluate((routeName) => {
          try {
            document.documentElement.classList.remove('intro-active');
            document.documentElement.setAttribute('data-visual-capture', '1');
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflow = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
            document.documentElement.style.height = '';
            [
              document.getElementById('main-content'),
              document.querySelector('header'),
              document.querySelector('footer'),
              document.getElementById('chat-widget'),
              document.getElementById('scroll-to-top'),
              document.querySelector('.scroll-progress'),
            ].forEach((el) => {
              if (el) el.style.visibility = 'visible';
            });

            if (window.gsap?.globalTimeline) window.gsap.globalTimeline.pause();
            document.querySelector('style[data-visual-freeze="1"]')?.remove();
            const style = document.createElement('style');
            style.setAttribute('data-visual-freeze', '1');
            style.textContent = `
              html,
              body {
                overflow: visible !important;
                height: auto !important;
                min-height: 100% !important;
              }
              *, *::before, *::after {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
                caret-color: transparent !important;
              }
              html,
              body,
              button,
              input,
              textarea,
              select {
                font-family: Arial, Helvetica, sans-serif !important;
                -webkit-font-smoothing: antialiased !important;
                text-rendering: geometricPrecision !important;
                font-kerning: none !important;
              }
              [data-gsap],
              .opacity-0,
              .translate-y-4,
              .translate-y-6,
              .translate-y-8 {
                opacity: 1 !important;
                transform: none !important;
                translate: none !important;
              }
              main > section,
              .page-hero,
              .page-close,
              footer,
              .section-below-fold,
              .spine-band,
              .spine-fact-grid,
              .spine-mini-route-grid {
                content-visibility: visible !important;
                contain-intrinsic-size: auto !important;
              }
              #cinematic-intro,
              .intro-curtain,
              .intro-player,
              #scroll-to-top,
              #welcome-bubble,
              .diagnostics-consent-banner,
              [aria-label="Diagnostics consent"],
              #chat-widget,
              #chat-window,
              .install-banner,
              [data-install-banner] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
              }
            `;
            document.head.appendChild(style);

            document.querySelectorAll('[data-gsap], [data-gsap] *, .reveal, .reveal *, .opacity-0').forEach((node) => {
              if (!(node instanceof HTMLElement)) return;
              node.classList.add('is-visible');
              node.classList.remove('opacity-0');
              node.style.opacity = '1';
              node.style.visibility = 'visible';
              node.style.transform = 'none';
            });

            if (routeName === 'about') {
              window.aboutCarousel?.resetInteractionState?.();
              window.aboutCarousel?.goToSlide?.(window.aboutCarousel.currentIndex, { durationMs: 0, announce: false });
              window.aboutCarousel?.refreshLayout?.();
            }
            if (routeName === 'projects') {
              window.luxuryCoverflow?.resetInteractionState?.();
              window.luxuryCoverflow?.goToSlide?.(window.luxuryCoverflow.currentIndex, { durationMs: 0, announce: false });
              window.luxuryCoverflow?.refreshLayout?.();
            }
          } catch {
            // ignore
          }
        }, route.name);

        await page.evaluate(async () => {
          try {
            localStorage.setItem('theme', 'light');
            localStorage.setItem('theme_manual', 'true');
          } catch {
            // ignore
          }

          const forceRender = (selector) => {
            document.querySelectorAll(selector).forEach((el) => {
              void el.getBoundingClientRect();
              void el.offsetHeight;
            });
          };

          forceRender('.spine-band');
          forceRender('footer');
          forceRender('.section-below-fold');
        });

        if (route.name === 'about' || route.name === 'projects') {
          await page.evaluate(async (routeName) => {
            const images = Array.from(document.querySelectorAll('.coverflow-card img.card-image'));
            images.forEach((img) => {
              img.loading = 'eager';
              img.decoding = 'sync';
              img.fetchPriority = 'high';
            });

            await Promise.all(images.map(async (img) => {
              try {
                if (typeof img.decode === 'function') {
                  await img.decode();
                }
              } catch {
                // ignore decode failures for already-painted images
              }
            }));

            if (routeName === 'about') {
              window.aboutCarousel?.refreshLayout?.();
            }
            if (routeName === 'projects') {
              window.luxuryCoverflow?.refreshLayout?.();
            }
          }, route.name).catch(() => {});
        }

        await waitForStablePageGeometry(page);
        await new Promise(r => setTimeout(r, 900));
        await waitForStablePageGeometry(page);

        const shotPath = path.join(outDir, makeShotName(viewport.name, route.name));
        await page.screenshot({ path: shotPath, fullPage: true });
        // eslint-disable-next-line no-console
        console.log(`Captured: ${path.relative(REPO_ROOT, shotPath)} (${targetUrl})`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function diffScreenshots({ baselineDir, currentDir, diffDir, thresholdRatio }) {
  await ensureDir(diffDir);

  const rows = [];
  let failed = false;

  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const fileName = makeShotName(viewport.name, route.name);
      const baselinePath = path.join(baselineDir, fileName);
      const currentPath = path.join(currentDir, fileName);
      const outDiffPath = path.join(diffDir, fileName);

      if (!fs.existsSync(baselinePath)) {
        throw new Error(`Missing baseline screenshot: ${path.relative(REPO_ROOT, baselinePath)} (run visual:baseline)`);
      }
      if (!fs.existsSync(currentPath)) {
        throw new Error(`Missing current screenshot: ${path.relative(REPO_ROOT, currentPath)}`);
      }

      const baseline = await readPng(baselinePath);
      const current = await readPng(currentPath);

      if (baseline.width !== current.width) {
        failed = true;
        rows.push({ viewport: viewport.name, route: route.name, diffPct: 100, note: 'width-mismatch' });
        continue;
      }

      function padToHeight(png, height) {
        if (png.height === height) return png;
        const out = new PNG({ width: png.width, height });

        // Fill with opaque white
        for (let i = 0; i < out.data.length; i += 4) {
          out.data[i] = 255;
          out.data[i + 1] = 255;
          out.data[i + 2] = 255;
          out.data[i + 3] = 255;
        }

        // Copy original pixels (top-left)
        const rowBytes = png.width * 4;
        for (let y = 0; y < png.height; y++) {
          const srcStart = y * rowBytes;
          const dstStart = y * rowBytes;
          png.data.copy(out.data, dstStart, srcStart, srcStart + rowBytes);
        }

        return out;
      }

      const height = Math.max(baseline.height, current.height);
      const baselinePadded = padToHeight(baseline, height);
      const currentPadded = padToHeight(current, height);

      const diff = new PNG({ width: baseline.width, height });
      const diffPixels = pixelmatch(
        baselinePadded.data,
        currentPadded.data,
        diff.data,
        baseline.width,
        height,
        { threshold: 0.15, includeAA: false }
      );

      const totalPixels = baseline.width * baseline.height;
      const diffRatio = diffPixels / totalPixels;
      const diffPct = diffRatio * 100;

      await writePng(outDiffPath, diff);

      const over = diffRatio > thresholdRatio;
      if (over) failed = true;

      rows.push({
        viewport: viewport.name,
        route: route.name,
        diffPct,
        note: over ? 'FAIL' : 'OK',
      });
    }
  }

  // Print a compact table
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log(`Visual diff threshold: ${(thresholdRatio * 100).toFixed(3)}%`);
  // eslint-disable-next-line no-console
  console.log('viewport  route      diff    status');
  // eslint-disable-next-line no-console
  console.log('-------  --------  -------  ------');
  for (const r of rows) {
    const vp = r.viewport.padEnd(7);
    const rt = r.route.padEnd(8);
    const dp = pct(r.diffPct).padStart(7);
    // eslint-disable-next-line no-console
    console.log(`${vp}  ${rt}  ${dp}  ${r.note}`);
  }
  // eslint-disable-next-line no-console
  console.log('');

  if (failed) {
    // eslint-disable-next-line no-console
    console.error(`Visual regression failure. See diff images in: ${path.relative(REPO_ROOT, diffDir)}`);
    process.exitCode = 1;
  }
}

async function main() {
  const mode = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  const hasCustomBaseUrl = Boolean(args.baseUrl || process.env.BASE_URL);
  const baseUrl = args.baseUrl || process.env.BASE_URL || await getDefaultVisualBaseUrl();
  const thresholdRatio = Number.isFinite(args.threshold)
    ? args.threshold
    : Number(process.env.VISUAL_THRESHOLD || 0.008);

  const baselineDir = path.join(REPO_ROOT, 'visual-baseline');
  const currentDir = path.join(REPO_ROOT, 'visual-current');
  const diffDir = path.join(REPO_ROOT, 'visual-diff');

  const server = await ensureLocalServerUp(baseUrl, {
    requireLocalServeIdentity: !hasCustomBaseUrl,
    preferManagedServer: !hasCustomBaseUrl,
  });

  try {
    if (mode === 'baseline') {
      await captureScreenshots({ baseUrl, outDir: baselineDir, server });
      // eslint-disable-next-line no-console
      console.log(`Baseline written to: ${path.relative(REPO_ROOT, baselineDir)}`);
      return;
    }

    if (mode === 'check') {
      await captureScreenshots({ baseUrl, outDir: currentDir, server });
      await diffScreenshots({ baselineDir, currentDir, diffDir, thresholdRatio });
      return;
    }
  } finally {
    await server.stop();
  }

  // eslint-disable-next-line no-console
  console.error('Usage:');
  // eslint-disable-next-line no-console
  console.error('  node scripts/visual-regression.mjs baseline [--baseUrl=http://127.0.0.1:5512]');
  // eslint-disable-next-line no-console
  console.error('  node scripts/visual-regression.mjs check [--threshold=0.003] [--baseUrl=http://127.0.0.1:5512]');
  process.exitCode = 2;
}

await main();

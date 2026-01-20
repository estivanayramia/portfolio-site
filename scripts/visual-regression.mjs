import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'overview', path: '/overview' },
  { name: 'contact', path: '/contact' },
  { name: 'projects', path: '/projects/' },
];

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];

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

async function captureScreenshots({ baseUrl, outDir }) {
  await ensureDir(outDir);

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport(viewport);
      await page.setCacheEnabled(false);

      for (const route of ROUTES) {
        const targetUrl = new URL(route.path.replace(/^\//, ''), ensureTrailingSlash(baseUrl)).toString();

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60_000 });
        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
          window.scrollTo(0, 0);
        });

        // Stabilize animations for deterministic screenshots (does not affect the site, only the capture run)
        await page.evaluate(() => {
          try {
            // Pause GSAP timeline if present
            if (window.gsap?.globalTimeline) window.gsap.globalTimeline.pause();
            // Stop CSS animations/transitions to reduce flake
            const style = document.createElement('style');
            style.setAttribute('data-visual-freeze', '1');
            style.textContent = `
              *, *::before, *::after {
                animation-duration: 0s !important;
                animation-delay: 0s !important;
                transition-duration: 0s !important;
                transition-delay: 0s !important;
                caret-color: transparent !important;
              }
            `;
            document.head.appendChild(style);
          } catch {
            // ignore
          }
        });

        // Small settle time for layout/paint completion
        await page.waitForTimeout(250);

        const shotPath = path.join(outDir, makeShotName(viewport.name, route.name));
        await page.screenshot({ path: shotPath, fullPage: true });
        // eslint-disable-next-line no-console
        console.log(`Captured: ${path.relative(REPO_ROOT, shotPath)} (${targetUrl})`);
      }

      await page.close();
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
        { threshold: 0.1, includeAA: false }
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

  const baseUrl = args.baseUrl || process.env.BASE_URL || 'http://localhost:5500';
  const thresholdRatio = Number.isFinite(args.threshold)
    ? args.threshold
    : Number(process.env.VISUAL_THRESHOLD || 0.003);

  const baselineDir = path.join(REPO_ROOT, 'visual-baseline');
  const currentDir = path.join(REPO_ROOT, 'visual-current');
  const diffDir = path.join(REPO_ROOT, 'visual-diff');

  if (mode === 'baseline') {
    await captureScreenshots({ baseUrl, outDir: baselineDir });
    // eslint-disable-next-line no-console
    console.log(`Baseline written to: ${path.relative(REPO_ROOT, baselineDir)}`);
    return;
  }

  if (mode === 'check') {
    await captureScreenshots({ baseUrl, outDir: currentDir });
    await diffScreenshots({ baselineDir, currentDir, diffDir, thresholdRatio });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('Usage:');
  // eslint-disable-next-line no-console
  console.error('  node scripts/visual-regression.mjs baseline [--baseUrl=http://localhost:5500]');
  // eslint-disable-next-line no-console
  console.error('  node scripts/visual-regression.mjs check [--threshold=0.003] [--baseUrl=http://localhost:5500]');
  process.exitCode = 2;
}

await main();

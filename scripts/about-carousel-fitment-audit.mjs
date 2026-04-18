import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { chromium, devices } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const ABOUT_PATH = '/EN/about.html';
const PROJECTS_PATH = '/EN/projects/';
const PROJECTS_SECTION_SELECTOR = '#luxury-portfolio-carousel';

const VIEWPORT_MATRIX = [
  { name: '1366x768', width: 1366, height: 768, touch: false, mobile: false },
  { name: '1440x900', width: 1440, height: 900, touch: false, mobile: false },
  { name: '1536x864', width: 1536, height: 864, touch: false, mobile: false },
  { name: '1920x1080', width: 1920, height: 1080, touch: false, mobile: false },
  { name: '1024x768', width: 1024, height: 768, touch: true, mobile: true },
  { name: '768x1024', width: 768, height: 1024, touch: true, mobile: true },
  { name: '430x932', width: 430, height: 932, touch: true, mobile: true },
  { name: '390x844', width: 390, height: 844, touch: true, mobile: true },
  { name: '375x667', width: 375, height: 667, touch: true, mobile: true },
  { name: '1366x640', width: 1366, height: 640, touch: false, mobile: false },
  { name: '1440x700', width: 1440, height: 700, touch: false, mobile: false }
];

const SCREENSHOT_FOCUS_VIEWPORTS = new Set(['1366x768', '1024x768', '375x667', '1366x640']);

function parseArgs(argv) {
  const args = {
    label: 'run',
    baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500',
    outRoot: '.reports/about-carousel-audit',
    skipProjectsCheck: false
  };

  for (const arg of argv) {
    if (arg.startsWith('--label=')) {
      args.label = arg.slice('--label='.length).trim() || args.label;
      continue;
    }
    if (arg.startsWith('--baseUrl=')) {
      args.baseUrl = arg.slice('--baseUrl='.length).trim() || args.baseUrl;
      continue;
    }
    if (arg.startsWith('--outRoot=')) {
      args.outRoot = arg.slice('--outRoot='.length).trim() || args.outRoot;
      continue;
    }
    if (arg === '--skipProjectsCheck') {
      args.skipProjectsCheck = true;
      continue;
    }
  }

  return args;
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIsoSafe() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function toNum(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function httpStatus(url, timeoutMs) {
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
          'user-agent': 'about-carousel-fitment-audit',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', () => resolve(0));
    req.end();
  });
}

async function waitForUrl(url, timeoutMs, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    lastStatus = await httpStatus(url, Math.min(1500, Math.max(250, intervalMs * 2)));
    if (lastStatus >= 200 && lastStatus < 400) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs);
  }

  throw new Error(`Timeout waiting for ${url} (last HTTP status: ${lastStatus || 'unreachable'})`);
}

async function stopChildProcess(child, timeoutMs = 4000) {
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

async function ensureLocalServerUp(baseUrl) {
  const normalized = ensureTrailingSlash(baseUrl);
  const rootUrl = new URL('/', normalized).toString();
  const fallbackRootUrl = rootUrl.includes('127.0.0.1')
    ? rootUrl.replace('127.0.0.1', 'localhost')
    : null;

  try {
    await waitForUrl(rootUrl, 1200, 300);
    return { started: false, stop: async () => {} };
  } catch {
    if (fallbackRootUrl) {
      try {
        await waitForUrl(fallbackRootUrl, 1200, 300);
        return { started: false, stop: async () => {} };
      } catch {
        // continue and start local server
      }
    }
    // continue and start local server
  }

  const url = new URL(normalized);
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  const serverScript = path.join(REPO_ROOT, 'scripts', 'local-serve.js');

  console.log(`BASE_URL not reachable; starting local server: node ${path.relative(REPO_ROOT, serverScript)} (PORT=${port})`);

  const child = spawn(process.execPath, [serverScript], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port)
    },
    stdio: 'inherit',
    windowsHide: true
  });

  try {
    await waitForUrl(rootUrl, 15000, 300);
  } catch (error) {
    if (fallbackRootUrl) {
      try {
        await waitForUrl(fallbackRootUrl, 15000, 300);
        return {
          started: true,
          stop: async () => {
            console.log('Stopping auto-started local server...');
            await stopChildProcess(child);
          }
        };
      } catch {
        // fall through to cleanup and throw original error
      }
    }
    await stopChildProcess(child);
    throw error;
  }

  return {
    started: true,
    stop: async () => {
      console.log('Stopping auto-started local server...');
      await stopChildProcess(child);
    }
  };
}

function getUserAgentForProfile(profile) {
  if (!profile.touch) return undefined;
  if (profile.width >= 700) {
    return devices['iPad (gen 7)']?.userAgent || devices['iPad Mini']?.userAgent;
  }
  return devices['iPhone 14']?.userAgent;
}

async function hideDiagnosticsBanner(page) {
  const banner = page.locator('[role="dialog"][aria-label="Diagnostics consent"]');
  if (await banner.count()) {
    await page.evaluate(() => {
      const node = document.querySelector('[role="dialog"][aria-label="Diagnostics consent"]');
      if (!node) return;
      node.setAttribute('aria-hidden', 'true');
      node.style.pointerEvents = 'none';
      node.style.opacity = '0';
    });
  }
}

async function prepareAboutCarousel(page, baseUrl) {
  await page.goto(new URL(ABOUT_PATH.replace(/^\//, ''), ensureTrailingSlash(baseUrl)).toString(), {
    waitUntil: 'networkidle',
    timeout: 45000
  });

  await hideDiagnosticsBanner(page);

  const section = page.locator('#about-carousel-section');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);

  await section.waitFor({ state: 'visible', timeout: 10000 });
  await section.locator('.coverflow-track').waitFor({ state: 'visible', timeout: 10000 });

  await page.waitForFunction(
    () => {
      const sectionNode = document.querySelector('#about-carousel-section');
      if (!sectionNode) return false;
      if (sectionNode.getAttribute('data-coverflow-ready') !== 'true') return false;
      const active = sectionNode.querySelector('.coverflow-card--active, .coverflow-card.is-center');
      return Boolean(active);
    },
    null,
    { timeout: 10000 }
  );

  await page.waitForTimeout(260);
}

async function collectAboutStateMetrics(page, viewportName, stateStep, screenshotsDir, focusOnly) {
  const metrics = await page.locator('#about-carousel-section').evaluate((section) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const cards = Array.from(section.querySelectorAll('.coverflow-card'));
    const active = section.querySelector('.coverflow-card--active, .coverflow-card.is-center');
    const controls = section.querySelector('.coverflow-controls');
    const stage = section.querySelector('.coverflow-container');

    const toBox = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        right: Number(rect.right.toFixed(2)),
        bottom: Number(rect.bottom.toFixed(2)),
        left: Number(rect.left.toFixed(2))
      };
    };

    const sectionRect = section.getBoundingClientRect();
    const activeRect = active?.getBoundingClientRect();
    const controlsRect = controls?.getBoundingClientRect();

    let adjacent = null;
    if (activeRect) {
      const activeCenterX = activeRect.left + activeRect.width / 2;
      const visibleCandidates = cards
        .filter((card) => card !== active)
        .map((card) => {
          const rect = card.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const intersectionLeft = Math.max(rect.left, 0);
          const intersectionRight = Math.min(rect.right, viewportWidth);
          const visibleWidth = Math.max(0, intersectionRight - intersectionLeft);
          return {
            node: card,
            rect,
            distance: Math.abs(centerX - activeCenterX),
            visibleWidth
          };
        })
        .filter((entry) => entry.visibleWidth >= 24)
        .sort((a, b) => a.distance - b.distance);

      adjacent = visibleCandidates[0] || null;
    }

    const activeBox = toBox(active);
    const adjacentBox = toBox(adjacent?.node || null);
    const controlsBox = toBox(controls);

    const cardControlsGap = activeBox && controlsBox
      ? Number((controlsBox.top - activeBox.bottom).toFixed(2))
      : null;

    const cardAndControlsFit = Boolean(
      activeBox
      && controlsBox
      && activeBox.top >= -2
      && controlsBox.bottom <= viewportHeight + 2
      && (controlsBox.top - activeBox.bottom) >= -2
    );

    const stageStyles = stage ? getComputedStyle(stage) : null;
    const sectionStyles = getComputedStyle(section);

    const activeScaleVar = Number.parseFloat(sectionStyles.getPropertyValue('--coverflow-active-scale'));

    const aboutCarousel = window.aboutCarousel;
    let transformScales = null;
    if (aboutCarousel && typeof aboutCarousel.getNearestIndex === 'function') {
      const totalItems = Array.isArray(aboutCarousel.items) ? aboutCarousel.items.length : cards.length;
      const previewIndex = Number.isFinite(aboutCarousel.previewIndex)
        ? aboutCarousel.previewIndex
        : aboutCarousel.currentIndex;
      const nearestIndex = aboutCarousel.getNearestIndex(previewIndex);

      const transforms = aboutCarousel.engine3D?.calculateAllTransforms?.(
        previewIndex,
        totalItems,
        Boolean(aboutCarousel.config?.infiniteLoop)
      ) || null;

      if (transforms && transforms[nearestIndex]) {
        const adjacentIndex = adjacent?.node
          ? Number(adjacent.node.getAttribute('data-index'))
          : null;
        transformScales = {
          previewIndex: Number(previewIndex.toFixed(4)),
          nearestIndex,
          activeIndex: Number(aboutCarousel.currentIndex),
          activeScale: Number((transforms[nearestIndex].scale ?? NaN).toFixed(4)),
          adjacentScale: Number.isInteger(adjacentIndex) && transforms[adjacentIndex]
            ? Number((transforms[adjacentIndex].scale ?? NaN).toFixed(4))
            : null,
          adjacentRotateY: Number.isInteger(adjacentIndex) && transforms[adjacentIndex]
            ? Number((transforms[adjacentIndex].rotateY ?? NaN).toFixed(2))
            : null,
          adjacentTranslateX: Number.isInteger(adjacentIndex) && transforms[adjacentIndex]
            ? Number((transforms[adjacentIndex].translateX ?? NaN).toFixed(2))
            : null,
          adjacentTranslateZ: Number.isInteger(adjacentIndex) && transforms[adjacentIndex]
            ? Number((transforms[adjacentIndex].translateZ ?? NaN).toFixed(2))
            : null
        };
      }
    }

    const activeAspectRatio = activeBox ? Number((activeBox.width / activeBox.height).toFixed(4)) : null;
    const previewAspectRatio = adjacentBox ? Number((adjacentBox.width / adjacentBox.height).toFixed(4)) : null;
    const previewToActiveWidthRatio = activeBox && adjacentBox
      ? Number((adjacentBox.width / activeBox.width).toFixed(4))
      : null;

    return {
      viewport: { width: viewportWidth, height: viewportHeight },
      sectionBox: toBox(section),
      stageBox: toBox(stage),
      activeCard: {
        index: active ? Number(active.getAttribute('data-index')) : null,
        title: active?.getAttribute('data-title') || active?.querySelector('.card-title')?.textContent?.trim() || null,
        box: activeBox,
        aspectRatio: activeAspectRatio
      },
      adjacentCard: {
        index: adjacent?.node ? Number(adjacent.node.getAttribute('data-index')) : null,
        title: adjacent?.node?.getAttribute('data-title') || adjacent?.node?.querySelector('.card-title')?.textContent?.trim() || null,
        box: adjacentBox,
        aspectRatio: previewAspectRatio,
        visibleWidth: adjacent ? Number(adjacent.visibleWidth.toFixed(2)) : null,
        previewToActiveWidthRatio
      },
      controls: {
        box: controlsBox
      },
      fitment: {
        cardAndControlsFit,
        cardControlsGap,
        activeTopOverflow: activeBox ? Number(Math.max(0, -activeBox.top).toFixed(2)) : null,
        activeBottomOverflow: activeBox ? Number(Math.max(0, activeBox.bottom - viewportHeight).toFixed(2)) : null,
        controlsBottomOverflow: controlsBox ? Number(Math.max(0, controlsBox.bottom - viewportHeight).toFixed(2)) : null,
        dynamicTop: stageStyles ? stageStyles.getPropertyValue('--coverflow-dynamic-top').trim() : null,
        dynamicBottom: stageStyles ? stageStyles.getPropertyValue('--coverflow-dynamic-bottom').trim() : null,
        dynamicHeight: stageStyles ? stageStyles.getPropertyValue('--coverflow-dynamic-height').trim() : null
      },
      runtime: {
        geometryProfile: section.dataset.coverflowGeometry || null,
        tier: section.dataset.coverflowTier || null,
        activeScaleCssVar: Number.isFinite(activeScaleVar) ? Number(activeScaleVar.toFixed(4)) : null,
        transformScales
      },
      visuals: {
        previewLooksCompressed: Boolean(previewToActiveWidthRatio !== null && previewToActiveWidthRatio < 0.38),
        previewLooksSubstantial: Boolean(previewToActiveWidthRatio !== null && previewToActiveWidthRatio >= 0.42),
        premiumBalanceSignal: Boolean(
          cardAndControlsFit
          && previewToActiveWidthRatio !== null
          && previewToActiveWidthRatio >= 0.42
          && previewToActiveWidthRatio <= 0.68
        )
      }
    };
  });

  const shouldCapture = !focusOnly || SCREENSHOT_FOCUS_VIEWPORTS.has(viewportName);
  let screenshotPath = null;

  if (shouldCapture) {
    const fileName = `${sanitizeFilePart(viewportName)}-state-${stateStep}.png`;
    screenshotPath = path.join(screenshotsDir, fileName);
    await page.locator('#about-carousel-section').screenshot({ path: screenshotPath });
  }

  return {
    ...metrics,
    stateStep,
    screenshot: screenshotPath ? path.relative(REPO_ROOT, screenshotPath).replace(/\\/g, '/') : null
  };
}

async function clickOrTapNext(page, useTap) {
  const button = page.locator('#about-carousel-section .coverflow-btn-next').first();
  await button.scrollIntoViewIfNeeded();

  const beforeIndex = await page
    .locator('#about-carousel-section .coverflow-card--active, #about-carousel-section .coverflow-card.is-center')
    .first()
    .getAttribute('data-index');

  if (useTap) {
    await button.tap();
  } else {
    await button.click();
  }

  await page.waitForFunction(
    (prevIndex) => {
      const active = document.querySelector('#about-carousel-section .coverflow-card--active, #about-carousel-section .coverflow-card.is-center');
      const nextIndex = active?.getAttribute('data-index');
      return typeof nextIndex === 'string' && nextIndex !== prevIndex;
    },
    beforeIndex,
    { timeout: 5000 }
  );

  await page.waitForTimeout(360);
}

function summarizeViewportResult(viewportResult) {
  const states = viewportResult.states;
  const failedFitStates = states.filter((state) => !state.fitment.cardAndControlsFit).length;
  const compressedStates = states.filter((state) => state.visuals.previewLooksCompressed).length;
  const substantialStates = states.filter((state) => state.visuals.previewLooksSubstantial).length;
  const minGap = states
    .map((state) => state.fitment.cardControlsGap)
    .filter((value) => Number.isFinite(value))
    .reduce((min, value) => (min === null || value < min ? value : min), null);

  return {
    viewport: viewportResult.viewport,
    interactionMode: viewportResult.interactionMode,
    fitFailures: failedFitStates,
    compressedStates,
    substantialStates,
    minGap: toNum(minGap, 2)
  };
}

async function auditAboutMatrix(browser, baseUrl, outDir) {
  const screenshotsDir = path.join(outDir, 'screenshots');
  await ensureDir(screenshotsDir);

  const results = [];

  for (const profile of VIEWPORT_MATRIX) {
    const context = await browser.newContext({
      baseURL: ensureTrailingSlash(baseUrl),
      viewport: { width: profile.width, height: profile.height },
      isMobile: profile.mobile,
      hasTouch: profile.touch,
      userAgent: getUserAgentForProfile(profile),
      deviceScaleFactor: profile.touch ? 2 : 1
    });

    try {
      const page = await context.newPage();
      await prepareAboutCarousel(page, baseUrl);

      const viewportResult = {
        viewport: profile,
        interactionMode: profile.touch ? 'tap' : 'click',
        states: []
      };

      viewportResult.states.push(
        await collectAboutStateMetrics(page, profile.name, 0, screenshotsDir, false)
      );

      for (let step = 1; step <= 3; step += 1) {
        await clickOrTapNext(page, profile.touch);
        viewportResult.states.push(
          await collectAboutStateMetrics(page, profile.name, step, screenshotsDir, false)
        );
      }

      viewportResult.summary = summarizeViewportResult(viewportResult);
      results.push(viewportResult);

      console.log(
        `[about] ${profile.name}: fitFailures=${viewportResult.summary.fitFailures}, `
        + `compressedStates=${viewportResult.summary.compressedStates}, `
        + `substantialStates=${viewportResult.summary.substantialStates}, minGap=${viewportResult.summary.minGap}`
      );
    } finally {
      await context.close();
    }
  }

  return results;
}

async function auditProjectsQuickCheck(browser, baseUrl, outDir) {
  const context = await browser.newContext({
    baseURL: ensureTrailingSlash(baseUrl),
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false
  });

  try {
    const page = await context.newPage();
    await page.goto(new URL(PROJECTS_PATH.replace(/^\//, ''), ensureTrailingSlash(baseUrl)).toString(), {
      waitUntil: 'networkidle',
      timeout: 45000
    });

    await hideDiagnosticsBanner(page);

    const section = page.locator(PROJECTS_SECTION_SELECTOR);
    await section.scrollIntoViewIfNeeded();
    await section.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction((selector) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      if (node.getAttribute('data-coverflow-ready') !== 'true') return false;
      return Boolean(node.querySelector('.coverflow-card--active, .coverflow-card.is-center'));
    }, PROJECTS_SECTION_SELECTOR, { timeout: 10000 });

    const state = await section.evaluate((node) => {
      const viewportHeight = window.innerHeight;
      const active = node.querySelector('.coverflow-card--active, .coverflow-card.is-center');
      const controls = node.querySelector('.coverflow-controls');
      const activeRect = active?.getBoundingClientRect();
      const controlsRect = controls?.getBoundingClientRect();

      return {
        geometryProfile: node.dataset.coverflowGeometry || null,
        tier: node.dataset.coverflowTier || null,
        activeCardHeight: activeRect ? Number(activeRect.height.toFixed(2)) : null,
        previewCount: node.querySelectorAll('.coverflow-card').length,
        cardAndControlsFit: Boolean(
          activeRect && controlsRect
          && activeRect.top >= -2
          && controlsRect.bottom <= viewportHeight + 2
          && controlsRect.top - activeRect.bottom >= -2
        ),
        cardControlsGap: activeRect && controlsRect
          ? Number((controlsRect.top - activeRect.bottom).toFixed(2))
          : null
      };
    });

    const screenshotPath = path.join(outDir, 'screenshots', 'projects-quick-check.png');
    await ensureDir(path.dirname(screenshotPath));
    await section.screenshot({ path: screenshotPath });

    return {
      ...state,
      screenshot: path.relative(REPO_ROOT, screenshotPath).replace(/\\/g, '/')
    };
  } finally {
    await context.close();
  }
}

function flattenAboutStates(aboutMatrix) {
  const rows = [];
  for (const entry of aboutMatrix) {
    for (const state of entry.states) {
      rows.push({
        viewport: entry.viewport.name,
        state: state.stateStep,
        cardAndControlsFit: state.fitment.cardAndControlsFit,
        cardControlsGap: state.fitment.cardControlsGap,
        previewToActiveWidthRatio: state.adjacentCard.previewToActiveWidthRatio,
        previewLooksCompressed: state.visuals.previewLooksCompressed,
        previewLooksSubstantial: state.visuals.previewLooksSubstantial,
        activeScaleCssVar: state.runtime.activeScaleCssVar,
        activeScaleRuntime: state.runtime.transformScales?.activeScale ?? null,
        adjacentScaleRuntime: state.runtime.transformScales?.adjacentScale ?? null,
        adjacentRotateY: state.runtime.transformScales?.adjacentRotateY ?? null,
        adjacentTranslateX: state.runtime.transformScales?.adjacentTranslateX ?? null,
        adjacentTranslateZ: state.runtime.transformScales?.adjacentTranslateZ ?? null,
        activeCardBox: state.activeCard.box,
        adjacentCardBox: state.adjacentCard.box,
        controlsBox: state.controls.box,
        screenshot: state.screenshot
      });
    }
  }
  return rows;
}

function buildOverallSummary(aboutMatrix) {
  const flat = flattenAboutStates(aboutMatrix);

  const fitFailures = flat.filter((row) => !row.cardAndControlsFit).length;
  const compressedCount = flat.filter((row) => row.previewLooksCompressed).length;
  const substantialCount = flat.filter((row) => row.previewLooksSubstantial).length;

  const minGap = flat
    .map((row) => row.cardControlsGap)
    .filter((value) => Number.isFinite(value))
    .reduce((min, value) => (min === null || value < min ? value : min), null);

  const ratioValues = flat
    .map((row) => row.previewToActiveWidthRatio)
    .filter((value) => Number.isFinite(value));

  const ratioMin = ratioValues.length
    ? Math.min(...ratioValues)
    : null;
  const ratioMax = ratioValues.length
    ? Math.max(...ratioValues)
    : null;

  return {
    totalStates: flat.length,
    fitFailures,
    compressedCount,
    substantialCount,
    minCardControlsGap: toNum(minGap, 2),
    previewWidthRatioRange: {
      min: toNum(ratioMin, 4),
      max: toNum(ratioMax, 4)
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runStamp = `${sanitizeFilePart(args.label)}-${nowIsoSafe()}`;
  const outDir = path.resolve(REPO_ROOT, args.outRoot, runStamp);
  await ensureDir(outDir);

  const server = await ensureLocalServerUp(args.baseUrl);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage']
  });

  try {
    const aboutMatrix = await auditAboutMatrix(browser, args.baseUrl, outDir);
    const projectsQuickCheck = args.skipProjectsCheck
      ? null
      : await auditProjectsQuickCheck(browser, args.baseUrl, outDir);

    const report = {
      label: args.label,
      baseUrl: args.baseUrl,
      generatedAt: new Date().toISOString(),
      outputDir: path.relative(REPO_ROOT, outDir).replace(/\\/g, '/'),
      about: {
        viewportMatrix: VIEWPORT_MATRIX,
        results: aboutMatrix,
        summary: buildOverallSummary(aboutMatrix),
        stateRows: flattenAboutStates(aboutMatrix)
      },
      projectsQuickCheck
    };

    const reportPath = path.join(outDir, 'report.json');
    await fsp.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log('');
    console.log(`Report written: ${path.relative(REPO_ROOT, reportPath).replace(/\\/g, '/')}`);
    console.log(`About summary: ${JSON.stringify(report.about.summary)}`);
    if (projectsQuickCheck) {
      console.log(`Projects quick check: ${JSON.stringify(projectsQuickCheck)}`);
    }
  } finally {
    await browser.close();
    await server.stop();
  }
}

main().catch((error) => {
  console.error('[about-carousel-fitment-audit] failed');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});

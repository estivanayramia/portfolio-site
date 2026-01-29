/* eslint-disable no-console */
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const DEFAULT_DASHBOARD_URL = `http://localhost:5500/dashboard?demo=1&cb=${Date.now()}`;
const DASHBOARD_URL = process.env.DASHBOARD_URL || DEFAULT_DASHBOARD_URL;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'savonie21';
const AUTO_START_SERVER = process.env.START_SERVER !== '0';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

async function expectVisible(page, selector, timeout = 15000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

async function clickTab(page, tabName) {
  const btn = page.locator(`.tab-btn[data-tab="${tabName}"]`);
  await btn.click();
  await page.waitForFunction((name) => {
    const panel = document.getElementById(`tab-${name}`);
    return !!panel && panel.classList.contains('active');
  }, tabName, { timeout: 5000 });
}

function isLocalhostUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

async function startLocalServer(port = 5500) {
  return new Promise((resolve, reject) => {
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
      if (text.includes('Serving on http://localhost:')) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(child);
      }
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

(async () => {
  let serverProc = null;
  if (AUTO_START_SERVER && isLocalhostUrl(DASHBOARD_URL)) {
    console.log('Starting local server for dashboard test…');
    serverProc = await startLocalServer(5500);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text() || '';
    // Expected noise from the synthetic comprehensive test + optional resources.
    if (t.includes('Test error message')) return;
    if (t.includes('Caught synthetic error:')) return;
    if (t.includes('Access to fetch at') && t.includes('example.com')) return;
    if (t.startsWith('Failed to load resource:')) return;
    consoleErrors.push(t);
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(String(err));
  });

  page.on('requestfailed', (req) => {
    if (req.url().startsWith('https://example.com/')) return;
    requestFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure() ? req.failure().errorText : 'unknown',
    });
  });

  page.on('dialog', async (d) => {
    try {
      await d.accept();
    } catch {
      // ignore
    }
  });

  try {
    console.log(`Visiting: ${DASHBOARD_URL}`);
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });

    await expectVisible(page, '#login-form');
    await page.fill('#password-input', DEMO_PASSWORD);
    await page.click('#login-form button[type="submit"]');

    await expectVisible(page, '#dashboard');

    // Buttons/tabs must be clickable
    await clickTab(page, 'errors');
    await clickTab(page, 'console');
    await clickTab(page, 'network');
    await clickTab(page, 'performance');
    await clickTab(page, 'redirects');
    await clickTab(page, 'storage');
    await clickTab(page, 'system');

    // Ensure diagnostics open button responds (does not guarantee HUD loads, but validates click path)
    await clickTab(page, 'errors');
    await page.click('#open-diagnostics');

    // Comprehensive test button should populate redirect log and other tabs
    await clickTab(page, 'redirects');
    await page.click('#test-all-features');

    await page.waitForFunction(() => {
      const el = document.getElementById('redirect-log');
      return el && el.textContent && el.textContent.includes('COMPREHENSIVE TEST COMPLETE');
    }, { timeout: 20000 });

    // Console should contain rapid logs
    await clickTab(page, 'console');
    await page.waitForFunction(() => {
      const el = document.getElementById('console-output');
      return el && el.textContent && el.textContent.includes('Rapid log');
    }, { timeout: 8000 });

    // Network table should have at least one row
    await clickTab(page, 'network');
    await page.waitForFunction(() => {
      const tbody = document.getElementById('network-tbody');
      return tbody && tbody.children && tbody.children.length > 0;
    }, { timeout: 8000 });

    // Storage tables should reflect our synthetic keys
    await clickTab(page, 'storage');
    await page.click('#storage-ls-refresh');
    await page.click('#storage-ss-refresh');

    await page.waitForFunction(() => {
      const ls = document.getElementById('storage-ls-table');
      const ss = document.getElementById('storage-ss-table');
      const lsOk = ls && ls.textContent && ls.textContent.includes('dashboard_test_key');
      const ssOk = ss && ss.textContent && ss.textContent.includes('dashboard_test_session_key');
      return lsOk && ssOk;
    }, { timeout: 8000 });

    console.log('PASS: Dashboard buttons and comprehensive test flow worked.');
  } catch (e) {
    fail(String(e));
  } finally {
    if (requestFailures.length) {
      console.log('Request failures:');
      for (const f of requestFailures) console.log(JSON.stringify(f));
    }

    if (consoleErrors.length) {
      console.log('Console errors:');
      for (const c of consoleErrors) console.log(c);
    }

    await context.close();
    await browser.close();

    if (serverProc) {
      try {
        serverProc.kill();
      } catch {
        // ignore
      }
    }
  }

  if (process.exitCode === 1) process.exit(1);
})();

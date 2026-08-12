/* eslint-disable no-console */
const { spawn } = require('child_process');
const http = require('http');
const { chromium } = require('playwright');

const DEFAULT_CONTACT_URL = `http://127.0.0.1:5512/contact?cb=${Date.now()}`;
const CONTACT_URL = process.env.CONTACT_URL || DEFAULT_CONTACT_URL;

const CONTACT_API_PATH = '/api/contact';
const FORMSPREE_URL_PART = 'formspree.io/f/mblbnwoy';
const MOCK_FORMSPREE = process.env.MOCK_FORMSPREE !== '0';
const EXPECT_DIRECT_FORMSPREE = process.env.EXPECT_DIRECT_FORMSPREE !== '0';
const AUTO_START_SERVER = process.env.START_SERVER !== '0';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

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

async function startLocalServer(port) {
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
      if (!String(buf || '').includes('Serving on http://localhost:') || settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(child);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
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
  if (AUTO_START_SERVER && isLocalhostUrl(CONTACT_URL)) {
    const parsed = new URL(CONTACT_URL);
    const port = Number(parsed.port || 80);
    if (!(await isPortServingHttp(port))) {
      serverProc = await startLocalServer(port);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  await page.route(
    /https:\/\/(?:www\.googletagmanager\.com|analytics\.google\.com|www\.clarity\.ms|scripts\.clarity\.ms)\//,
    (route) => route.fulfill({ status: 204, body: '' })
  );

  const consoleErrors = [];
  const requestFailures = [];
  const submissionPosts = [];
  let submissionResponse = null;

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(String(err));
  });

  page.on('requestfailed', (req) => {
    requestFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure() ? req.failure().errorText : 'unknown',
    });
  });

  page.on('request', (req) => {
    if (
      req.method() === 'POST'
      && (req.url().includes(CONTACT_API_PATH) || req.url().includes(FORMSPREE_URL_PART))
    ) {
      submissionPosts.push(req.url());
    }
  });

  if (MOCK_FORMSPREE) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'accept, content-type, cache-control, pragma',
      'Access-Control-Max-Age': '86400',
    };

    await page.route(`**${EXPECT_DIRECT_FORMSPREE ? FORMSPREE_URL_PART : CONTACT_API_PATH}`, async (route) => {
      const req = route.request();

      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          next: '/thanks',
          ...(EXPECT_DIRECT_FORMSPREE
            ? {}
            : {
                success: true,
                recorded: true,
                receiptId: `mock-receipt-${Date.now()}`,
                upstream: {
                  endpoint: `https://${FORMSPREE_URL_PART}`,
                  status: 200,
                  ok: true,
                  next: '/thanks'
                }
              })
        }),
      });
    });
  }

  page.on('response', async (res) => {
    if (res.url().includes(CONTACT_API_PATH) || res.url().includes(FORMSPREE_URL_PART)) {
      let body = null;
      try {
        body = await res.json();
      } catch (_) {
        body = null;
      }
      submissionResponse = { url: res.url(), status: res.status(), ok: res.ok(), body };
    }
  });

  try {
    console.log(`Visiting: ${CONTACT_URL}`);
    await page.goto(CONTACT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#contact-form', { state: 'attached', timeout: 15000 });
    await page.locator('#contact-form').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    await page.waitForTimeout(2700);

    const stamp = Date.now();
    await page.locator('#name').scrollIntoViewIfNeeded();
    await page.fill('#name', 'Automated Test');
    await page.fill('#email', `test+${stamp}@example.com`);
    await page.fill('#message', `Automated submission test at ${new Date(stamp).toISOString()}`);

    await page.click('#contact-form button[type="submit"]');

    await page.waitForFunction(() => {
      const el = document.querySelector('#contact-status');
      if (!el) return false;
      const s = (el.getAttribute('data-status') || '').toLowerCase();
      return s && s !== 'idle';
    }, { timeout: 5000 });

    {
      const statusText = await page.textContent('#contact-status');
      const statusType = await page.getAttribute('#contact-status', 'data-status');
      console.log(`contact-status(after-submit): [${statusType}] ${statusText && statusText.trim()}`);
    }

    await page.waitForFunction(() => {
      const el = document.querySelector('#contact-status');
      const text = el ? String(el.textContent || '') : '';
      return !!el && /message (sent successfully|received and recorded)/i.test(text);
    }, { timeout: 30000 });

    await page.waitForFunction(() => {
      const modal = document.querySelector('#contact-success-modal');
      return !!modal && !modal.classList.contains('hidden');
    }, { timeout: 10000 });

    {
      const statusText = await page.textContent('#contact-status');
      const statusType = await page.getAttribute('#contact-status', 'data-status');
      console.log(`contact-status: [${statusType}] ${statusText && statusText.trim()}`);
    }

    const currentUrl = page.url();
    if (/formspree\.io\/thanks/i.test(currentUrl)) {
      fail(`Unexpected redirect to Formspree thanks page: ${currentUrl}`);
    }

    const modalVisible = await page.evaluate(() => {
      const modal = document.querySelector('#contact-success-modal');
      return !!modal && !modal.classList.contains('hidden');
    });
    if (!modalVisible) fail('Contact success modal should open after inline success.');

    if (submissionPosts.length !== 1) {
      fail(`Expected exactly 1 contact submission POST, saw ${submissionPosts.length}.`);
    }

    const postedToFormspree = submissionPosts[0] && submissionPosts[0].includes(FORMSPREE_URL_PART);
    if (EXPECT_DIRECT_FORMSPREE && !postedToFormspree) {
      fail(`Expected direct Formspree POST, saw ${submissionPosts[0]}`);
    } else if (!EXPECT_DIRECT_FORMSPREE && postedToFormspree) {
      fail(`Expected contact API POST, saw direct Formspree POST: ${submissionPosts[0]}`);
    }

    if (!submissionResponse) fail('No network response observed to contact submission endpoint.');
    else if (!submissionResponse.ok) fail(`Contact submission response not ok (status=${submissionResponse.status}).`);
    else if (EXPECT_DIRECT_FORMSPREE && (!submissionResponse.body || submissionResponse.body.ok !== true || typeof submissionResponse.body.next !== 'string')) {
      fail(`Formspree did not confirm direct AJAX success: ${JSON.stringify(submissionResponse.body)}`);
    } else if (!EXPECT_DIRECT_FORMSPREE && (!submissionResponse.body || submissionResponse.body.success !== true || submissionResponse.body.recorded !== true || !submissionResponse.body.receiptId)) {
      fail(`Contact API did not confirm a recorded receipt: ${JSON.stringify(submissionResponse.body)}`);
    } else if (!EXPECT_DIRECT_FORMSPREE && (!submissionResponse.body.upstream || submissionResponse.body.upstream.ok !== true || !String(submissionResponse.body.upstream.endpoint || '').includes(FORMSPREE_URL_PART))) {
      fail(`Contact API did not confirm the intended Formspree upstream: ${JSON.stringify(submissionResponse.body)}`);
    } else {
      console.log(`Contact submission response: ${submissionResponse.status} ok=${submissionResponse.ok} endpoint=${submissionPosts[0]}`);
    }
  } catch (e) {
    try {
      const statusText = await page.textContent('#contact-status');
      const statusType = await page.getAttribute('#contact-status', 'data-status');
      console.log(`contact-status(at-fail): [${statusType}] ${statusText && statusText.trim()}`);
    } catch (_) {
      // ignore
    }

    if (submissionResponse) {
      console.log(`Contact submission response(at-fail): ${submissionResponse.status} ok=${submissionResponse.ok}`);
      console.log(JSON.stringify(submissionResponse.body));
    }

    fail(String(e));
  } finally {
    if (requestFailures.length) {
      console.log('Request failures:');
      for (const failure of requestFailures) console.log(JSON.stringify(failure));
    }

    if (consoleErrors.length) {
      console.log('Console errors:');
      for (const error of consoleErrors) console.log(error);
    }

    await context.close();
    await browser.close();
    if (serverProc) {
      try { serverProc.kill(); } catch {}
    }
  }

  if (process.exitCode === 1) process.exit(1);
  console.log('PASS: Contact form submission worked in headless browser.');
})();

/* eslint-disable no-console */
/* eslint-disable no-console */
const { chromium } = require('playwright');

const DEFAULT_CONTACT_URL = `https://www.estivanayramia.com/contact?cb=${Date.now()}`;
const CONTACT_URL = process.env.CONTACT_URL || DEFAULT_CONTACT_URL;

const FORMSPREE_URL_PART = 'formspree.io/f/mblbnwoy';
const MOCK_FORMSPREE = process.env.MOCK_FORMSPREE === '1';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Block SW (Service Worker) so stale caches cannot “help” you
  const context = await browser.newContext({
    serviceWorkers: 'block',
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];
  let formspreeRequestSeen = false;
  let formspreeResponse = null;

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

  // CI mode: mock Formspree so you do not spam yourself
  if (MOCK_FORMSPREE) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'accept, content-type, cache-control, pragma',
      'Access-Control-Max-Age': '86400',
    };

    await page.route('https://formspree.io/**', async (route) => {
      const req = route.request();

      if (req.url().includes('formspree.io')) {
        console.log(`MOCK Formspree: ${req.method()} ${req.url()}`);
      }

      // Preflight support (in case any header changes trigger it)
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
        return;
      }

      if (req.url().includes(FORMSPREE_URL_PART) && req.method() === 'POST') {
        formspreeRequestSeen = true;
      }

      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      });
    });

    // Optional coverage if Formspree ever uses api.formspree.io
    await page.route('https://api.formspree.io/**', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      });
    });
  }

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes(FORMSPREE_URL_PART)) {
      formspreeResponse = { url, status: res.status(), ok: res.ok() };
    }
  });

  try {
    console.log(`Visiting: ${CONTACT_URL}`);
    await page.goto(CONTACT_URL, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#contact-form', { state: 'visible', timeout: 15000 });

    // Anti-bot: wait it out
    await page.waitForTimeout(2700);

    const stamp = Date.now();
    await page.fill('#name', 'Automated Test');
    await page.fill('#email', `test+${stamp}@example.com`);
    await page.fill('#message', `Automated submission test at ${new Date(stamp).toISOString()}`);

    await page.click('#contact-form button[type="submit"]');

    // Ensure the submit handler actually ran (it will set data-status quickly)
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

    // Success path opens the modal; status text may be overwritten by cooldown timer.
    await page.waitForSelector('#contact-success-modal:not(.hidden)', { timeout: 30000 });

    {
      const statusText = await page.textContent('#contact-status');
      const statusType = await page.getAttribute('#contact-status', 'data-status');
      console.log(`contact-status: [${statusType}] ${statusText && statusText.trim()}`);
    }

    if (MOCK_FORMSPREE) {
      if (!formspreeRequestSeen) fail('MOCK_FORMSPREE=1 but no POST to Formspree endpoint was observed.');
    } else {
      if (!formspreeResponse) fail('No network response observed to Formspree endpoint.');
      else if (!formspreeResponse.ok) fail(`Formspree response not ok (status=${formspreeResponse.status}).`);
      else console.log(`Formspree response: ${formspreeResponse.status} ok=${formspreeResponse.ok}`);
    }
  } catch (e) {
    try {
      const statusText = await page.textContent('#contact-status');
      const statusType = await page.getAttribute('#contact-status', 'data-status');
      console.log(`contact-status(at-fail): [${statusType}] ${statusText && statusText.trim()}`);
    } catch (e2) {
      // ignore
    }
    if (MOCK_FORMSPREE) {
      console.log(`MOCK_FORMSPREE=1 formspreeRequestSeen=${formspreeRequestSeen}`);
      if (formspreeResponse) {
        console.log(`Formspree response(at-fail): ${formspreeResponse.status} ok=${formspreeResponse.ok}`);
      }
    } else if (formspreeResponse) {
      console.log(`Formspree response(at-fail): ${formspreeResponse.status} ok=${formspreeResponse.ok}`);
    }
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
  }

  if (process.exitCode === 1) process.exit(1);
  console.log('PASS: Contact form submission worked in headless browser.');
})();

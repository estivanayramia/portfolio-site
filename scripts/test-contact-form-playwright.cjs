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
  const context = await browser.newContext({
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];
  const formspreePosts = [];
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

  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes(FORMSPREE_URL_PART)) {
      formspreePosts.push(req.url());
    }
  });

  if (MOCK_FORMSPREE) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'accept, content-type, cache-control, pragma',
      'Access-Control-Max-Age': '86400',
    };

    await page.route('https://formspree.io/**', async (route) => {
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
    if (res.url().includes(FORMSPREE_URL_PART)) {
      formspreeResponse = { url: res.url(), status: res.status(), ok: res.ok() };
    }
  });

  try {
    console.log(`Visiting: ${CONTACT_URL}`);
    await page.goto(CONTACT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#contact-form', { state: 'visible', timeout: 15000 });

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
      return !!el && /message sent successfully/i.test(el.textContent || '');
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

    if (formspreePosts.length !== 1) {
      fail(`Expected exactly 1 Formspree POST, saw ${formspreePosts.length}.`);
    }

    if (!formspreeResponse) fail('No network response observed to Formspree endpoint.');
    else if (!formspreeResponse.ok) fail(`Formspree response not ok (status=${formspreeResponse.status}).`);
    else console.log(`Formspree response: ${formspreeResponse.status} ok=${formspreeResponse.ok}`);
  } catch (e) {
    try {
      const statusText = await page.textContent('#contact-status');
      const statusType = await page.getAttribute('#contact-status', 'data-status');
      console.log(`contact-status(at-fail): [${statusType}] ${statusText && statusText.trim()}`);
    } catch (_) {
      // ignore
    }

    if (formspreeResponse) {
      console.log(`Formspree response(at-fail): ${formspreeResponse.status} ok=${formspreeResponse.ok}`);
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
  }

  if (process.exitCode === 1) process.exit(1);
  console.log('PASS: Contact form submission worked in headless browser.');
})();

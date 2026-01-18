/* eslint-disable no-console */
const { chromium } = require('playwright');

const CONTACT_URL = `https://www.estivanayramia.com/contact?cb=${Date.now()}`;
const FORMSPREE_URL_PART = 'formspree.io/f/mblbnwoy';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Block SW to avoid stale caches affecting behavior
  const context = await browser.newContext({
    serviceWorkers: 'block'
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];

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

  let formspreeResponse = null;

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes(FORMSPREE_URL_PART)) {
      formspreeResponse = {
        url,
        status: res.status(),
        ok: res.ok(),
      };
    }
  });

  try {
    console.log(`Visiting: ${CONTACT_URL}`);
    await page.goto(CONTACT_URL, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#contact-form', { state: 'visible', timeout: 15000 });

    // Wait out anti-bot timer (2.7s)
    await page.waitForTimeout(2700);

    const stamp = Date.now();
    await page.fill('#name', 'Automated Test');
    await page.fill('#email', `test+${stamp}@example.com`);
    await page.fill('#message', `Automated submission test at ${new Date(stamp).toISOString()}`);

    await page.click('#contact-form button[type="submit"]');

    await page.waitForFunction(() => {
      const el = document.querySelector('#contact-status');
      if (!el) return false;
      const t = (el.textContent || '').toLowerCase();
      return t.includes('sent') || t.includes('thanks');
    }, { timeout: 20000 });

    const statusText = await page.textContent('#contact-status');
    console.log(`contact-status: ${statusText && statusText.trim()}`);

    if (!formspreeResponse) {
      fail('No network response observed to Formspree endpoint.');
    } else {
      console.log(`Formspree response: ${formspreeResponse.status} ok=${formspreeResponse.ok}`);
      if (!formspreeResponse.ok) {
        fail(`Formspree response not ok (status=${formspreeResponse.status}).`);
      }
    }

    const modalExists = await page.$('#contact-success-modal');
    if (!modalExists) {
      console.log('Note: #contact-success-modal not found in DOM. If success still works, ignore.');
    }
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
  }

  if (process.exitCode === 1) process.exit(1);
  console.log('PASS: Contact form submission worked in headless browser.');
})();

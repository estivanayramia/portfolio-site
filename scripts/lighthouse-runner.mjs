import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import { getBrowserLaunchConfig } from './browser-path.mjs';

// Default to localhost:5500 if no arg provided
const BASE_URL = process.argv[2] ? process.argv[2].replace(/\/$/, '') : 'http://localhost:5500';
const OUT_DIR = 'lighthouse-results';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'about', path: '/about' },
  { name: 'overview', path: '/overview' },
  { name: 'contact', path: '/contact' },
  { name: 'projects', path: '/projects/' },
];

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

async function waitForUrl(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await fetchStatus(url);
    if (status && status >= 200 && status < 500) return true;
    await sleep(250);
  }
  return false;
}

async function ensureLocalServer(baseUrl) {
  // Only auto-start if we are targeting localhost
  if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
    return { stop: async () => {} };
  }

  const ok = await waitForUrl(baseUrl, 1000); // quick check
  if (ok) return { stop: async () => {} };

  console.log(`Starting local server at ${baseUrl}...`);
  const port = new URL(baseUrl).port || 5500;
  
  const child = spawn(process.execPath, ['scripts/local-serve.js'], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore' 
  });

  const ready = await waitForUrl(baseUrl);
  if (!ready) {
    child.kill();
    throw new Error(`Server failed to start at ${baseUrl}`);
  }

  return {
    stop: () => {
        console.log('Stopping local server...');
        child.kill();
    }
  };
}

async function runAudit() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });

  const server = await ensureLocalServer(BASE_URL);
  
  // Launch Chrome via Puppeteer to ensure we use the correct binary
  const launchConfig = getBrowserLaunchConfig();
  const PORT = 9222;
  
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: launchConfig.executablePath,
    args: [
        ...launchConfig.args, 
        `--remote-debugging-port=${PORT}`,
        '--no-sandbox', 
        '--disable-setuid-sandbox'
    ]
  });

  console.log(`Lighthouse audit targeting: ${BASE_URL}`);

  try {
    const options = {
        port: PORT,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    };

    // Desktop config based on LR desktop config
    const desktopConfig = {
        extends: 'lighthouse:default',
        settings: {
            formFactor: 'desktop',
            screenEmulation: {
                mobile: false,
                width: 1350,
                height: 940,
                deviceScaleFactor: 1,
                disabled: false,
            },
        }
    };

    for (const page of PAGES) {
        const url = new URL(page.path, BASE_URL).href;
        console.log(`Auditing ${page.name} (${url})...`);

        // Mobile
        const mobileResult = await lighthouse(url, options);
        await fs.promises.writeFile(
            path.join(OUT_DIR, `mobile-${page.name}.report.json`), 
            mobileResult.report
        );
        
        // Desktop
        const desktopResult = await lighthouse(url, options, desktopConfig);
        await fs.promises.writeFile(
             path.join(OUT_DIR, `desktop-${page.name}.report.json`), 
             desktopResult.report
        );
    }
    console.log('Audit complete.');

  } finally {
    await browser.close();
    server.stop();
  }
}

runAudit().catch(err => {
    console.error(err);
    process.exit(1);
});

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { getBrowserLaunchConfig } from './browser-path.mjs';

const ROUTES = ['/', '/about', '/overview', '/contact', '/projects/'];

const BASE_URL = process.env.BASE_URL || 'http://localhost:5500';
const IS_JANK_MODE = process.argv.includes('--jank');

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

  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});

  const ready = await waitForUrl(baseUrl);
  if (!ready) {
    try { child.kill(); } catch {}
    throw new Error(`Local server did not become ready at ${baseUrl}`);
  }

  return {
    stop: async () => {
      try { child.kill('SIGTERM'); } catch {}
      await sleep(300);
      try { if (!child.killed) child.kill('SIGKILL'); } catch {}
    },
  };
}

// Original Sanity Check
async function checkRoute(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3100);

  const stuck = await page.evaluate(() => document.documentElement.classList.contains('gsap-prep'));
  if (stuck) {
    throw new Error(`gsap-prep still present after 3s: ${url}`);
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await sleep(1200);

  const result = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-gsap]'));
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    
    // ... helper ...
    const parseTy = (transform) => { 
      try {
        if (!transform || transform === 'none') return 0;
        const m = transform.match(/^matrix\(([^)]+)\)$/);
        if (m) {
          const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
          return parts.length === 6 ? parts[5] : 0;
        }
        return 0;
      } catch { return 0; }
    };

    let hiddenNear = 0;
    const samples = [];
    
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
          samples.push({ tag: el.tagName, top: rect.top, opacity, transform: cs.transform });
      }
    }
    return { hiddenNear, total: els.length, samples };
  });

  if (result.hiddenNear !== 0) {
    throw new Error(
      `Hidden [data-gsap] near viewport after scroll on ${url}: ${result.hiddenNear}\n` +
      JSON.stringify(result.samples, null, 2)
    );
  }
}

// Jank Check
async function checkJank(page, url) {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);

    const result = await page.evaluate(async () => {
        // Selection Logic
        const candidates = [
            ...Array.from(document.querySelectorAll('[data-gsap]')).slice(0, 25),
            ...Array.from(document.querySelectorAll('h1, .hero-section, main > section:first-child')),
            ...Array.from(document.querySelectorAll('*')).filter(el => {
                 const wc = getComputedStyle(el).willChange;
                 return wc.includes('transform') || wc.includes('opacity');
            })
        ];
        const uniqueEl = [...new Set(candidates)];
        
        const history = uniqueEl.map(el => ({
             tag: (el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className ? '.'+el.className.split(' ')[0] : '')),
             frames: [],
             spikes: 0,
             maxSpike: 0
        }));

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const vh = window.innerHeight;
        
        // Controlled Scroll
        for (let i = 0; i <= 10; i++) {
            // Scroll step
            window.scrollTo(0, (i / 10) * (vh * 1.2));
            await sleep(100); // Settle
            
            // Sample Frames
            for (let f=0; f<20; f++) {
                const now = performance.now();
                uniqueEl.forEach((el, idx) => {
                    const rect = el.getBoundingClientRect();
                    history[idx].frames.push({
                        time: now,
                        top: rect.top
                    });
                });
                await new Promise(r => requestAnimationFrame(r));
            }
        }
        
        // Analysis
        const THRESHOLD = Number(process.env.JANK_THRESHOLD) || 50; // px jump; override via JANK_THRESHOLD env var
        const fails = [];
        let worstSelector = '-';
        let worstSpikeValue = 0;
        let framesOver = 0;

        history.forEach(item => {
             let itemSpikes = 0;
             let maxDelta = 0;
             
             for (let i=1; i<item.frames.length; i++) {
                 const prev = item.frames[i-1];
                 const curr = item.frames[i];
                 if (curr.time - prev.time > 100) continue; // Skip gaps (scrolling happened between)
                 
                 const delta = Math.abs(curr.top - prev.top);
                 if (delta > maxDelta) maxDelta = delta;
                 if (delta > THRESHOLD) itemSpikes++;
             }
             
             if (itemSpikes >= 2) {
                 fails.push({ selector: item.tag, spikes: itemSpikes, maxDelta });
                 framesOver += itemSpikes;
                 if (maxDelta > worstSpikeValue) {
                     worstSpikeValue = maxDelta;
                     worstSelector = item.tag;
                 }
             }
        });
        
        return { fails, worstSelector, worstSpikeValue, framesOver };
    });
    
    return {
        url,
        ...result,
        pass: result.fails.length === 0
    };
}

async function main() {
  let stopServer = async () => {};
  try {
    const srv = await ensureLocalServer(BASE_URL);
    stopServer = srv.stop;

    const launchConfig = getBrowserLaunchConfig();
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: launchConfig.executablePath,
      args: launchConfig.args
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      if (IS_JANK_MODE) {
          console.log('Animation Jank Detector');
          console.log('='.repeat(80));
          console.log('route      | worstSelector                | worstSpikeValue | framesOver | pass/fail');
          console.log('-----------|------------------------------|-----------------|------------|----------');
          
          let anyFail = false;
          for (const route of ROUTES) {
              const url = `${BASE_URL}${route}`;
              try {
                  const res = await checkJank(page, url);
                  const status = res.pass ? 'PASS' : 'FAIL';
                  if (!res.pass) anyFail = true;
                  
                  console.log(`${route.padEnd(10)} | ${res.worstSelector.slice(0, 28).padEnd(28)} | ${res.worstSpikeValue.toFixed(1).padEnd(15)} | ${String(res.framesOver).padEnd(10)} | ${status}`);
              } catch (e) {
                  console.log(`${route.padEnd(10)} | ERROR: ${e.message.slice(0, 20)}...`);
                  anyFail = true;
              }
          }
          if (anyFail) process.exit(1);

      } else {
         // Sanity Mode
         for (const route of ROUTES) {
            const url = `${BASE_URL}${route}`;
            await checkRoute(page, url);
         }
         console.log('Animation sanity check passed.');
      }

    } finally {
      await browser.close();
    }
  } finally {
    await stopServer();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

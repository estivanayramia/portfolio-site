const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    try {
      const args = msg.args();
      Promise.all(args.map(a => a.jsonValue())).then(vals => console.log('PAGE_CONSOLE>', ...vals));
    } catch (e) {
      console.log('PAGE_CONSOLE>', msg.text());
    }
  });

  page.on('pageerror', err => console.log('PAGE_ERROR>', err.toString()));

  // simple sleep helper (some Puppeteer distributions lack page.waitForTimeout)
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  const url = 'http://localhost:8000/hobbies-games.html?collect-logs=1';
  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // Start Invaders via global startGame
  await page.evaluate(() => {
    if (window.startGame) startGame('invaders');
  });

  // Immediately inspect whether initInvaders exists and invaderRunning toggled
  const immediate = await page.evaluate(() => {
    return {
      hasInit: typeof initInvaders !== 'undefined',
      invaderRunningNow: typeof invaderRunning !== 'undefined' ? invaderRunning : null,
      invaderGameStartedNow: typeof invaderGameStarted !== 'undefined' ? invaderGameStarted : null
    };
  });
  console.log('Immediate after startGame:', immediate);

  // Wait for invaders canvas and some time for init
  await page.waitForSelector('#invaders-canvas', { timeout: 5000 });
  // Wait for countdown (3s) to finish and initInvaders to run
  await sleep(3500);

  // Capture a snapshot of alien positions and bullets
  const snapshot1 = await page.evaluate(() => {
    try {
      return {
        aliensCount: Array.isArray(aliens) ? aliens.length : null,
        aliensSample: Array.isArray(aliens) ? aliens.slice(0,6).map(a=>({x:a.x,y:a.y,active:a.active})) : null,
        alienDir: typeof alienDir !== 'undefined' ? alienDir : null,
        alienSpeed: typeof alienSpeed !== 'undefined' ? alienSpeed : null,
        bulletsCount: Array.isArray(bullets) ? bullets.length : null,
        bulletsSample: Array.isArray(bullets) ? bullets.slice(0,6) : null
      };
    } catch (e) { return { error: String(e) }; }
  });
  console.log('Snapshot 1:', JSON.stringify(snapshot1, null, 2));

  // Simulate right arrow press to start movement
  console.log('Sending ArrowRight down/up');
  await page.keyboard.down('ArrowRight');
  await sleep(200);
  await page.keyboard.up('ArrowRight');
  await sleep(200);

  // Press Space to shoot
  console.log('Pressing Space');
  await page.keyboard.press('Space');
  await sleep(500);

  // Simulate left arrow
  console.log('Sending ArrowLeft down/up');
  await page.keyboard.down('ArrowLeft');
  await sleep(200);
  await page.keyboard.up('ArrowLeft');
  await sleep(200);

  // Capture a second snapshot to see movement
  const snapshot2 = await page.evaluate(() => {
    try {
      return {
        aliensCount: Array.isArray(aliens) ? aliens.length : null,
        aliensSample: Array.isArray(aliens) ? aliens.slice(0,6).map(a=>({x:a.x,y:a.y,active:a.active})) : null,
        alienDir: typeof alienDir !== 'undefined' ? alienDir : null,
        alienSpeed: typeof alienSpeed !== 'undefined' ? alienSpeed : null,
        bulletsCount: Array.isArray(bullets) ? bullets.length : null,
        bulletsSample: Array.isArray(bullets) ? bullets.slice(0,6) : null
      };
    } catch (e) { return { error: String(e) }; }
  });
  console.log('Snapshot 2:', JSON.stringify(snapshot2, null, 2));

  // Collect diagnostics logs from the page
  const collected = await page.evaluate(() => {
    try {
      if (window.__getCollectedLogs) return window.__getCollectedLogs();
      const raw = localStorage.getItem('site_collect_logs');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return { error: String(e) }; }
  });

  console.log('Collected logs length:', Array.isArray(collected) ? collected.length : 'N/A');
  if (Array.isArray(collected)) console.log(JSON.stringify(collected.slice(-20), null, 2));

  // Inspect important invader state variables
  const state = await page.evaluate(() => {
    try {
      return {
        invaderGameStarted: typeof invaderGameStarted !== 'undefined' ? invaderGameStarted : null,
        invaderDir: typeof invaderDir !== 'undefined' ? invaderDir : null,
        invaderRunning: typeof invaderRunning !== 'undefined' ? invaderRunning : null,
        invaderScore: typeof invaderScore !== 'undefined' ? invaderScore : null,
        invaderWave: typeof invaderWave !== 'undefined' ? invaderWave : null
      };
    } catch (e) { return { error: String(e) }; }
  });
  console.log('Invader state:', JSON.stringify(state, null, 2));

  await browser.close();
  console.log('Done');
  process.exit(0);
})();

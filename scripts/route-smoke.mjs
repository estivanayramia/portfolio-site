import { spawn } from 'node:child_process';

// Default to localhost:5500 if no arg provided
const BASE_URL = process.argv[2] ? process.argv[2].replace(/\/$/, '') : 'http://localhost:5500';

const TESTS = [
  { path: '/', status: 200, marker: '<title>' }, // Simple existence check
  { path: '/about', status: 200, marker: '<title>' },
  { path: '/overview', status: 200, marker: '<title>' },
  { path: '/contact', status: 200, marker: '<title>' },
  { path: '/projects', status: 301, location: '/projects/' },
  { path: '/projects/', status: 200, marker: '<title>' },
  { path: '/hobbies', status: 301, location: '/hobbies/' },
  { path: '/hobbies/', status: 200, marker: '<title>' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 2000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function waitForUrl(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
        const res = await fetchWithTimeout(url);
        if (res.status >= 200 && res.status < 500) return true;
    } catch {}
    await sleep(250);
  }
  return false;
}

async function ensureLocalServer(baseUrl) {
  if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
    return { stop: async () => {} };
  }

  // Probe to see if already up
  try {
      const res = await fetchWithTimeout(baseUrl, {}, 1000);
      if (res.status >= 200) return { stop: async () => {} };
  } catch {}

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
    } // No-op for now unless we really want to kill shared server? 
      // Actually usually better to kill it if we started it.
      // But for simplicity/safety I'll define stop() to kill it.
  };
}

async function main() {
  console.log('Route Parity Smoke Test');
  console.log('='.repeat(40));
  
  let server;
  try {
      server = await ensureLocalServer(BASE_URL);
  } catch (e) {
      console.error(e.message);
      process.exit(1);
  }
  
  // Need to handle server stop manually in ensureLocalServer if I want to be precise.
  // The current implementation returns a stop function that kills the child it spawned.
  // If it didn't spawn (already running), stop is no-op. Correct.

  console.log('route      | status | location   | marker | pass/fail');
  console.log('-----------|--------|------------|--------|----------');

  let anyFail = false;

  try {
      for (const test of TESTS) {
          const url = new URL(test.path, BASE_URL).href;
          const opts = { redirect: 'manual' };
          
          let res;
          let content = '';
          try {
            res = await fetchWithTimeout(url, opts);
            if (test.status === 200) {
                content = await res.text();
            }
          } catch (e) {
              console.log(`${test.path.padEnd(10)} | ERR    |            |        | FAIL (${e.message})`);
              anyFail = true;
              continue;
          }

          const statusMatch = res.status === test.status;
          const location = res.headers.get('location');
          const locMatch = !test.location || location === test.location;
          const markerMatch = !test.marker || content.includes(test.marker);

          const statusStr = String(res.status).padEnd(6);
          const locStr = (location || '').slice(0, 10).padEnd(10);
          const markStr = test.marker ? (markerMatch ? 'YES' : 'NO') : '-';
          const pass = statusMatch && locMatch && markerMatch;
          
          if (!pass) anyFail = true;

          console.log(`${test.path.padEnd(10)} | ${statusStr} | ${locStr} | ${markStr}    | ${pass ? 'PASS' : 'FAIL'}`);
          
          if (!pass && !statusMatch) console.error(`  Expected status ${test.status}, got ${res.status}`);
          if (!pass && !locMatch) console.error(`  Expected location ${test.location}, got ${location}`);
          if (!pass && !markerMatch) console.error(`  Marker '${test.marker}' not found`);
      }
  } finally {
      if (server) server.stop();
  }

  if (anyFail) {
      console.error('\nSmoke Test Failed.');
      process.exit(1);
  } else {
      console.log('\nSmoke Test Passed.');
  }

}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

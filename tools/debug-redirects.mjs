import fs from 'node:fs';

async function traceRedirects(url, maxDepth = 10) {
  /** @type {{url?: string, status?: number, location?: string|null, server?: string|null, cfRay?: string|null, error?: string, loopUrl?: string}[]} */
  const chain = [];
  let currentUrl = url;

  for (let i = 0; i < maxDepth; i++) {
    try {
      const result = await fetch(currentUrl, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Debug Bot)' },
      });

      const location = result.headers.get('location');
      chain.push({
        url: currentUrl,
        status: result.status,
        location,
        server: result.headers.get('server'),
        cfRay: result.headers.get('cf-ray'),
      });

      if (result.status >= 300 && result.status < 400) {
        if (!location) break;
        const nextUrl = new URL(location, currentUrl).href;

        if (chain.some((c) => c.url === nextUrl)) {
          chain.push({ error: 'LOOP DETECTED', loopUrl: nextUrl });
          break;
        }

        currentUrl = nextUrl;
      } else {
        break;
      }
    } catch (err) {
      chain.push({ url: currentUrl, error: err?.message || String(err) });
      break;
    }
  }

  return chain;
}

function loadTestUrlsFromMatrix() {
  try {
    const raw = fs.readFileSync(new URL('../.reports/test_matrix.json', import.meta.url), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.urls_to_test) && parsed.urls_to_test.length) return parsed.urls_to_test;
  } catch {
    try {
      const raw = fs.readFileSync(new URL('../test_matrix.json', import.meta.url), 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.urls_to_test) && parsed.urls_to_test.length) return parsed.urls_to_test;
    } catch {
      // ignore
    }
  }
  return null;
}

const cliUrls = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const matrixUrls = loadTestUrlsFromMatrix();
const testUrls =
  cliUrls.length > 0
    ? cliUrls
    : matrixUrls || [
        'http://estivanayramia.com',
        'https://estivanayramia.com',
        'http://www.estivanayramia.com',
        'https://www.estivanayramia.com',
      ];

console.log('=== REDIRECT CHAIN ANALYSIS ===\n');
for (const url of testUrls) {
  console.log(`Testing: ${url}`);
  const chain = await traceRedirects(url);
  console.log(JSON.stringify(chain, null, 2));
  console.log('\n---\n');
}

import fs from 'node:fs';
import path from 'node:path';

function log(msg) {
  process.stdout.write(`[health-check] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[health-check] ${msg}\n`);
  process.exit(1);
}

function readJsonIfExists(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseRedirectsFile(redirectsPath) {
  const raw = fs.readFileSync(redirectsPath, 'utf8');
  const rules = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Cloudflare Pages style: FROM  TO  STATUS
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;
    const [from, to, status] = parts;
    rules.push({ from, to, status, raw: trimmed });
  }

  return rules;
}

function staticRedirectAudit() {
  const repoRoot = process.cwd();
  const redirectsPath = path.join(repoRoot, '_redirects');

  if (!fs.existsSync(redirectsPath)) {
    fail('Missing _redirects at repo root.');
  }

  const rules = parseRedirectsFile(redirectsPath);

  // This site is a multi-page static export. Avoid catch-all rules that swallow
  // real files (/, /assets/*, /404.html) and can cause redirect loops on Pages.
  const catchAll = rules.find((r) => r.from === '/*');
  if (catchAll) {
    fail(`Catch-all rule is not allowed for this site: ${catchAll.raw}`);
  }

  // Detect immediate ping-pong loops among 301 rules (A->B and B->A)
  const redirects301 = rules.filter((r) => r.status === '301');
  const map = new Map();
  for (const r of redirects301) map.set(r.from, r.to);

  const loops = [];
  for (const r of redirects301) {
    const back = map.get(r.to);
    if (back && back === r.from) {
      loops.push(`${r.from} <-> ${r.to}`);
    }
  }

  if (loops.length) {
    fail(`301 redirect loop(s) detected in _redirects: ${[...new Set(loops)].join(', ')}`);
  }

  log('Static _redirects audit OK (no catch-all, no direct 301 ping-pong loops).');
}

async function traceRedirects(url, maxRedirects = 5) {
  let currentUrl = url;
  let redirectCount = 0;
  const visited = new Set();

  while (redirectCount < maxRedirects) {
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Health Check Bot)' },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { ok: true, redirects: redirectCount, finalUrl: currentUrl };

      const nextUrl = new URL(location, currentUrl).href;
      if (visited.has(nextUrl)) {
        throw new Error(`REDIRECT LOOP DETECTED: ${url} -> ${nextUrl}`);
      }

      visited.add(currentUrl);
      currentUrl = nextUrl;
      redirectCount++;
      continue;
    }

    return { ok: true, redirects: redirectCount, finalUrl: currentUrl, status: response.status };
  }

  throw new Error(`Too many redirects: ${redirectCount}`);
}

async function liveRedirectAudit() {
  const repoRoot = process.cwd();
  const matrixPath = path.join(repoRoot, 'test_matrix.json');
  const matrix = readJsonIfExists(matrixPath);

  const urls =
    (Array.isArray(matrix?.urls_to_test) && matrix.urls_to_test.length
      ? matrix.urls_to_test
      : [
          'https://estivanayramia.com',
          'https://www.estivanayramia.com',
          'https://estivanayramia.com/about',
        ]);

  for (const url of urls) {
    try {
      const result = await traceRedirects(url, 5);
      log(`✅ ${url}: ${result.redirects} redirects, final: ${result.finalUrl} (status ${result.status ?? 'n/a'})`);
    } catch (err) {
      fail(`❌ ${url}: ${err?.message || String(err)}`);
    }
  }

  log('Live redirect audit OK.');
}

staticRedirectAudit();

if (process.env.REDIRECT_CHECK_LIVE === '1') {
  await liveRedirectAudit();
} else {
  log('Skipping live redirect audit (set REDIRECT_CHECK_LIVE=1 to enable).');
}

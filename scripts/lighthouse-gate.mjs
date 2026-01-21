
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '..', 'lighthouse-results');

const CATEGORIES = [
  { key: 'performance', label: 'Performance' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'best-practices', label: 'Best Practices' },
  { key: 'seo', label: 'SEO' }
];

function parseBool(v, def = false) {
  if (v == null) return def;
  const s = String(v).trim().toLowerCase();
  if (["1","true","yes","y","on"].includes(s)) return true;
  if (["0","false","no","n","off",""].includes(s)) return false;
  return def;
}

function parseMinScore(v, def01) {
  if (v == null || String(v).trim() === '') return def01;
  const n = Number(v);
  if (!Number.isFinite(n)) return def01;
  if (n <= 1) return Math.max(0, Math.min(1, n));
  return Math.max(0, Math.min(1, n / 100));
}

function score01(report, catKey) {
  const s = report?.categories?.[catKey]?.score;
  return typeof s === 'number' && Number.isFinite(s) ? s : 0;
}

async function main() {
  if (!fs.existsSync(RESULTS_DIR)) {
    console.error(`Error: ${RESULTS_DIR} missing. Run npm run audit:lighthouse:local first.`);
    process.exit(1);
  }
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.report.json'));
  if (files.length === 0) {
    console.error('Error: No report JSON files found.');
    process.exit(1);
  }

  // Thresholds
  const minPerf = parseMinScore(process.env.LH_MIN_PERF, 1.0);
  const minA11y = parseMinScore(process.env.LH_MIN_A11Y, 1.0);
  const minBP = parseMinScore(process.env.LH_MIN_BP, 1.0);
  const minSEO = parseMinScore(process.env.LH_MIN_SEO, 1.0);
  const enforcePerf = parseBool(process.env.LH_ENFORCE_PERF, false);

  console.log('Lighthouse Gate Thresholds:');
  console.log(`  LH_MIN_PERF=${minPerf} (${(minPerf*100).toFixed(0)}%)  LH_MIN_A11Y=${minA11y} (${(minA11y*100).toFixed(0)}%)  LH_MIN_BP=${minBP} (${(minBP*100).toFixed(0)}%)  LH_MIN_SEO=${minSEO} (${(minSEO*100).toFixed(0)}%)  LH_ENFORCE_PERF=${enforcePerf}`);
  console.log('');

  let anyNonPerfFail = false;
  let anyPerfBelow = false;

  console.log('path       | device  | perf | a11y | bp   | seo  | perfStatus | pass/fail');
  console.log('-----------|---------|------|------|------|------|------------|----------');

  for (const file of files) {
    const content = fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8');
    const report = JSON.parse(content);
    const parts = file.split('-');
    const device = parts[0];
    const pagePath = parts.slice(1).join('-').replace('.report.json', '');

    const perf = score01(report, 'performance');
    const a11y = score01(report, 'accessibility');
    const bp = score01(report, 'best-practices');
    const seo = score01(report, 'seo');

    const nonPerfFailThis = (a11y < minA11y) || (bp < minBP) || (seo < minSEO);
    const perfBelowThis = perf < minPerf;

    if (nonPerfFailThis) anyNonPerfFail = true;
    if (perfBelowThis) anyPerfBelow = true;

    let perfStatus = 'PASS';
    if (perfBelowThis) perfStatus = enforcePerf ? 'FAIL' : 'WARN';
    const overall = nonPerfFailThis ? 'FAIL' : (perfBelowThis && enforcePerf ? 'FAIL' : (perfBelowThis ? 'WARN' : 'PASS'));

    const fmt = n => (n * 100).toFixed(0).padStart(3);
    console.log(`${pagePath.padEnd(10)} | ${device.padEnd(7)} | ${fmt(perf)}  | ${fmt(a11y)}  | ${fmt(bp)}  | ${fmt(seo)}  | ${perfStatus.padEnd(10)} | ${overall}`);
  }

  if (anyNonPerfFail) process.exit(1);
  if (anyPerfBelow && enforcePerf) process.exit(1);
  if (anyPerfBelow && !enforcePerf) {
    console.warn('\nLighthouse Gate: Performance below threshold (WARN), but other categories pass.');
    process.exit(0);
  }
  process.exit(0);
}

main();

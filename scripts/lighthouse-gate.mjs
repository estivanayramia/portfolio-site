
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
  const ensureReports = () => {
    if (!fs.existsSync(RESULTS_DIR)) return [];
    return fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.report.json'));
  };

  let files = ensureReports();
  if (files.length === 0) {
    console.log('No lighthouse reports found; generating fresh reports...');
    try {
      fs.rmSync(RESULTS_DIR, { recursive: true, force: true });
    } catch {}

    const runnerPath = path.join(__dirname, 'lighthouse-runner.mjs');
    const baseUrl = process.env.LH_BASE_URL || process.env.BASE_URL;
    const args = [runnerPath];
    if (baseUrl) args.push(baseUrl);

    const res = spawnSync(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
    });

    if (res.status !== 0) {
      console.error(`Error: lighthouse runner failed (exit=${res.status}).`);
      process.exit(res.status || 1);
    }

    files = ensureReports();
    if (files.length === 0) {
      console.error(`Error: No report JSON files found after running lighthouse.`);
      process.exit(1);
    }
  }

  // Thresholds with warnings for misconfig
  function warnEnv(name, value, def, type) {
    if (value == null || String(value).trim() === '') {
      console.warn(`Warning: ${name} is not set. Defaulting to ${def}.`);
      return;
    }
    if (type === 'score') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        console.warn(`Warning: ${name} is not a valid number (0-1 or 0-100). Defaulting to ${def}.`);
      }
    } else if (type === 'bool') {
      const s = String(value).trim().toLowerCase();
      if (!["1","true","yes","y","on","0","false","no","n","off",""].includes(s)) {
        console.warn(`Warning: ${name} is not a recognized boolean. Defaulting to ${def}.`);
      }
    }
  }

  warnEnv('LH_MIN_PERF', process.env.LH_MIN_PERF, 0.9, 'score');
  warnEnv('LH_MIN_A11Y', process.env.LH_MIN_A11Y, 0.95, 'score');
  warnEnv('LH_MIN_BP', process.env.LH_MIN_BP, 0.95, 'score');
  warnEnv('LH_MIN_SEO', process.env.LH_MIN_SEO, 0.95, 'score');
  warnEnv('LH_ENFORCE_PERF', process.env.LH_ENFORCE_PERF, false, 'bool');

  const minPerf = parseMinScore(process.env.LH_MIN_PERF, 0.9);
  const minA11y = parseMinScore(process.env.LH_MIN_A11Y, 0.95);
  const minBP = parseMinScore(process.env.LH_MIN_BP, 0.95);
  const minSEO = parseMinScore(process.env.LH_MIN_SEO, 0.95);
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

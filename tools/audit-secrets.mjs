import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const IGNORE_DIRS = new Set(['.git', '.reports', 'node_modules', 'lighthouse-results']);

const SCAN_TARGETS = [
  'EN',
  'es',
  'ar',
  'assets',
  'worker',
  'sw.js',
  'theme.css',
  '_headers',
  '_redirects',
  'package.json',
];

/** @type {Array<{name: string, re: RegExp}>} */
const PATTERNS = [
  { name: 'Google API key', re: /AIza[0-9A-Za-z-_]{20,}/g },
  { name: 'Private key PEM', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Bearer token', re: /Bearer\s+\S{20,}/g },
];

function toRel(fullPath) {
  return path.relative(ROOT, fullPath).replace(/\\/g, '/');
}

function shouldIgnoreDirName(name) {
  return IGNORE_DIRS.has(name);
}

function walkDir(dir) {
  /** @type {string[]} */
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && shouldIgnoreDirName(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
      continue;
    }
    if (entry.isFile()) results.push(full);
  }
  return results;
}

function isBinaryByExt(relPath) {
  const lower = relPath.toLowerCase();
  const binaryExt = [
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.woff',
    '.woff2',
    '.pdf',
    '.mp4',
    '.mov',
    '.zip',
    '.7z',
    '.gz',
  ];
  return binaryExt.some((ext) => lower.endsWith(ext));
}

function scanFile(fullPath) {
  const rel = toRel(fullPath);
  if (!rel || rel.startsWith('..')) return [];

  // Guardrail must ignore these folders anywhere in path.
  const segments = rel.split('/');
  if (segments.some((s) => IGNORE_DIRS.has(s))) return [];

  if (isBinaryByExt(rel)) return [];

  let text;
  try {
    text = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return [];
  }

  const lines = text.split(/\r?\n/);

  /** @type {Array<{file: string, line: number, pattern: string, match: string}>} */
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];

    for (const p of PATTERNS) {
      const matches = lineText.matchAll(p.re);
      for (const m of matches) {
        if (!m[0]) continue;
        hits.push({ file: rel, line: i + 1, pattern: p.name, match: m[0] });
      }
    }
  }

  return hits;
}

function main() {
  /** @type {string[]} */
  const filesToScan = [];

  for (const target of SCAN_TARGETS) {
    const full = path.join(ROOT, target);
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      filesToScan.push(...walkDir(full));
    } else if (stat.isFile()) {
      filesToScan.push(full);
    }
  }

  /** @type {Array<{file: string, line: number, pattern: string, match: string}>} */
  const hits = [];
  for (const f of filesToScan) hits.push(...scanFile(f));

  if (hits.length === 0) {
    console.log('OK: no secret-like material found');
    process.exit(0);
  }

  console.error('FAIL: secret-like material found');
  for (const h of hits) {
    console.error(`${h.file}:${h.line}: ${h.pattern}: ${h.match}`);
  }
  process.exit(1);
}

main();

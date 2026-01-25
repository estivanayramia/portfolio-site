import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

// Determinism + noise control:
// - Scan tracked files only (git ls-files)
// - Ignore common noise dirs even if they appear in a path
const IGNORE_DIRS = new Set(['.git', '.reports', 'node_modules', 'lighthouse-results']);

/** @type {Array<{name: string, re: RegExp, severity: 'fail' | 'warn'}>} */
const PATTERNS = [
  // High-signal "this might be a real secret" patterns (fail CI)
  { name: 'Google API key (AIza...)', re: /AIza[0-9A-Za-z-_]{20,}/g, severity: 'fail' },
  { name: 'GitHub token (gho_)', re: /gho_[0-9A-Za-z]{10,}/g, severity: 'fail' },
  { name: 'Private key PEM', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'fail' },
  { name: 'Bearer token (long)', re: /Bearer\s+\S{20,}/g, severity: 'fail' },

  // Required scan patterns (informational by default; commonly appear in docs/config)
  { name: 'GEMINI_API_KEY (any case)', re: /gemini_api_key/gi, severity: 'warn' },
  { name: 'x-goog-api-key header', re: /x-goog-api-key/gi, severity: 'warn' },
  { name: 'Gemini endpoint (generativelanguage.googleapis.com)', re: /generativelanguage\.googleapis\.com/gi, severity: 'warn' },
  { name: 'Authorization: Bearer header', re: /authorization\s*:\s*bearer/gi, severity: 'warn' },
];

function toRel(fullPath) {
  return path.relative(ROOT, fullPath).replace(/\\/g, '/');
}

function listTrackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return out
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .sort();
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
      p.re.lastIndex = 0;
      const matches = lineText.matchAll(p.re);
      for (const m of matches) {
        if (!m[0]) continue;
        hits.push({ file: rel, line: i + 1, pattern: p.name, match: m[0], severity: p.severity });
      }
    }
  }

  return hits;
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const failOnWarn = args['fail-on-warn'] === true || args['fail-on-warn'] === 'true';
  const tracked = listTrackedFiles();
  const filesToScan = tracked
    .filter((p) => {
      const segments = p.split('/');
      return !segments.some((s) => IGNORE_DIRS.has(s));
    })
    .map((p) => path.join(ROOT, p));

  /** @type {Array<{file: string, line: number, pattern: string, match: string, severity: 'fail' | 'warn'}>} */
  const hits = [];
  for (const f of filesToScan) hits.push(...scanFile(f));

  hits.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    if (a.pattern !== b.pattern) return a.pattern.localeCompare(b.pattern);
    return a.match.localeCompare(b.match);
  });

  const failHits = hits.filter((h) => h.severity === 'fail');
  const warnHits = hits.filter((h) => h.severity === 'warn');

  if (failHits.length === 0 && warnHits.length === 0) {
    console.log('OK: no secret-like material found');
    process.exit(0);
  }

  if (warnHits.length > 0) {
    console.log('WARN: informational secret-adjacent strings found');
    for (const h of warnHits) {
      console.log(`${h.file}:${h.line}: ${h.pattern}: ${h.match}`);
    }
  }

  if (failHits.length > 0) {
    console.error('FAIL: secret-like material found');
    for (const h of failHits) {
      console.error(`${h.file}:${h.line}: ${h.pattern}: ${h.match}`);
    }
    process.exit(1);
  }

  if (failOnWarn) {
    console.error('FAIL: fail-on-warn enabled and informational matches were found');
    process.exit(1);
  }

  process.exit(0);
}

main();

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function extractCacheVersion(swText) {
  const m = swText.match(/CACHE_VERSION\s*=\s*(["'])([^"']+)\1/);
  return m ? m[2] : null;
}

function getChangedFiles() {
  const out = sh('git diff --name-only origin/main...HEAD');
  return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

export function isCritical(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized === 'sw.js') return false;
  if (/^(?:tests|scripts|tools|docs|\.github)\//u.test(normalized)) return false;
  if (/\.(?:html|css|js|mjs|json|webmanifest|png|jpe?g|webp|svg|ico|woff2?|ttf|otf)$/iu.test(normalized)) return true;
  if (normalized === '_redirects') return true;
  if (normalized === '_headers') return true;
  return false;
}

function latestCommitUnixForPaths(paths) {
  if (!paths.length) return null;
  const args = paths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
  const cmd = `git log -1 --format=%ct origin/main..HEAD -- ${args}`;
  try {
    const out = sh(cmd).trim();
    return out ? Number(out) : null;
  } catch {
    return null;
  }
}

function main() {
  const changed = getChangedFiles();
  const critical = changed.filter(isCritical);

  if (critical.length === 0) {
    process.stdout.write('OK: no critical changes vs origin/main; no CACHE_VERSION bump required.\n');
    process.exit(0);
  }

  const originSw = sh('git show origin/main:sw.js');
  const currentSw = fs.readFileSync('sw.js', 'utf8');

  const originVer = extractCacheVersion(originSw);
  const currentVer = extractCacheVersion(currentSw);

  if (!originVer || !currentVer) {
    process.stderr.write('FAIL: Unable to extract CACHE_VERSION from sw.js (origin or current).\n');
    process.exit(1);
  }

  if (originVer === currentVer) {
    process.stderr.write(`FAIL: CACHE_VERSION not bumped. origin/main=${originVer} current=${currentVer}\n`);
    process.exit(1);
  }

  // Additional safety: ensure sw.js update is at least as recent as the newest critical change.
  const latestCritical = latestCommitUnixForPaths(critical);
  const latestSw = latestCommitUnixForPaths(['sw.js']);
  if (latestCritical && latestSw && latestCritical > latestSw) {
    process.stderr.write('FAIL: Critical files changed after the last sw.js update; bump CACHE_VERSION again.\n');
    process.stderr.write(`Latest critical commit time=${latestCritical}, latest sw.js commit time=${latestSw}\n`);
    process.exit(1);
  }

  process.stdout.write('OK: CACHE_VERSION bumped appropriately for critical changes.\n');
  process.stdout.write(`Critical files (${critical.length}):\n`);
  for (const p of critical) process.stdout.write(`- ${p}\n`);
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

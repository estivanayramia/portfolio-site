import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

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

function normalizePath(p) {
  return (p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function readSwFromRef(ref) {
  return execFileSync('git', ['show', `${ref}:sw.js`], { encoding: 'utf8' });
}

function readSwFromWorktree() {
  return fs.readFileSync('sw.js', 'utf8');
}

function extractCacheVersion(swText) {
  const re = /const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"]\s*;/;
  const m = swText.match(re);
  return m ? m[1] : null;
}

function listChangedFiles(baseRef) {
  const out = execFileSync('git', ['diff', '--name-only', '-z', `${baseRef}...HEAD`], {
    encoding: 'utf8',
  });
  return out
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizePath);
}

function matchesTrigger(file) {
  const f = normalizePath(file);

  const exact = new Set([
    'index.html',
    '_redirects',
    '_headers',
    'assets/js/site.min.js',
    'assets/js/lazy-loader.min.js',
    'assets/css/style.css',
    'sw.js',
  ]);
  if (exact.has(f)) return true;

  const prefixes = ['EN/', 'ar/', 'es/'];
  return prefixes.some((p) => f.startsWith(p));
}

function main() {
  const args = parseArgs(process.argv);
  const baseRef = typeof args['base-ref'] === 'string' ? args['base-ref'] : 'origin/main';
  const headRef = typeof args['head-ref'] === 'string' ? args['head-ref'] : null;
  const changedFilesArg = typeof args['changed-files'] === 'string' ? args['changed-files'] : null;

  // Best-effort: keep origin/main fresh in CI/local, but don't hard-fail if remote isn't available.
  try {
    execFileSync('git', ['fetch', 'origin', 'main', '--quiet'], { stdio: 'ignore' });
  } catch {
    // ignore
  }

  /** @type {string[]} */
  const changedFiles = changedFilesArg
    ? changedFilesArg
        .split(',')
        .map((s) => normalizePath(s.trim()))
        .filter(Boolean)
    : listChangedFiles(baseRef);

  const triggering = [...new Set(changedFiles.filter(matchesTrigger))].sort();

  if (triggering.length === 0) {
    console.log('OK: no SW cache bump required (no triggering files changed)');
    process.exit(0);
  }

  let baseSw;
  try {
    baseSw = readSwFromRef(baseRef);
  } catch (e) {
    console.error(`FAIL: unable to read sw.js from ${baseRef}`);
    console.error(String(e?.message || e));
    process.exit(1);
  }

  let headSw;
  try {
    headSw = headRef ? readSwFromRef(headRef) : readSwFromWorktree();
  } catch (e) {
    console.error(headRef ? `FAIL: unable to read sw.js from ${headRef}` : 'FAIL: unable to read sw.js from working tree');
    console.error(String(e?.message || e));
    process.exit(1);
  }

  const baseVersion = extractCacheVersion(baseSw);
  const headVersion = extractCacheVersion(headSw);

  if (!baseVersion) {
    console.error(`FAIL: could not find CACHE_VERSION in ${baseRef}:sw.js`);
    process.exit(1);
  }

  if (!headVersion) {
    console.error(headRef ? `FAIL: could not find CACHE_VERSION in ${headRef}:sw.js` : 'FAIL: could not find CACHE_VERSION in sw.js (working tree)');
    process.exit(1);
  }

  if (baseVersion === headVersion) {
    console.error('FAIL: SW cache bump required but CACHE_VERSION was not bumped');
    console.error(`base (${baseRef}) CACHE_VERSION=${baseVersion}`);
    console.error(`head (${headRef || 'worktree'}) CACHE_VERSION=${headVersion}`);
    console.error('Triggering changed files:');
    for (const f of triggering) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log('OK: SW cache bump satisfied');
  console.log(`base (${baseRef}) CACHE_VERSION=${baseVersion}`);
  console.log(`head (${headRef || 'worktree'}) CACHE_VERSION=${headVersion}`);
  console.log('Triggering changed files:');
  for (const f of triggering) console.log(`- ${f}`);
}

main();

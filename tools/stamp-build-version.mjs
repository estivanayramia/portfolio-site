#!/usr/bin/env node
/**
 * Stamp build/version metadata into static assets.
 *
 * Why: Prevent stale client caching (SW) and make deployed buildVersion reflect the actual deploy.
 *
 * Updates:
 * - All tracked *.html files: <meta name="build-version" content="...">
 * - sw.js: CACHE_VERSION constant
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8').trim();
}

function computeBuildVersion() {
  const sha =
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    '';

  let shortSha = '';
  if (sha && typeof sha === 'string') shortSha = sha.slice(0, 7);

  if (!shortSha) {
    try {
      shortSha = run('git rev-parse --short HEAD');
    } catch {
      shortSha = 'local';
    }
  }

  const d = new Date();
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const date = `${y}${m}${day}`;

  return `${date}-${shortSha}`;
}

function updateFile(path, updater) {
  const before = readFileSync(path, 'utf8');
  const after = updater(before);
  if (after !== before) writeFileSync(path, after, 'utf8');
  return after !== before;
}

function listTrackedHtmlFiles() {
  // Avoid scanning node_modules; rely on git index.
  const out = run('git ls-files "*.html"');
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function stampHtmlBuildVersion(files, version) {
  const metaRe = /(<meta\s+[^>]*name=["']build-version["'][^>]*content=["'])([^"']*)(["'][^>]*>)/gi;

  let changed = 0;
  for (const f of files) {
    const didChange = updateFile(f, (src) => {
      if (!metaRe.test(src)) return src;
      metaRe.lastIndex = 0;
      return src.replace(metaRe, `$1${version}$3`);
    });
    if (didChange) changed++;
  }
  return changed;
}

function stampServiceWorker(version) {
  const swPath = 'sw.js';
  const cacheRe = /(const\s+CACHE_VERSION\s*=\s*['"])([^'"]+)(['"];)/;
  return updateFile(swPath, (src) => {
    if (!cacheRe.test(src)) return src;
    const next = `v${version}-dashboard-bypass`;
    return src.replace(cacheRe, `$1${next}$3`);
  });
}

function main() {
  const version = computeBuildVersion();

  const htmlFiles = listTrackedHtmlFiles();
  const htmlChanged = stampHtmlBuildVersion(htmlFiles, version);
  const swChanged = stampServiceWorker(version);

  // eslint-disable-next-line no-console
  console.log(`[stamp-build-version] version=${version} htmlChanged=${htmlChanged} swChanged=${swChanged ? 1 : 0}`);
}

main();

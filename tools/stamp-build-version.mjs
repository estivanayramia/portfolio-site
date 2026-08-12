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
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

  let date = '';
  try {
    date = run('git show -s --format=%cd --date=format:%Y%m%d HEAD');
  } catch {
    const d = new Date();
    const y = String(d.getUTCFullYear());
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    date = `${y}${m}${day}`;
  }

  return `${date}-${shortSha}`;
}

function updateFile(path, updater) {
  const before = readFileSync(path, 'utf8');
  const after = updater(before);
  if (after !== before) writeFileSync(path, after, 'utf8');
  return after !== before;
}

function listTrackedHtmlFiles() {
  try {
    const tracked = run('git ls-files -z -- "*.html"')
      .split('\0')
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    if (tracked.length > 0) return tracked;
  } catch {}

  const rootDir = process.cwd();
  const files = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(entry.name);
    }
  }

  const walk = (dirPath, prefix) => {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const absolutePath = path.join(dirPath, entry.name);
      const relativePath = `${prefix}/${entry.name}`;

      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(relativePath);
      }
    }
  };

  for (const folder of ['EN', 'ar', 'es', 'assets/MiniGames']) {
    const absoluteDir = path.join(rootDir, folder);
    if (existsSync(absoluteDir)) {
      walk(absoluteDir, folder);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function stampHtmlBuildVersion(files, version) {
  const metaRe = /(<meta\s+[^>]*name=["']build-version["'][^>]*content=["'])([^"']*)(["'][^>]*>)/gi;

  let changed = 0;
  for (const f of files) {
    const didChange = updateFile(f, (src) => {
      if (metaRe.test(src)) {
        metaRe.lastIndex = 0;
        return src.replace(metaRe, `$1${version}$3`);
      }

      metaRe.lastIndex = 0;
      const headMatch = /<head(?:\s[^>]*)?>/i.exec(src);
      if (!headMatch) {
        throw new Error(`[stamp-build-version] Missing <head> in ${f}`);
      }

      const insertAt = headMatch.index + headMatch[0].length;
      const before = src.slice(0, insertAt);
      const after = src.slice(insertAt);
      const lineLayout = /^(\r?\n)([\t ]*)/.exec(after);
      const lineBreak = lineLayout?.[1] || (src.includes('\r\n') ? '\r\n' : '\n');
      const indent = lineLayout?.[2] || '  ';
      const meta = `<meta name="build-version" content="${version}">`;

      if (lineLayout) {
        return `${before}${lineBreak}${indent}${meta}${after}`;
      }
      return `${before}${lineBreak}${indent}${meta}${lineBreak}${indent}${after}`;
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
    const next = `v${version}`;
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

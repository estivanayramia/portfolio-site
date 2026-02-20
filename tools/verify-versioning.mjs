#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function getCurrentSha() {
  try {
    return run('git rev-parse --short HEAD');
  } catch {
    console.error('[verify-versioning] ERROR: failed to resolve git SHA. Are you in a git repository?');
    process.exit(1);
  }
}

function getTrackedHtmlFiles() {
  const out = run('git ls-files "*.html"');
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

function main() {
  const sha = getCurrentSha();
  const files = getTrackedHtmlFiles();
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const regex = /\?v=([a-f0-9]+)/g;
    let match = regex.exec(content);

    while (match) {
      const foundSha = match[1];
      if (foundSha !== sha) {
        const line = getLineNumber(content, match.index);
        violations.push({ file, line, foundSha });
      }
      match = regex.exec(content);
    }
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `[verify-versioning] FAIL: ${violation.file} line ${violation.line} has ?v=${violation.foundSha} (expected ?v=${sha})`,
      );
    }
    console.error(
      `[verify-versioning] FAIL: ${violations.length} stale version strings found — run npm run apply:versioning`,
    );
    process.exit(1);
  }

  console.log(`[verify-versioning] ✅ All ?v= strings match SHA ${sha} across ${files.length} files`);
}

main();

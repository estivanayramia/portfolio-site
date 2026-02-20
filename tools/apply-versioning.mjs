#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function getCurrentSha() {
  try {
    return run('git rev-parse --short HEAD');
  } catch {
    console.error('[apply-versioning] ERROR: failed to resolve git SHA. Are you in a git repository?');
    process.exit(1);
  }
}

function getTrackedHtmlFiles() {
  const out = run('git ls-files "*.html"');
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function main() {
  const sha = getCurrentSha();
  const files = getTrackedHtmlFiles();

  let updatedFiles = 0;
  let totalReplacements = 0;

  for (const file of files) {
    const original = readFileSync(file, 'utf8');
    const matches = original.match(/\?v=[a-f0-9]+/g) || [];
    if (matches.length === 0) continue;

    const content = original.replace(/\?v=[a-f0-9]+/g, `?v=${sha}`);
    if (content !== original) {
      writeFileSync(file, content, 'utf8');
      updatedFiles += 1;
      totalReplacements += matches.length;
    }
  }

  const skippedFiles = files.length - updatedFiles;
  console.log(`[apply-versioning] SHA: ${sha}`);
  console.log(`[apply-versioning] Updated ${updatedFiles} files, ${totalReplacements} replacements total`);
  console.log(`[apply-versioning] Skipped ${skippedFiles} files (no ?v= strings or already current)`);
}

main();

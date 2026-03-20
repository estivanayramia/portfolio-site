#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

  for (const folder of ['EN', 'ar', 'es']) {
    const absoluteDir = path.join(rootDir, folder);
    if (existsSync(absoluteDir)) {
      walk(absoluteDir, folder);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
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

#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function getAcceptableShas() {
  const shas = new Set();
  try {
    shas.add(run('git rev-parse --short HEAD'));
  } catch {
    console.error('[verify-versioning] ERROR: failed to resolve git SHA. Are you in a git repository?');
    process.exit(1);
  }
  try {
    shas.add(run('git rev-parse --short HEAD~1'));
  } catch {
    /* first commit or shallow clone */
  }
  return shas;
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

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') line += 1;
  }
  return line;
}

function main() {
  const acceptableShas = getAcceptableShas();
  const shaLabel = [...acceptableShas].join(' or ');
  const files = getTrackedHtmlFiles();
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const regex = /\?v=([^"' >]+)/g;
    let match = regex.exec(content);

    while (match) {
      const foundVersion = match[1];
      if (!acceptableShas.has(String(foundVersion || '').trim())) {
        const line = getLineNumber(content, match.index);
        violations.push({ file, line, foundVersion });
      }
      match = regex.exec(content);
    }
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `[verify-versioning] FAIL: ${violation.file} line ${violation.line} has ?v=${violation.foundVersion} (expected exact ?v=${shaLabel})`,
      );
    }
    console.error(`[verify-versioning] FAIL: ${violations.length} stale or malformed version strings found — run npm run apply:versioning`);
    process.exit(1);
  }

  console.log(`[verify-versioning] OK. All ?v= strings match exact SHA ${shaLabel} across ${files.length} files`);
}

main();

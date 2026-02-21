#!/usr/bin/env node

/**
 * Pre-commit hook to ensure built files are up-to-date
 * Install: Run `node tools/install-git-hooks.mjs`
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BUILT_FILES = [
  'assets/js/site.min.js',
  'assets/js/lazy-loader.min.js',
  'assets/js/debugger-hud.min.js'
];

console.log('🔨 Pre-commit: Checking built files...');

// Check if source files are staged
const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean);

function getCurrentSha() {
  return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
}

function findStaleVersionStringsInFile(file, sha) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');
  const matches = [...content.matchAll(/\?v=([a-f0-9]+)/g)];
  return matches.filter((m) => m[1] !== sha);
}

const stagedHtmlFiles = stagedFiles.filter((f) => f.endsWith('.html'));

if (stagedHtmlFiles.length > 0) {
  console.log('🧩 Staged HTML detected, verifying cache-busting version strings...');

  try {
    const sha = getCurrentSha();
    const staleAfter = stagedHtmlFiles.flatMap((file) =>
      findStaleVersionStringsInFile(file, sha).map((m) => ({ file, value: m[1] })),
    );

    if (staleAfter.length > 0) {
      console.error('❌ Stale ?v= strings found in staged HTML:');
      staleAfter.forEach((item) => console.error(`   - ${item.file} has ?v=${item.value}`));
      console.error('\n💡 Run: npm run apply:versioning && git add -A');
      process.exit(1);
    }

    console.log('✅ HTML cache-busting version strings are current');
  } catch (error) {
    console.error('❌ Failed HTML version-string check:', error.message);
    process.exit(1);
  }
}

const jsSourceChanged = stagedFiles.some(f => 
  f.startsWith('assets/js/') && f.endsWith('.js') && !f.endsWith('.min.js')
);

if (!jsSourceChanged) {
  console.log('✅ No JS source files changed, skipping build');
  process.exit(0);
}

console.log('⚠️  JS source files changed, verifying builds...');

// Check if built files exist
const missingFiles = BUILT_FILES.filter(f => !fs.existsSync(f));

if (missingFiles.length > 0) {
  console.error('❌ Missing built files:');
  missingFiles.forEach(f => console.error(`   - ${f}`));
  console.error('\n💡 Run: npm run build');
  process.exit(1);
}

// Check if built files are up-to-date
const sourceMtimes = stagedFiles
  .filter(f => f.endsWith('.js') && !f.endsWith('.min.js'))
  .map(f => fs.statSync(f).mtimeMs);

const builtMtimes = BUILT_FILES.map(f => fs.statSync(f).mtimeMs);

const oldestBuild = Math.min(...builtMtimes);
const newestSource = Math.max(...sourceMtimes);

if (newestSource > oldestBuild) {
  console.error('❌ Built files are outdated!');
  console.error(`   Source modified: ${new Date(newestSource).toLocaleString()}`);
  console.error(`   Build timestamp: ${new Date(oldestBuild).toLocaleString()}`);
  console.error('\n💡 Run: npm run build');
  process.exit(1);
}

console.log('✅ All built files are up-to-date');
process.exit(0);

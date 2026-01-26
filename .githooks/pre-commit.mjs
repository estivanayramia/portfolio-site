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
  'assets/js/debugger.min.js',
  'assets/js/error-reporting.min.js'
];

console.log('🔨 Pre-commit: Checking built files...');

// Check if source files are staged
const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
  .split('\n')
  .filter(Boolean);

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

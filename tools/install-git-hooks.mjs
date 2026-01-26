#!/usr/bin/env node

/**
 * Install Git hooks
 * Run this once: node tools/install-git-hooks.mjs
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🔧 Installing Git hooks...');

// Configure Git to use .githooks directory
try {
  execSync('git config core.hooksPath .githooks', { cwd: rootDir, stdio: 'inherit' });
  console.log('✅ Git hooks configured');
} catch (err) {
  console.error('❌ Failed to configure Git hooks:', err.message);
  process.exit(1);
}

// Make hook executable (Unix)
const hookPath = path.join(rootDir, '.githooks', 'pre-commit.mjs');
if (process.platform !== 'win32') {
  try {
    fs.chmodSync(hookPath, '755');
    console.log('✅ Hook made executable');
  } catch (err) {
    console.warn('⚠️  Could not make hook executable:', err.message);
  }
}

console.log('\n✨ Git hooks installed successfully!');
console.log('   Pre-commit hook will now verify builds before commits.\n');

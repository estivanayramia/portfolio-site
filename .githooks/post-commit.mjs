#!/usr/bin/env node

import { execSync } from 'child_process';

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

try {
  const dirty = run('git status --porcelain');
  if (!dirty) {
    console.log('✅ Post-commit: working tree is clean');
    process.exit(0);
  }

  console.warn('⚠️  Post-commit: working tree is dirty after commit.');
  console.warn('   Run: npm run build && npm run apply:versioning && git add -A');
  console.warn('   Dirty files:');
  for (const line of dirty.split('\n')) console.warn(`   ${line}`);
  process.exit(0);
} catch (error) {
  console.warn('⚠️  Post-commit: unable to inspect working tree:', error.message);
  process.exit(0);
}

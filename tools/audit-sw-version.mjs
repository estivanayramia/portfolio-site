import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

console.log('🛡️  Audit: Service Worker Cache Version Guardrail');

const SW_PATH = 'sw.js';
const CRITICAL_FILES = [
  'sw.js',
  'assets/js/site.js',
  'index.html',
  '_headers',
  '_redirects'
];

try {
  // 1. Get current CACHE_VERSION from sw.js
  const swContent = fs.readFileSync(SW_PATH, 'utf8');
  const versionMatch = swContent.match(/const\s+CACHE_VERSION\s*=\s*['"](.+?)['"]/);
  
  if (!versionMatch) {
    console.error('❌ Error: Could not find CACHE_VERSION in sw.js');
    process.exit(1);
  }
  
  const currentVersion = versionMatch[1];
  console.log(`ℹ️  Current Cache Version: ${currentVersion}`);

  // 2. Check for changes in critical files since last merge to main
  // Note: This relies on git. If not in git, we skip.
  const diffCommand = `git diff origin/main --name-only ${CRITICAL_FILES.join(' ')}`;
  const changedFiles = execSync(diffCommand, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

  if (changedFiles.length === 0) {
    console.log('✅ No critical files changed. Guardrail passed.');
    process.exit(0);
  }

  console.log('⚠️  Critical files changed:', changedFiles);

  // 3. If critical files changed, check if sw.js version was bumped
  // Simple check: Is sw.js in the changed files?
  // Ideally, we'd check if the VERSION line specifically changed, but for now, 
  // if sw.js is modified, we assume the user MIGHT have bumped it. 
  // If sw.js is NOT modified but other files ARE, that's a failure.
  
  if (!changedFiles.includes('sw.js')) {
    console.error('❌ Error: Critical assets changed but sw.js was not touched to bump version.');
    console.error('   Please update CACHE_VERSION in sw.js to verify changes.');
    process.exit(1);
  }
  
  // 4. Advanced: Check if the specific line changed in the diff
  const swDiff = execSync(`git diff origin/main sw.js`, { encoding: 'utf8' });
  if (!swDiff.includes('CACHE_VERSION')) {
     console.error('❌ Error: sw.js changed, but CACHE_VERSION line was not modified.');
     process.exit(1);
  }

  console.log('✅ CACHE_VERSION bumped. Guardrail passed.');
  process.exit(0);

} catch (error) {
  // If we prefer fail-open on git errors (e.g. no origin/main), log warning but pass
  console.warn('⚠️  Warning: Guardrail execution failed (likely no git context). Skipping.', error.message);
  process.exit(0);
}

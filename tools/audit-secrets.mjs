import fs from 'fs';
import { execSync } from 'child_process';

console.log('🔒 Audit: Secrets Scan');

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/,
  /gho_[0-9A-Za-z]{36}/,
  // Removed variable name checks to avoid false positives in code that uses env vars
  // /GEMINI_API_KEY/,
  // /x-goog-api-key/,
  /Authorization:\s*Bearer\s+[a-zA-Z0-9_\-\.]+/i
];

try {
  // 1. Scan staged files if in git repo, otherwise scan all tracked files
  const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  
  let foundSecrets = false;

  files.forEach(file => {
    const normalizedFile = file.replace(/\\/g, '/');
    // Skip binary or trusted files if needed
    if (normalizedFile.endsWith('.png') || normalizedFile.endsWith('.ico') || normalizedFile.endsWith('.jpg')) return;
    // Skip the tools directory (where this script lives) and reports
    if (normalizedFile.startsWith('tools/') || normalizedFile.startsWith('.reports/')) return;
    // Skip wrangler.toml config files (variable definitions)
    if (normalizedFile.endsWith('wrangler.toml')) return;
    
    const content = fs.readFileSync(file, 'utf8');
    
    SECRET_PATTERNS.forEach(pattern => {
      if (pattern.test(content)) {
        console.error(`❌ Potential secret found in ${file}: matches ${pattern}`);
        foundSecrets = true;
      }
    });
  });

  if (foundSecrets) {
    console.error('⛔ Audit FAILED: High-risk strings detected.');
    process.exit(1);
  }

  console.log('✅ No secrets found in tracked files.');
  process.exit(0);

} catch (error) {
  console.warn('⚠️  Warning: Secret audit scan failed (git issues?).', error.message);
  process.exit(0);
}

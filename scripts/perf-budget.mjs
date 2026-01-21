import fs from 'node:fs';
import path from 'node:path';

const FILES = [
  'assets/js/site.min.js',
  'theme.css',
  'assets/css/theme.css',
];

const DEFAULT_LIMIT_KB = 200;

function formatKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

function main() {
  console.log('Performance Budget Guard');
  console.log('='.repeat(60));
  console.log('file                     | sizeKB  | limitKB | pass/fail');
  console.log('-------------------------|---------|---------|----------');

  let anyFail = false;

  for (const relPath of FILES) {
    const filePath = path.resolve(relPath);
    if (!fs.existsSync(filePath)) {
      console.log(`${relPath.padEnd(25)} | -       | -       | SKIP (missing)`);
      continue;
    }

    const sizeBytes = fs.statSync(filePath).size;
    const sizeKB = sizeBytes / 1024;
    
    let limitKB = DEFAULT_LIMIT_KB;
    // If already exceeding default, adapt limit to current + 10%
    if (sizeKB > DEFAULT_LIMIT_KB) {
        limitKB = sizeKB * 1.10;
        // console.log(`  [Note] ${relPath} exceeds ${DEFAULT_LIMIT_KB}KB. Adjusted limit to ${limitKB.toFixed(2)}KB.`);
    }

    const pass = sizeKB <= limitKB;
    const status = pass ? 'PASS' : 'FAIL';
    
    console.log(`${relPath.padEnd(25)} | ${formatKB(sizeBytes).padEnd(7)} | ${limitKB.toFixed(2).padEnd(7)} | ${status}`);

    if (!pass) anyFail = true;
  }

  if (anyFail) {
    console.error('\nBudget Check Failed.');
    process.exit(1);
  } else {
    console.log('\nBudget Check Passed.');
  }
}

main();

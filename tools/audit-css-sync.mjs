import fs from 'node:fs';

const REQUIRED_CSS_FILES = [
  'assets/css/style.css',
  'assets/css/components/luxury-coverflow.min.css',
  'assets/css/carousel/coverflow-luxury.min.css',
];

function main() {
  const missing = REQUIRED_CSS_FILES.filter((file) => !fs.existsSync(file));

  if (missing.length > 0) {
    process.stderr.write('FAIL: Required built CSS artifact(s) missing:\n');
    for (const file of missing) process.stderr.write(`- ${file}\n`);
    process.exit(1);
  }

  const sourceFile = 'assets/css/input.css';
  const sourceStat = fs.statSync(sourceFile);
  const stale = REQUIRED_CSS_FILES.filter((file) => fs.statSync(file).mtimeMs < sourceStat.mtimeMs);

  if (stale.length > 0) {
    process.stderr.write('FAIL: CSS build artifacts appear older than source input.css:\n');
    for (const file of stale) process.stderr.write(`- ${file}\n`);
    process.stderr.write('Run: npm run build:css && npm run build:coverflow && npm run build:luxury-coverflow\n');
    process.exit(1);
  }

  process.stdout.write('OK: CSS artifacts are present and newer than source.\n');
  process.exit(0);
}

main();

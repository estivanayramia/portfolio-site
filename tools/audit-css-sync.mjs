import fs from 'node:fs';
import { transform } from 'lightningcss';

const REQUIRED_CSS_FILES = [
  'assets/css/style.css',
  'assets/css/components/luxury-coverflow.min.css',
  'assets/css/carousel/coverflow-luxury.min.css',
];

const THEME_SOURCE = 'assets/css/theme.css';
const THEME_ROOT_OUTPUT = 'theme.css';
const THEME_MIN_OUTPUT = 'assets/css/theme.min.css';

function main() {
  const requiredFiles = [
    ...REQUIRED_CSS_FILES,
    THEME_SOURCE,
    THEME_ROOT_OUTPUT,
    THEME_MIN_OUTPUT,
  ];
  const missing = requiredFiles.filter((file) => !fs.existsSync(file));

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

  const themeSource = fs.readFileSync(THEME_SOURCE);
  const themeRoot = fs.readFileSync(THEME_ROOT_OUTPUT);
  if (!themeSource.equals(themeRoot)) {
    process.stderr.write('FAIL: theme.css does not match assets/css/theme.css.\n');
    process.stderr.write('Run: npm run build:theme\n');
    process.exit(1);
  }

  const expectedMin = transform({
    filename: THEME_SOURCE,
    code: themeSource,
    minify: true,
    sourceMap: false,
  }).code;
  const themeMin = fs.readFileSync(THEME_MIN_OUTPUT);
  if (!expectedMin.equals(themeMin)) {
    process.stderr.write('FAIL: assets/css/theme.min.css does not match the theme source.\n');
    process.stderr.write('Run: npm run build:theme\n');
    process.exit(1);
  }

  process.stdout.write('OK: CSS artifacts are present, current, and theme outputs match source.\n');
  process.exit(0);
}

main();

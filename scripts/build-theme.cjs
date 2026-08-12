/**
 * Build the deployable theme styles from the authoring source.
 *
 * `assets/css/theme.css` owns theme changes. The root `theme.css` file is the
 * compatibility output loaded by current routes, and `theme.min.css` is the
 * minified output retained for legacy consumers.
 */

const fs = require('node:fs');
const path = require('node:path');
const { transform } = require('lightningcss');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT_DIR, 'assets', 'css', 'theme.css');
const ROOT_OUTPUT_PATH = path.join(ROOT_DIR, 'theme.css');
const MIN_OUTPUT_PATH = path.join(ROOT_DIR, 'assets', 'css', 'theme.min.css');

function normalizeCss(source) {
  if (source.charCodeAt(0) === 0xfeff) {
    throw new Error('theme source must be UTF-8 without a BOM');
  }

  const normalized = source.replace(/\r\n?/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function writeIfChanged(filePath, content) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  if (current && current.equals(next)) return false;
  fs.writeFileSync(filePath, next);
  return true;
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Theme source is missing: ${path.relative(ROOT_DIR, SOURCE_PATH)}`);
  }

  const source = normalizeCss(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const minified = transform({
    filename: SOURCE_PATH,
    code: Buffer.from(source, 'utf8'),
    minify: true,
    sourceMap: false,
  }).code;

  const rootChanged = writeIfChanged(ROOT_OUTPUT_PATH, source);
  const minChanged = writeIfChanged(MIN_OUTPUT_PATH, minified);

  process.stdout.write(
    `[build-theme] source=${path.relative(ROOT_DIR, SOURCE_PATH)} ` +
      `root=${rootChanged ? 'updated' : 'unchanged'} ` +
      `min=${minChanged ? 'updated' : 'unchanged'}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`[build-theme] ${error.message}\n`);
  process.exitCode = 1;
}

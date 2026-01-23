'use strict';

const fs = require('fs');
const path = require('path');

function fail(message, error) {
  console.error(`[build-theme] ${message}`);
  if (error) {
    if (error.stack) console.error(error.stack);
    else console.error(String(error));
  }
  process.exit(1);
}

let transform;
try {
  ({ transform } = require('lightningcss'));
} catch (error) {
  fail(
    "Failed to load 'lightningcss'. Ensure dependencies are installed (e.g. `npm ci` / `npm install`).",
    error
  );
}

const repoRoot = path.resolve(__dirname, '..');
const inPath = path.join(repoRoot, 'assets', 'css', 'theme.css');
const outPath = path.join(repoRoot, 'assets', 'css', 'theme.min.css');

let input;
try {
  input = fs.readFileSync(inPath);
} catch (error) {
  fail(`Failed to read input CSS: ${inPath}`, error);
}

let result;
try {
  result = transform({
    filename: inPath,
    code: input,
    minify: true,
    errorRecovery: true
  });
} catch (error) {
  fail('Lightning CSS transform failed.', error);
}

if (Array.isArray(result.warnings) && result.warnings.length > 0) {
  for (const warning of result.warnings) {
    console.warn('[build-theme] warning:', warning);
  }
}

try {
  fs.writeFileSync(outPath, result.code);
} catch (error) {
  fail(`Failed to write output CSS: ${outPath}`, error);
}

console.log(`[build-theme] Wrote ${path.relative(repoRoot, outPath)}`);

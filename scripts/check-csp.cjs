/* eslint-disable no-console */
const fs = require('fs');

const text = fs.readFileSync('_headers', 'utf8');

// Grab the first block (/* ... until next blank line or next path)
const lines = text.split(/\r?\n/);
let inRootBlock = false;
const cspLines = [];
let cacheLine = null;

for (const line of lines) {
  if (line.trim() === '/*') { inRootBlock = true; continue; }
  if (inRootBlock && line.trim().startsWith('/assets/')) break;

  if (inRootBlock) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('content-security-policy:')) cspLines.push(trimmed);
    if (trimmed.toLowerCase().startsWith('cache-control:')) cacheLine = trimmed;
  }
}

function die(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (cspLines.length !== 1) die(`Expected exactly 1 CSP line in /* block, found ${cspLines.length}.`);
const csp = cspLines[0].toLowerCase();
if (!csp.includes('connect-src')) die('CSP missing connect-src.');
if (!csp.includes('https://formspree.io')) die('CSP connect-src missing https://formspree.io.');

if (!cacheLine) die('Missing Cache-Control in /* block.');
if (!cacheLine.toLowerCase().includes('max-age=0')) die('Cache-Control should include max-age=0 for HTML revalidation.');

console.log('PASS: CSP and HTML cache policy look correct.');

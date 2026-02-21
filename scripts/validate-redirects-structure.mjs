import fs from 'node:fs';

const lines = fs.readFileSync('_redirects', 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.trim().startsWith('#'));

const seen = new Set();
const dupes = [];
const loops = [];
const invalids = [];

lines.forEach((line, index) => {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) {
    invalids.push(`Line ${index + 1}: too few tokens: ${line}`);
    return;
  }

  const src = parts[0];
  const dest = parts[1];
  const status = parts[2];

  if (seen.has(src)) dupes.push(`Line ${index + 1}: ${src}`);
  seen.add(src);
  if (dest === src) loops.push(`Line ${index + 1}: ${src}`);

  if (status && !['200', '301', '302', '307', '308'].includes(status)) {
    invalids.push(`Line ${index + 1}: invalid status ${status} on ${src}`);
  }
});

const isCFPages = fs.existsSync('wrangler.toml');
const hasCatchAll = lines.some((line) => /^\/\*\s+/.test(line.trim()));
const issues = [];

if (!isCFPages && !hasCatchAll) {
  issues.push({ type: 'NO_CATCHALL' });
}

if (dupes.length) console.error('DUPLICATE SOURCES:', dupes);
if (loops.length) console.error('SELF-REDIRECTS:', loops);
if (invalids.length) console.error('INVALID LINES:', invalids);
if (issues.length) console.error('ISSUES:', issues);

if (!dupes.length && !loops.length && !invalids.length && !issues.length) {
  console.log(`_redirects structurally clean (${lines.length} active rules) ✅`);
  process.exit(0);
}

console.error('Issues remain — do NOT commit');
process.exit(1);

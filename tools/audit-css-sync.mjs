import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const A = path.join(ROOT, 'theme.css');
const B = path.join(ROOT, 'assets', 'css', 'theme.css');

function firstDiffIndex(aBuf, bBuf) {
  const min = Math.min(aBuf.length, bBuf.length);
  for (let i = 0; i < min; i++) {
    if (aBuf[i] !== bBuf[i]) return i;
  }
  return aBuf.length === bBuf.length ? -1 : min;
}

function main() {
  if (!fs.existsSync(A)) {
    console.error(`ERROR: Missing ${path.relative(ROOT, A)}`);
    process.exit(2);
  }
  if (!fs.existsSync(B)) {
    console.error(`ERROR: Missing ${path.relative(ROOT, B)}`);
    process.exit(2);
  }

  const aBuf = fs.readFileSync(A);
  const bBuf = fs.readFileSync(B);

  if (aBuf.equals(bBuf)) {
    console.log('OK: theme.css is byte-for-byte identical to assets/css/theme.css');
    process.exit(0);
  }

  const idx = firstDiffIndex(aBuf, bBuf);
  console.error('FAIL: theme.css differs from assets/css/theme.css');
  console.error(`- theme.css bytes: ${aBuf.length}`);
  console.error(`- assets/css/theme.css bytes: ${bBuf.length}`);
  console.error(`- first differing byte index: ${idx}`);
  process.exit(1);
}

main();

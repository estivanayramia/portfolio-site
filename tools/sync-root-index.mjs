import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootIndex = resolve('index.html');
const sourceIndex = resolve('EN/index.html');

if (!existsSync(sourceIndex)) {
  console.error('[sync-root-index] Missing source file:', sourceIndex);
  process.exit(1);
}

if (!existsSync(rootIndex)) {
  copyFileSync(sourceIndex, rootIndex);
  console.log('[sync-root-index] Created root index from EN/index.html');
  process.exit(0);
}

const source = readFileSync(sourceIndex, 'utf8');
const target = readFileSync(rootIndex, 'utf8');

if (source === target) {
  console.log('[sync-root-index] Root index already in sync');
  process.exit(0);
}

copyFileSync(sourceIndex, rootIndex);
console.log('[sync-root-index] Updated root index from EN/index.html');

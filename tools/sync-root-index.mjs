import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = path.join('EN', 'index.html');
const DEST_ROOT = 'index.html';
const DEST_STABLE_ROOT = path.join('__root', 'index.html');
const HEADER_ROOT = '<!-- Generated from EN/index.html by tools/sync-root-index.mjs. Do not edit directly. -->\n';
const HEADER_STABLE_ROOT = '<!-- Generated from EN/index.html by tools/sync-root-index.mjs. Do not edit directly. -->\n';

async function writeIfChanged(destPath, content, label) {
  let existing = null;
  try {
    existing = await fs.readFile(destPath, 'utf8');
  } catch {
    existing = null;
  }

  if (existing === content) {
    console.log(`No changes to ${label}`);
    return;
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, content, 'utf8');
  console.log(`Synced ${label} from ${SOURCE}`);
}

async function main() {
  const sourcePath = path.resolve(process.cwd(), SOURCE);
  const rootDestPath = path.resolve(process.cwd(), DEST_ROOT);
  const stableRootDestPath = path.resolve(process.cwd(), DEST_STABLE_ROOT);

  try {
    await fs.access(sourcePath);
  } catch {
    console.error(`Missing required source file: ${SOURCE}`);
    process.exit(1);
  }

  const sourceContent = await fs.readFile(sourcePath, 'utf8');

  await writeIfChanged(rootDestPath, HEADER_ROOT + sourceContent, DEST_ROOT);
  await writeIfChanged(stableRootDestPath, HEADER_STABLE_ROOT + sourceContent, DEST_STABLE_ROOT.replace(/\\/g, '/'));
}

main().catch((err) => {
  console.error('sync-root-index failed:', err);
  process.exit(1);
});

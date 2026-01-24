import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = path.join('EN', 'index.html');
const DEST = 'index.html';
const HEADER = '<!-- Generated from EN/index.html by tools/sync-root-index.mjs. Do not edit directly. -->\n';

async function main() {
  const sourcePath = path.resolve(process.cwd(), SOURCE);
  const destPath = path.resolve(process.cwd(), DEST);

  try {
    await fs.access(sourcePath);
  } catch {
    console.error(`Missing required source file: ${SOURCE}`);
    process.exit(1);
  }

  const sourceContent = await fs.readFile(sourcePath, 'utf8');
  await fs.writeFile(destPath, HEADER + sourceContent, 'utf8');
  console.log(`Synced ${DEST} from ${SOURCE}`);
}

main().catch((err) => {
  console.error('sync-root-index failed:', err);
  process.exit(1);
});

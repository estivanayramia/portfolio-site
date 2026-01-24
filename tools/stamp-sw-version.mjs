import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const swPath = path.join(ROOT, 'sw.js');

function versionFromEnv() {
  const sha = process.env.CF_PAGES_COMMIT_SHA;
  if (sha && String(sha).trim()) {
    const shortSha = String(sha).trim().slice(0, 12);
    return `v${shortSha}`;
  }
  return `v${Date.now()}`;
}

function main() {
  if (!fs.existsSync(swPath)) {
    console.error(`ERROR: Missing ${path.relative(ROOT, swPath)}`);
    process.exit(2);
  }

  const version = versionFromEnv();
  const original = fs.readFileSync(swPath, 'utf8');

  const re = /const\s+CACHE_VERSION\s*=\s*['"][^'"]*['"]\s*;/;
  if (!re.test(original)) {
    console.error('ERROR: Could not find CACHE_VERSION assignment in sw.js');
    process.exit(2);
  }

  const updated = original.replace(re, `const CACHE_VERSION = '${version}';`);
  if (updated === original) {
    console.log('OK: sw.js already stamped');
    process.exit(0);
  }

  fs.writeFileSync(swPath, updated);
  console.log(`OK: stamped CACHE_VERSION=${version} into sw.js`);
}

main();

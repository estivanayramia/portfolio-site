import fs from 'node:fs';

const REQUIRED = ['_headers', '_redirects', 'public/_headers'];

function main() {
  const missing = REQUIRED.filter((file) => !fs.existsSync(file));

  if (missing.length > 0) {
    process.stderr.write('FAIL: Missing required Cloudflare files:\n');
    for (const file of missing) process.stderr.write(`- ${file}\n`);
    process.exit(1);
  }

  const empty = REQUIRED.filter((file) => {
    try {
      const stat = fs.statSync(file);
      return !stat.isFile() || stat.size === 0;
    } catch {
      return true;
    }
  });

  if (empty.length > 0) {
    process.stderr.write('FAIL: Cloudflare files must be non-empty regular files:\n');
    for (const file of empty) process.stderr.write(`- ${file}\n`);
    process.exit(1);
  }

  process.stdout.write('OK: Required Cloudflare files are present and non-empty.\n');
  process.exit(0);
}

main();

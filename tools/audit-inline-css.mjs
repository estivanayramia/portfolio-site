import { execSync } from 'node:child_process';
import fs from 'node:fs';

function listTrackedHtmlFiles() {
  const out = execSync('git ls-files -z', { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
  return out
    .split('\0')
    .map((item) => item.trim())
    .filter((item) => item.endsWith('.html'));
}

function main() {
  const files = listTrackedHtmlFiles();
  const findings = [];
  const forbiddenPattern = /(style\s*=\s*["'][^"']*(?:expression\s*\(|url\s*\(\s*['"]?\s*javascript:))/i;

  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    if (forbiddenPattern.test(text)) findings.push(file);
  }

  if (findings.length > 0) {
    process.stderr.write('FAIL: Unsafe inline CSS pattern(s) found in HTML files:\n');
    for (const file of findings) process.stderr.write(`- ${file}\n`);
    process.exit(1);
  }

  process.stdout.write('OK: No unsafe inline CSS patterns found in tracked HTML files.\n');
  process.exit(0);
}

main();

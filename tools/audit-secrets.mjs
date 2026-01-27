import { execSync } from 'node:child_process';
import fs from 'node:fs';

function listTrackedFiles() {
  const out = execSync('git ls-files -z', { stdio: ['ignore', 'pipe', 'pipe'] });
  return out.toString('utf8').split('\0').map(s => s.trim()).filter(Boolean);
}

function safeReadText(path) {
  try {
    const buf = fs.readFileSync(path);
    if (buf.length > 2_000_000) return null;
    const sample = buf.subarray(0, Math.min(buf.length, 8000));
    for (const b of sample) if (b === 0) return null;
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function main() {
  const files = listTrackedFiles();

  const placeholder = '__SET_VIA_CLOUDFLARE_SECRETS__';

  // Prefer patterns that indicate an actual secret value, not just a variable name in docs/code.
  const reGoogleApiKey = /AIza[0-9A-Za-z\-_]{10,}/;
  const reGithubToken = /gho_[A-Za-z0-9_]{10,}/;
  const reAuthBearer = /Authorization\s*:\s*Bearer\s+[A-Za-z0-9\-._~+/]+=*/i;
  const reDashNonPlaceholder = new RegExp(
    `DASHBOARD_PASSWORD_HASH\\s*=\\s*(["'])(?!${placeholder})[^\\"']+\\1`,
    'i'
  );

  const hits = [];

  for (const path of files) {
    const text = safeReadText(path);
    if (text == null) continue;

    if (reGoogleApiKey.test(text)) hits.push({ path, rule: 'google-api-key' });
    if (reGithubToken.test(text)) hits.push({ path, rule: 'github-oauth' });
    if (reAuthBearer.test(text)) hits.push({ path, rule: 'auth-bearer' });
    if (reDashNonPlaceholder.test(text)) hits.push({ path, rule: 'dashboard-password-hash-nonplaceholder' });
  }

  if (hits.length) {
    process.stderr.write('FAIL: Potential secrets detected in tracked files:\n');
    for (const h of hits) process.stderr.write(`- ${h.rule}: ${h.path}\n`);
    process.exit(1);
  }

  process.stdout.write('OK: No secrets detected in tracked files.\n');
  process.exit(0);
}

main();

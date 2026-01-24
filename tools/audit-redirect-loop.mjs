import fs from 'node:fs/promises';

function splitLines(text) {
  return String(text).replace(/\r\n/g, '\n').split('\n');
}

function findIndexRedirectLines(indexHtml) {
  const lines = splitLines(indexHtml);
  const matches = [];

  const patterns = [
    // Meta refresh to /EN or /EN/
    { re: /<meta[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/i, needsEn: true },
    // window.location.* redirects
    { re: /window\.location\.(?:replace|assign)\(\s*["']\s*\/EN\/?/i },
    { re: /window\.location\.(?:href|pathname)\s*=\s*["']\s*\/EN\/?/i },
    { re: /location\.(?:href|pathname)\s*=\s*["']\s*\/EN\/?/i }
  ];

  for (const line of lines) {
    const hasEn = /\/EN\/?/i.test(line);
    if (!hasEn) continue;

    for (const p of patterns) {
      if (p.needsEn) {
        if (p.re.test(line) && /url\s*=\s*\/?EN\/?/i.test(line.replace(/\s+/g, ''))) {
          matches.push(line.trim());
          break;
        }
        continue;
      }

      if (p.re.test(line)) {
        matches.push(line.trim());
        break;
      }
    }
  }

  return matches;
}

function findRedirectsEnToRootLines(redirectsText) {
  const lines = splitLines(redirectsText)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const matches = [];

  for (const line of lines) {
    // Match: /EN or /EN/ or /EN/index.html => / (301/302/etc)
    // Using whitespace-separated format: source dest code
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;

    const [source, dest, code] = parts;
    if (!/^\/(EN)(\/|$)/i.test(source)) continue;
    if (dest !== '/') continue;
    if (!/^\d+$/.test(code)) continue;

    matches.push(line);
  }

  return matches;
}

async function main() {
  const indexHtml = await fs.readFile('index.html', 'utf8');
  const redirectsText = await fs.readFile('_redirects', 'utf8');

  const indexRedirects = findIndexRedirectLines(indexHtml);
  const enToRoot = findRedirectsEnToRootLines(redirectsText);

  if (indexRedirects.length > 0 && enToRoot.length > 0) {
    console.log('FAIL: Potential / <-> /EN redirect loop detected');
    console.log('--- index.html redirect lines ---');
    for (const l of indexRedirects) console.log(l);
    console.log('--- _redirects /EN -> / lines ---');
    for (const l of enToRoot) console.log(l);
    process.exit(1);
  }

  console.log('PASS');
}

main().catch((err) => {
  console.error('audit-redirect-loop failed:', err);
  process.exit(1);
});

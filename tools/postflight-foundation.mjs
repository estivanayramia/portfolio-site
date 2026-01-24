import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function walkHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  /** @type {string[]} */
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkHtmlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const next = haystack.indexOf(needle, idx);
    if (next === -1) break;
    count++;
    idx = next + needle.length;
  }
  return count;
}

function scanEnHtml() {
  const targetDir = path.join(ROOT, 'EN');
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Missing EN directory at ${targetDir}`);
  }

  const files = walkHtmlFiles(targetDir);
  let styleAttr = 0;
  let styleTag = 0;
  let dataThemeAttr = 0;
  let themeTerm = 0;
  let swRefs = 0;

  /** @type {Array<{file:string, kind:string, sample:string}>} */
  const offenders = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const contents = fs.readFileSync(file, 'utf8');

    const styleAttrHits = countOccurrences(contents, 'style="');
    const styleTagHits = countOccurrences(contents, '<style');
    const dataThemeHits = countOccurrences(contents, 'data-theme=');
    const themeTermHits = countOccurrences(contents.toLowerCase(), 'theme');

    // Heuristic: SW references in HTML generally include sw.js or serviceWorker usage
    const swRefHits = countOccurrences(contents, '/sw.js') + countOccurrences(contents, 'serviceWorker');

    styleAttr += styleAttrHits;
    styleTag += styleTagHits;
    dataThemeAttr += dataThemeHits;
    themeTerm += themeTermHits;
    swRefs += swRefHits;

    if (styleAttrHits > 0) offenders.push({ file: rel, kind: 'style-attr', sample: 'contains style="' });
    if (styleTagHits > 0) offenders.push({ file: rel, kind: 'style-tag', sample: 'contains <style' });
    if (dataThemeHits > 0) offenders.push({ file: rel, kind: 'data-theme', sample: 'contains data-theme=' });
  }

  return { styleAttr, styleTag, dataThemeAttr, themeTerm, swRefs, offenders };
}

function scanServiceWorkerRefsInJs() {
  const files = [
    path.join(ROOT, 'assets', 'js', 'site.js'),
    path.join(ROOT, 'assets', 'js', 'site.min.js'),
    path.join(ROOT, 'assets', 'js', 'cache-refresh.js'),
  ].filter((p) => fs.existsSync(p));

  let hits = 0;
  for (const file of files) {
    const contents = fs.readFileSync(file, 'utf8');
    hits += countOccurrences(contents, 'serviceWorker');
    hits += countOccurrences(contents, '/sw.js');
    hits += countOccurrences(contents, 'SKIP_WAITING');
  }

  return { files: files.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')), hits };
}

function scanEscapedClassAttrs() {
  const file = path.join(ROOT, 'EN', 'projects', 'index.html');
  if (!fs.existsSync(file)) {
    return { count: 0, present: false };
  }
  const contents = fs.readFileSync(file, 'utf8');
  const count = countOccurrences(contents, 'class=\\"');
  return { count, present: count > 0 };
}

function scanRedirects() {
  const redirectsPath = path.join(ROOT, '_redirects');
  if (!fs.existsSync(redirectsPath)) {
    return { hasFile: false, bangCount: 0 };
  }
  const contents = fs.readFileSync(redirectsPath, 'utf8');
  const bangCount = countOccurrences(contents, '301!') + countOccurrences(contents, '302!') + countOccurrences(contents, '308!');
  return { hasFile: true, bangCount };
}

function scanHeadersSw() {
  const headersPath = path.join(ROOT, '_headers');
  if (!fs.existsSync(headersPath)) {
    return { hasFile: false, hasSwBlock: false };
  }
  const lines = fs.readFileSync(headersPath, 'utf8').split(/\r?\n/);
  const hasSwBlock = lines.some((l) => l.trim() === '/sw.js');
  return { hasFile: true, hasSwBlock };
}

function main() {
  const escapedClass = scanEscapedClassAttrs();
  const en = scanEnHtml();
  const redirects = scanRedirects();
  const headers = scanHeadersSw();
  const swJs = scanServiceWorkerRefsInJs();

  console.log('postflight.counts');
  console.log(`escaped class attrs (EN/projects/index.html) count: ${escapedClass.count}`);
  console.log(`inline style attrs (EN/**/*.html) count: ${en.styleAttr}`);
  console.log(`<style tags (EN/**/*.html) count: ${en.styleTag}`);
  console.log(`data-theme attrs (EN/**/*.html) count: ${en.dataThemeAttr}`);
  console.log(`theme term hits (EN/**/*.html) count: ${en.themeTerm}`);
  console.log(`service worker ref hits (EN/**/*.html) count: ${en.swRefs}`);
  console.log(`service worker ref hits (assets/js/*) count: ${swJs.hits}`);
  console.log(`service worker ref scanned files: ${swJs.files.join(', ') || '(none found)'}`);
  console.log(`301!/302!/308! occurrences in _redirects: ${redirects.bangCount}`);
  console.log(`_headers contains /sw.js block: ${headers.hasSwBlock ? 'YES' : 'NO'}`);

  const mustBeZero = [
    { label: 'escaped class attrs', value: escapedClass.count },
    { label: 'inline style attrs', value: en.styleAttr },
    { label: '<style tags', value: en.styleTag },
    { label: 'forced data-theme', value: en.dataThemeAttr },
    { label: 'redirect ! syntax', value: redirects.bangCount },
  ];

  const failures = mustBeZero.filter((x) => x.value !== 0);
  if (failures.length === 0 && headers.hasSwBlock) {
    process.exit(0);
  }

  console.error('FAIL: postflight checks failed');
  for (const f of failures) {
    console.error(`- ${f.label}: ${f.value}`);
  }
  if (!headers.hasSwBlock) {
    console.error('- missing /sw.js block in _headers');
  }

  if (en.offenders.length > 0) {
    console.error('Offenders (file:kind):');
    for (const o of en.offenders) {
      console.error(`${o.file}:${o.kind}`);
    }
  }

  process.exit(1);
}

main();

#!/usr/bin/env node
/**
 * fix-encoding-styles.mjs
 * -----------------------
 * Programmatic fixer for:
 *  1. Theme-toggle inline color → aria-hidden (HTML + JS)
 *  2. Mojibake sequences (UTF-8 misread as Windows-1252)
 *  3. Palette color inline styles → Tailwind classes (HTML)
 *
 * Run: node scripts/fix-encoding-styles.mjs [--dry-run]
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run');
let totalChanges = 0;

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

function patchFile(path, patcher, label) {
  const before = readFileSync(path, 'utf8');
  const after = patcher(before);
  if (after !== before) {
    if (!DRY_RUN) writeFileSync(path, after, 'utf8');
    console.log(`  ✅ ${label}: ${path}`);
    totalChanges++;
    return true;
  }
  return false;
}

// ─── MOJIBAKE MAP ────────────────────────────────────────────────────────────
const MOJIBAKE_MAP = [
  // 3-byte emoji (E2 xx xx)
  ['âœ¨', '✨'],  // U+2728 SPARKLES
  ['âœ…', '✅'],  // U+2705 CHECK MARK
  ['âœ"', '✔'],   // U+2714 HEAVY CHECK MARK
  ['â€"', '—'],   // U+2014 EM DASH
  ['â€"', '–'],   // U+2013 EN DASH
  ['â€™', '\u2019'], // U+2019 RIGHT SINGLE QUOTATION MARK
  ['â€œ', '\u201C'], // U+201C LEFT DOUBLE QUOTATION MARK
  ['â€\x9D', '\u201D'], // U+201D RIGHT DOUBLE QUOTATION MARK
  // 2-byte accented chars (Cxx)
  ['Ã©', 'é'],   // U+00E9
  ['Ã¨', 'è'],   // U+00E8
  ['Ã ', 'à'],   // U+00E0
  ['Ã¯', 'ï'],   // U+00EF
  ['Ã¶', 'ö'],   // U+00F6
  ['Ã¼', 'ü'],   // U+00FC
  ['Ã±', 'ñ'],   // U+00F1
  // Non-breaking space / copyright / registered
  ['Â©', '©'],   // U+00A9
  ['Â®', '®'],   // U+00AE
  ['Â ', '\u00A0'], // U+00A0 NBSP
];

// ─── 1. THEME-TOGGLE FIX (HTML) ─────────────────────────────────────────────
// Replace: <span style="color: #e1d4c2">EMOJI</span>
//    With: <span aria-hidden="true">EMOJI</span>
// Also:    <span style="color: #212842">EMOJI</span>
//    With: <span aria-hidden="true">EMOJI</span>
function fixThemeToggleHTML(content) {
  // Match span with style="color: #HEX" containing emoji
  return content.replace(
    /<span\s+style="color:\s*#(?:e1d4c2|212842)">([\s\S]*?)<\/span>/gi,
    '<span aria-hidden="true">$1</span>'
  );
}

// ─── 2. THEME-TOGGLE FIX (JS innerHTML) ─────────────────────────────────────
function fixThemeToggleJS(content) {
  // Fix innerHTML assignments: '<span style="color: #e1d4c2">🔆</span>'
  return content
    .replace(
      /'<span style="color: #e1d4c2">(.*?)<\/span>'/g,
      '\'<span aria-hidden="true">$1</span>\''
    )
    .replace(
      /'<span style="color: #212842">(.*?)<\/span>'/g,
      '\'<span aria-hidden="true">$1</span>\''
    );
}

// ─── 3. THEME-TOGGLE BUTTON TEMPLATE IN JS ──────────────────────────────────
function fixThemeToggleTemplateJS(content) {
  // Fix the full button template string in site.js that embeds theme-toggle HTML
  return content.replace(
    /<span style="color:\s*#(?:e1d4c2|212842)">(.*?)<\/span>/gi,
    '<span aria-hidden="true">$1</span>'
  );
}

// ─── 4. MOJIBAKE FIX ────────────────────────────────────────────────────────
function fixMojibake(content) {
  let result = content;
  for (const [bad, good] of MOJIBAKE_MAP) {
    result = result.split(bad).join(good);
  }
  return result;
}

// ─── 5. DIAGNOSTICS-CONSENT.JS palette colors ───────────────────────────────
function fixDiagnosticsConsent(content) {
  let result = content;

  // title.style.color = "#212842" → title.classList.add('text-indigodeep')
  result = result.replace(
    /title\.style\.color\s*=\s*"#212842"/g,
    "title.classList.add('text-indigodeep')"
  );

  // btnEnable.style.background = "#212842" → btnEnable.classList.add('bg-indigodeep')
  result = result.replace(
    /btnEnable\.style\.background\s*=\s*"#212842"/g,
    "btnEnable.classList.add('bg-indigodeep')"
  );

  // btnNo.style.color = "#362017" → btnNo.classList.add('text-chocolate')
  result = result.replace(
    /btnNo\.style\.color\s*=\s*"#362017"/g,
    "btnNo.classList.add('text-chocolate')"
  );

  return result;
}

// ─── 6. SITE-REFACTORED.JS diag-toggle palette color ────────────────────────
function fixSiteRefactored(content) {
  // Replace inline color: #e1d4c2 in the diag-toggle button template
  // with a Tailwind class
  return content.replace(
    /(<button[^>]*id="diag-toggle"[^>]*style=")([^"]*)(color:\s*#e1d4c2;?)([^"]*")/g,
    (match, pre, before, colorPart, after) => {
      // Remove the color property from the style attribute
      const cleanedBefore = before.replace(/;\s*$/, '');
      const cleanedAfter = after.replace(/^\s*;/, '');
      const remainingStyle = [cleanedBefore, cleanedAfter.replace(/"$/, '')]
        .filter(Boolean)
        .join('; ');
      // Add class="text-beige" to the button
      const styleAttr = remainingStyle ? `style="${remainingStyle}"` : '';
      return match.replace(
        /style="[^"]*"/,
        `class="text-beige" ${styleAttr}`
      ).replace(/\s+"/g, '"');
    }
  );
}

// ─── 7. ABOUT.HTML figcaption: remove redundant var(--color-text) ────────────
function fixAboutFigcaption(content) {
  // The figcaption already has text-chocolate/70 Tailwind class.
  // The inline style="color: var(--color-text);" provides dark-mode adaptation
  // but conflicts conceptually. Replace with Tailwind dark variant.
  return content.replace(
    /(<figcaption[^>]*class="[^"]*text-chocolate\/70)("[^>]*)\s*style="color:\s*var\(--color-text\);?"/g,
    '$1 dark:text-beige/70$2'
  );
}

// ─── 8. CONTACT.HTML: var(--color-text) + opacity inline styles ──────────────
function fixContactVarStyles(content) {
  // style="color: var(--color-text); opacity: 0.7;" → add Tailwind classes
  return content
    .replace(
      /(<p[^>]*class="[^"]*)(text-xs)([^"]*"[^>]*)\s*style="color:\s*var\(--color-text\);\s*opacity:\s*0\.7;?"/g,
      '$1$2 text-chocolate/70 dark:text-beige/70$3'
    )
    .replace(
      /(<p[^>]*class="[^"]*)(text-xs\s+leading-relaxed)([^"]*"[^>]*)\s*style="color:\s*var\(--color-text\);\s*opacity:\s*0\.7;?"/g,
      '$1$2 text-chocolate/70 dark:text-beige/70$3'
    );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

console.log(`\n🔧 fix-encoding-styles${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

// Get all tracked HTML files
const htmlFiles = run('git ls-files "*.html"').split(/\r?\n/).filter(Boolean);
const jsFiles = run('git ls-files "*.js"').split(/\r?\n/).filter(f => f && !f.endsWith('.min.js') && !f.includes('node_modules'));

// ── HTML FILES ───────────────────────────────────────────────────────────────
console.log('── HTML files ──');
for (const file of htmlFiles) {
  patchFile(file, (c) => {
    let result = c;
    result = fixThemeToggleHTML(result);
    result = fixMojibake(result);
    return result;
  }, 'theme-toggle+mojibake');
}

// ── JS FILES ────────────────────────────────────────────────────────────────
console.log('\n── JS files ──');

// site.js — theme toggle innerHTML + template
if (jsFiles.includes('assets/js/site.js')) {
  patchFile('assets/js/site.js', (c) => {
    let result = c;
    result = fixThemeToggleJS(result);
    result = fixThemeToggleTemplateJS(result);
    result = fixMojibake(result);
    return result;
  }, 'theme-toggle+mojibake');
}

// diagnostics-consent.js — palette colors
if (jsFiles.includes('assets/js/diagnostics-consent.js')) {
  patchFile('assets/js/diagnostics-consent.js', fixDiagnosticsConsent, 'palette→classList');
}

// site-refactored.js — diag-toggle palette color
if (jsFiles.includes('assets/js/site-refactored.js')) {
  patchFile('assets/js/site-refactored.js', (c) => {
    let result = c;
    result = fixSiteRefactored(result);
    result = fixMojibake(result);
    return result;
  }, 'diag-toggle+mojibake');
}

// about.html — figcaption
if (htmlFiles.includes('EN/about.html')) {
  patchFile('EN/about.html', fixAboutFigcaption, 'figcaption-var-color');
}

// contact.html — var(--color-text) inline styles
if (htmlFiles.includes('EN/contact.html')) {
  patchFile('EN/contact.html', fixContactVarStyles, 'contact-var-color');
}

// All remaining JS files — mojibake sweep
for (const file of jsFiles) {
  if (['assets/js/site.js', 'assets/js/diagnostics-consent.js', 'assets/js/site-refactored.js'].includes(file)) continue;
  patchFile(file, fixMojibake, 'mojibake');
}

console.log(`\n📊 Total files changed: ${totalChanges}`);
if (DRY_RUN) console.log('ℹ️  Dry run — no files were written.');
process.exit(0);

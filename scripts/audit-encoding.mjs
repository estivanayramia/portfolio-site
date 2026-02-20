#!/usr/bin/env node
/**
 * audit-encoding.mjs
 * ------------------
 * CI gate detecting:
 *  1. UTF-8→Windows-1252 mojibake in HTML/JS files
 *  2. Inline style= palette colors that should use Tailwind classes
 *  3. Missing or misordered <meta charset> in HTML <head>
 *
 * Fails with exit code 1 if any violations found.
 * Run: node scripts/audit-encoding.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

// ─── MOJIBAKE PATTERNS ──────────────────────────────────────────────────────
const MOJIBAKE_PATTERNS = [
  { pattern: /ðŸ/g, description: 'Corrupted 4-byte emoji (U+1F000+)' },
  { pattern: /â€[™""–—]/g, description: 'Corrupted curly quotes / dashes' },
  { pattern: /Ã©/g, description: 'Corrupted é (U+00E9)' },
  { pattern: /Ã¨/g, description: 'Corrupted è (U+00E8)' },
  { pattern: /Ã /g, description: 'Corrupted à (U+00E0)' },
  { pattern: /Ã¢/g, description: 'Corrupted â (U+00E2)' },
  { pattern: /Ã¶/g, description: 'Corrupted ö (U+00F6)' },
  { pattern: /Ã¼/g, description: 'Corrupted ü (U+00FC)' },
  { pattern: /Ã±/g, description: 'Corrupted ñ (U+00F1)' },
  { pattern: /Â©/g, description: 'Corrupted © (U+00A9)' },
  { pattern: /Â®/g, description: 'Corrupted ® (U+00AE)' },
  { pattern: /âœ¨/g, description: 'Corrupted ✨ (U+2728)' },
  { pattern: /âœ…/g, description: 'Corrupted ✅ (U+2705)' },
];

// ─── PALETTE COLORS (from tailwind.config.js) ───────────────────────────────
const INLINE_PALETTE_COLORS = [
  { hex: /#e1d4c2/i, name: 'beige', tailwind: 'text-beige / bg-beige' },
  { hex: /#362017/i, name: 'chocolate', tailwind: 'text-chocolate / bg-chocolate' },
  { hex: /#212842/i, name: 'indigodeep', tailwind: 'text-indigodeep / bg-indigodeep' },
  { hex: /#0a0a0a/i, name: 'ink', tailwind: 'text-ink / bg-ink' },
];

// Get tracked files from git (never touch node_modules/dist)
const htmlFiles = run('git ls-files "*.html"').split(/\r?\n/).filter(Boolean);
const jsFiles = run('git ls-files "*.js"')
  .split(/\r?\n/)
  .filter((f) => f && !f.endsWith('.min.js') && !f.includes('node_modules'));
const allFiles = [...htmlFiles, ...jsFiles];

let violations = 0;

for (const file of allFiles) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // ── Check mojibake ──────────────────────────────────────────────────────
  for (const { pattern, description } of MOJIBAKE_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        console.error(`[MOJIBAKE] ${file}:${i + 1} — ${description}`);
        console.error(`  Line: ${lines[i].trim().slice(0, 120)}`);
        violations++;
      }
    }
  }

  // ── Check inline palette colors in HTML style= attributes ──────────────
  if (file.endsWith('.html')) {
    const styleAttrRe = /style="([^"]*)"/g;
    let m;
    while ((m = styleAttrRe.exec(content)) !== null) {
      const styleVal = m[1];
      for (const { hex, name, tailwind } of INLINE_PALETTE_COLORS) {
        hex.lastIndex = 0;
        if (hex.test(styleVal)) {
          // Allow palette colors inside calc(), var(), background gradients
          // Only flag simple color: or background-color: uses
          if (/(?:^|;\s*)(?:color|background-color)\s*:/.test(styleVal)) {
            const lineNum = content.slice(0, m.index).split('\n').length;
            console.error(
              `[INLINE-COLOR] ${file}:${lineNum} — use ${tailwind} instead of hardcoded ${name}`,
            );
            console.error(`  Found: style="${styleVal.slice(0, 80)}"`);
            violations++;
          }
        }
      }
    }
  }

  // ── Check charset in HTML files ────────────────────────────────────────
  if (file.endsWith('.html')) {
    const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headMatch) {
      const headContent = headMatch[1];
      const charsetMatch = headContent.match(/<meta\s[^>]*charset/i);
      if (!charsetMatch) {
        console.error(`[NO-CHARSET] ${file} — missing <meta charset="UTF-8"> in <head>`);
        violations++;
      } else {
        // Check it's the first element in <head> (ignoring whitespace and comments)
        const strippedHead = headContent.replace(/<!--[\s\S]*?-->/g, '').trimStart();
        const firstTagIdx = strippedHead.search(/<[a-z]/i);
        const charsetIdx = strippedHead.search(/<meta\s[^>]*charset/i);
        if (firstTagIdx >= 0 && charsetIdx > firstTagIdx) {
          // Allow <script> that just adds a class (common pattern for FOUC prevention)
          const firstTag = strippedHead.slice(firstTagIdx, firstTagIdx + 80);
          if (!/^<script>document\.documentElement\.classList/.test(firstTag)) {
            console.error(
              `[CHARSET-ORDER] ${file} — <meta charset> must be FIRST element in <head>`,
            );
            violations++;
          }
        }
      }
    }
  }
}

if (violations === 0) {
  console.log(`✅ audit-encoding: ${allFiles.length} files scanned — no violations`);
  process.exit(0);
} else {
  console.error(
    `\n❌ audit-encoding: ${violations} violation(s) found — fix before commit`,
  );
  process.exit(1);
}

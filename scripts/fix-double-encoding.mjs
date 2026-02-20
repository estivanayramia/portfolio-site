#!/usr/bin/env node
/**
 * fix-double-encoding.mjs
 * -----------------------
 * Fixes double-encoded UTF-8 in tracked JS/HTML files.
 *
 * Problem: some files in the repo were saved through a
 * UTF-8 → Windows-1252 → UTF-8 round-trip, which encodes
 * each multi-byte UTF-8 character as a longer sequence of
 * Windows-1252 code-points re-encoded as UTF-8.
 *
 * The fix reverses the process:
 *  1. Map each character back to its Windows-1252 byte value
 *  2. Re-interpret the resulting bytes as UTF-8
 *
 * Usage:
 *   node scripts/fix-double-encoding.mjs          # dry-run
 *   node scripts/fix-double-encoding.mjs --apply   # write changes
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DRY_RUN = !process.argv.includes('--apply');

// ── Windows-1252 reverse map: Unicode codepoint → byte value ────────────────
const UNICODE_TO_WIN1252 = new Map();

// 0x00-0x7F: identical in all encodings
for (let i = 0; i < 0x80; i++) UNICODE_TO_WIN1252.set(i, i);
// 0xA0-0xFF: identical to Latin-1
for (let i = 0xA0; i <= 0xFF; i++) UNICODE_TO_WIN1252.set(i, i);

// 0x80-0x9F: Windows-1252 special characters
const W1252_SPECIAL = [
  [0x20AC, 0x80], // €
  // 0x81 undefined
  [0x201A, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201E, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02C6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8A], // Š
  [0x2039, 0x8B], // ‹
  [0x0152, 0x8C], // Œ
  // 0x8D undefined
  [0x017D, 0x8E], // Ž
  // 0x8F undefined
  // 0x90 undefined
  [0x2018, 0x91], // '
  [0x2019, 0x92], // '
  [0x201C, 0x93], // "
  [0x201D, 0x94], // "
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02DC, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9A], // š
  [0x203A, 0x9B], // ›
  [0x0153, 0x9C], // œ
  // 0x9D undefined
  [0x017E, 0x9E], // ž
  [0x0178, 0x9F], // Ÿ
];
for (const [unicode, byte] of W1252_SPECIAL) {
  UNICODE_TO_WIN1252.set(unicode, byte);
}

// Undefined Win1252 positions (0x81, 0x8D, 0x8F, 0x90, 0x9D) pass through
// as C1 control characters (U+0081, U+008D, etc.) in many encoders.
for (const byte of [0x81, 0x8D, 0x8F, 0x90, 0x9D]) {
  UNICODE_TO_WIN1252.set(byte, byte);
}

function charToWin1252(cp) {
  return UNICODE_TO_WIN1252.get(cp);
}

function utf8SeqLen(leadByte) {
  if (leadByte >= 0xC2 && leadByte <= 0xDF) return 2;
  if (leadByte >= 0xE0 && leadByte <= 0xEF) return 3;
  if (leadByte >= 0xF0 && leadByte <= 0xF4) return 4;
  return 0;
}

function isContinuation(byte) {
  return byte >= 0x80 && byte <= 0xBF;
}

/**
 * Attempt to reverse one layer of UTF-8 → Windows-1252 → UTF-8 double encoding.
 * Only replaces sequences that:
 *  - Map cleanly back through Windows-1252 to bytes
 *  - Form a valid UTF-8 sequence
 *  - Decode to a character beyond ASCII (i.e. actually multi-byte)
 */
function fixDoubleEncoded(str) {
  let result = '';
  let i = 0;

  while (i < str.length) {
    const cp = str.charCodeAt(i);
    const byte = charToWin1252(cp);

    // Check if this character maps to a valid UTF-8 lead byte
    if (byte !== undefined && utf8SeqLen(byte) > 0) {
      const seqLen = utf8SeqLen(byte);
      const bytes = [byte];
      let valid = true;

      for (let j = 1; j < seqLen; j++) {
        if (i + j >= str.length) { valid = false; break; }
        const contCp = str.charCodeAt(i + j);
        const contByte = charToWin1252(contCp);
        if (contByte !== undefined && isContinuation(contByte)) {
          bytes.push(contByte);
        } else {
          valid = false;
          break;
        }
      }

      if (valid && bytes.length === seqLen) {
        // Decode the bytes as UTF-8
        const buf = Buffer.from(bytes);
        const decoded = buf.toString('utf8');
        // Ensure the decoded result is valid (no replacement chars)
        // and is actually different from the original characters
        if (decoded.length > 0 && !decoded.includes('\uFFFD')) {
          result += decoded;
          i += seqLen;
          continue;
        }
      }
    }

    // Not part of a double-encoded sequence — keep as-is
    result += str[i];
    i++;
  }

  return result;
}

// ── Main ────────────────────────────────────────────────────────────────────
function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

const jsFiles = run('git ls-files "*.js"')
  .split(/\r?\n/)
  .filter((f) => f && !f.endsWith('.min.js') && !f.includes('node_modules'));

const htmlFiles = run('git ls-files "*.html"')
  .split(/\r?\n/)
  .filter(Boolean);

const allFiles = [...jsFiles, ...htmlFiles];

let totalFixed = 0;

for (const file of allFiles) {
  const original = readFileSync(file, 'utf8');
  const fixed = fixDoubleEncoded(original);

  if (fixed !== original) {
    totalFixed++;
    // Count changes (rough: number of characters that differ)
    let changes = 0;
    for (let i = 0, j = 0; i < original.length || j < fixed.length; i++, j++) {
      if (original[i] !== fixed[j]) changes++;
    }
    console.log(`  ${DRY_RUN ? '[DRY-RUN]' : '[FIXED]'} ${file} (${changes} char diffs)`);
    if (!DRY_RUN) {
      writeFileSync(file, fixed, 'utf8');
    }
  }
}

if (totalFixed === 0) {
  console.log('✅ No double-encoded files found.');
} else {
  console.log(`\n${DRY_RUN ? '🔍 Dry-run:' : '✅ Fixed:'} ${totalFixed} file(s) with double-encoded UTF-8.`);
  if (DRY_RUN) {
    console.log('Run with --apply to write changes.');
  }
}

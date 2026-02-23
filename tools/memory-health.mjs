#!/usr/bin/env node
/**
 * tools/memory-health.mjs
 * Validates agent memory system.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT        = process.cwd();
const CLAUDE_PATH = resolve(ROOT, 'CLAUDE.md');
const MEMORY_PATH = resolve(ROOT, 'docs/MEMORY.md');
const SIZE_WARN   = 5800;
const SIZE_BLOCK  = 6500; // Match update script
const SECTIONS    = ['ROUTING','SEC','CSS','BUILD','WORKER','SW','ENCODING','HOUSE'];

let err = 0;
const fail = (m) => { console.error(`❌ ${m}`); err++; };
const pass = (m) => console.log(`✅ ${m}`);

if (!existsSync(CLAUDE_PATH)) {
  fail('CLAUDE.md missing');
} else {
  const c = readFileSync(CLAUDE_PATH, 'utf-8');
  const b = Buffer.byteLength(c, 'utf-8');
  if (b > SIZE_BLOCK) fail(`CLAUDE.md too large: ${b} > ${SIZE_BLOCK}`);
  else pass(`CLAUDE.md size: ${b} bytes`);
  
  if (!SECTIONS.every(s => c.includes(`## §${s}`))) fail('Missing sections in CLAUDE.md');
  if (c.charCodeAt(0) === 0xFEFF) fail('BOM detected in CLAUDE.md');
}

if (!existsSync(MEMORY_PATH)) {
  fail('MEMORY.md missing');
} else {
  const m = readFileSync(MEMORY_PATH, 'utf-8');
  if (!SECTIONS.every(s => m.includes(`## §${s}`))) fail('Missing sections in MEMORY.md');
  if (m.charCodeAt(0) === 0xFEFF) fail('BOM detected in MEMORY.md');
  
  const rules = (m.match(/\*\*CLAUDE\.md rules?:\*\* §[A-Z]+ [—\-] "/g) || []).length;
  if (rules === 0) console.warn('⚠️  No parseable rules in MEMORY.md');
  else pass(`Found ${rules} parseable rules in MEMORY.md`);
}

process.exit(err > 0 ? 1 : 0);

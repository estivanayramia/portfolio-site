#!/usr/bin/env node
/**
 * tools/update-agent-memory.mjs
 * UNIFIED BRIDGE: Updates CLAUDE.md (compact) and MEMORY.md (forensics).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT           = process.cwd();
const CLAUDE_PATH    = resolve(ROOT, 'CLAUDE.md');
const MEMORY_PATH    = resolve(ROOT, 'docs/MEMORY.md');
const SIZE_WARN      = 5800;
const SIZE_BLOCK     = 6500; // Increased to safe buffer, actual target < 4KB
const VALID_SECTIONS = ['ROUTING','SEC','CSS','BUILD','WORKER','SW','ENCODING','HOUSE'];

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 2) {
  if (args[i]?.startsWith('--')) opts[args[i].slice(2)] = args[i + 1] ?? '';
}

const section  = (opts.section  || process.env.RULE_SECTION  || '').toUpperCase().trim();
const rule     = (opts.rule     || process.env.RULE_TEXT     || '').trim();
const trigger  = (opts.trigger  || process.env.RULE_TRIGGER  || '').trim();
const after    = (opts.after    || process.env.RULE_AFTER    || '').trim();
const title    = (opts.title    || process.env.RULE_TITLE    || '').trim();
const detail   = (opts.detail   || process.env.RULE_DETAIL   || '').trim();
const files    = (opts.files    || process.env.RULE_FILES    || '').trim();
const validate = (opts.validate || process.env.RULE_VALIDATE || '').trim();
const status   = (opts.status   || process.env.RULE_STATUS   || '⚠️ Active').trim();
const date     =  opts.date     || new Date().toISOString().slice(0, 10);
const id       =  opts.id       || `${section}-${Date.now().toString(36).toUpperCase()}`;

if (!section || !rule || !after) {
  console.error('❌  update-agent-memory: --section, --rule, and --after are all required.');
  process.exit(1);
}
if (!VALID_SECTIONS.includes(section)) {
  console.error(`❌  update-agent-memory: --section must be: ${VALID_SECTIONS.join(', ')}`);
  process.exit(1);
}

const fullMode = !!(title || detail);

// UPDATE CLAUDE.md
if (!existsSync(CLAUDE_PATH)) {
  console.error('❌  CLAUDE.md not found.');
  process.exit(1);
}

let claude = readFileSync(CLAUDE_PATH, 'utf-8');
const normRule = rule.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

if (claude.toLowerCase().replace(/[^a-z0-9 ]/g, '').includes(normRule)) {
  console.log('ℹ️   update-agent-memory: Rule already in CLAUDE.md — skipping duplicate.');
} else {
  const anchor   = `## §${section}`;
  const secIdx   = claude.indexOf(anchor);
  if (secIdx === -1) { console.error(`❌  Section §${section} missing.`); process.exit(1); }
  
  const afterSec = claude.slice(secIdx + anchor.length);
  const sepMatch = afterSec.match(/\n---\n/);
  const insertAt = secIdx + anchor.length + (sepMatch ? sepMatch.index : afterSec.length);

  const prefix    = /^(NEVER|ALWAYS|WHEN|DO |DON)/i.test(rule) ? '' : 'RULE: ';
  const trgBullet = trigger ? ` (WHEN ${trigger.replace(/^when\s+/i, '').trim()})` : '';
  const bullet    = `\n- **${prefix}${rule}**${trgBullet}`;

  claude = claude.slice(0, insertAt) + bullet + claude.slice(insertAt);
  claude = appendToLog(claude, '<!-- FORMAT: YYYY-MM-DD | §SECTION | RULE | AFTER -->', `| ${date} | §${section} | ${rule.slice(0,40)} | ${after.slice(0,30)} |`);

  const bytes = Buffer.byteLength(claude, 'utf-8');
  if (bytes > SIZE_BLOCK) {
    console.error(`❌  CLAUDE.md would exceed ${SIZE_BLOCK} bytes (${bytes}). TRIM RULES.`);
    process.exit(1);
  }
  writeFileSync(CLAUDE_PATH, claude, 'utf-8');
  console.log(`✅  CLAUDE.md: Added rule to §${section} (${bytes} bytes)`);
}

// UPDATE MEMORY.md
if (fullMode) {
  if (!existsSync(MEMORY_PATH)) { console.error('❌ MEMORY.md missing'); process.exit(1); }
  let memory = readFileSync(MEMORY_PATH, 'utf-8');
  
  const dedupeKey = title || detail.slice(0, 40);
  if (memory.includes(`### ${id}`) || (dedupeKey && memory.toLowerCase().includes(dedupeKey.toLowerCase()))) {
    console.log('ℹ️   Incident already in MEMORY.md — skipping.');
  } else {
    const memAnchor = `## §${section}`;
    const memIdx    = memory.indexOf(memAnchor);
    if (memIdx === -1) { console.error(`❌ §${section} missing in MEMORY.md`); process.exit(1); }
    
    const afterMem = memory.slice(memIdx + memAnchor.length);
    const nextSec  = afterMem.match(/\n## §/);
    const insMemAt = memIdx + memAnchor.length + (nextSec ? nextSec.index : afterMem.length);

    const entry = `
  ### ${id} — Incident (${status})

**Date:** ${date}
**What broke:** ${after}
${detail ? `**Root cause:** ${detail}\n` : ''}${files ? `**Files:** \`${files}\`\n` : ''}${validate ? `**Val:** \`${validate}\`\n` : ''}**CLAUDE.md rule:** §${section} — "${rule}"

---
`;
    memory = memory.slice(0, insMemAt) + entry + memory.slice(insMemAt);
    memory = appendToLog(memory, '<!-- FORMAT: YYYY-MM-DD | §SECTION | ID | TITLE | STATUS -->', `| ${date} | §${section} | ${id} | ${(title||rule).slice(0,30)} | ${status} |`);
    writeFileSync(MEMORY_PATH, memory, 'utf-8');
    console.log(`✅  MEMORY.md: Added incident ${id}`);
  }
}

console.log(`\n    Commit: git add CLAUDE.md docs/MEMORY.md && git commit -m "rules(${section.toLowerCase()}): ${rule.slice(0,50)}"`);

// ── FIXED appendToLog (handles CRLF & comments safely) ──────────────────────
function appendToLog(content, anchorComment, newRow) {
  const anchorIdx = content.indexOf(anchorComment);
  if (anchorIdx === -1) return content;
  
  // Skip past the comment line itself to find the table
  const searchFrom = anchorIdx + anchorComment.length;
  const tableStart = content.indexOf('\n|', searchFrom); // Find first | at start of line
  if (tableStart === -1) return content;
  
  const tableSlice = content.slice(tableStart + 1); // skip \n
  const lines      = tableSlice.split('\n');
  let offset       = tableStart + 1;
  
  for (const line of lines) {
    if (line.startsWith('|')) offset += line.length + 1; // +1 for \n
    else break;
  }
  offset -= 1; // back up over last \n
  return content.slice(0, offset) + '\n' + newRow + content.slice(offset);
}

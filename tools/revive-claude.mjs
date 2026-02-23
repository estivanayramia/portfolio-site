#!/usr/bin/env node
/**
 * tools/revive-claude.mjs
 * Rebuilds CLAUDE.md (compact) from MEMORY.md (forensics).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT        = process.cwd();
const CLAUDE_PATH = resolve(ROOT, 'CLAUDE.md');
const MEMORY_PATH = resolve(ROOT, 'docs/MEMORY.md');
const SECTIONS    = ['ROUTING','SEC','CSS','BUILD','WORKER','SW','ENCODING','HOUSE'];

if (!existsSync(MEMORY_PATH)) process.exit(1);

const memory = readFileSync(MEMORY_PATH, 'utf-8');
const recovered = {};
for (const sec of SECTIONS) recovered[sec] = [];

// Matches: **CLAUDE.md rule:** §SECTION — "rule text"
const re = /\*\*CLAUDE\.md rules?:\*\* §([A-Z]+) [—\-] "?([^\n"]+)"?/gi;
let match;
while ((match = re.exec(memory)) !== null) {
  const [, sec, rule] = match;
  if (SECTIONS.includes(sec.toUpperCase()) && rule.trim()) {
    recovered[sec.toUpperCase()].push(rule.trim());
  }
}

const total = Object.values(recovered).reduce((a, v) => a + v.length, 0);
console.log(`Found ${total} rules in MEMORY.md`);

let needsRevive = false;
let reason = '';
if (!existsSync(CLAUDE_PATH)) {
  needsRevive = true;
  reason = 'CLAUDE.md does not exist';
} else {
  const existing = readFileSync(CLAUDE_PATH, 'utf-8');
  const missing = SECTIONS.filter(s => !existing.includes(`## §${s}`));
  if (missing.length > 0) {
    needsRevive = true;
    reason = `Missing sections: ${missing.join(', ')}`;
  }
}

if (!needsRevive) {
  console.log('CLAUDE.md is intact');
  process.exit(0);
}

const blocks = SECTIONS.map(sec => {
  const rules = recovered[sec].map(r => {
    const prefix = /^(NEVER|ALWAYS|WHEN|DO |DON)/i.test(r) ? '' : 'RULE: ';
    return `- **${prefix}${r}**`;
  }).join('\n');
  return `## §${sec}\n${rules || '- *(empty)*'}`;
});

const content = `<!-- CLAUDE.md · estivanyramia.com -->
<!-- TIER 1: Prevention. Read every session. Hard limit: 6 KB. -->
<!-- ⚡ REVIVED: ${new Date().toISOString().slice(0,10)} -->
<!-- UPDATE: node tools/update-agent-memory.mjs -->

# CLAUDE.md — Agent Prevention Rules

> **Boris Protocol — end every correction with:**
> \`node tools/update-agent-memory.mjs --section X --rule "..."\`

## Session Start Checklist
- [ ] Read this file
- [ ] \`npm run audit\`
- [ ] \`npm run memory:health\`

---

${blocks.join('\n\n---\n\n')}

---

## §AUTO-UPDATE LOG

<!-- ✍️ Auto-appended by tools/update-agent-memory.mjs — DO NOT edit manually -->
<!-- FORMAT: YYYY-MM-DD | §SECTION | RULE | AFTER -->

| Date | Section | Rule | After |
|---|---|---|---|
| ${new Date().toISOString().slice(0,10)} | ALL | Revived from MEMORY.md | Intact |
`;

writeFileSync(CLAUDE_PATH, content, 'utf-8');
console.log(`✅ CLAUDE.md revived (${Buffer.byteLength(content)} bytes)`);

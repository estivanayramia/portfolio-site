#!/usr/bin/env node
/**
 * Phase 1 Migration Tool
 * Safely updates hobbies-games.html to use unified achievement system.
 * 
 * Operations:
 * 1. Remove duplicate window.ACHIEVEMENTS object
 * 2. Remove unlockHubAchievement() wrapper function
 * 3. Remove legacy UI/storage helper functions
 * 4. Update all unlock calls to use full IDs
 * 5. Validate output
 * 
 * Usage:
 *   node scripts/migrate-phase1.mjs           # Apply changes
 *   node scripts/migrate-phase1.mjs --dry-run # Preview only
 */

import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

let stats = {
    linesRemoved: 0,
    unlockCallsUpdated: 0,
    functionsRemoved: 0,
    backupCreated: false
};

console.log(`${BLUE}═══════════════════════════════════════${RESET}`);
console.log(`${BLUE}  Phase 1 Migration Tool${RESET}`);
if (DRY_RUN) console.log(`${YELLOW}  [DRY RUN MODE - No changes will be saved]${RESET}`);
console.log(`${BLUE}═══════════════════════════════════════${RESET}\n`);

const HUB_PATH = join(ROOT, 'EN/hobbies-games.html');
const BACKUP_PATH = HUB_PATH + '.backup';

console.log(`Reading: ${HUB_PATH}`);
let content = readFileSync(HUB_PATH, 'utf8');
const originalLength = content.split('\n').length;

// BACKUP
if (!DRY_RUN) {
    copyFileSync(HUB_PATH, BACKUP_PATH);
    stats.backupCreated = true;
    console.log(`${GREEN}✓${RESET} Backup created: ${BACKUP_PATH}\n`);
}

// STEP 1: Remove window.ACHIEVEMENTS object
console.log(`${BLUE}[1/5]${RESET} Removing duplicate window.ACHIEVEMENTS object...`);
const achievementsPattern = /window\.ACHIEVEMENTS\s*=\s*\{[\s\S]*?\n\s*\};/;
if (achievementsPattern.test(content)) {
    const match = content.match(achievementsPattern);
    const linesRemoved = match[0].split('\n').length;
    content = content.replace(achievementsPattern, '// window.ACHIEVEMENTS removed (now in achievements-defs.js)');
    stats.linesRemoved += linesRemoved;
    stats.functionsRemoved++;
    console.log(`  ${GREEN}✓${RESET} Removed ${linesRemoved} lines`);
} else {
    console.log(`  ${YELLOW}⚠${RESET} Pattern not found (may be already migrated)`);
}

// STEP 2: Remove unlockHubAchievement function
console.log(`${BLUE}[2/5]${RESET} Removing unlockHubAchievement() wrapper...`);
const unlockHubPattern = /function unlockHubAchievement\([^)]*\)\s*\{[\s\S]*?^\s*\}/m;
if (unlockHubPattern.test(content)) {
    const match = content.match(unlockHubPattern);
    const linesRemoved = match[0].split('\n').length;
    content = content.replace(unlockHubPattern, '// unlockHubAchievement removed (use ArcadeAchievements.unlock directly)');
    stats.linesRemoved += linesRemoved;
    stats.functionsRemoved++;
    console.log(`  ${GREEN}✓${RESET} Removed ${linesRemoved} lines`);
} else {
    console.log(`  ${YELLOW}⚠${RESET} Pattern not found (may be already migrated)`);
}

// STEP 3: Remove legacy helper functions
console.log(`${BLUE}[3/5]${RESET} Removing legacy helper functions...`);
const helpersToRemove = [
    'loadGameData',
    'saveGameData',
    'getUnifiedUnlockedSet',
    'resolveAchievementDef',
    'renderGlobalAchievements',
    'refreshAchievementUI',
    'achievementPanelState',
    'renderAchievementPanel',
    'renderAllAchievementPanels',
    'escapeHtml' // Only if defined inline (keep if it's used elsewhere)
];

let helpersRemoved = 0;
for (const funcName of helpersToRemove) {
    // Match function declarations: function name(...) { ... }
    const pattern = new RegExp(`function ${funcName}\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\s*\\}`, 'm');
    // Also match const/let assignments: const name = function(...) { ... }
    const pattern2 = new RegExp(`(const|let|var)\\s+${funcName}\\s*=\\s*[\\s\\S]*?;`, 'm');
    
    if (pattern.test(content)) {
        const match = content.match(pattern);
        const linesRemoved = match[0].split('\n').length;
        content = content.replace(pattern, `// ${funcName} removed (now in arcade modules)`);
        stats.linesRemoved += linesRemoved;
        helpersRemoved++;
    } else if (pattern2.test(content)) {
        const match = content.match(pattern2);
        const linesRemoved = match[0].split('\n').length;
        content = content.replace(pattern2, `// ${funcName} removed (now in arcade modules)`);
        stats.linesRemoved += linesRemoved;
        helpersRemoved++;
    }
}

if (helpersRemoved > 0) {
    console.log(`  ${GREEN}✓${RESET} Removed ${helpersRemoved} helper functions`);
    stats.functionsRemoved += helpersRemoved;
} else {
    console.log(`  ${YELLOW}⚠${RESET} No helpers found (may be already migrated)`);
}

// STEP 4: Remove GAME_OBJECTIVES object
console.log(`${BLUE}[4/5]${RESET} Removing GAME_OBJECTIVES object...`);
const objectivesPattern = /const GAME_OBJECTIVES\s*=\s*\{[\s\S]*?\n\s*\};/;
if (objectivesPattern.test(content)) {
    const match = content.match(objectivesPattern);
    const linesRemoved = match[0].split('\n').length;
    content = content.replace(objectivesPattern, '// GAME_OBJECTIVES removed (integrated into achievement descriptions)');
    stats.linesRemoved += linesRemoved;
    console.log(`  ${GREEN}✓${RESET} Removed ${linesRemoved} lines`);
} else {
    console.log(`  ${YELLOW}⚠${RESET} Pattern not found (may be already migrated)`);
}

// STEP 5: Update unlock calls
console.log(`${BLUE}[5/5]${RESET} Updating achievement unlock calls...`);
const unlockPattern = /unlockHubAchievement\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\)/g;
let match;
const replacements = [];

while ((match = unlockPattern.exec(content)) !== null) {
    const game = match[1];
    const id = match[2];
    const fullId = `${game}_${id}`;
    const oldCall = match[0];
    const newCall = `window.ArcadeAchievements.unlock('${fullId}')`;
    
    replacements.push({ oldCall, newCall, line: content.substring(0, match.index).split('\n').length });
}

// Apply replacements
for (const rep of replacements) {
    content = content.replace(rep.oldCall, rep.newCall);
    stats.unlockCallsUpdated++;
}

if (stats.unlockCallsUpdated > 0) {
    console.log(`  ${GREEN}✓${RESET} Updated ${stats.unlockCallsUpdated} unlock calls`);
    if (VERBOSE) {
        replacements.forEach(r => {
            console.log(`    Line ${r.line}: ${r.oldCall} → ${r.newCall}`);
        });
    }
} else {
    console.log(`  ${YELLOW}⚠${RESET} No unlock calls found (may be already migrated)`);
}

// VALIDATION
console.log(`\n${BLUE}Validating output...${RESET}`);
const finalLength = content.split('\n').length;
const netChange = finalLength - originalLength;

console.log(`  Original: ${originalLength} lines`);
console.log(`  Final: ${finalLength} lines`);
console.log(`  Net change: ${netChange >= 0 ? '+' : ''}${netChange} lines\n`);

// Check for common issues
let validationErrors = [];

if (content.includes('unlockHubAchievement(')) {
    validationErrors.push('Still contains unlockHubAchievement calls (incomplete migration)');
}

if (content.includes('window.ACHIEVEMENTS = {')) {
    validationErrors.push('Still contains window.ACHIEVEMENTS object');
}

if (!content.includes('window.ArcadeAchievements')) {
    validationErrors.push('No ArcadeAchievements references found (migration may have failed)');
}

if (validationErrors.length > 0) {
    console.log(`${RED}✗ Validation failed:${RESET}`);
    validationErrors.forEach(err => console.log(`  ${RED}•${RESET} ${err}`));
    console.log(`\n${RED}Migration aborted. Fix errors and try again.${RESET}\n`);
    process.exit(1);
}

console.log(`${GREEN}✓ Validation passed${RESET}\n`);

// SAVE
if (!DRY_RUN) {
    writeFileSync(HUB_PATH, content, 'utf8');
    console.log(`${GREEN}✓ Changes saved to ${HUB_PATH}${RESET}\n`);
} else {
    console.log(`${YELLOW}⚠ DRY RUN: No changes saved${RESET}\n`);
}

// SUMMARY
console.log(`${BLUE}═══════════════════════════════════════${RESET}`);
console.log(`${BLUE}  Migration Summary${RESET}`);
console.log(`${BLUE}═══════════════════════════════════════${RESET}`);
console.log(`  Lines removed: ${stats.linesRemoved}`);
console.log(`  Functions removed: ${stats.functionsRemoved}`);
console.log(`  Unlock calls updated: ${stats.unlockCallsUpdated}`);
if (stats.backupCreated) {
    console.log(`  ${GREEN}✓${RESET} Backup: ${BACKUP_PATH}`);
}
console.log();

if (!DRY_RUN) {
    console.log(`${GREEN}✓ Migration complete!${RESET}\n`);
    console.log(`Next steps:`);
    console.log(`  1. Test locally: Open /hobbies-games in browser`);
    console.log(`  2. Check console for errors`);
    console.log(`  3. Trigger achievements, verify toasts`);
    console.log(`  4. If issues, rollback: cp ${BACKUP_PATH} ${HUB_PATH}`);
    console.log();
} else {
    console.log(`To apply changes, run without --dry-run:\n`);
    console.log(`  ${BLUE}node scripts/migrate-phase1.mjs${RESET}\n`);
}

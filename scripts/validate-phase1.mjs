#!/usr/bin/env node
/**
 * Phase 1 Validation Script
 * Ensures achievement system unification is safe before applying changes.
 * 
 * Checks:
 * 1. arcade-core.js has strict validation logic
 * 2. achievements-defs.js contains all expected IDs
 * 3. hobbies-games.html unlock calls match known patterns
 * 4. No orphaned achievement IDs (defined but never unlocked)
 * 5. localStorage migration won't break existing users
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

let errors = [];
let warnings = [];
let passed = 0;
const total = 10;

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function check(name, fn) {
    try {
        process.stdout.write(`${BLUE}[${passed + 1}/${total}]${RESET} ${name}... `);
        const result = fn();
        if (result === true || result === undefined) {
            console.log(`${GREEN}✓${RESET}`);
            passed++;
        } else {
            console.log(`${RED}✗${RESET}`);
            errors.push(`${name}: ${result}`);
        }
    } catch (e) {
        console.log(`${RED}✗${RESET}`);
        errors.push(`${name}: ${e.message}`);
    }
}

function warn(message) {
    warnings.push(message);
}

console.log(`${BLUE}═══════════════════════════════════════${RESET}`);
console.log(`${BLUE}  Phase 1 Validation (Achievement Unification)${RESET}`);
console.log(`${BLUE}═══════════════════════════════════════${RESET}\n`);

// CHECK 1: arcade-core.js exists and has strict validation
check('arcade-core.js has strict validation', () => {
    const path = join(ROOT, 'assets/js/arcade/arcade-core.js');
    if (!existsSync(path)) return 'File not found';
    
    const content = readFileSync(path, 'utf8');
    
    if (!content.includes('unlock(id)')) return 'unlock() method not found';
    if (!content.includes('console.error')) return 'No error logging for invalid IDs';
    if (!content.includes('ACHIEVEMENTS[id]')) return 'No definition lookup';
    if (!content.includes('typeof id !== \'string\'')) return 'No type checking';
    
    return true;
});

// CHECK 2: achievements-defs.js has all first-party game IDs
let EXPECTED_IDS = [];
check('achievements-defs.js has all first-party IDs', () => {
    const path = join(ROOT, 'assets/js/arcade/achievements-defs.js');
    if (!existsSync(path)) return 'File not found';
    
    const content = readFileSync(path, 'utf8');
    
    const expectedGames = {
        snake: ['first_food', 'combo_5', 'score_100', 'level_5', 'length_20'],
        breaker: ['first_brick', 'score_500', 'perfect_level', 'level_3', 'powerup_5'],
        merge: ['tile_128', 'tile_512', 'tile_1024', 'tile_2048', 'score_5000'],
        invaders: ['first_kill', 'wave_3', 'aliens_50', 'score_500', 'perfect_wave']
    };
    
    for (const [game, ids] of Object.entries(expectedGames)) {
        for (const id of ids) {
            const fullId = `${game}_${id}`;
            EXPECTED_IDS.push(fullId);
            
            if (!content.includes(`${fullId}:`)) {
                return `Missing achievement: ${fullId}`;
            }
            if (!content.includes(`id: '${fullId}'`)) {
                return `Achievement ${fullId} missing id field`;
            }
        }
    }
    
    return true;
});

// CHECK 3: hobbies-games.html exists
let hubContent = '';
check('hobbies-games.html exists', () => {
    const path = join(ROOT, 'EN/hobbies-games.html');
    if (!existsSync(path)) return 'File not found';
    
    hubContent = readFileSync(path, 'utf8');
    return true;
});

// CHECK 4: Find all unlock calls in hobbies-games.html
let unlockCalls = [];
check('Extract unlock calls from hobbies-games.html', () => {
    // Pattern 1: unlockHubAchievement('game', 'id')
    const pattern1 = /unlockHubAchievement\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\)/g;
    let match;
    
    while ((match = pattern1.exec(hubContent)) !== null) {
        unlockCalls.push({
            game: match[1],
            id: match[2],
            fullId: `${match[1]}_${match[2]}`,
            original: match[0],
            line: hubContent.substring(0, match.index).split('\n').length
        });
    }
    
    if (unlockCalls.length === 0) {
        warn('No unlockHubAchievement calls found (might already be migrated)');
    }
    
    return true;
});

// CHECK 5: All unlock calls reference valid achievement IDs
check('All unlock calls use valid achievement IDs', () => {
    const invalid = unlockCalls.filter(call => !EXPECTED_IDS.includes(call.fullId));
    
    if (invalid.length > 0) {
        return `Found ${invalid.length} invalid IDs: ${invalid.map(c => c.fullId).join(', ')}`;
    }
    
    return true;
});

// CHECK 6: No orphaned achievements (defined but never unlocked)
check('No orphaned achievements', () => {
    const unlockedIds = new Set(unlockCalls.map(c => c.fullId));
    const orphaned = EXPECTED_IDS.filter(id => !unlockedIds.has(id));
    
    if (orphaned.length > 0) {
        warn(`Found ${orphaned.length} achievements never unlocked: ${orphaned.join(', ')}`);
        warn('These achievements may be unreachable by users.');
    }
    
    return true;
});

// CHECK 7: arcade-core.js has M key handler
check('arcade-core.js has M key mute toggle', () => {
    const path = join(ROOT, 'assets/js/arcade/arcade-core.js');
    const content = readFileSync(path, 'utf8');
    
    if (!content.includes("e.key.toLowerCase() === 'm'")) return 'M key handler not found';
    if (!content.includes('this.toggle()')) return 'Toggle call not found in keydown handler';
    
    return true;
});

// CHECK 8: arcade-core.js broadcasts to iframes
check('arcade-core.js broadcasts mute to iframes', () => {
    const path = join(ROOT, 'assets/js/arcade/arcade-core.js');
    const content = readFileSync(path, 'utf8');
    
    if (!content.includes('broadcastToIframes')) return 'broadcastToIframes method not found';
    if (!content.includes('postMessage')) return 'postMessage not found';
    if (!content.includes("type: 'arcade-mute'")) return 'arcade-mute message type not found';
    
    return true;
});

// CHECK 9: Verify no placeholder strings in arcade-core.js
check('No placeholder sentinel strings in toasts', () => {
    const path = join(ROOT, 'assets/js/arcade/arcade-core.js');
    const content = readFileSync(path, 'utf8');
    
    const badPatterns = ['[Circular]', '[Object]', '[Array]', '[Unserializable]'];
    for (const pattern of badPatterns) {
        if (content.includes(pattern)) {
            return `Found placeholder string: ${pattern}`;
        }
    }
    
    return true;
});

// CHECK 10: Migration won't break existing localStorage
check('localStorage migration is backward compatible', () => {
    // Verify that arcade-core.js reads from 'arcade_achievements'
    const path = join(ROOT, 'assets/js/arcade/arcade-core.js');
    const content = readFileSync(path, 'utf8');
    
    if (!content.includes("localStorage.getItem('arcade_achievements')")) {
        return 'Does not read from arcade_achievements key';
    }
    
    // Verify it doesn't DELETE old keys (defensive approach)
    if (content.includes('removeItem') && content.includes('_data')) {
        warn('arcade-core.js may delete legacy per-game storage (verify intentional)');
    }
    
    return true;
});

// SUMMARY
console.log(`\n${BLUE}═══════════════════════════════════════${RESET}`);
console.log(`${BLUE}  Results${RESET}`);
console.log(`${BLUE}═══════════════════════════════════════${RESET}\n`);

if (errors.length === 0) {
    console.log(`${GREEN}✓ All ${passed}/${total} checks passed!${RESET}\n`);
} else {
    console.log(`${RED}✗ ${errors.length} check(s) failed:${RESET}`);
    errors.forEach(err => console.log(`  ${RED}•${RESET} ${err}`));
    console.log();
}

if (warnings.length > 0) {
    console.log(`${YELLOW}⚠ ${warnings.length} warning(s):${RESET}`);
    warnings.forEach(warn => console.log(`  ${YELLOW}•${RESET} ${warn}`));
    console.log();
}

if (unlockCalls.length > 0) {
    console.log(`${BLUE}Found ${unlockCalls.length} unlock calls to migrate:${RESET}`);
    console.log(`\nReplacement Map (save to docs/UNLOCK_CALLS_MAP.json):\n`);
    console.log(JSON.stringify(unlockCalls, null, 2));
    console.log();
}

if (errors.length === 0) {
    console.log(`${GREEN}✓ SAFE TO PROCEED with hobbies-games.html cleanup${RESET}\n`);
    process.exit(0);
} else {
    console.log(`${RED}✗ FIX ERRORS BEFORE PROCEEDING${RESET}\n`);
    process.exit(1);
}

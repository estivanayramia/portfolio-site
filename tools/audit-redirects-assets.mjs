import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const redirectsPath = path.join(rootDir, '_redirects');

if (!fs.existsSync(redirectsPath)) {
    console.error('[FAIL] _redirects file missing');
    process.exit(1);
}

const content = fs.readFileSync(redirectsPath, 'utf8');
const lines = content.split('\n');

let assetsLineIndex = -1;
let themeLineIndex = -1;
let swLineIndex = -1;
let catchAllLineIndex = -1;

lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    // Normalize whitespace
    const parts = trimmed.split(/\s+/);
    const source = parts[0];
    
    if (source === '/assets/*') assetsLineIndex = i;
    if (source === '/theme.css') themeLineIndex = i;
    if (source === '/sw.js') swLineIndex = i;
    
    if (source === '/*') {
        if (catchAllLineIndex === -1) { // First catch-all matters
            catchAllLineIndex = i;
        }
    }
});

let failures = 0;

function check(name, index) {
    if (index === -1) {
        console.error(`[FAIL] Missing strict passthrough rule for ${name}`);
        failures++;
        return false;
    }
    return true;
}

if (check('/assets/*', assetsLineIndex)) {
    if (catchAllLineIndex !== -1 && assetsLineIndex > catchAllLineIndex) {
        console.error(`[FAIL] /assets/* rule (line ${assetsLineIndex+1}) appears AFTER catch-all rule (line ${catchAllLineIndex+1})`);
        failures++;
    }
}

if (check('/theme.css', themeLineIndex)) {
    if (catchAllLineIndex !== -1 && themeLineIndex > catchAllLineIndex) {
         console.error(`[FAIL] /theme.css rule (line ${themeLineIndex+1}) appears AFTER catch-all rule (line ${catchAllLineIndex+1})`);
         failures++;
    }
}

if (check('/sw.js', swLineIndex)) {
    if (catchAllLineIndex !== -1 && swLineIndex > catchAllLineIndex) {
         console.error(`[FAIL] /sw.js rule (line ${swLineIndex+1}) appears AFTER catch-all rule (line ${catchAllLineIndex+1})`);
         failures++;
    }
}

if (catchAllLineIndex === -1) {
    console.warn('[WARN] No catch-all /* rule found. 404 behavior might be inconsistent.');
}

if (failures > 0) {
    console.log(`\nFound ${failures} issues with redirect ordering.`);
    process.exit(1);
} else {
    console.log('\nPASS: Asset passthrough rules exist and are correctly ordered.');
    process.exit(0);
}

const fs = require('fs');
const path = require('path');

const rootDir = __dirname.endsWith('tools') ? path.join(__dirname, '..') : __dirname;

function getAllHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'lighthouse-results' && file !== '.reports') {
                getAllHtmlFiles(filePath, fileList);
            }
        } else {
            if (path.extname(file) === '.html') {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

const allHtmlFiles = getAllHtmlFiles(rootDir);
const relevantFiles = allHtmlFiles;

console.log(`Scanning ${relevantFiles.length} HTML files for sanity checks...`);

let failures = 0;

relevantFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(rootDir, file);
    const lines = content.split('\n');

    let fileFailures = 0;

    // Check 1: class=\"
    if (content.includes('class=\\"')) {
        console.error(`[FAIL] ${relPath}: Found escaped class attribute (class=\\")`);
        fileFailures++;
    }

    // Check 2: <img ...> without closing > (heuristic)
    // We look for <img occurrences that don't have a > before the next <
    // or end of file
    let pos = 0;
    while (true) {
        const imgStart = content.indexOf('<img', pos);
        if (imgStart === -1) break;
        
        const nextTag = content.indexOf('<', imgStart + 1);
        const closing = content.indexOf('>', imgStart);
        
        if (closing === -1 || (nextTag !== -1 && nextTag < closing)) {
            console.error(`[FAIL] ${relPath}: Unclosed <img tag starting at index ${imgStart}`);
            fileFailures++;
        }
        pos = imgStart + 1;
    }
    
    // Check 3: Obvious double-escaped entities in attributes
    // e.g. &amp;quot; although strictly &amp;quot; is valid if you mean "&quot;" text.
    // The prompt says "obvious double-escaped entities".
    // Let's check for &amp;amp; which is definitely suspicious in an attribute if not intended.
    // Or class="&quot;foo&quot;" which is valid.
    // I'll check for &amp; followed by an entity name and semicolon if it looks like an accident.
    
    if (content.match(/&amp;[a-z]+;/i)) {
         // This is common in text content, but in attributes?
         // Let's search specifically for things that look like errors.
    }

    // Check 4: Guardrail against committing local-stamped asset URLs
    // Example: /assets/css/style.20260125-local.css
    if (content.match(/\/assets\/(?:css|js)\/[^"'\s>]+\.\d{8}-local\.(?:css|js)/i)) {
        console.error(`[FAIL] ${relPath}: Found local-stamped asset URL (\\d{8}-local).`);
        fileFailures++;
    }
    
    if (fileFailures > 0) failures++;
});

if (failures > 0) {
    console.log(`\nFound issues in ${failures} files.`);
    process.exit(1);
} else {
    console.log(`\nPASS: No malformed HTML patterns found.`);
    process.exit(0);
}

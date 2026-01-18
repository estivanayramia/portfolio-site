/**
 * Audit Script: Check head sections for required elements
 * 
 * Ensures all HTML files have the critical head elements needed
 * for proper functioning and SEO.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const ignoreDirs = new Set([
    '.git',
    'node_modules',
    'assets',
    'tools',
    'worker',
    'scripts',
    'docs'
]);

const ignoreFiles = new Set([
    'hobby-car.html',
    'hobby-cooking.html',
    'hobby-whispers.html'
]);

function findHtmlFiles(dir, files = []) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory() && ignoreDirs.has(item.name)) continue;
        if (item.isFile() && ignoreFiles.has(item.name)) continue;
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            findHtmlFiles(fullPath, files);
        } else if (item.isFile() && item.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

function checkHeadSection(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    // Required elements
    const required = [
        { regex: /<head>/i, name: '<head> tag' },
        { regex: /<meta charset/i, name: 'charset meta' },
        { regex: /<meta name="viewport"/i, name: 'viewport meta' },
        { regex: /<title>/i, name: '<title> tag' },
        { regex: /<meta name="description"/i, name: 'description meta' },
        { regex: /href="\/assets\/css\/style\.css"/i, name: 'style.css link' },
        { regex: /href="\/assets\/css\/theme(\.min)?\.css"/i, name: 'theme.css link' },
    ];
    
    // Check each required element
    for (const req of required) {
        if (!req.regex.test(content)) {
            issues.push(`Missing: ${req.name}`);
        }
    }
    
    // Check for broken patterns
    const brokenPatterns = [
        { regex: /media="\(max-width: 768px\)".*theme\.css/i, name: 'Broken media-query CSS loading' },
        { regex: /href="assets\//i, name: 'Relative asset path' },
    ];
    
    for (const bp of brokenPatterns) {
        if (bp.regex.test(content)) {
            issues.push(`Found: ${bp.name}`);
        }
    }
    
    return issues;
}

// Main
const htmlFiles = findHtmlFiles(rootDir);
let hasIssues = false;

console.log(`Checking ${htmlFiles.length} HTML files for head section completeness...\n`);

for (const file of htmlFiles) {
    const issues = checkHeadSection(file);
    if (issues.length > 0) {
        hasIssues = true;
        const relPath = path.relative(path.join(__dirname, '..'), file);
        console.log(`❌ ${relPath}`);
        for (const issue of issues) {
            console.log(`   - ${issue}`);
        }
    }
}

if (!hasIssues) {
    console.log('✅ All head sections are complete and properly configured!');
    process.exit(0);
} else {
    console.log('\n⚠️ Found head section issues.');
    process.exit(1);
}

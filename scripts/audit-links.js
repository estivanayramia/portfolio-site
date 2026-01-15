/**
 * Audit Script: Check for relative asset paths in /en folder
 * 
 * Ensures all asset paths are absolute (starting with /) to prevent
 * 404 errors when pages are in subdirectories like /en/.
 */

const fs = require('fs');
const path = require('path');

const enDir = path.join(__dirname, '..', 'en');

function findHtmlFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findHtmlFiles(fullPath, files);
        } else if (item.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

function checkRelativePaths(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];
    
    // Patterns that indicate relative paths (bad)
    const badPatterns = [
        { regex: /href="assets\//g, msg: 'Relative href to assets/' },
        { regex: /src="assets\//g, msg: 'Relative src to assets/' },
        { regex: /href="\.\.\/assets\//g, msg: 'Relative ../assets/' },
        { regex: /src="\.\.\/assets\//g, msg: 'Relative ../assets/' },
    ];
    
    for (const pattern of badPatterns) {
        const matches = content.match(pattern.regex);
        if (matches) {
            issues.push({ pattern: pattern.msg, count: matches.length });
        }
    }
    
    return issues;
}

// Main
const htmlFiles = findHtmlFiles(enDir);
let hasIssues = false;

console.log(`Checking ${htmlFiles.length} HTML files in /en for relative paths...\n`);

for (const file of htmlFiles) {
    const issues = checkRelativePaths(file);
    if (issues.length > 0) {
        hasIssues = true;
        const relPath = path.relative(path.join(__dirname, '..'), file);
        console.log(`❌ ${relPath}`);
        for (const issue of issues) {
            console.log(`   - ${issue.pattern}: ${issue.count} occurrence(s)`);
        }
    }
}

if (!hasIssues) {
    console.log('✅ All files use absolute asset paths!');
    process.exit(0);
} else {
    console.log('\n⚠️ Found relative paths that could cause 404 errors.');
    process.exit(1);
}

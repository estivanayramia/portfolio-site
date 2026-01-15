/**
 * Fix CSS Loading Script
 * 
 * This script fixes the unreliable CSS loading pattern across all HTML pages.
 * The old pattern (media="print" data-media="...") required JS to flip the media attribute,
 * which could fail and leave desktop without theme styles.
 * 
 * New pattern: Simple, reliable CSS loading that works everywhere.
 */

const fs = require('fs');
const path = require('path');

// Find all HTML files in the project (excluding tools/archive)
function findHtmlFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        // Skip archive and node_modules
        if (item === 'archive' || item === 'node_modules' || item === '_baseline' || item === '_current') continue;
        
        if (stat.isDirectory()) {
            findHtmlFiles(fullPath, files);
        } else if (item.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    return files;
}

// Standard CSS loading pattern - simple and reliable
const STANDARD_THEME_CSS = `    <!-- Theme CSS - loads reliably for all viewports -->
    <link rel="stylesheet" href="/assets/css/theme.css">`;

// Patterns to match and replace
const cssPatterns = [
    // Pattern 1: theme.min.css with media tricks (3 lines)
    {
        regex: /\s*<link rel="stylesheet" href="\/assets\/css\/theme\.min\.css" media="\(max-width: 768px\)">\s*\n\s*<link rel="stylesheet" href="\/assets\/css\/theme\.min\.css" media="print" data-media="\(min-width: 769px\)">\s*\n\s*<noscript><link rel="stylesheet" href="\/assets\/css\/theme\.min\.css"><\/noscript>/g,
        replacement: STANDARD_THEME_CSS
    },
    // Pattern 2: theme.css with media tricks (3 lines)
    {
        regex: /\s*<link rel="stylesheet" href="\/assets\/css\/theme\.css" media="\(max-width: 768px\)">\s*\n\s*<link rel="stylesheet" href="\/assets\/css\/theme\.css" media="print" data-media="\(min-width: 769px\)">\s*\n\s*<noscript><link rel="stylesheet" href="\/assets\/css\/theme\.css"><\/noscript>/g,
        replacement: STANDARD_THEME_CSS
    },
    // Pattern 3: Simple theme.css load (already correct, just normalize)
    {
        regex: /<link rel="stylesheet" href="\/assets\/css\/theme\.css"\s*\/?>/g,
        replacement: '<link rel="stylesheet" href="/assets/css/theme.css">'
    }
];

// Also update any pages using theme.min.css to use theme.css (consistency)
const minToNormalPattern = {
    regex: /href="\/assets\/css\/theme\.min\.css"/g,
    replacement: 'href="/assets/css/theme.css"'
};

function fixCssLoading(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check for the media-query trick pattern
    if (content.includes('media="(max-width: 768px)"') && content.includes('theme.css')) {
        for (const pattern of cssPatterns) {
            const newContent = content.replace(pattern.regex, pattern.replacement);
            if (newContent !== content) {
                content = newContent;
                modified = true;
            }
        }
    }
    
    // Normalize theme.min.css to theme.css
    if (content.includes('theme.min.css')) {
        const newContent = content.replace(minToNormalPattern.regex, minToNormalPattern.replacement);
        if (newContent !== content) {
            content = newContent;
            modified = true;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
        return true;
    }
    return false;
}

// Main execution
const rootDir = path.resolve(__dirname, '..');
const htmlFiles = findHtmlFiles(rootDir);

console.log(`Found ${htmlFiles.length} HTML files to check...\n`);

let fixedCount = 0;
for (const file of htmlFiles) {
    if (fixCssLoading(file)) {
        fixedCount++;
    }
}

console.log(`\n✨ Done! Fixed ${fixedCount} files.`);

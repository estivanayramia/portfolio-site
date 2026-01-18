// Script to normalize internal links to clean URLs.
// - Strips trailing .html
// - Converts /index.html to /
// - Leaves external URLs untouched

const fs = require('fs');
const path = require('path');

const foldersToScan = ['.', 'en', 'es', 'ar'];

let totalFiles = 0;
let totalChanges = 0;

function getAllHtmlFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (item.name === 'node_modules' || item.name === '.git') continue;
            files.push(...getAllHtmlFiles(fullPath));
        } else if (item.isFile() && item.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }

    return files;
}

function normalizeHrefValue(hrefValue) {
    // skip external, anchors, mailto, tel, javascript
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(hrefValue)) return hrefValue;
    if (hrefValue.startsWith('#')) return hrefValue;

    // Only touch site-root relative and relative links
    let normalized = hrefValue;

    // /index.html -> /
    normalized = normalized.replace(/\/index\.html(\?|#|$)/i, '/$1');
    // any /foo/index.html -> /foo/
    normalized = normalized.replace(/\/index\.html(\?|#|$)/ig, '/$1');
    // strip trailing .html
    normalized = normalized.replace(/\.html(\?|#|$)/i, '$1');

    return normalized;
}

function updateLinksInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let fileChanges = 0;

    // Normalize href="..." and href='...'
    content = content.replace(/href=(['"])([^'"]+)\1/gi, (match, quote, url) => {
        const normalized = normalizeHrefValue(url);
        if (normalized === url) return match;
        fileChanges++;
        return `href=${quote}${normalized}${quote}`;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalChanges += fileChanges;
        console.log(`✓ Updated ${filePath} (${fileChanges} changes)`);
    }
}

console.log('🔗 Normalizing internal links to clean URLs...\n');

for (const folder of foldersToScan) {
    const folderPath = path.resolve(folder);
    if (!fs.existsSync(folderPath)) continue;
    const files = getAllHtmlFiles(folderPath);
    for (const file of files) {
        updateLinksInFile(file);
        totalFiles++;
    }
}

console.log(`\n✅ Complete! Scanned ${totalFiles} files, made ${totalChanges} link updates`);

// Script to update all internal links to use .html extensions
// Removes clean URL behavior - all links must explicitly reference .html files

const fs = require('fs');
const path = require('path');

const foldersToScan = ['en', 'es', 'ar'];
let totalFiles = 0;
let totalChanges = 0;

function getAllHtmlFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files.push(...getAllHtmlFiles(fullPath));
        } else if (item.isFile() && item.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

function updateLinksInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let fileChanges = 0;
    
    // Pattern 1: href="/en/something" (not ending in .html or /)
    content = content.replace(/href="(\/en\/[^"]+?)(?<!\.html)(?<!\/)"/g, (match, path) => {
        // Skip if it's already .html, an anchor #, has a query ?, or is /assets/
        if (path.endsWith('.html') || path.includes('#') || path.includes('?') || path.includes('/assets/')) {
            return match;
        }
        fileChanges++;
        return `href="${path}.html"`;
    });
    
    // Pattern 2: href="/en/projects/slug" style links
    content = content.replace(/href="(\/en\/projects\/[^"\/]+)(?<!\.html)"/g, (match, path) => {
        if (path.endsWith('.html') || path.includes('#') || path.includes('?')) {
            return match;
        }
        fileChanges++;
        return `href="${path}.html"`;
    });
    
    // Pattern 3: href="/en/hobbies/slug" style links
    content = content.replace(/href="(\/en\/hobbies\/[^"\/]+)(?<!\.html)"/g, (match, path) => {
        if (path.endsWith('.html') || path.includes('#') || path.includes('?') || path.includes('hobbies-games')) {
            return match;
        }
        fileChanges++;
        return `href="${path}.html"`;
    });
    
    // Pattern 4: href="/en/hobbies-games/slug" style links
    content = content.replace(/href="(\/en\/hobbies-games\/[^"\/]+)(?<!\.html)"/g, (match, path) => {
        if (path.endsWith('.html') || path.includes('#') || path.includes('?')) {
            return match;
        }
        fileChanges++;
        return `href="${path}.html"`;
    });
    
    // Pattern 5: Legacy game shortcuts like /snake, /2048, /breaker, /invaders
    content = content.replace(/href="(\/(snake|2048|breaker|invaders|block-breaker|space-invaders))"/g, (match, fullPath, game) => {
        fileChanges++;
        const gameName = game === '2048' ? '2048' : 
                        game === 'snake' ? 'snake' :
                        game === 'breaker' ? 'block-breaker' :
                        game === 'invaders' ? 'space-invaders' :
                        game === 'block-breaker' ? 'block-breaker' :
                        game === 'space-invaders' ? 'space-invaders' : game;
        return `href="/en/hobbies-games/${gameName}.html"`;
    });
    
    // Pattern 6: Fix directory references like /en/ or /en/projects/ to point to index.html
    content = content.replace(/href="(\/en|\/en\/projects|\/en\/hobbies|\/en\/hobbies-games)\/"(?!>)/g, (match, path) => {
        fileChanges++;
        return `href="${path}/index.html"`;
    });
    
    // Pattern 7: Naked /en reference
    content = content.replace(/href="\/en"(?=[^\/]|$)/g, () => {
        fileChanges++;
        return 'href="/en/index.html"';
    });
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Updated ${filePath} (${fileChanges} changes)`);
        totalChanges += fileChanges;
        return true;
    }
    
    return false;
}

console.log('🔗 Updating internal links to use .html extensions...\n');

for (const folder of foldersToScan) {
    if (!fs.existsSync(folder)) {
        console.log(`⚠ Folder ${folder}/ does not exist, skipping`);
        continue;
    }
    
    const files = getAllHtmlFiles(folder);
    console.log(`📁 Scanning ${folder}/ (${files.length} files)`);
    
    for (const file of files) {
        updateLinksInFile(file);
        totalFiles++;
    }
}

console.log(`\n✅ Complete! Scanned ${totalFiles} files, made ${totalChanges} link updates`);

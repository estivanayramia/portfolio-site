// Script to update canonical and og:url meta tags to use .html extensions

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

function updateMetaTagsInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let fileChanges = 0;
    
    // Update canonical links - add .html if missing
    content = content.replace(/<link rel="canonical" href="https:\/\/www\.estivanayramia\.com(\/[^"]+?)(?<!\.html)(?<!\/)">/g, (match, path) => {
        // Skip if already ends in .html or if it's a directory ending in /
        if (path.endsWith('.html') || path.endsWith('/')) {
            return match;
        }
        fileChanges++;
        return `<link rel="canonical" href="https://www.estivanayramia.com${path}.html">`;
    });
    
    // Update og:url meta tags - add .html if missing
    content = content.replace(/<meta property="og:url" content="https:\/\/www\.estivanayramia\.com(\/[^"]+?)(?<!\.html)(?<!\/)">/g, (match, path) => {
        if (path.endsWith('.html') || path.endsWith('/')) {
            return match;
        }
        fileChanges++;
        return `<meta property="og:url" content="https://www.estivanayramia.com${path}.html">`;
    });
    
    // Fix directory references in canonical (should point to index.html)
    content = content.replace(/<link rel="canonical" href="https:\/\/www\.estivanayramia\.com(\/en|\/en\/projects|\/en\/hobbies|\/en\/hobbies-games)\/">/g, (match, path) => {
        fileChanges++;
        return `<link rel="canonical" href="https://www.estivanayramia.com${path}/index.html">`;
    });
    
    // Fix directory references in og:url (should point to index.html)
    content = content.replace(/<meta property="og:url" content="https:\/\/www\.estivanayramia\.com(\/en|\/en\/projects|\/en\/hobbies|\/en\/hobbies-games)\/">/g, (match, path) => {
        fileChanges++;
        return `<meta property="og:url" content="https://www.estivanayramia.com${path}/index.html">`;
    });
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Updated ${filePath} (${fileChanges} meta tag changes)`);
        totalChanges += fileChanges;
        return true;
    }
    
    return false;
}

console.log('🏷️  Updating canonical and og:url meta tags to use .html...\n');

for (const folder of foldersToScan) {
    if (!fs.existsSync(folder)) {
        console.log(`⚠ Folder ${folder}/ does not exist, skipping`);
        continue;
    }
    
    const files = getAllHtmlFiles(folder);
    console.log(`📁 Scanning ${folder}/ (${files.length} files)`);
    
    for (const file of files) {
        updateMetaTagsInFile(file);
        totalFiles++;
    }
}

console.log(`\n✅ Complete! Scanned ${totalFiles} files, made ${totalChanges} meta tag updates`);

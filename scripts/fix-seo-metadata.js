const fs = require('fs');
const path = require('path');

console.log('Fixing SEO metadata and JSON-LD URLs to include /en/ prefix and .html extensions...\n');

// Recursively find all HTML files
function findHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findHtmlFiles(filePath, fileList);
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

const htmlFiles = findHtmlFiles(path.join(__dirname, '..', 'en'));

let filesModified = 0;
let totalChanges = 0;

htmlFiles.forEach(fullPath => {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    let fileChanges = 0;
    
    // Fix canonical links
    content = content.replace(/<link rel="canonical" href="https:\/\/www\.estivanayramia\.com\/([^"]+)">/g, (match, urlPath) => {
        if (urlPath.startsWith('en/')) return match;
        if (urlPath.startsWith('assets/')) return match;
        
        if (urlPath === '' || urlPath === '/') {
            modified = true;
            fileChanges++;
            return '<link rel="canonical" href="https://www.estivanayramia.com/en/index.html">';
        }
        
        let newPath = urlPath;
        if (!newPath.endsWith('.html') && !newPath.endsWith('/')) newPath += '.html';
        if (newPath.endsWith('/')) newPath += 'index.html';
        
        modified = true;
        fileChanges++;
        return `<link rel="canonical" href="https://www.estivanayramia.com/en/${newPath}">`;
    });
    
    // Fix og:url
    content = content.replace(/<meta property="og:url" content="https:\/\/www\.estivanayramia\.com\/([^"]+)">/g, (match, urlPath) => {
        if (urlPath.startsWith('en/')) return match;
        if (urlPath.startsWith('assets/')) return match;
        
        if (urlPath === '' || urlPath === '/') {
            modified = true;
            fileChanges++;
            return '<meta property="og:url" content="https://www.estivanayramia.com/en/index.html">';
        }
        
        let newPath = urlPath;
        if (!newPath.endsWith('.html') && !newPath.endsWith('/')) newPath += '.html';
        if (newPath.endsWith('/')) newPath += 'index.html';
        
        modified = true;
        fileChanges++;
        return `<meta property="og:url" content="https://www.estivanayramia.com/en/${newPath}">`;
    });
    
    // Fix JSON-LD urls (except WebSite root)
    content = content.replace(/"url":\s*"https:\/\/www\.estivanayramia\.com\/([^"]+)"/g, (match, urlPath) => {
        if (content.includes('"@type": "WebSite"') && match.includes('"url": "https://www.estivanayramia.com/"')) {
            return match;
        }
        
        if (urlPath.startsWith('en/')) return match;
        if (urlPath.startsWith('assets/')) return match;
        if (urlPath === '') return '"url": "https://www.estivanayramia.com/"';
        
        let newPath = urlPath;
        if (!newPath.endsWith('.html') && !newPath.endsWith('/')) newPath += '.html';
        if (newPath.endsWith('/')) newPath += 'index.html';
        
        modified = true;
        fileChanges++;
        return `"url": "https://www.estivanayramia.com/en/${newPath}"`;
    });
    
    // Fix data-print-url
    content = content.replace(/data-print-url="https:\/\/www\.estivanayramia\.com\/([^"]+)"/g, (match, urlPath) => {
        if (urlPath.startsWith('en/')) return match;
        if (urlPath.startsWith('assets/')) return match;
        
        if (urlPath === '' || urlPath === '/') {
            modified = true;
            fileChanges++;
            return 'data-print-url="https://www.estivanayramia.com/en/index.html"';
        }
        
        let newPath = urlPath;
        if (!newPath.endsWith('.html') && !newPath.endsWith('/')) newPath += '.html';
        if (newPath.endsWith('/')) newPath += 'index.html';
        
        modified = true;
        fileChanges++;
        return `data-print-url="https://www.estivanayramia.com/en/${newPath}"`;
    });
    
    if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        filesModified++;
        totalChanges += fileChanges;
        const relativePath = path.relative(path.join(__dirname, '..'), fullPath);
        console.log(` ${relativePath} (${fileChanges} changes)`);
    }
});

console.log(`\n Fixed SEO metadata in ${filesModified} files`);
console.log(` Total changes: ${totalChanges}`);

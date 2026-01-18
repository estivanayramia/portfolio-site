const fs = require('fs');
const path = require('path');

const rootDir = __dirname.endsWith('scripts') ? path.join(__dirname, '..') : __dirname;

function getAllHtmlFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'lighthouse-results') {
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
const relevantFiles = allHtmlFiles.filter(f => {
    // Filter logic based on user request: EN, root, and assets/MiniGames
    const relPath = path.relative(rootDir, f).replace(/\\/g, '/');
    return relPath.startsWith('EN/') || 
           !relPath.includes('/') || 
           relPath.startsWith('assets/MiniGames/');
});

console.log(`Scanning ${relevantFiles.length} HTML files...`);

let failures = 0;

relevantFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(rootDir, file);
    
    // Check 1: Meta Charset
    const hasCharset = /<meta\s+charset=["']?utf-8["']?/i.test(content);
    
    // Check 2: classList.add('js') in head
    const jsInjection = "classList.add('js')";
    const count = (content.split(jsInjection).length - 1);
    
    // Check location
    const headStart = content.toLowerCase().indexOf('<head');
    const headEnd = content.toLowerCase().indexOf('</head');
    const injectionPos = content.indexOf(jsInjection);
    
    const inHead = injectionPos > headStart && injectionPos < headEnd;

    let errors = [];
    if (!hasCharset) errors.push("Missing <meta charset='utf-8'>");
    if (count === 0) errors.push("Missing html.js injection");
    if (count > 1) errors.push(`Duplicate html.js injection (found ${count})`);
    if (count === 1 && !inHead) errors.push("Injection not inside <head>");

    if (errors.length > 0) {
        console.error(`FAIL: ${relPath} -> ${errors.join(', ')}`);
        failures++;
    }
});

if (failures > 0) {
    console.error(`\nFound ${failures} failed files.`);
    process.exit(1);
} else {
    console.log(`\nPASS: ${relevantFiles.length} files verified.`);
    process.exit(0);
}

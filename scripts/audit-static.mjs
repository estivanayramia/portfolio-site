import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const HTML_GLOBS = [
    { dir: ROOT_DIR, pattern: /\.html$/ },
    { dir: path.join(ROOT_DIR, 'EN'), pattern: /\.html$/ },
    { dir: path.join(ROOT_DIR, 'ar'), pattern: /\.html$/ },
    { dir: path.join(ROOT_DIR, 'es'), pattern: /\.html$/ },
    { dir: path.join(ROOT_DIR, 'hobbies'), pattern: /\.html$/ }, // Legacy check
    { dir: path.join(ROOT_DIR, 'projects'), pattern: /\.html$/ }, // Legacy check
];

const IGNORE_URL_PREFIXES = ['http://', 'https://', 'mailto:', 'tel:', '#', 'data:'];

function getAllHtmlFiles() {
    let results = [];
    
    function walk(dir) {
        if (!fs.existsSync(dir)) return;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                if (file === 'node_modules' || file === '.git') return;
                walk(filePath);
            } else {
                if (file.endsWith('.html')) {
                    results.push(filePath);
                }
            }
        });
    }

    // Start from known roots to avoid scanning node_modules deeply if we just used recursive from root
    // But since we have a specific structure, let's just specific dirs or root
    // The user asked for ./EN/**/*.html and root ./*.html specifically, but a full scan is safer.
    // Let's just walk the root but skip node_modules
    walk(ROOT_DIR);
    return results;
}

function resolveAssetPath(htmlFilePath, assetUrl) {
    if (IGNORE_URL_PREFIXES.some(p => assetUrl.startsWith(p))) return { valid: true, ignored: true };
    
    // Strip query strings and hashes
    const cleanUrl = assetUrl.split('?')[0].split('#')[0];
    if (!cleanUrl) return { valid: true, ignored: true };

    let absolutePath;
    if (cleanUrl.startsWith('/')) {
        // Root relative
        absolutePath = path.join(ROOT_DIR, cleanUrl);
    } else {
        // Relative to file
        absolutePath = path.resolve(path.dirname(htmlFilePath), cleanUrl);
    }

    return {
        valid: fs.existsSync(absolutePath),
        absolutePath: absolutePath,
        cleanUrl: cleanUrl
    };
}

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const errors = [];
    const glyphs = [];

    // Regex for attributes
    // src, href, poster, data-src
    const attrRegex = /(src|href|poster|data-src)=["']([^"']+)["']/g;
    let match;
    while ((match = attrRegex.exec(content)) !== null) {
        const [full, attr, url] = match;
        
        // Filter href - only check if it looks like an asset (css, js, image, json, font) 
        // OR if it is a link to another html file (internal link checking)
        // But user said "href (only for assets)"
        if (attr === 'href') {
            const ext = path.extname(url).toLowerCase();
            const assetExts = ['.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.json', '.woff', '.woff2', '.ttf', '.ico', '.webmanifest'];
            if (!assetExts.includes(ext) && !url.includes('favicon')) {
               // Skipping non-asset hrefs (like normal links) for now as detailed in instructions? 
               // "href (only for assets)"
               continue;
            }
        }

        const result = resolveAssetPath(filePath, url);
        if (!result.ignored && !result.valid) {
            errors.push({
                file: path.relative(ROOT_DIR, filePath),
                attr,
                value: url,
                resolvedPath: path.relative(ROOT_DIR, result.absolutePath)
            });
        }
    }

    // Check for srcset separately
    const srcsetRegex = /srcset=["']([^"']+)["']/g;
    while ((match = srcsetRegex.exec(content)) !== null) {
        const srcsetVal = match[1];
        // Split by comma
        const sources = srcsetVal.split(',');
        sources.forEach(srcRaw => {
            const url = srcRaw.trim().split(' ')[0]; // Take first part (url) before width descriptor
            if(url) {
                const result = resolveAssetPath(filePath, url);
                if (!result.ignored && !result.valid) {
                    errors.push({
                        file: path.relative(ROOT_DIR, filePath),
                        attr: 'srcset',
                        value: url,
                        resolvedPath: path.relative(ROOT_DIR, result.absolutePath)
                    });
                }
            }
        });
    }

    // Check for suspicious glyphs
    const suspiciousPatterns = [
        { pattern: />\?<\/button>/, name: 'Question Mark Button' },
        { pattern: /LinkedIn \?/, name: 'LinkedIn ?' },
        { pattern: /GitHub \?/, name: 'GitHub ?' },
        { pattern: /\? Back/, name: '? Back' },
        { pattern: />\?<\/a>/, name: 'Question Mark Link' } 
    ];

    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        suspiciousPatterns.forEach(p => {
            if (p.pattern.test(line)) {
                glyphs.push({
                    file: path.relative(ROOT_DIR, filePath),
                    line: idx + 1,
                    snippet: line.trim().substring(0, 50),
                    issue: p.name
                });
            }
        });
    });

    return { errors, glyphs };
}

function runAudit() {
    console.log('Starting Audit...');
    const files = getAllHtmlFiles();
    console.log(`Scanning ${files.length} HTML files...`);

    let allErrors = [];
    let allGlyphs = [];

    files.forEach(f => {
        const { errors, glyphs } = scanFile(f);
        allErrors = allErrors.concat(errors);
        allGlyphs = allGlyphs.concat(glyphs);
    });

    // Generate Report
    let report = `# EN Move Regression Audit Report\n\n`;
    report += `Date: ${new Date().toISOString()}\n`;
    report += `Total Files Scanned: ${files.length}\n`;
    report += `Total Broken Assets: ${allErrors.length}\n`;
    report += `Total Suspicious Glyphs: ${allGlyphs.length}\n\n`;

    if (allErrors.length > 0) {
        report += `## Broken Assets\n\n`;
        report += `| File | Attribute | Value | Resolved Path |\n`;
        report += `|------|-----------|-------|---------------|\n`;
        allErrors.forEach(e => {
            report += `| ${e.file} | ${e.attr} | \`${e.value}\` | \`${e.resolvedPath}\` |\n`;
        });
        report += `\n`;
    }

    if (allGlyphs.length > 0) {
        report += `## Suspicious Glyphs\n\n`;
        report += `| File | Line | Issue | Snippet |\n`;
        report += `|------|------|-------|---------|\n`;
        allGlyphs.forEach(g => {
            report += `| ${g.file} | ${g.line} | ${g.issue} | \`${g.snippet.replace(/\|/g, '\\|')}\` |\n`;
        });
    }

    const reportPath = path.join(ROOT_DIR, 'docs', 'notes', 'en-move-regression-audit.md');
    // Ensure dir exists
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    
    fs.writeFileSync(reportPath, report);
    console.log(`Report written to ${reportPath}`);

    if (allErrors.length > 0 || allGlyphs.length > 0) {
        console.error('Audit FAILED: Found issues.');
        // console.log(report); // Optional: print to stdout
        process.exit(1);
    } else {
        console.log('Audit PASSED: No issues found.');
    }
}

runAudit();

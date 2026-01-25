// tools/generate-postflight.mjs
import fs from 'node:fs';
import path from 'node:path';
// import { globSync } from 'glob'; // Removed unused import

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'postflight.counts.txt');

function countOccurrences(regex, files) {
    let count = 0;
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        const matches = content.match(regex);
        if (matches) count += matches.length;
    }
    return count;
}

function getAllHtmlFiles() {
    // Simple recursive search matching the workspace structure (EN/, ar/, es/, etc.)
    // Skipping node_modules, .git, _site, etc.
    // Using a simple reliable implementation without external 'glob' dependency if possible,
    // but the environment seems to have a standard node setup.
    // I will use a simple recursive walker.
    const files = [];
    
    function walk(dir) {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git' && file !== '.reports' && file !== 'dist' && file !== 'assets') {
                    walk(filePath);
                }
            } else {
                if (filePath.endsWith('.html')) {
                    files.push(filePath);
                }
            }
        });
    }
    walk(ROOT);
    return files;
}

const htmlFiles = getAllHtmlFiles();

const offenders = [];
// Regex: Word boundary 'style' followed by '=' and quotes. Ignores 'fillStyle'.
const styleAttrRegex = /\bstyle\s*=\s*["'][^"']*["']/i;

for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
        if (styleAttrRegex.test(line)) {
            offenders.push(`Inline Style in: ${path.relative(ROOT, file)}:${index + 1} -> ${line.trim()}`);
        }
        if (/<style[^>]*>/i.test(line)) {
            offenders.push(`Style Tag in: ${path.relative(ROOT, file)}:${index + 1} -> ${line.trim()}`);
        }
    });
}

const inlineStyleCount = offenders.filter(o => o.includes('Inline Style')).length;
const styleTagCount = offenders.filter(o => o.includes('Style Tag')).length;
const linkTagCount = countOccurrences(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi, htmlFiles);

const report = `POSTFLIGHT CSS COUNTS
=====================
Scanned ${htmlFiles.length} HTML files.

Inline 'style="..."' attributes: ${inlineStyleCount}
Internal '<style>' blocks:       ${styleTagCount}
External '<link rel="stylesheet">: ${linkTagCount}

Offenders:
${offenders.join('\n')}

timestamp: ${new Date().toISOString()}
`;

fs.writeFileSync(REPORT_PATH, report);
console.log(report);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const siteUrl = 'https://www.estivanayramia.com';
const excludeFiles = ['index.html', '404.html'];
const localeDirs = ['es', 'ar'];

function getHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (localeDirs.includes(file)) {
                if (fs.existsSync(path.join(filePath, 'index.html'))) {
                    results.push(path.join(file, 'index.html'));
                }
            }
        } else {
            if (file.endsWith('.html')) {
                results.push(file);
            }
        }
    });
    return results;
}

const allHtmlFiles = getHtmlFiles(rootDir);
const indexableFiles = allHtmlFiles.filter(f => !excludeFiles.includes(f) && !localeDirs.some(d => f.startsWith(d + path.sep)));
const localeFiles = allHtmlFiles.filter(f => localeDirs.some(d => f.startsWith(d + path.sep)));

let errors = 0;

function error(msg) {
    console.error(`[FAIL] ${msg}`);
    errors++;
}

function checkHtmlFiles() {
    const filesToCheck = [...indexableFiles, 'index.html', ...localeFiles];
    
    filesToCheck.forEach(relativePath => {
        const filePath = path.join(rootDir, relativePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 1. Check Canonical
        const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i);
        if (!canonicalMatch) {
            error(`${relativePath}: Missing canonical tag`);
        } else {
            const canonicalUrl = canonicalMatch[1];
            if (canonicalUrl.endsWith('.html')) {
                error(`${relativePath}: Canonical URL ends with .html (${canonicalUrl})`);
            }
            
            // 2. Check OG URL
            const ogMatch = content.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']\s*\/?>/i);
            if (ogMatch) {
                const ogUrl = ogMatch[1];
                if (ogUrl !== canonicalUrl) {
                    error(`${relativePath}: OG URL (${ogUrl}) does not match Canonical (${canonicalUrl})`);
                }
            } else {
                // error(`${relativePath}: Missing og:url`); // Optional strictness
            }
        }

        // 3. Check Internal Links
        // Simple check for href="...html"
        const linkMatch = content.match(/href=["']([^"']+\.html)["']/);
        if (linkMatch) {
            // Ignore external links or specific exceptions if any
            if (!linkMatch[1].startsWith('http')) {
                 error(`${relativePath}: Contains internal link with .html: ${linkMatch[1]}`);
            }
        }

        // 4. Check JSON-LD
        const jsonLdMatch = content.match(/"url":\s*"https:\/\/www\.estivanayramia\.com\/[^"]+\.html"/);
        if (jsonLdMatch) {
            error(`${relativePath}: JSON-LD contains .html URL`);
        }
    });
}

function checkRedirects() {
    const redirectsPath = path.join(rootDir, '_redirects');
    if (!fs.existsSync(redirectsPath)) {
        error('_redirects file missing');
        return;
    }
    const content = fs.readFileSync(redirectsPath, 'utf8');

    indexableFiles.forEach(file => {
        const slug = file.replace('.html', '');
        
        // Check 301: /file.html -> /slug
            if (!content.includes(`/${file}                   /${slug}                       301`)) {
             error(`_redirects: Missing 301 redirect for ${file}`);
        }

        // Check 200: /slug -> /file.html
        if (!content.includes(`/${slug}                       /${file}                       200`)) {
             error(`_redirects: Missing 200 rewrite for ${file}`);
        }
    });
}

function checkSitemap() {
    const sitemapPath = path.join(rootDir, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
        error('sitemap.xml missing');
        return;
    }
    const content = fs.readFileSync(sitemapPath, 'utf8');
    
    if (content.includes('.html</loc>')) {
        error('sitemap.xml contains .html URLs');
    }
}

console.log('Starting SEO Route Check...');
checkHtmlFiles();
checkRedirects();
checkSitemap();

if (errors === 0) {
    console.log('[PASS] All checks passed!');
    process.exit(0);
} else {
    console.error(`[FAIL] Found ${errors} errors.`);
    process.exit(1);
}

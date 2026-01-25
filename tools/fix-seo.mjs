import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Configuration
const siteUrl = 'https://www.estivanayramia.com';
const EN_DIR = 'EN';
const localeDirs = ['es', 'ar'];

const RUN_REDIRECTS = process.argv.includes('--redirects');
const RUN_HTML = process.argv.includes('--html');
const RUN_SITEMAP = process.argv.includes('--sitemap');
const RUN_ALL = process.argv.includes('--all');

// CLI flags
if (!RUN_REDIRECTS && !RUN_HTML && !RUN_SITEMAP && !RUN_ALL) {
    console.log('Usage: node tools/fix-seo.mjs [flags]');
    console.log('Flags:');
    console.log('  --redirects  Generate _redirects');
    console.log('  --html       Update HTML files (links, canonical, meta)');
    console.log('  --sitemap    Update sitemap.xml');
    console.log('  --all        Run all updates');
    process.exit(0);
}

// 1. Inventory Routes (EN-aware, recursive)
function getHtmlFilesRecursive(baseDir) {
    /** @type {string[]} */
    const results = [];

    /** @param {string} dir */
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (!entry.isFile()) continue;
            if (!entry.name.endsWith('.html')) continue;

            const relToRoot = path.relative(rootDir, fullPath);
            results.push(relToRoot.replace(/\\/g, '/'));
        }
    }

    walk(baseDir);
    return results;
}

const enDirAbsolute = path.join(rootDir, EN_DIR);
const enHtmlFiles = fs.existsSync(enDirAbsolute) ? getHtmlFilesRecursive(enDirAbsolute) : [];

const localeFiles = localeDirs
    .map((dir) => `${dir}/index.html`)
    .filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)));

// Exclusions (canonical non-indexables)
const enIndexableFiles = enHtmlFiles.filter((f) => f !== 'EN/404.html');

// Map EN files to canonical routes
function mapToCanonicalRoute(filePath) {
    const normalized = filePath.replace(/\\/g, '/'); // Normalize to forward slashes
    if (normalized.startsWith('EN/')) {
        const enPath = normalized.replace('EN/', '');
        if (enPath === 'index.html') return '/';
        if (enPath.endsWith('/index.html')) return '/' + enPath.replace('/index.html', '/');
        return '/' + enPath.replace('.html', '');
    }
    // For locales, keep as is
    if (normalized.startsWith('es/') || normalized.startsWith('ar/')) {
        return '/' + normalized.replace('.html', '');
    }
    return '/' + normalized.replace('.html', '');
}

console.log('Indexable Files:', enIndexableFiles);
console.log('Locale Files:', localeFiles);

// 2. Fix _redirects
function generateRedirects() {
    const redirectsPath = path.join(rootDir, '_redirects');
    const BEGIN = '# BEGIN GENERATED (fix-seo)';
    const END = '# END GENERATED (fix-seo)';

    const canonicalToEnFile = new Map();
    for (const enFile of enIndexableFiles) {
        canonicalToEnFile.set(mapToCanonicalRoute(enFile), enFile);
    }

    const generatedLines = [];
    // URL normalization (301) so /x and /x/ both resolve to the canonical route
    generatedLines.push('# URL normalization (301)');

    const canonicals = [...canonicalToEnFile.keys()].sort((a, b) => a.localeCompare(b));
    for (const canonical of canonicals) {
        if (canonical === '/') continue;

        if (canonical.endsWith('/')) {
            // Canonical is directory-style: /projects/ => redirect /projects -> /projects/
            const noSlash = canonical.slice(0, -1);
            generatedLines.push(`${noSlash}    ${canonical}    301`);
        } else {
            // Canonical is file-style: /about => redirect /about/ -> /about
            generatedLines.push(`${canonical}/    ${canonical}    301`);
        }
    }

    generatedLines.push('');
    generatedLines.push('# Clean URL rewrites (200) -> serve from /EN/');
    for (const [canonical, enFile] of [...canonicalToEnFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        // Do not proxy the site root. Root should serve /index.html directly.
        if (canonical === '/') continue;
        // For directory canonicals (ending with /), rewrite to directory path, not index.html
        // This avoids Cloudflare Pages rewrite failures with explicit index.html targets
        let target;
        if (canonical !== '/' && canonical.endsWith('/') && enFile.endsWith('/index.html')) {
            // Directory route: /hobbies/ -> /EN/hobbies/ (not /EN/hobbies/index.html)
            target = '/' + enFile.replace('/index.html', '/');
        } else {
            // File route or root: use literal file path
            target = '/' + enFile;
        }
        generatedLines.push(`${canonical}    ${target}    200`);
    }

    generatedLines.push('');
    generatedLines.push('# Prevent indexing /EN/* directly (301)');
    for (const [canonical, enFile] of [...canonicalToEnFile.entries()].sort(([, a], [, b]) => a.localeCompare(b))) {
        const enUrlPath = '/' + enFile;
        generatedLines.push(`${enUrlPath}    ${canonical}    301`);
    }

    const headerLines = [
        '# Generated by tools/fix-seo.mjs (Cloudflare Pages compatible).',
        '# Do not hand-edit; run: node tools/fix-seo.mjs --redirects',
        '',
        '# /EN and /EN/ hard redirects',
        '/EN    /    301',
        '/EN/   /    301',
        '',
        '# 1. Canonical Redirects (301) - Enforce clean URLs',
        '/index.html                  /                            301',
        '# Root serve (200) - prevents "/" from hitting the 404 catch-all',
        '/                            /index.html                  200',
        '',
        '/es/index.html               /es/                         301',
        '/ar/index.html               /ar/                         301',
        '',
        '# Locale rewrites',
        '/es/                         /es/index.html               200',
        '/ar/                         /ar/index.html               200',
        '',
    ];

    const footerLines = [
        '',
        '# 404 Fallback (Pages does not support 404 rewrites; use 200 proxy)',
        '# Use the clean URL (/EN/404) as the canonical 404 target.',
        '# Cloudflare Pages may redirect *.html -> clean URL (308), which can loop',
        '# if we rewrite /EN/404 back to /EN/404.html.',
        '/404.html                    /EN/404                     301',
        '/EN/404.html                 /EN/404                     301',
        '/*                           /EN/404                     200',
        '',
    ];

    const updated = `${headerLines.join('\n')}\n${BEGIN}\n${generatedLines.join('\n')}\n${END}${footerLines.join('\n')}`;

    const existing = fs.existsSync(redirectsPath) ? fs.readFileSync(redirectsPath, 'utf8') : '';
    if (updated !== existing) {
        fs.writeFileSync(redirectsPath, updated);
        console.log('Updated _redirects');
    } else {
        console.log('No changes to _redirects');
    }
}

// 3 & 4. Update HTML Content (Links, Canonical, Meta, JSON-LD)
function updateHtmlContent() {
    const extraFiles = [];
    const en404 = 'EN/404.html';
    if (fs.existsSync(path.join(rootDir, en404))) extraFiles.push(en404);

    const filesToProcess = [...enIndexableFiles, ...extraFiles, ...localeFiles];

    // Build canonical map for HTML normalization (directory routes)
    const canonicalToEnFile = new Map();
    for (const enFile of enIndexableFiles) {
        canonicalToEnFile.set(mapToCanonicalRoute(enFile), enFile);
    }

    const directoryNoSlashSet = new Set([
        ...[...canonicalToEnFile.keys()]
            .filter((c) => c !== '/' && c.endsWith('/'))
            .map((c) => c.slice(0, -1))
    ]);

    function escapeRegExpFor(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    filesToProcess.forEach(relativePath => {
        const filePath = path.join(rootDir, relativePath);
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;

        // Determine clean URL for this page
        let cleanPath = mapToCanonicalRoute(relativePath);
        if (cleanPath === '/') cleanPath = '';

        const fullUrl = siteUrl + cleanPath;

        // A. Update Internal Links (strip trailing .html)
        // Regex to find internal href values ending with .html
        content = content.replace(/href=(["'])([^"']+)\.html\1/g, (match, quote, url) => {
            // Don't touch external links
            if (url.startsWith('http')) return match;
            // Don't touch index.html if it's meant to be root (usually /index.html -> /)
            if (url === '/index' || url === 'index') return `href=${quote}/${quote}`;
            if (url.endsWith('/index')) return `href=${quote}${url.replace('/index', '/')}${quote}`;
            
            return `href=${quote}${url}${quote}`;
        });

        // A.5 Normalize directory links (no-trailing-slash -> trailing-slash)
        for (const noSlash of directoryNoSlashSet) {
            const re = new RegExp(`href=(['"])${escapeRegExpFor(noSlash)}\\1`, 'g');
            content = content.replace(re, (match, quote) => `href=${quote}${noSlash}/${quote}`);
        }

        // B. Update data-print-url
        content = content.replace(/data-print-url=(["'])([^"']+)\.html\1/g, (match, quote, url) => {
             return `data-print-url=${quote}${url}${quote}`;
        });

        // C. Update Canonical
        // <link rel="canonical" href="...">
        const canonicalRegex = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i;
        if (canonicalRegex.test(content)) {
            content = content.replace(canonicalRegex, `<link rel="canonical" href="${fullUrl}">`);
        } else {
            // Insert if missing (in head)
            content = content.replace('</head>', `  <link rel="canonical" href="${fullUrl}">\n</head>`);
        }

        // D. Update OG URL
        const ogUrlRegex = /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']\s*\/?>/i;
        if (ogUrlRegex.test(content)) {
            content = content.replace(ogUrlRegex, `<meta property="og:url" content="${fullUrl}">`);
        }

        // E. Update Twitter URL
        const twitterUrlRegex = /<meta\s+name=["']twitter:url["']\s+content=["']([^"']+)["']\s*\/?>/i;
        if (twitterUrlRegex.test(content)) {
            content = content.replace(twitterUrlRegex, `<meta name="twitter:url" content="${fullUrl}">`);
        }

        // F. Update JSON-LD "url"
        // Look for JSON-LD url values that end with .html for the known domain
        // We'll use a specific regex for the known domain to be safe
        const jsonLdUrlRegex = /"url":\s*"https:\/\/www\.estivanayramia\.com\/([^"]+)\.html"/g;
        content = content.replace(jsonLdUrlRegex, (match, slug) => {
            if (slug === 'index') return `"url": "${siteUrl}/"`;
            return `"url": "${siteUrl}/${slug}"`;
        });

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${relativePath}`);
        }
    });
}

// 5. Update sitemap.xml
function updateSitemap() {
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    const urlSet = new Set();

    // Canonical EN routes
    for (const file of enIndexableFiles) {
        urlSet.add(siteUrl + mapToCanonicalRoute(file));
    }

    // Locales
    for (const dir of localeDirs) {
        urlSet.add(siteUrl + '/' + dir + '/');
    }

    const urls = [...urlSet].sort((a, b) => a.localeCompare(b));

    urls.forEach(url => {
        sitemap += `  <url>
    <loc>${url}</loc>
  </url>
`;
    });

    sitemap += `</urlset>`;
    
    fs.writeFileSync(path.join(rootDir, 'sitemap.xml'), sitemap);
    console.log('Updated sitemap.xml');
}

// Run
if (RUN_REDIRECTS || RUN_ALL) {
    generateRedirects();
}

if (RUN_HTML || RUN_ALL) {
    updateHtmlContent();
}

if (RUN_SITEMAP || RUN_ALL) {
    updateSitemap();
}

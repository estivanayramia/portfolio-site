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

const DEBUG = process.argv.includes('--debug') || process.env.FIX_SEO_DEBUG === '1';

function dbg(...args) {
    if (!DEBUG) return;
    console.error('[fix-seo][debug]', ...args);
}

// CLI flags
if (!RUN_REDIRECTS && !RUN_HTML && !RUN_SITEMAP && !RUN_ALL) {
    console.log('Usage: node tools/fix-seo.mjs [flags]');
    console.log('Flags:');
    console.log('  --redirects  Generate _redirects');
    console.log('  --html       Update HTML files (links, canonical, meta)');
    console.log('  --sitemap    Update sitemap.xml');
    console.log('  --all        Run all updates');
    console.log('  --debug      Print debug diagnostics');
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

dbg('rootDir:', rootDir);
dbg('EN dir exists:', fs.existsSync(enDirAbsolute), 'path:', enDirAbsolute);
dbg('enHtmlFiles:', enHtmlFiles.length);
dbg('enIndexableFiles:', enIndexableFiles.length);
dbg('localeFiles:', localeFiles);

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

if (DEBUG) {
    console.log('Indexable Files:', enIndexableFiles);
    console.log('Locale Files:', localeFiles);
}

// 2. Fix _redirects
function generateRedirects() {
    const redirectsPath = path.join(rootDir, '_redirects');
    const BEGIN = '# BEGIN GENERATED (fix-seo)';
    const END = '# END GENERATED (fix-seo)';

    const canonicalToEnFile = new Map();
    for (const enFile of enIndexableFiles) {
        canonicalToEnFile.set(mapToCanonicalRoute(enFile), enFile);
    }

    dbg('generateRedirects: canonicalToEnFile size:', canonicalToEnFile.size);

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
            // File route: target the extensionless path to avoid Clean URL loops
            // Cloudflare will handle /EN/foo -> /EN/foo.html via the second-pass rules below or natively
            target = '/' + enFile.replace(/\.html$/, '');
        }
        generatedLines.push(`${canonical}    ${target}    200`);
    }

    generatedLines.push('');
    generatedLines.push('# Prevent indexing /EN/* directly (301)');
    for (const [canonical, enFile] of [...canonicalToEnFile.entries()].sort(([, a], [, b]) => a.localeCompare(b))) {
        // Skip redirection for /EN/index.html to avoid loops with Serve.json rewrites or root redirects
        if (enFile === 'EN/index.html') continue;
        // Skip 404.html to avoid loop: /EN/404.html -> /404 -> catch-all -> /EN/404.html
        if (enFile === 'EN/404.html') continue;

        const enUrlPath = '/' + enFile;
        generatedLines.push(`${enUrlPath}    ${canonical}    301`);

        // Cloudflare Pages may canonicalize /EN/foo.html -> /EN/foo (308).
        // Redirecting /EN/foo back to /foo creates an infinite loop for clean URL rewrites.
        // Instead, serve /EN/foo by rewriting to the underlying /EN/foo.html.
        if (!enFile.endsWith('/index.html')) {
            const enNoExtPath = '/' + enFile.replace(/\.html$/, '');
            generatedLines.push(`${enNoExtPath}    ${enUrlPath}    200`);
        }
    }

    const headerLines = [
        '# Generated by tools/fix-seo.mjs (Cloudflare Pages compatible).',
        '# Do not hand-edit; run: node tools/fix-seo.mjs --redirects',
        '',
        '# /EN and /EN/ hard redirects removed to prevent infinite loops',
        // '/EN    /    301',
        // '/EN/   /    301',
        '',
        '# Root is served by /index.html; no root rewrite (avoids /about -> /EN/about redirects)',
        '',
        '# 1. Canonical Redirects (301) - Enforce clean URLs',
        '/index.html                  /                            301',
        '/es/index.html               /es/                         301',
        '/ar/index.html               /ar/                         301',
        '',
    ];

    const footerLines = [
        '',
        '# Catch-all 404',
        '/*    /EN/404.html    404',
        '',
    ];

    const updated = `${headerLines.join('\n')}\n${BEGIN}\n${generatedLines.join('\n')}\n${END}${footerLines.join('\n')}`;

    if (DEBUG) {
        /** @type {{from: string, to: string, status: string, raw: string}[]} */
        const rules = [];
        for (const line of updated.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const parts = trimmed.split(/\s+/);
            if (parts.length < 3) continue;
            const [from, to, status] = parts;
            rules.push({ from, to, status, raw: trimmed });
        }

        const byStatus = new Map();
        const byFrom = new Map();
        for (const rule of rules) {
            byStatus.set(rule.status, (byStatus.get(rule.status) || 0) + 1);
            byFrom.set(rule.from, (byFrom.get(rule.from) || 0) + 1);
        }

        const duplicates = [...byFrom.entries()].filter(([, count]) => count > 1);
        const selfRedirects = rules.filter((r) => r.from === r.to && r.status !== '200');
        const selfAny = rules.filter((r) => r.from === r.to);

        dbg('generateRedirects: rule count:', rules.length);
        dbg('generateRedirects: counts by status:', Object.fromEntries([...byStatus.entries()].sort(([a], [b]) => a.localeCompare(b))));
        if (duplicates.length) {
            dbg('generateRedirects: duplicate FROM rules (order-sensitive):', duplicates);
        }
        if (selfAny.length) {
            dbg('generateRedirects: self-mapping rules:', selfAny.map((r) => r.raw));
        }
        if (selfRedirects.length) {
            dbg('generateRedirects: SELF-REDIRECT rules detected (likely loop):', selfRedirects.map((r) => r.raw));
        }

        const expectedDebug200 = rules.filter((r) => (r.from === '/redirect-debug' || r.from === '/redirect-debug.html'));
        if (!expectedDebug200.length) {
            dbg('generateRedirects: WARNING missing debug route rules for /redirect-debug(.html)');
        } else {
            for (const r of expectedDebug200) {
                if (r.status !== '200') dbg('generateRedirects: WARNING debug route not 200:', r.raw);
            }
        }

        const expected404 = rules.filter((r) => r.from === '/EN/404' || r.from === '/EN/404/' || r.from === '/EN/404.html' || r.from === '/404' || r.from === '/404.html');
        for (const r of expected404) {
            if (r.status !== '200') dbg('generateRedirects: WARNING 404 guard not 200:', r.raw);
        }
    }

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
    let updatedFileCount = 0;

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
            updatedFileCount++;
        }
    });

    dbg('updateHtmlContent: processed files:', filesToProcess.length, 'updated:', updatedFileCount);
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
    dbg('updateSitemap: url count:', urls.length);

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

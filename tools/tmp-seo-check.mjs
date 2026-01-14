import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://www.estivanayramia.com';

function fail(errors, message) {
  errors.push(message);
}

function extractFirst(html, regex, group = 1) {
  const match = html.match(regex);
  return match ? match[group] : null;
}

function hasRobotsNoindexNofollow(html) {
  const robots = extractFirst(
    html,
    /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']\s*\/?>/i,
  );
  if (!robots) return false;
  const normalized = robots.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('noindex') && normalized.includes('nofollow');
}

function hasCanonical(html) {
  return /<link\s+rel=["']canonical["']/i.test(html);
}

function hasOgUrl(html) {
  return /<meta\s+property=["']og:url["']/i.test(html);
}

function findAllInternalHtmlHrefs(html) {
  const matches = [];
  const re = /href=("|')\/[^"']+\.html(\#[^"']*)?\1/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    matches.push(m[0]);
  }
  return matches;
}

function expectedCanonicalForFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized === 'index.html') return `${ORIGIN}/`;
  const base = path.posix.basename(normalized, '.html');
  return `${ORIGIN}/${base}`;
}

async function readUtf8(filePath) {
  return readFile(filePath, 'utf8');
}

async function main() {
  const errors = [];

  const rootEntries = await readdir('.', { withFileTypes: true });
  const rootHtml = rootEntries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.html'))
    .map((e) => e.name);

  const localized = ['es/index.html', 'ar/index.html'];
  const allRelPaths = [...rootHtml, ...localized];

  const noindexRelPaths = new Set(['404.html', 'index-critical.html', ...localized]);

  const indexableRelPaths = [];
  for (const rel of allRelPaths) {
    if (noindexRelPaths.has(rel)) continue;
    indexableRelPaths.push(rel);
  }

  // Validate pages
  const indexableCanonicals = new Set();

  for (const rel of indexableRelPaths) {
    const html = await readUtf8(rel);

    if (hasRobotsNoindexNofollow(html)) {
      fail(errors, `${rel}: unexpected noindex,nofollow on an indexable page`);
      continue;
    }

    const title = extractFirst(html, /<title>([^<]+)<\/title>/i);
    if (!title || !title.trim()) fail(errors, `${rel}: missing/empty <title>`);

    const description =
      extractFirst(
        html,
        /<meta\s+name=["']description["'][^>]*\scontent="([^"]+)"[^>]*>/i,
      ) ??
      extractFirst(
        html,
        /<meta\s+name=["']description["'][^>]*\scontent='([^']+)'[^>]*>/i,
      );
    if (!description || !description.trim()) fail(errors, `${rel}: missing/empty meta description`);

    const canonical = extractFirst(
      html,
      /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i,
    );
    if (!canonical) {
      fail(errors, `${rel}: missing canonical link`);
    }

    const ogUrl = extractFirst(
      html,
      /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']\s*\/?>/i,
    );
    if (!ogUrl) {
      fail(errors, `${rel}: missing og:url`);
    }

    if (canonical && ogUrl && canonical !== ogUrl) {
      fail(errors, `${rel}: canonical != og:url (${canonical} vs ${ogUrl})`);
    }

    const expectedCanonical = expectedCanonicalForFile(rel);
    if (canonical && canonical !== expectedCanonical) {
      fail(errors, `${rel}: canonical should be ${expectedCanonical} (got ${canonical})`);
    }

    if (canonical && canonical.includes('.html')) {
      fail(errors, `${rel}: canonical contains .html (${canonical})`);
    }

    const bodyPrintUrl = extractFirst(
      html,
      /<body[^>]*\sdata-print-url=["']([^"']+)["'][^>]*>/i,
    );
    if (bodyPrintUrl) {
      if (bodyPrintUrl.includes('.html')) {
        fail(errors, `${rel}: data-print-url contains .html (${bodyPrintUrl})`);
      }
      if (canonical && bodyPrintUrl !== canonical) {
        fail(errors, `${rel}: data-print-url != canonical (${bodyPrintUrl} vs ${canonical})`);
      }
    }

    const htmlHrefs = findAllInternalHtmlHrefs(html);
    if (htmlHrefs.length > 0) {
      fail(errors, `${rel}: contains internal .html links (e.g. ${htmlHrefs[0]})`);
    }

    if (canonical) indexableCanonicals.add(canonical);
  }

  for (const rel of noindexRelPaths) {
    const html = await readUtf8(rel);

    if (!hasRobotsNoindexNofollow(html)) {
      fail(errors, `${rel}: expected meta robots noindex,nofollow`);
    }

    if (hasCanonical(html)) {
      fail(errors, `${rel}: should not include rel=canonical`);
    }

    if (hasOgUrl(html)) {
      fail(errors, `${rel}: should not include og:url`);
    }
  }

  // Sitemap set must match indexable canonicals
  const sitemap = await readUtf8('sitemap.xml');
  const locs = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);

  for (const loc of locs) {
    if (loc.includes('.html')) fail(errors, `sitemap.xml: loc contains .html (${loc})`);
    if (loc.startsWith(`${ORIGIN}/es`) || loc.startsWith(`${ORIGIN}/ar`)) {
      fail(errors, `sitemap.xml: should not include localized noindex URLs (${loc})`);
    }
  }

  const sitemapSet = new Set(locs);
  const missingInSitemap = [...indexableCanonicals].filter((c) => !sitemapSet.has(c));
  const extraInSitemap = [...sitemapSet].filter((c) => !indexableCanonicals.has(c));

  if (missingInSitemap.length > 0) fail(errors, `sitemap.xml: missing ${missingInSitemap.length} canonical URLs (e.g. ${missingInSitemap[0]})`);
  if (extraInSitemap.length > 0) fail(errors, `sitemap.xml: has ${extraInSitemap.length} extra URLs (e.g. ${extraInSitemap[0]})`);

  if (errors.length > 0) {
    console.error(`SEO check failed (errors: ${errors.length})`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }

  console.log(`SEO check passed (${indexableRelPaths.length} indexable pages, ${noindexRelPaths.size} noindex pages, ${locs.length} sitemap URLs)`);
}

await main();

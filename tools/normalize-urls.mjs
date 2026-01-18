import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SITE = "https://www.estivanayramia.com";

const NOINDEX_PAGES = new Set(["404.html"]);

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function writeUtf8(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

function listRootHtml() {
  return fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html"))
    .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());
}

function normalizeHtmlContent(html) {
  let out = html;

  // canonical/og:url: strip .html on site URLs
  out = out.replace(
    /(rel=["']canonical["'][^>]*href=["'])(https:\/\/www\.estivanayramia\.com\/(?:[^"']+?))\.html(["'])/gi,
    "$1$2$3"
  );
  out = out.replace(
    /(property=["']og:url["'][^>]*content=["'])(https:\/\/www\.estivanayramia\.com\/(?:[^"']+?))\.html(["'])/gi,
    "$1$2$3"
  );

  // home canonical edge cases
  out = out.replace(new RegExp(`${SITE}\\/index\\.html`, "gi"), `${SITE}/`);
  out = out.replace(new RegExp(`${SITE}\\/index(["'])`, "gi"), `${SITE}/$1`);

  // data-print-url: strip .html
  out = out.replace(
    /(data-print-url=["'])(https:\/\/www\.estivanayramia\.com\/(?:[^"']+?))\.html(["'])/gi,
    "$1$2$3"
  );
  out = out.replace(new RegExp(`(data-print-url=["'])${SITE}\\/index\\.html(["'])`, "gi"), `$1${SITE}/$2`);

  // localized index links
  out = out.replace(/href=["']\/es\/index\.html["']/gi, 'href="/es/"');
  out = out.replace(/href=["']\/ar\/index\.html["']/gi, 'href="/ar/"');

  // home
  out = out.replace(/href=["']\/index\.html["']/gi, 'href="/"');

  // internal .html hrefs with anchors first
  out = out.replace(/href=["']\/([^"'#?]+)\.html#/gi, 'href="/$1#');
  // internal .html hrefs
  out = out.replace(/href=["']\/([^"'#?]+)\.html["']/gi, 'href="/$1"');

  return out;
}

function updateFile(relPath) {
  const p = path.join(ROOT, relPath);
  const before = readUtf8(p);
  const after = normalizeHtmlContent(before);
  if (after !== before) writeUtf8(p, after);
}

function normalizeSitemap() {
  const p = path.join(ROOT, "sitemap.xml");
  if (!fs.existsSync(p)) return;

  const before = readUtf8(p);
  const after = before.replace(
    /(<loc>https:\/\/www\.estivanayramia\.com\/[^<]+?)\.html<\/loc>/gi,
    "$1</loc>"
  );
  if (after !== before) writeUtf8(p, after);
}

function buildRedirects(rootHtmlFiles) {
  const lines = [];
  lines.push("# Canonical URL normalization (SEO)");
  lines.push("# Redirect .html URLs to extensionless canonical paths");
  lines.push("");

  // explicit index redirects
  lines.push("/index.html / 301");
  lines.push("/es/index.html /es/ 301");
  lines.push("/ar/index.html /ar/ 301");
  lines.push("");

  // per-page rules
  const slugs = rootHtmlFiles
    .filter((f) => f !== "index.html")
    .filter((f) => !NOINDEX_PAGES.has(f))
    .map((f) => f.replace(/\.html$/i, ""));

  for (const slug of slugs) {
    lines.push(`/${slug}.html /${slug} 301`);
    lines.push(`/${slug} /${slug}.html 200`);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function main() {
  const rootHtml = listRootHtml();

  // update all root html files (including 404 for href cleanup)
  for (const f of rootHtml) updateFile(f);

  // localized pages
  for (const rel of ["es/index.html", "ar/index.html"]) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) updateFile(rel);
  }

  normalizeSitemap();

  const redirectsPath = path.join(ROOT, "_redirects");
  const redirects = buildRedirects(rootHtml);
  writeUtf8(redirectsPath, redirects);

  console.log("Normalized URLs for HTML + sitemap.xml + _redirects");
}

main();

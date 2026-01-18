import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const NOINDEX_PAGES = new Set(["404.html"]);

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function listAllHtml(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "tools" || ent.name === ".vscode_restore_backup") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listAllHtml(p));
    else if (ent.isFile() && ent.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function getRobots(html) {
  const m = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  return m ? m[1].toLowerCase() : "";
}

function hasNoindex(html) {
  return getRobots(html).includes("noindex");
}

function main() {
  const failures = [];

  const htmlFiles = listAllHtml(ROOT);
  for (const p of htmlFiles) {
    const rel = path.relative(ROOT, p).replace(/\\/g, "/");
    const html = readUtf8(p);

    // no .html internal hrefs anywhere
    const badHref = html.match(/href=["']\/[^"]+?\.html(?:[#"'])/i);
    if (badHref) failures.push(`${rel}: still has .html href (${badHref[0]})`);

    const base = path.basename(rel);

    // noindex pages should not have canonical or og:url
    if (NOINDEX_PAGES.has(base)) {
      const robots = getRobots(html);
      if (!robots.includes("noindex") || !robots.includes("nofollow")) {
        failures.push(`${rel}: robots must be noindex,nofollow`);
      }
      if (/<link[^>]+rel=["']canonical["']/i.test(html)) failures.push(`${rel}: must not contain canonical`);
      if (/<meta[^>]+property=["']og:url["']/i.test(html)) failures.push(`${rel}: must not contain og:url`);
      continue;
    }

    // for indexable pages, canonical and og:url must not contain .html
    if (!hasNoindex(html)) {
      const canon = html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
      const og = html.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? null;
      if (canon && canon.includes(".html")) failures.push(`${rel}: canonical still has .html (${canon})`);
      if (og && og.includes(".html")) failures.push(`${rel}: og:url still has .html (${og})`);
    }
  }

  // sitemap should not contain .html
  const sitemapPath = path.join(ROOT, "sitemap.xml");
  if (fs.existsSync(sitemapPath)) {
    const sm = readUtf8(sitemapPath);
    if (sm.includes(".html</loc>")) failures.push(`sitemap.xml: still contains .html URLs`);
  }

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  } else {
    console.log(JSON.stringify({ ok: true }, null, 2));
  }
}

main();

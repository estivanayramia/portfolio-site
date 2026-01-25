import fs from "node:fs";
import path from "node:path";

const files = [
  "index.html",
  "ar/index.html",
  "es/index.html",
  ...walk("EN").filter((f) => f.endsWith(".html")),
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const rx = [
  [
    /\/assets\/js\/site\.min\.([A-Za-z0-9_-]+)\.js/g,
    "/assets/js/site.min.js?v=$1",
  ],
  [
    /\/assets\/js\/lazy-loader\.min\.([A-Za-z0-9_-]+)\.js/g,
    "/assets/js/lazy-loader.min.js?v=$1",
  ],
  [
    /\/assets\/css\/style\.([A-Za-z0-9_-]+)\.css/g,
    "/assets/css/style.css?v=$1",
  ],
];

let changed = 0;

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f);
  const s = buf.toString("utf8");
  let next = s;
  for (const [r, rep] of rx) next = next.replace(r, rep);
  if (next !== s) {
    fs.writeFileSync(f, next, "utf8");
    changed++;
  }
}

console.log(`unstamp-html-assets: changed_files=${changed}`);

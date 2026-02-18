import fs from "fs";
import path from "path";

const outDir = process.env.PAGES_OUTPUT_DIR || ".";
const redirectsPath = path.join(process.cwd(), outDir, "_redirects");
const DEBUG = process.argv.includes("--debug") || process.env.VERIFY_PAGES_DEBUG === "1";

function dbg(msg) {
  if (!DEBUG) return;
  console.error(`[verify-pages-output][debug] ${msg}`);
}

function findMatchingLines(text, re) {
  /** @type {string[]} */
  const matches = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (re.test(line)) matches.push(line);
  }
  return matches;
}

function fail(msg) {
  console.error(`[verify-pages-output] ${msg}`);
  if (DEBUG) {
    dbg(`outDir=${outDir}`);
    dbg(`redirectsPath=${redirectsPath}`);
  }
  process.exit(1);
}

if (!fs.existsSync(redirectsPath)) {
  fail(`Missing _redirects in output directory: "${outDir}". Pages rewrites will not run.`);
}

// Sanity-check that the expected output directory looks like a real deploy.
// This catches misconfigured Pages output directories (deploying an empty dist/).
const expectedFiles = [
  path.join(process.cwd(), outDir, "index.html"),
  path.join(process.cwd(), outDir, "EN", "index.html"),
];
for (const fp of expectedFiles) {
  if (!fs.existsSync(fp)) {
    fail(`Missing expected file in output directory "${outDir}": ${path.relative(process.cwd(), fp)}`);
  }
}

const redirects = fs.readFileSync(redirectsPath, "utf8");
dbg(`Read _redirects (${redirects.length} chars)`);

// Catch-all rules are SPA-style and will swallow real files on this site.
// Reject them to prevent redirect loops and missing-asset behavior.
const catchAllRe = /^\/\*\s+/m;
if (catchAllRe.test(redirects)) {
  if (DEBUG) {
    const lines = findMatchingLines(redirects, catchAllRe);
    dbg(`Catch-all candidates: ${lines.slice(0, 10).join(' | ')}`);
  }
  fail("_redirects must NOT include a catch-all rule ('/* ...'). This site is not an SPA.");
}

// Guard against a broad root rewrite. In Cloudflare Pages, this has been observed
// to redirect clean routes like /about -> /EN/about (leaking locale paths).
// Cloudflare Pages ignores whitespace differences, so we do too.
const rootRewriteToEnRe = /^\/\s+\/EN\/\s+200\s*$/m;
const rootRewriteToEnIndexRe = /^\/\s+\/EN\/index\.html\s+200\s*$/m;

if (rootRewriteToEnRe.test(redirects) || rootRewriteToEnIndexRe.test(redirects)) {
  if (DEBUG) {
    const lines = [
      ...findMatchingLines(redirects, rootRewriteToEnRe),
      ...findMatchingLines(redirects, rootRewriteToEnIndexRe),
    ];
    dbg(`Root rewrite lines detected: ${lines.join(' | ')}`);
  }
  fail(
    "_redirects contains a root rewrite to /EN/* (loop/locale-leak prone). Root should be served by /index.html without a root rewrite.",
  );
}

// Locale rewrites must not target index.html (Cloudflare Pages may ignore them)
const badLocaleRewriteRe = /^\/(es|ar)\/\s+\/\1\/index\.html\s+200\s*$/m;
if (badLocaleRewriteRe.test(redirects)) {
  if (DEBUG) {
    const lines = findMatchingLines(redirects, badLocaleRewriteRe);
    dbg(`Bad locale rewrite lines: ${lines.join(' | ')}`);
  }
  fail(
    "_redirects contains locale rewrite to index.html (e.g. '/es/  /es/index.html  200'). Use directory rewrites or rely on static index.",
  );
}

// Check directory routes rewrite directly to physical index.html files.
// We use explicit .html targets throughout to bypass Cloudflare Pages' automatic
// 308 clean-URL behavior which fires before _redirects and causes redirect loops.
const hobbiesRewriteRe = /^\/hobbies\/\s+\/EN\/hobbies\/index\.html\s+200\s*$/m;
const projectsRewriteRe = /^\/projects\/\s+\/EN\/projects\/index\.html\s+200\s*$/m;

if (!hobbiesRewriteRe.test(redirects)) {
  if (DEBUG) {
    const candidates = findMatchingLines(redirects, /^\/hobbies\//m);
    dbg(`/hobbies/ candidates: ${candidates.slice(0, 10).join(' | ')}`);
  }
  fail(
    "_redirects does not include '/hobbies/  /EN/hobbies/index.html  200' (must rewrite to explicit .html file).",
  );
}

if (!projectsRewriteRe.test(redirects)) {
  if (DEBUG) {
    const candidates = findMatchingLines(redirects, /^\/projects\//m);
    dbg(`/projects/ candidates: ${candidates.slice(0, 10).join(' | ')}`);
  }
  fail(
    "_redirects does not include '/projects/  /EN/projects/index.html  200' (must rewrite to explicit .html file).",
  );
}

console.log(
  `[verify-pages-output] OK. Found _redirects in "${outDir}" with expected rewrites (no root rewrite + explicit .html rewrite targets).`,
);

import fs from "fs";
import path from "path";

const outDir = process.env.PAGES_OUTPUT_DIR || ".";
const redirectsPath = path.join(process.cwd(), outDir, "_redirects");

function fail(msg) {
  console.error(`[verify-pages-output] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(redirectsPath)) {
  fail(`Missing _redirects in output directory: "${outDir}". Pages rewrites will not run.`);
}

const redirects = fs.readFileSync(redirectsPath, "utf8");

// Whitespace-insensitive check for the old root rewrite (now forbidden):
//   /  /EN/index.html  200
// Cloudflare Pages ignores whitespace differences, so we do too.
const rootRewriteRe = /^\/\s+\/EN\/index\.html\s+200\s*$/m;

if (rootRewriteRe.test(redirects)) {
  fail(
    "_redirects must NOT include the root rewrite '/  /EN/index.html  200' (it can cause redirect loops).",
  );
}

// Check directory routes rewrite to directory paths (not index.html)
// This prevents Cloudflare Pages rewrite failures
const hobbiesRewriteRe = /^\/hobbies\/\s+\/EN\/hobbies\/\s+200\s*$/m;
const projectsRewriteRe = /^\/projects\/\s+\/EN\/projects\/\s+200\s*$/m;

if (!hobbiesRewriteRe.test(redirects)) {
  fail(
    "_redirects does not include '/hobbies/  /EN/hobbies/  200' (must rewrite to directory, not index.html).",
  );
}

if (!projectsRewriteRe.test(redirects)) {
  fail(
    "_redirects does not include '/projects/  /EN/projects/  200' (must rewrite to directory, not index.html).",
  );
}

// Fail if any directory canonical rewrites to index.html (regression guard)
const badDirectoryRewriteRe = /^\/[^/]+\/\s+\/EN\/[^/]+\/index\.html\s+200\s*$/m;
if (badDirectoryRewriteRe.test(redirects)) {
  fail(
    "_redirects contains directory route rewriting to index.html (should rewrite to directory path).",
  );
}

console.log(
  `[verify-pages-output] OK. Found _redirects in "${outDir}" with expected directory rewrites and no forbidden root rewrite.`,
);

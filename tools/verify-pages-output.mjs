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

// Whitespace-insensitive check for the repo's required root rewrite:
//   /  /EN/index.html  200
// Cloudflare Pages ignores whitespace differences, so we do too.
const rootRewriteRe = /^\/\s+\/EN\/index\.html\s+200\s*$/m;

if (!rootRewriteRe.test(redirects)) {
  fail(
    "_redirects does not include the root rewrite '/  /EN/index.html  200' (whitespace-insensitive check).",
  );
}

console.log(
  `[verify-pages-output] OK. Found _redirects in "${outDir}" with expected root rewrite.`,
);

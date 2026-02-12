import { spawnSync } from "node:child_process";
import path from "node:path";

function log(msg) {
  // Keep output terse but greppable.
  process.stdout.write(`[upload-site-facts] ${msg}\n`);
}

function fail(msg, code = 1) {
  process.stderr.write(`[upload-site-facts] ${msg}\n`);
  process.exit(code);
}

const forceUpload = process.env.FORCE_KV_UPLOAD === "1";
const hasToken = Boolean(
  (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.trim()) ||
    (process.env.CF_API_TOKEN && process.env.CF_API_TOKEN.trim()),
);

// Skip on Cloudflare Pages or any CI environment without explicit token
if ((process.env.CF_PAGES || process.env.CI) && !forceUpload) {
  log("Skipping upload on Cloudflare Pages/CI (CF_PAGES or CI detected).");
  process.exit(0);
}

if (!hasToken && !forceUpload) {
  log(
    "Skipping upload (no CLOUDFLARE_API_TOKEN/CF_API_TOKEN). Set FORCE_KV_UPLOAD=1 to override.",
  );
  process.exit(0);
}

const repoRoot = process.cwd();
const workerDir = path.join(repoRoot, "worker");

const result = spawnSync(
  "npx",
  [
    "wrangler",
    "kv",
    "key",
    "put",
    "--remote",
    "--binding",
    "SAVONIE_KV",
    "site-facts:v1",
    "--path",
    "../assets/data/site-facts.json",
  ],
  {
    cwd: workerDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

if (result.error) {
  fail(`Failed to run wrangler: ${result.error.message}`);
}

process.exit(result.status ?? 1);

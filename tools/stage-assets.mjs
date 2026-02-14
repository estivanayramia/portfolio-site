/**
 * stage-assets.mjs — Copy only deployable files to dist/
 * Runs as the final build step before `wrangler versions upload`.
 * Excludes node_modules, build tooling, configs, and dev artifacts.
 */
import fs from 'node:fs';
import path from 'node:path';

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.github', '.wrangler', 'worker', 'dist',
  '.vscode', '.lighthouse', 'lighthouse-results', 'playwright-report',
  'test-results', '.worktrees', '.vscode_restore_backup', '.vscode_restore_reports',
  'visual-baseline', 'visual-current', 'visual-diff', '.reports', '.reports.bak',
  'scripts', 'tools', '.gemini', '.agent', 'extracted',
]);

const EXCLUDE_FILES = new Set([
  'package.json', 'package-lock.json', 'wrangler.jsonc', '.wranglerignore',
  'tsconfig.json', '.gitignore', '.env', 'audit.js', 'ALL_CODE_COPY.txt',
  'history.txt', 'verify_mapping.js',
]);

const EXCLUDE_EXT = new Set(['.log', '.zip']);

function shouldExclude(name, isDir) {
  if (isDir && EXCLUDE_DIRS.has(name)) return true;
  if (!isDir && EXCLUDE_FILES.has(name)) return true;
  if (!isDir && EXCLUDE_EXT.has(path.extname(name))) return true;
  if (!isDir && name.startsWith('.env')) return true;
  if (!isDir && name.startsWith('dryrun-transcript')) return true;
  if (!isDir && name.startsWith('verification-failure')) return true;
  if (!isDir && name.startsWith('tmp-serve')) return true;
  return false;
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    if (shouldExclude(entry.name, entry.isDirectory())) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const distDir = path.join(process.cwd(), 'dist');

// Clean dist
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

copyRecursive('.', distDir);

// Count and report
let count = 0;
let totalBytes = 0;
let largest = { file: '', size: 0 };

function audit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      audit(full);
    } else {
      count++;
      const stat = fs.statSync(full);
      totalBytes += stat.size;
      if (stat.size > largest.size) {
        largest = { file: full.replace(distDir, ''), size: stat.size };
      }
    }
  }
}
audit(distDir);

const sizeMB = (totalBytes / 1048576).toFixed(1);
const largestMB = (largest.size / 1048576).toFixed(1);

console.log(`[stage-assets] ✅ Staged ${count} files to dist/ (${sizeMB} MB total)`);
console.log(`[stage-assets]    Largest: ${largest.file} (${largestMB} MB)`);

if (largest.size > 25 * 1048576) {
  console.error(`[stage-assets] ❌ FATAL: ${largest.file} exceeds 25 MiB Cloudflare limit!`);
  process.exit(1);
}
if (count > 20000) {
  console.error(`[stage-assets] ❌ FATAL: ${count} files exceeds Cloudflare 20k limit!`);
  process.exit(1);
}

console.log('[stage-assets] ✅ All assets within Cloudflare limits');

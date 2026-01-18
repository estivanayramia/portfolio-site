import fs from 'fs';
import { execSync } from 'child_process';

const REPO_ROOT = process.cwd();
const PATTERN_FILE = '.git/info/banned-patterns.txt';

function readPatterns(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'));
}

function compilePatterns(patterns) {
  const compiled = [];
  for (const pattern of patterns) {
    try {
      compiled.push({ pattern, re: new RegExp(pattern, 'i') });
    } catch (e) {
      console.error(`Invalid regex in banned patterns list: ${pattern}`);
      process.exit(2);
    }
  }
  return compiled;
}

function getGitDiff(command) {
  try {
    return execSync(command, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // If git diff fails, fail closed.
    const stderr = e?.stderr ? String(e.stderr) : '';
    console.error(`Failed to run: ${command}`);
    if (stderr) console.error(stderr);
    process.exit(2);
  }
}

const patterns = readPatterns(PATTERN_FILE);

if (patterns.length === 0) {
  console.log('No banned patterns configured (expected at .git/info/banned-patterns.txt)');
  process.exit(0);
}

const compiled = compilePatterns(patterns);

const stagedDiff = getGitDiff('git diff --cached --unified=0 --no-color');
const unstagedDiff = getGitDiff('git diff --unified=0 --no-color');

function scan(label, text) {
  const hits = [];
  for (const { pattern, re } of compiled) {
    if (re.test(text)) hits.push(pattern);
  }
  if (hits.length) {
    console.error(`Banned pattern(s) detected in ${label}:`);
    hits.forEach((p) => console.error(`- ${p}`));
    return false;
  }
  return true;
}

const okStaged = scan('staged changes', stagedDiff);
const okUnstaged = scan('unstaged changes', unstagedDiff);

if (!okStaged || !okUnstaged) {
  process.exit(1);
}

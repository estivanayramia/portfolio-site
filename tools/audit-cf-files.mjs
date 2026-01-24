import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REDIRECTS = path.join(ROOT, '_redirects');
const HEADERS = path.join(ROOT, '_headers');

const ALLOWED_STATUS = new Set(['200', '301', '302', '303', '307', '308']);

function readLines(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  return { raw, lines };
}

function auditRedirects() {
  const rel = path.relative(ROOT, REDIRECTS).replace(/\\/g, '/');
  if (!fs.existsSync(REDIRECTS)) {
    return [{ file: rel, line: 0, message: 'Missing _redirects file' }];
  }

  const { lines } = readLines(REDIRECTS);
  /** @type {{file:string,line:number,message:string}[]} */
  const problems = [];

  /** @type {Map<string, number>} */
  const firstSeenFrom = new Map();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.includes('!')) {
      problems.push({ file: rel, line: lineNo, message: `Invalid '!': ${trimmed}` });
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2 || parts.length > 3) {
      problems.push({ file: rel, line: lineNo, message: `Invalid redirect format: ${trimmed}` });
      continue;
    }

    const from = parts[0];
    if (firstSeenFrom.has(from)) {
      problems.push({
        file: rel,
        line: lineNo,
        message: `Duplicate source path (first seen at line ${firstSeenFrom.get(from)}): ${from}`,
      });
      continue;
    }
    firstSeenFrom.set(from, lineNo);

    const code = parts[2];
    if (code !== undefined) {
      if (!/^\d+$/.test(code)) {
        problems.push({ file: rel, line: lineNo, message: `Non-numeric status code: ${trimmed}` });
        continue;
      }
      if (!ALLOWED_STATUS.has(code)) {
        problems.push({ file: rel, line: lineNo, message: `Disallowed status code ${code}: ${trimmed}` });
        continue;
      }
    }
  }

  return problems;
}

function auditHeaders() {
  const rel = path.relative(ROOT, HEADERS).replace(/\\/g, '/');
  if (!fs.existsSync(HEADERS)) {
    return [{ file: rel, line: 0, message: 'Missing _headers file' }];
  }

  const { lines } = readLines(HEADERS);
  /** @type {{file:string,line:number,message:string}[]} */
  const problems = [];

  let currentPathLine = null;
  let currentPathLineNo = 0;
  let currentHeaderCount = 0;

  function flush() {
    if (currentPathLine === null) return;
    if (currentHeaderCount === 0) {
      problems.push({
        file: rel,
        line: currentPathLineNo,
        message: `Header block has zero headers: ${currentPathLine}`,
      });
    }
    currentPathLine = null;
    currentPathLineNo = 0;
    currentHeaderCount = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i];

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const isHeaderLine = /^\s+\S/.test(line);
    if (!isHeaderLine) {
      flush();
      currentPathLine = trimmed;
      currentPathLineNo = lineNo;
      currentHeaderCount = 0;
      continue;
    }

    // Header line
    if (currentPathLine === null) {
      problems.push({ file: rel, line: lineNo, message: `Header without a path block: ${trimmed}` });
      continue;
    }

    if (!trimmed.includes(':')) {
      problems.push({ file: rel, line: lineNo, message: `Invalid header line (missing ':'): ${trimmed}` });
      continue;
    }

    currentHeaderCount++;
  }

  flush();
  return problems;
}

function main() {
  const problems = [...auditRedirects(), ...auditHeaders()];
  if (problems.length === 0) {
    console.log('OK: Cloudflare _redirects and _headers pass basic validation');
    process.exit(0);
  }

  console.error('FAIL: Cloudflare config validation failed');
  for (const p of problems) {
    console.error(`${p.file}:${p.line}: ${p.message}`);
  }

  process.exit(1);
}

main();

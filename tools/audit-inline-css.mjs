import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'EN');

function walkHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  /** @type {string[]} */
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkHtmlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

/** @returns {{styleAttr:number, styleTag:number, offenders: Array<{file:string, line:number, text:string, kind:'style-attr'|'style-tag'}>}} */
function scan() {
  const files = walkHtmlFiles(TARGET_DIR);
  let styleAttr = 0;
  let styleTag = 0;
  /** @type {Array<{file:string, line:number, text:string, kind:'style-attr'|'style-tag'}>} */
  const offenders = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const contents = fs.readFileSync(file, 'utf8');
    const lines = contents.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      if (text.includes('style="')) {
        styleAttr++;
        offenders.push({ file: rel, line: i + 1, text: text.trim(), kind: 'style-attr' });
      }
      if (text.includes('<style')) {
        styleTag++;
        offenders.push({ file: rel, line: i + 1, text: text.trim(), kind: 'style-tag' });
      }
    }
  }

  return { styleAttr, styleTag, offenders };
}

function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    console.error(`ERROR: Missing EN directory at ${TARGET_DIR}`);
    process.exit(2);
  }

  const { styleAttr, styleTag, offenders } = scan();

  console.log(`style=\" count: ${styleAttr}`);
  console.log(`<style count: ${styleTag}`);

  if (offenders.length === 0) {
    process.exit(0);
  }

  console.log('');
  console.log('Offenders (file:line:kind:content):');
  for (const o of offenders) {
    console.log(`${o.file}:${o.line}:${o.kind}:${o.text}`);
  }

  process.exit(1);
}

main();

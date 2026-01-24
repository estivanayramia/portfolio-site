import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function usage() {
  console.error('Usage: node tools/run-command-capture.mjs --out <file> --exit <file> -- <command...>');
  process.exit(2);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const idx = args.indexOf('--');
  if (idx === -1) return null;

  const before = args.slice(0, idx);
  const cmd = args.slice(idx + 1);
  if (cmd.length === 0) return null;

  let outPath = null;
  let exitPath = null;

  for (let i = 0; i < before.length; i++) {
    const a = before[i];
    if (a === '--out') {
      outPath = before[++i];
      continue;
    }
    if (a === '--exit') {
      exitPath = before[++i];
      continue;
    }
    return null;
  }

  if (!outPath || !exitPath) return null;
  return { outPath, exitPath, cmd };
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) usage();

  const outPath = path.resolve(process.cwd(), parsed.outPath);
  const exitPath = path.resolve(process.cwd(), parsed.exitPath);

  ensureDir(outPath);
  ensureDir(exitPath);

  const commandLine = parsed.cmd.join(' ');
  const out = fs.createWriteStream(outPath, { flags: 'w' });

  const child = spawn(commandLine, {
    shell: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.pipe(out, { end: false });
  child.stderr.pipe(out, { end: false });

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(typeof code === 'number' ? code : 1));
    child.on('error', () => resolve(1));
  });

  out.end();
  fs.writeFileSync(exitPath, String(exitCode), 'utf8');

  process.exit(exitCode);
}

main();

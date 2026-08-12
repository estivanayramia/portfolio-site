import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const rootPath = fileURLToPath(new URL('../', import.meta.url));
const metaPattern = /<meta\s+[^>]*name=["']build-version["'][^>]*content=["']([^"']+)["'][^>]*>/gi;

function trackedHtmlFiles() {
  return execFileSync('git', ['ls-files', '-z', '--', '*.html'], {
    cwd: rootPath,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);
}

test('every tracked HTML surface has exactly one non-empty build version', async () => {
  const files = trackedHtmlFiles();
  assert.equal(files.length, 60);

  for (const file of files) {
    const source = await readFile(path.join(rootPath, file), 'utf8');
    const matches = [...source.matchAll(metaPattern)];
    assert.equal(matches.length, 1, file);
    assert.match(matches[0][1], /^\d{8}-[a-z0-9]+$/i, file);
  }
});

test('the build stamper inserts missing metadata and updates existing metadata', async () => {
  const fixturePath = await mkdtemp(path.join(tmpdir(), 'portfolio-build-version-'));

  try {
    await mkdir(path.join(fixturePath, 'EN'));
    await mkdir(path.join(fixturePath, 'assets', 'MiniGames', 'sample-game'), { recursive: true });
    await writeFile(path.join(fixturePath, 'index.html'), '<!doctype html>\n<html><head>\n  <meta charset="utf-8">\n  <title>Root</title>\n</head><body></body></html>\n');
    await writeFile(path.join(fixturePath, 'EN', 'index.html'), '<!doctype html>\n<html><head>\n  <meta name="build-version" content="old-build">\n  <meta charset="utf-8">\n</head><body></body></html>\n');
    await writeFile(path.join(fixturePath, 'assets', 'MiniGames', 'sample-game', 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Game</title></head><body></body></html>\n');
    await writeFile(path.join(fixturePath, 'sw.js'), 'const CACHE_VERSION = "old-cache";\n');

    await execFileAsync(process.execPath, [path.join(rootPath, 'tools', 'stamp-build-version.mjs')], {
      cwd: fixturePath,
      env: { ...process.env, COMMIT_SHA: 'abcdef1234567890' },
    });

    for (const file of [
      'index.html',
      path.join('EN', 'index.html'),
      path.join('assets', 'MiniGames', 'sample-game', 'index.html'),
    ]) {
      const source = await readFile(path.join(fixturePath, file), 'utf8');
      const matches = [...source.matchAll(metaPattern)];
      assert.equal(matches.length, 1, file);
      assert.match(matches[0][1], /^\d{8}-abcdef1$/, file);
      const headContent = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
      assert.match(headContent, /^\s*<meta\s+charset=/i, `${file} charset must stay first`);
      assert.ok(
        headContent.search(/name=["']build-version["']/i) > headContent.search(/<meta\s+charset=/i),
        `${file} build version must follow charset`,
      );
    }

    const serviceWorker = await readFile(path.join(fixturePath, 'sw.js'), 'utf8');
    assert.match(serviceWorker, /CACHE_VERSION = "v\d{8}-abcdef1";/);

    const firstPass = await Promise.all([
      readFile(path.join(fixturePath, 'index.html'), 'utf8'),
      readFile(path.join(fixturePath, 'EN', 'index.html'), 'utf8'),
      readFile(path.join(fixturePath, 'assets', 'MiniGames', 'sample-game', 'index.html'), 'utf8'),
    ]);
    await execFileAsync(process.execPath, [path.join(rootPath, 'tools', 'stamp-build-version.mjs')], {
      cwd: fixturePath,
      env: { ...process.env, COMMIT_SHA: 'abcdef1234567890' },
    });
    const secondPass = await Promise.all([
      readFile(path.join(fixturePath, 'index.html'), 'utf8'),
      readFile(path.join(fixturePath, 'EN', 'index.html'), 'utf8'),
      readFile(path.join(fixturePath, 'assets', 'MiniGames', 'sample-game', 'index.html'), 'utf8'),
    ]);
    assert.deepEqual(secondPass, firstPass, 'stamping the same build twice must be byte-identical');
  } finally {
    await rm(fixturePath, { recursive: true, force: true });
  }
});

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, parse, extname } from 'node:path';

const execFileAsync = promisify(execFile);

const SOURCE_DIR = 'assets/img/Portolio-Media/me-/extracted';
const OUTPUT_DIR = 'assets/img/Portolio-Media/Portfolio-Media/me-';
const QUALITY = 76;
const MAX_DIMENSION = 1800;

const VALID_EXTENSIONS = new Set(['.cr2', '.heic', '.jpg', '.jpeg', '.png']);

function toKb(bytes) {
  return Math.round(bytes / 1024);
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && VALID_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function convertOne(inputPath, outputPath) {
  const args = [
    inputPath,
    '-auto-orient',
    '-resize',
    `${MAX_DIMENSION}x${MAX_DIMENSION}>`,
    '-strip',
    '-quality',
    String(QUALITY),
    '-define',
    'webp:method=6',
    '-define',
    'webp:alpha-quality=100',
    outputPath,
  ];

  try {
    await execFileAsync('magick', args, { timeout: 120000, windowsHide: true });
    const outputStats = await stat(outputPath);
    return { success: true, outputBytes: outputStats.size };
  } catch (error) {
    return { success: false, error: String(error?.message || error) };
  }
}

async function main() {
  console.log('🔍 Scanning me source directory...');
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await collectFiles(SOURCE_DIR)).sort((a, b) => a.localeCompare(b));
  console.log(`📸 Found ${files.length} images to convert`);

  const results = [];

  for (const inputPath of files) {
    const sourceStats = await stat(inputPath);
    const baseName = parse(inputPath).name;
    const outputPath = join(OUTPUT_DIR, `${baseName}.webp`);

    process.stdout.write(`Converting ${parse(inputPath).base} (${toKb(sourceStats.size)} KB) ... `);
    const result = await convertOne(inputPath, outputPath);

    if (result.success) {
      console.log(`✅ ${parse(outputPath).base} (${toKb(result.outputBytes)} KB)`);
      results.push({ success: true, sourceBytes: sourceStats.size, outputBytes: result.outputBytes });
    } else {
      console.log('❌ FAILED');
      results.push({ success: false, sourceBytes: sourceStats.size, outputBytes: 0, error: result.error, inputPath });
    }
  }

  const successful = results.filter((item) => item.success);
  const failed = results.filter((item) => !item.success);
  const totalOutputBytes = successful.reduce((sum, item) => sum + item.outputBytes, 0);
  const avgOutputKb = successful.length > 0 ? Math.round(totalOutputBytes / successful.length / 1024) : 0;

  console.log('\n📊 RESULTS');
  console.log(`✅ Converted: ${successful.length}/${files.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`💾 Total output size: ${toKb(totalOutputBytes)} KB`);
  console.log(`📏 Average per image: ${avgOutputKb} KB`);

  if (failed.length > 0) {
    console.log('\n⚠️ Failed files:');
    for (const item of failed) {
      console.log(` - ${item.inputPath}: ${item.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { join, parse, extname } from 'node:path';

const execFileAsync = promisify(execFile);

const SOURCE_DIR = 'assets/img/Portolio-Media/Portfolio-Media/photography-/extracted';
const OUTPUT_DIR = 'assets/img/Portolio-Media/Portfolio-Media/photography-';
const QUALITY = 76;
const MAX_DIMENSION = 1800;

const VALID_EXTENSIONS = new Set(['.cr2', '.heic', '.jpg', '.jpeg', '.png']);

function toKb(bytes) {
  return Math.round(bytes / 1024);
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
  console.log('🔍 Scanning source directory...');
  await mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await readdir(SOURCE_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => VALID_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  console.log(`📸 Found ${files.length} images to convert`);

  const results = [];

  for (const fileName of files) {
    const inputPath = join(SOURCE_DIR, fileName);
    const baseName = parse(fileName).name;
    const outputPath = join(OUTPUT_DIR, `${baseName}.webp`);

    const sourceStats = await stat(inputPath);
    process.stdout.write(`Converting ${fileName} (${toKb(sourceStats.size)} KB) ... `);

    const result = await convertOne(inputPath, outputPath);
    if (result.success) {
      console.log(`✅ ${parse(outputPath).base} (${toKb(result.outputBytes)} KB)`);
      results.push({ fileName, success: true, sourceBytes: sourceStats.size, outputBytes: result.outputBytes });
    } else {
      console.log('❌ FAILED');
      results.push({ fileName, success: false, sourceBytes: sourceStats.size, outputBytes: 0, error: result.error });
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
      console.log(` - ${item.fileName}: ${item.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

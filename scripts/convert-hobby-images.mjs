/**
 * convert-hobby-images.mjs
 * Convert HEIC, CR2, JPEG, PNG to optimized WebP for hobby pages
 * Handles photography (HEIC/CR2/JPG), whispers (HEIC/JPG), reading (various)
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Max dimensions for gallery images (maintain aspect ratio)
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const WEBP_QUALITY = 85;

async function convertImage(inputPath, outputPath) {
  try {
    const ext = path.extname(inputPath).toLowerCase();
    
    // CR2 (Canon RAW) needs special handling - extract embedded JPEG
    if (ext === '.cr2') {
      const metadata = await sharp(inputPath).metadata();
      console.log(`  [CR2] ${path.basename(inputPath)} - ${metadata.width}x${metadata.height}`);
      
      await sharp(inputPath, { failOn: 'none' })
        .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);
    }
    // HEIC needs conversion via sharp
    else if (ext === '.heic') {
      const metadata = await sharp(inputPath).metadata();
      console.log(`  [HEIC] ${path.basename(inputPath)} - ${metadata.width}x${metadata.height}`);
      
      await sharp(inputPath)
        .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);
    }
    // Standard formats
    else {
      const metadata = await sharp(inputPath).metadata();
      console.log(`  [${ext.toUpperCase()}] ${path.basename(inputPath)} - ${metadata.width}x${metadata.height}`);
      
      await sharp(inputPath)
        .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);
    }
    
    const inputSize = fs.statSync(inputPath).size;
    const outputSize = fs.statSync(outputPath).size;
    const savings = ((1 - outputSize / inputSize) * 100).toFixed(1);
    console.log(`  → Saved ${savings}% (${(inputSize / 1024 / 1024).toFixed(2)} MB → ${(outputSize / 1024).toFixed(0)} KB)`);
    
    return { success: true, inputSize, outputSize };
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function processFolder(sourceFolder, targetFolder, pattern = null) {
  if (!fs.existsSync(sourceFolder)) {
    console.log(`⚠ Skip: ${sourceFolder} does not exist`);
    return { processed: 0, failed: 0 };
  }
  
  const files = fs.readdirSync(sourceFolder, { withFileTypes: true });
  let processed = 0;
  let failed = 0;
  let totalInputSize = 0;
  let totalOutputSize = 0;
  
  // Ensure target folder exists
  fs.mkdirSync(targetFolder, { recursive: true });
  
  for (const file of files) {
    if (!file.isFile()) continue;
    
    const ext = path.extname(file.name).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.heic', '.cr2', '.webp'];
    
    if (!validExts.includes(ext)) continue;
    
    // Apply pattern filter if provided
    if (pattern && !new RegExp(pattern, 'i').test(file.name)) continue;
    
    const inputPath = path.join(sourceFolder, file.name);
    const baseName = path.basename(file.name, ext);
    const outputPath = path.join(targetFolder, `${baseName}.webp`);
    
    // Skip if already WebP and in target folder
    if (ext === '.webp' && sourceFolder === targetFolder) {
      console.log(`  ✓ Skip: ${file.name} (already WebP)`);
      continue;
    }
    
    console.log(`\n📷 ${file.name}`);
    const result = await convertImage(inputPath, outputPath);
    
    if (result.success) {
      processed++;
      totalInputSize += result.inputSize;
      totalOutputSize += result.outputSize;
    } else {
      failed++;
    }
  }
  
  if (processed > 0) {
    const totalSavings = ((1 - totalOutputSize / totalInputSize) * 100).toFixed(1);
    console.log(`\n💾 Total: ${(totalInputSize / 1024 / 1024).toFixed(2)} MB → ${(totalOutputSize / 1024).toFixed(0)} KB (${totalSavings}% savings)`);
  }
  
  return { processed, failed, totalInputSize, totalOutputSize };
}

async function main() {
  console.log('🖼️  Converting hobby images to optimized WebP...\n');
  
  const tasks = [
    {
      name: 'Photography (extracted)',
      source: path.join(ROOT, 'assets/img/Portolio-Media/Portfolio Media/photography-/extracted'),
      target: path.join(ROOT, 'assets/img/Portolio-Media/Portfolio Media/photography-')
    },
    {
      name: 'Whispers (HEIC only)',
      source: path.join(ROOT, 'assets/img/Portolio-Media/Portfolio Media/whispers-'),
      target: path.join(ROOT, 'assets/img/Portolio-Media/Portfolio Media/whispers-'),
      pattern: 'Note (38|39|40|41|42|43|44|45|46)\\.HEIC'
    },
    {
      name: 'Reading (optimize existing)',
      source: path.join(ROOT, 'assets/img/Portolio-Media/Portfolio Media/reading-'),
      target: path.join(ROOT, 'assets/img/Portolio-Media/Portfolio Media/reading-')
    }
  ];
  
  const summary = [];
  
  for (const task of tasks) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📁 ${task.name}`);
    console.log(`${'='.repeat(60)}`);
    
    const result = await processFolder(task.source, task.target, task.pattern);
    summary.push({ ...task, ...result });
  }
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  let grandTotal = { processed: 0, failed: 0 };
  for (const s of summary) {
    console.log(`\n${s.name}:`);
    console.log(`  ✓ Processed: ${s.processed}`);
    console.log(`  ✗ Failed: ${s.failed}`);
    grandTotal.processed += s.processed;
    grandTotal.failed += s.failed;
  }
  
  console.log(`\n🎉 Grand Total: ${grandTotal.processed} images converted, ${grandTotal.failed} failed`);
  
  if (grandTotal.failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

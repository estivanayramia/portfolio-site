import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function log(msg) {
  console.log(`[stamp-versioned-assets] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[stamp-versioned-assets] ERROR: ${msg}`);
  process.exit(code);
}

// Compute stamp
function getStamp() {
  const sha = process.env.CF_PAGES_COMMIT_SHA;
  if (sha && String(sha).trim()) {
    const stamp = String(sha).trim().slice(0, 8);
    log(`Using commit SHA stamp: ${stamp}`);
    return { stamp, mode: 'commit' };
  }
  
  const dateStamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const localStamp = `${dateStamp}-local`;
  log(`Using local date stamp: ${localStamp}`);
  return { stamp: localStamp, mode: 'local' };
}

// Assets to stamp
const ASSETS_TO_STAMP = [
  { src: 'assets/js/site.min.js', pattern: /\/assets\/js\/site\.min\.js(\?v=[^"'\s]+)?/g },
  { src: 'assets/js/lazy-loader.min.js', pattern: /\/assets\/js\/lazy-loader\.min\.js(\?v=[^"'\s]+)?/g },
  { src: 'assets/css/style.css', pattern: /\/assets\/css\/style\.css(\?v=[^"'\s]+)?/g }
];

// HTML files to rewrite
const HTML_FILES = [
  'index.html',
  'ar/index.html',
  'es/index.html',
  'EN/index.html',
  'EN/404.html',
  'EN/about.html',
  'EN/contact.html',
  'EN/deep-dive.html',
  'EN/hobbies-games.html',
  'EN/overview.html',
  'EN/privacy.html'
];

function main() {
  const { stamp, mode } = getStamp();
  
  // Step 1: Verify source assets exist
  log('Verifying source assets...');
  for (const asset of ASSETS_TO_STAMP) {
    const srcPath = path.join(ROOT, asset.src);
    if (!fs.existsSync(srcPath)) {
      fail(`Source asset missing: ${asset.src}`);
    }
    log(`  ✓ ${asset.src}`);
  }
  
  // Step 2: Copy assets with stamp in filename
  log('Creating stamped copies...');
  const stampedAssets = [];
  for (const asset of ASSETS_TO_STAMP) {
    const srcPath = path.join(ROOT, asset.src);
    const ext = path.extname(asset.src);
    const base = asset.src.slice(0, -ext.length);
    const stampedName = `${base}.${stamp}${ext}`;
    const destPath = path.join(ROOT, stampedName);
    
    fs.copyFileSync(srcPath, destPath);
    log(`  ✓ ${asset.src} → ${stampedName}`);
    
    stampedAssets.push({
      original: asset.src,
      stamped: stampedName,
      pattern: asset.pattern
    });
  }
  
  // Step 3: Rewrite HTML files
  // Guardrail: local builds should not rewrite tracked HTML to a local stamp.
  if (mode === 'commit') {
    log('Rewriting HTML references...');
    let totalReplacements = 0;

    for (const htmlFile of HTML_FILES) {
      const htmlPath = path.join(ROOT, htmlFile);
      if (!fs.existsSync(htmlPath)) {
        log(`  ⚠ Skipping missing: ${htmlFile}`);
        continue;
      }

      let content = fs.readFileSync(htmlPath, 'utf8');
      let fileReplacements = 0;

      for (const asset of stampedAssets) {
        const replacement = `/${asset.stamped}`;
        const matches = content.match(asset.pattern);
        if (matches) {
          content = content.replace(asset.pattern, replacement);
          fileReplacements += matches.length;
        }
      }

      if (fileReplacements > 0) {
        fs.writeFileSync(htmlPath, content, 'utf8');
        log(`  ✓ ${htmlFile} (${fileReplacements} replacements)`);
        totalReplacements += fileReplacements;
      } else {
        log(`  - ${htmlFile} (no matches)`);
      }
    }

    log(`Total replacements: ${totalReplacements}`);
  } else {
    log('Skipping HTML reference rewriting (local stamp mode).');
  }
  
  // Step 4: Write deploy stamp metadata
  const stampData = {
    stamp,
    commit: process.env.CF_PAGES_COMMIT_SHA || 'local',
    builtAt: new Date().toISOString(),
    assets: stampedAssets.map(a => ({
      original: a.original,
      stamped: a.stamped
    }))
  };
  
  const stampMetaPath = path.join(ROOT, 'assets/data/deploy-stamp.json');
  fs.mkdirSync(path.dirname(stampMetaPath), { recursive: true });
  fs.writeFileSync(stampMetaPath, JSON.stringify(stampData, null, 2), 'utf8');
  log(`Wrote deploy stamp metadata to ${path.relative(ROOT, stampMetaPath)}`);
  
  log('✅ Asset stamping complete');
}

main();

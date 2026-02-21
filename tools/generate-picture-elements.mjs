/**
 * generate-picture-elements.mjs
 *
 * Wraps <img> in <picture> + <source type="image/webp"> where a .webp
 * counterpart exists on disk. GSAP/lightbox/coverflow/dynamic-src skipped.
 *
 * SH-1, SH-2 compliant.
 * Usage:
 *   node tools/generate-picture-elements.mjs          ← dry run
 *   node tools/generate-picture-elements.mjs --apply  ← write files
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const APPLY = process.argv.includes('--apply');

const SKIP_PATTERNS = [
  /data-gsap/i,
  /class="[^"]*(?:gsap|coverflow|roulette|lightbox|carousel|swiper|slider)/i,
  /data-src=/i,
  /data-lazy/i,
  /src=["']['"]/,
];

const SKIP_FILES = new Set([
  'EN/about.html',
  'EN/about/background.html',
  'EN/about/values.html',
  'EN/about/working-with-me.html',
  'EN/contact.html',
  'EN/deep-dive.html',
  'EN/hobbies/car.html',
  'EN/hobbies/cooking.html',
  'EN/hobbies/gym.html',
  'EN/hobbies/index.html',
  'EN/hobbies/me.html',
  'EN/hobbies/photography.html',
  'EN/hobbies/reading.html',
  'EN/hobbies/whispers.html',
  'EN/index.html',
  'EN/overview.html',
  'EN/projects/conflict.html',
  'EN/projects/endpoint-competitive-playbook.html',
  'EN/projects/endpoint-elosity-video.html',
  'EN/projects/endpoint-linkedin-campaign.html',
  'EN/projects/franklin-templeton-concept.html',
  'EN/projects/index.html',
  'EN/projects/loreal-maps-campaign.html',
  'EN/projects/portfolio.html',
  'ar/index.html',
  'es/index.html',
  'index.html',
]);

const files = execSync(
  'git ls-files -- "EN/**/*.html" "*.html" "ar/*.html" "es/*.html"',
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

let totalWrapped = 0, totalSkipped = 0;
const report = [];

for (const f of files) {
  if (SKIP_FILES.has(f)) {
    totalSkipped++;
    continue;
  }
  const html = readFileSync(f, 'utf8');
  let modified = false;

  const newHtml = html.replace(
    /(<img\s(?:[^>](?!<\/picture>))*?>)/gis,
    (match) => {
      const pos = html.indexOf(match);
      const before = html.slice(Math.max(0, pos - 60), pos);
      if (before.includes('<picture')) { totalSkipped++; return match; }
      for (const p of SKIP_PATTERNS) {
        if (p.test(match)) { totalSkipped++; return match; }
      }
      const srcMatch = match.match(/\bsrc=["']([^"']+)["']/);
      if (!srcMatch) { totalSkipped++; return match; }
      const src = srcMatch[1];
      if (!src || src.startsWith('data:') || src.startsWith('http')) {
        totalSkipped++; return match;
      }
      const local = src.startsWith('/') ? '.' + src : src;
      const webpLocal = local.replace(/\.(jpe?g|png)$/i, '.webp');
      if (!existsSync(webpLocal)) { totalSkipped++; return match; }
      const webpSrc = src.replace(/\.(jpe?g|png)$/i, '.webp');
      totalWrapped++;
      modified = true;
      report.push({ file: f, src, webp: webpSrc });
      return `<picture>\n  <source srcset="${webpSrc}" type="image/webp">\n  ${match}\n</picture>`;
    }
  );

  if (modified && APPLY) {
    writeFileSync(f, newHtml);
    console.log('[APPLIED]', f);
  } else if (modified) {
    console.log('[DRY RUN] would wrap',
      report.filter(r => r.file === f).length, 'img(s) in', f);
  }
}

console.log('\nWrapped:', totalWrapped,
  '| Skipped:', totalSkipped,
  '| Mode:', APPLY ? 'APPLIED' : 'DRY RUN');
if (!APPLY && totalWrapped > 0) {
  console.log('\nEligible:');
  report.forEach(r => console.log(' ', r.file, '→', r.src));
}

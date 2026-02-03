/* eslint-disable no-console */
/**
 * Applies the RadialCarousel "More Games" navigation to all pages under EN/hobbies-games/*.html
 * without touching game runtime code.
 *
 * Idempotent: safe to run multiple times.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GAMES_DIR = path.join(ROOT, 'EN', 'hobbies-games');

const RADIAL_CSS = '/assets/css/carousel/radial-carousel.min.css';
const THEMES_CSS = '/assets/css/carousel/carousel-themes.min.css';
const RADIAL_JS = '/assets/js/carousel/RadialCarousel.min.js';

const NAV_ITEMS = [
  {
    href: '/hobbies-games/block-breaker',
    label: 'Block Breaker',
    desc: 'Smash the bricks',
    emoji: '🧱'
  },
  {
    href: '/hobbies-games/2048',
    label: '2048',
    desc: 'Merge the numbers',
    emoji: '🧩'
  },
  {
    href: '/hobbies-games/space-invaders',
    label: 'Space Invaders',
    desc: 'Defend the earth',
    emoji: '👾'
  },
  {
    href: '/hobbies-games/racer',
    label: 'Racer',
    desc: 'Fast reflex racing',
    emoji: '🏎️'
  },
  {
    href: '/hobbies-games/oh-flip',
    label: 'Oh Flip',
    desc: 'Timing + tricks',
    emoji: '🌀'
  },
  {
    href: '/hobbies-games/onoff',
    label: 'ON/OFF',
    desc: 'Switch-based puzzle',
    emoji: '🔘'
  }
];

function ensureCarouselAssetsInHead(html) {
  if (html.includes(RADIAL_CSS) && html.includes(THEMES_CSS) && html.includes(RADIAL_JS)) return html;

  const themeLinkRe = /<link\s+rel="stylesheet"\s+href="\/theme\.css[^"]*"\s*\/?>/i;
  const m = html.match(themeLinkRe);
  if (!m) return html;

  const injection = [
    '',
    '  <!-- Radial Carousel -->',
    `  <link rel="stylesheet" href="${THEMES_CSS}">`,
    `  <link rel="stylesheet" href="${RADIAL_CSS}">`,
    `  <script type="module" src="${RADIAL_JS}"></script>`
  ].join('\n');

  return html.replace(themeLinkRe, (s) => `${s}${injection}`);
}

function buildCarouselMarkup({ withHeading = true } = {}) {
  const items = NAV_ITEMS.map((it, idx) => {
    return [
      `          <li class="carousel-radial__item" role="listitem" data-index="${idx}">`,
      `            <a href="${it.href}" class="carousel-radial__card flex flex-col items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all group border border-white/5 hover:border-white/20">`,
      `              <div class="text-4xl mb-3 group-hover:scale-110 transition-transform" aria-hidden="true">${it.emoji}</div>`,
      `              <div class="font-bold text-sm">${it.label}</div>`,
      `              <div class="text-xs opacity-60 mt-1">${it.desc}</div>`,
      `            </a>`,
      `          </li>`
    ].join('\n');
  }).join('\n');

  const heading = withHeading
    ? '      <h2 class="text-xl font-bold text-center mb-4">More Games</h2>\n'
    : '';

  return (
    `${heading}` +
    `      <div class="carousel-radial carousel-radial--compact max-w-2xl mx-auto" data-carousel-radial data-carousel-radius="300" data-carousel-rotation-speed="520" aria-label="More games">\n` +
    `        <div class="carousel-radial__viewport" role="region" aria-label="More games">\n` +
    `          <ul class="carousel-radial__track" role="list">\n` +
    `${items}\n` +
    `          </ul>\n` +
    `        </div>\n` +
    `        <div class="carousel-radial__controls" aria-live="polite">\n` +
    `          <button class="carousel-radial__btn carousel-radial__btn--prev" aria-label="View previous game" type="button">\n` +
    `            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">\n` +
    `              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />\n` +
    `            </svg>\n` +
    `          </button>\n` +
    `          <span class="carousel-radial__status" role="status" aria-atomic="true">Item 1 of ${NAV_ITEMS.length}</span>\n` +
    `          <button class="carousel-radial__btn carousel-radial__btn--next" aria-label="View next game" type="button">\n` +
    `            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">\n` +
    `              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />\n` +
    `            </svg>\n` +
    `          </button>\n` +
    `        </div>\n` +
    `        <div class="carousel-radial__indicators" role="tablist" aria-label="Game navigation"></div>\n` +
    `      </div>\n`
  );
}

function replaceMiniGridWithCarousel(html) {
  const gridStart = '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">';
  if (!html.includes(gridStart)) return html;
  if (html.includes('data-carousel-radial')) return html;

  // Replace the entire grid block (<div ...> ... </div>) with carousel markup.
  const startIdx = html.indexOf(gridStart);
  if (startIdx < 0) return html;

  const tokenRe = /<div\b[^>]*>|<\/div>/gi;
  tokenRe.lastIndex = startIdx;

  let depth = 0;
  let endIdx = -1;
  let m;

  while ((m = tokenRe.exec(html))) {
    const token = m[0];
    const isOpen = token.toLowerCase().startsWith('<div');
    const isClose = token.toLowerCase() === '</div>';

    if (m.index === startIdx) {
      // Starting div
      depth = 1;
      continue;
    }

    if (!depth) break;

    if (isOpen) depth += 1;
    else if (isClose) depth -= 1;

    if (depth === 0) {
      endIdx = tokenRe.lastIndex;
      break;
    }
  }

  if (endIdx < 0) return html;

  const before = html.slice(0, startIdx);
  const after = html.slice(endIdx);

  const replacement = buildCarouselMarkup({ withHeading: true });
  return `${before}${replacement}${after}`;
}

function ensureMainGamesHaveSection(html) {
  if (html.includes('data-carousel-radial')) return html;

  const mainClose = '</main>';
  const idx = html.lastIndexOf(mainClose);
  if (idx < 0) return html;

  const insertion = [
    '',
    '    <section class="px-6 pb-10">',
    buildCarouselMarkup({ withHeading: true }).trimEnd(),
    '    </section>',
    ''
  ].join('\n');

  return `${html.slice(0, idx)}${insertion}${html.slice(idx)}`;
}

function applyToFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf-8');
  let next = original;

  next = ensureCarouselAssetsInHead(next);
  next = replaceMiniGridWithCarousel(next);
  next = ensureMainGamesHaveSection(next);

  if (next === original) return false;
  fs.writeFileSync(filePath, next, 'utf-8');
  return true;
}

function main() {
  if (!fs.existsSync(GAMES_DIR)) {
    console.error(`[apply-radial-carousel-to-games] Missing directory: ${GAMES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(GAMES_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(GAMES_DIR, f))
    .sort();

  let changed = 0;
  for (const file of files) {
    const didChange = applyToFile(file);
    if (didChange) {
      changed++;
      console.log(`[apply-radial-carousel-to-games] Updated: ${path.relative(ROOT, file)}`);
    }
  }

  console.log(`[apply-radial-carousel-to-games] Done. Files changed: ${changed}/${files.length}`);
}

main();

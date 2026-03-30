import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { chromium } from 'playwright';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';

import {
  CARD_PREVIEW_MANIFEST,
  PROJECT_CARD_PREVIEWS,
  ABOUT_CARD_PREVIEWS
} from '../assets/js/data/card-preview-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const CARD_WIDTH = 960;
const CARD_HEIGHT = 1440;
const SCREENSHOT_PORT = 5588;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const SURFACE_THEMES = {
  project: {
    baseTop: '#2a3554',
    baseBottom: '#5b4638',
    warmBase: '#efe1ce',
    accent: '#c59a58',
    chipBackground: 'rgba(33, 40, 66, 0.86)',
    chipBorder: 'rgba(229, 213, 183, 0.54)',
    chipText: '#f7eddd',
    textTitle: '#f8f0e2',
    textBody: 'rgba(248, 240, 226, 0.86)',
    textQuote: '#fff7eb',
    lineTint: 'rgba(91, 70, 56, 0.08)',
    bottomFade: 'rgba(33, 40, 66, 0.2)'
  },
  about: {
    baseTop: '#344865',
    baseBottom: '#745948',
    warmBase: '#f1e6d6',
    accent: '#b98a4a',
    chipBackground: 'rgba(33, 40, 66, 0.82)',
    chipBorder: 'rgba(239, 221, 190, 0.52)',
    chipText: '#fff4e3',
    textTitle: '#fff8ed',
    textBody: 'rgba(255, 248, 237, 0.86)',
    textQuote: '#fff9ef',
    lineTint: 'rgba(116, 89, 72, 0.08)',
    bottomFade: 'rgba(54, 32, 23, 0.18)'
  }
};

const FONT_FAMILY = '"Inter", "Segoe UI", sans-serif';

function toRepoAbsolute(sourcePath) {
  if (!sourcePath) throw new Error('Missing source path');
  if (/^https?:\/\//i.test(sourcePath)) return sourcePath;
  return path.resolve(repoRoot, sourcePath.replace(/^\//, ''));
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function readBinaryFromSource(sourcePath) {
  if (/^https?:\/\//i.test(sourcePath)) {
    const response = await fetch(sourcePath);
    if (!response.ok) {
      throw new Error(`Failed to download ${sourcePath}: ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const absolutePath = toRepoAbsolute(sourcePath);
  return fs.readFile(absolutePath);
}

function pickTheme(cardId) {
  return cardId.startsWith('about-') ? SURFACE_THEMES.about : SURFACE_THEMES.project;
}

function drawRoundedRectPath(context, x, y, width, height, radius) {
  const normalizedRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));

  context.beginPath();
  context.moveTo(x + normalizedRadius, y);
  context.lineTo(x + width - normalizedRadius, y);
  context.arcTo(x + width, y, x + width, y + normalizedRadius, normalizedRadius);
  context.lineTo(x + width, y + height - normalizedRadius);
  context.arcTo(x + width, y + height, x + width - normalizedRadius, y + height, normalizedRadius);
  context.lineTo(x + normalizedRadius, y + height);
  context.arcTo(x, y + height, x, y + height - normalizedRadius, normalizedRadius);
  context.lineTo(x, y + normalizedRadius);
  context.arcTo(x, y, x + normalizedRadius, y, normalizedRadius);
  context.closePath();
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function wrapTextToLines(context, text, maxWidth) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const words = normalized.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const candidateWidth = context.measureText(candidate).width;

    if (!currentLine || candidateWidth <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function clampLinesWithEllipsis(context, lines, maxLines, maxWidth) {
  if (lines.length <= maxLines) return lines;

  const clipped = lines.slice(0, maxLines);
  let lastLine = clipped[maxLines - 1];

  while (lastLine.length > 0 && context.measureText(`${lastLine}...`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }

  clipped[maxLines - 1] = `${lastLine}...`;
  return clipped;
}

function drawWrappedText(context, options) {
  const {
    text,
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines,
    font,
    fillStyle
  } = options;

  context.font = font;
  context.fillStyle = fillStyle;
  context.textAlign = 'left';
  context.textBaseline = 'top';

  const wrapped = wrapTextToLines(context, text, maxWidth);
  const lines = clampLinesWithEllipsis(context, wrapped, maxLines, maxWidth);

  let cursorY = y;
  for (const line of lines) {
    context.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }

  return cursorY;
}

function buildBackdrop(theme) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const context = canvas.getContext('2d');

  const verticalGradient = context.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  verticalGradient.addColorStop(0, theme.warmBase);
  verticalGradient.addColorStop(0.48, '#f7efe4');
  verticalGradient.addColorStop(1, '#e5d4bf');
  context.fillStyle = verticalGradient;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const indigoBloom = context.createRadialGradient(
    CARD_WIDTH * 0.18,
    CARD_HEIGHT * 0.1,
    CARD_WIDTH * 0.02,
    CARD_WIDTH * 0.18,
    CARD_HEIGHT * 0.1,
    CARD_WIDTH * 0.72
  );
  indigoBloom.addColorStop(0, 'rgba(42, 53, 84, 0.32)');
  indigoBloom.addColorStop(0.45, 'rgba(42, 53, 84, 0.12)');
  indigoBloom.addColorStop(1, 'rgba(42, 53, 84, 0)');
  context.fillStyle = indigoBloom;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const warmGlow = context.createRadialGradient(
    CARD_WIDTH * 0.84,
    CARD_HEIGHT * 0.18,
    CARD_WIDTH * 0.04,
    CARD_WIDTH * 0.84,
    CARD_HEIGHT * 0.18,
    CARD_WIDTH * 0.58
  );
  warmGlow.addColorStop(0, 'rgba(213, 177, 113, 0.3)');
  warmGlow.addColorStop(0.46, 'rgba(213, 177, 113, 0.14)');
  warmGlow.addColorStop(1, 'rgba(213, 177, 113, 0)');
  context.fillStyle = warmGlow;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const edgeShade = context.createLinearGradient(0, CARD_HEIGHT * 0.3, 0, CARD_HEIGHT);
  edgeShade.addColorStop(0, 'rgba(33, 40, 66, 0)');
  edgeShade.addColorStop(1, theme.bottomFade);
  context.fillStyle = edgeShade;
  context.fillRect(0, CARD_HEIGHT * 0.3, CARD_WIDTH, CARD_HEIGHT * 0.7);

  context.strokeStyle = theme.lineTint;
  context.lineWidth = 1;
  for (let offset = -CARD_HEIGHT; offset < CARD_WIDTH + CARD_HEIGHT; offset += 84) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + CARD_HEIGHT, CARD_HEIGHT);
    context.stroke();
  }

  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  drawRoundedRectPath(context, 30, 30, CARD_WIDTH - 60, CARD_HEIGHT - 60, 34);
  context.stroke();

  return Buffer.from(canvas.toBuffer('image/png'));
}

function createRoundedMaskSvg(width, height, radius) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );
}

function createBorderSvg(width, height, radius, strokeColor, strokeWidth = 2) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${width - strokeWidth}" height="${height - strokeWidth}" rx="${Math.max(0, radius - strokeWidth / 2)}" ry="${Math.max(0, radius - strokeWidth / 2)}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"/></svg>`
  );
}

async function createPanelComposite(sourceBuffer, frame) {
  const {
    left,
    top,
    width,
    height,
    fit = 'cover',
    position = 'attention',
    radius = 30,
    border = 'rgba(242, 230, 213, 0.58)',
    borderWidth = 2,
    rotate = 0,
    background = { r: 13, g: 19, b: 31, alpha: 1 },
    saturation,
    brightness
  } = frame;

  let pipeline = sharp(sourceBuffer)
    .rotate()
    .resize(width, height, {
      fit,
      position,
      background
    });

  const modulate = {};
  if (typeof saturation === 'number') modulate.saturation = saturation;
  if (typeof brightness === 'number') modulate.brightness = brightness;
  if (Object.keys(modulate).length > 0) {
    pipeline = pipeline.modulate(modulate);
  }

  const rasterized = await pipeline.png().toBuffer();
  const rounded = await sharp(rasterized)
    .ensureAlpha()
    .composite([{ input: createRoundedMaskSvg(width, height, radius), blend: 'dest-in' }])
    .png()
    .toBuffer();

  let decorated = await sharp(rounded)
    .composite([{ input: createBorderSvg(width, height, radius, border, borderWidth), left: 0, top: 0 }])
    .png()
    .toBuffer();

  let compositeLeft = left;
  let compositeTop = top;

  if (rotate !== 0) {
    decorated = await sharp(decorated)
      .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const rotatedMeta = await sharp(decorated).metadata();
    const rotatedWidth = rotatedMeta.width || width;
    const rotatedHeight = rotatedMeta.height || height;

    compositeLeft = left - Math.round((rotatedWidth - width) / 2);
    compositeTop = top - Math.round((rotatedHeight - height) / 2);
  }

  return {
    input: decorated,
    left: compositeLeft,
    top: compositeTop
  };
}

function getLayoutFrames(treatment) {
  switch (treatment) {
    case 'single-image-editorial':
      return [
        {
          left: 92,
          top: 148,
          width: 776,
          height: 980,
          fit: 'cover',
          position: 'attention',
          radius: 30,
          border: 'rgba(239, 225, 199, 0.68)',
          borderWidth: 2,
          sourceIndex: 0
        }
      ];
    case 'document-poster':
      return [
        {
          left: 94,
          top: 148,
          width: 772,
          height: 574,
          fit: 'contain',
          position: 'center',
          radius: 26,
          border: 'rgba(248, 236, 214, 0.92)',
          borderWidth: 3,
          background: { r: 247, g: 238, b: 226, alpha: 1 },
          brightness: 1.02,
          saturation: 0.98
        },
        {
          left: 132,
          top: 764,
          width: 696,
          height: 252,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(233, 218, 191, 0.48)',
          borderWidth: 2,
          sourceIndex: 0,
          background: { r: 247, g: 238, b: 226, alpha: 1 }
        }
      ];
    case 'conversation-quote':
    case 'quote-led-cover':
      return [
        {
          left: 88,
          top: 132,
          width: 784,
          height: 590,
          fit: 'cover',
          position: 'top',
          radius: 30,
          border: 'rgba(239, 226, 203, 0.66)',
          borderWidth: 2,
          background: { r: 246, g: 237, b: 225, alpha: 1 }
        },
        {
          left: 618,
          top: 812,
          width: 214,
          height: 288,
          fit: 'cover',
          position: 'left top',
          radius: 20,
          border: 'rgba(235, 218, 190, 0.48)',
          borderWidth: 2,
          sourceIndex: 0
        }
      ];
    case 'motion-storyboard':
    case 'motion-concept':
      return [
        {
          left: 80,
          top: 120,
          width: 800,
          height: 560,
          fit: 'cover',
          position: 'top',
          radius: 32,
          border: 'rgba(238, 224, 199, 0.68)',
          borderWidth: 2,
          background: { r: 246, g: 238, b: 226, alpha: 1 }
        },
        {
          left: 80,
          top: 786,
          width: 236,
          height: 280,
          fit: 'cover',
          position: 'left top',
          radius: 20,
          border: 'rgba(237, 220, 191, 0.42)',
          borderWidth: 2,
          sourceIndex: 0
        },
        {
          left: 362,
          top: 786,
          width: 236,
          height: 280,
          fit: 'cover',
          position: 'center',
          radius: 20,
          border: 'rgba(237, 220, 191, 0.42)',
          borderWidth: 2,
          sourceIndex: 0
        },
        {
          left: 644,
          top: 786,
          width: 236,
          height: 280,
          fit: 'cover',
          position: 'right top',
          radius: 20,
          border: 'rgba(237, 220, 191, 0.42)',
          borderWidth: 2,
          sourceIndex: 0
        }
      ];
    case 'identity-led-composition':
      return [
        {
          left: 62,
          top: 154,
          width: 514,
          height: 996,
          fit: 'cover',
          position: 'attention',
          radius: 28,
          border: 'rgba(239, 225, 198, 0.62)',
          borderWidth: 2,
          sourceIndex: 0
        },
        {
          left: 600,
          top: 176,
          width: 298,
          height: 388,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(237, 220, 190, 0.52)',
          borderWidth: 2,
          sourceIndex: 1
        },
        {
          left: 600,
          top: 602,
          width: 298,
          height: 548,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(237, 220, 190, 0.52)',
          borderWidth: 2,
          sourceIndex: 2
        }
      ];
    case 'hero-detail-triptych':
    case 'hero-detail-diptych':
      return [
        {
          left: 64,
          top: 156,
          width: 500,
          height: 928,
          fit: 'cover',
          position: 'attention',
          radius: 28,
          border: 'rgba(239, 225, 198, 0.62)',
          borderWidth: 2,
          sourceIndex: 0
        },
        {
          left: 592,
          top: 156,
          width: 302,
          height: 404,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(237, 220, 190, 0.52)',
          borderWidth: 2,
          sourceIndex: 1
        },
        {
          left: 592,
          top: 592,
          width: 302,
          height: 492,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(237, 220, 190, 0.52)',
          borderWidth: 2,
          sourceIndex: 2
        }
      ];
    case 'photography-contact-sheet':
    case 'refined-contact-sheet':
      return [
        {
          left: 74,
          top: 162,
          width: 382,
          height: 938,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(236, 221, 195, 0.54)',
          borderWidth: 2,
          sourceIndex: 0
        },
        {
          left: 492,
          top: 162,
          width: 394,
          height: 446,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(236, 221, 195, 0.54)',
          borderWidth: 2,
          sourceIndex: 1
        },
        {
          left: 492,
          top: 654,
          width: 394,
          height: 446,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(236, 221, 195, 0.54)',
          borderWidth: 2,
          sourceIndex: 2
        },
      ];
    case 'reflective-note-cover':
      return [
        {
          left: 96,
          top: 210,
          width: 338,
          height: 474,
          fit: 'cover',
          position: 'attention',
          radius: 16,
          border: 'rgba(255, 248, 219, 0.84)',
          borderWidth: 3,
          rotate: -8,
          sourceIndex: 0,
          background: { r: 241, g: 226, b: 164, alpha: 1 },
          saturation: 0.95
        },
        {
          left: 496,
          top: 194,
          width: 282,
          height: 396,
          fit: 'cover',
          position: 'attention',
          radius: 16,
          border: 'rgba(255, 248, 219, 0.84)',
          borderWidth: 3,
          rotate: 5,
          sourceIndex: 1,
          background: { r: 241, g: 226, b: 164, alpha: 1 },
          saturation: 0.95
        },
        {
          left: 526,
          top: 666,
          width: 276,
          height: 392,
          fit: 'cover',
          position: 'attention',
          radius: 16,
          border: 'rgba(255, 248, 219, 0.84)',
          borderWidth: 3,
          rotate: 4,
          sourceIndex: 3,
          background: { r: 241, g: 226, b: 164, alpha: 1 },
          saturation: 0.95
        }
      ];
    case 'reading-editorial':
    case 'editorial-book-cover':
      return [
        {
          left: 68,
          top: 160,
          width: 500,
          height: 940,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(244, 232, 212, 0.78)',
          borderWidth: 3,
          sourceIndex: 0,
          background: { r: 244, g: 236, b: 225, alpha: 1 }
        },
        {
          left: 592,
          top: 172,
          width: 266,
          height: 412,
          fit: 'cover',
          position: 'center',
          radius: 18,
          border: 'rgba(234, 217, 187, 0.52)',
          borderWidth: 2,
          sourceIndex: 1,
          background: { r: 239, g: 229, b: 211, alpha: 1 }
        },
        {
          left: 592,
          top: 642,
          width: 266,
          height: 412,
          fit: 'contain',
          position: 'center',
          radius: 18,
          border: 'rgba(234, 217, 187, 0.52)',
          borderWidth: 2,
          sourceIndex: 2,
          background: { r: 239, g: 229, b: 211, alpha: 1 }
        }
      ];
    case 'chapter-opener-cover':
    case 'framed-portrait-card':
      return [
        {
          left: 92,
          top: 144,
          width: 776,
          height: 474,
          fit: 'cover',
          position: 'top',
          radius: 30,
          border: 'rgba(239, 225, 199, 0.68)',
          borderWidth: 2,
          background: { r: 246, g: 238, b: 226, alpha: 1 }
        }
      ];
    case 'web-build-cover':
      return [
        {
          left: 70,
          top: 138,
          width: 820,
          height: 538,
          fit: 'cover',
          position: 'top',
          radius: 28,
          border: 'rgba(239, 225, 199, 0.64)',
          borderWidth: 2,
          sourceIndex: 0,
          background: { r: 247, g: 239, b: 228, alpha: 1 }
        },
        {
          left: 88,
          top: 776,
          width: 382,
          height: 248,
          fit: 'cover',
          position: 'left top',
          radius: 22,
          border: 'rgba(234, 216, 185, 0.52)',
          borderWidth: 2,
          sourceIndex: 0
        },
        {
          left: 490,
          top: 776,
          width: 382,
          height: 248,
          fit: 'cover',
          position: 'right top',
          radius: 22,
          border: 'rgba(234, 216, 185, 0.52)',
          borderWidth: 2,
          sourceIndex: 0
        }
      ];
    case 'editorial-composite':
    default:
      return [
        {
          left: 76,
          top: 136,
          width: 808,
          height: 800,
          fit: 'cover',
          position: 'attention',
          radius: 30,
          border: 'rgba(239, 225, 199, 0.64)',
          borderWidth: 2,
          sourceIndex: 0
        },
        {
          left: 112,
          top: 964,
          width: 736,
          height: 238,
          fit: 'cover',
          position: 'attention',
          radius: 22,
          border: 'rgba(234, 216, 185, 0.52)',
          borderWidth: 2,
          sourceIndex: 1
        }
      ];
  }
}

function drawTopChip(context, theme, card) {
  const chipText = normalizeText(card.category || 'Portfolio').toUpperCase();
  context.font = `600 22px ${FONT_FAMILY}`;
  const chipWidth = Math.min(CARD_WIDTH - 128, Math.ceil(context.measureText(chipText).width + 44));

  drawRoundedRectPath(context, 64, 58, chipWidth, 48, 24);
  context.fillStyle = theme.chipBackground;
  context.fill();
  context.strokeStyle = theme.chipBorder;
  context.lineWidth = 1.5;
  context.stroke();

  context.font = `600 22px ${FONT_FAMILY}`;
  context.fillStyle = theme.chipText;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(chipText, 86, 82);
}

function drawTagRow(context, theme, labels, options = {}) {
  const x = options.x ?? 64;
  const y = options.y ?? 110;
  const gap = options.gap ?? 12;
  let cursorX = x;

  labels.forEach((label) => {
    const text = normalizeText(label).toUpperCase();
    if (!text) return;

    context.font = `600 18px ${FONT_FAMILY}`;
    const width = Math.ceil(context.measureText(text).width + 34);
    drawRoundedRectPath(context, cursorX, y, width, 40, 20);
    context.fillStyle = 'rgba(255, 255, 255, 0.58)';
    context.fill();
    context.strokeStyle = 'rgba(91, 70, 56, 0.12)';
    context.lineWidth = 1.2;
    context.stroke();

    context.fillStyle = '#362017';
    context.textBaseline = 'middle';
    context.fillText(text, cursorX + 17, y + 21);
    cursorX += width + gap;
  });
}

function buildTextOverlay(card, theme, treatment, quoteText = '') {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const context = canvas.getContext('2d');
  drawTopChip(context, theme, card);

  switch (treatment) {
    case 'web-build-cover':
      drawTagRow(context, theme, ['system', 'craft', 'performance'], { y: 104 });
      drawRoundedRectPath(context, 92, 1102, 776, 160, 28);
      context.fillStyle = 'rgba(247, 239, 227, 0.8)';
      context.fill();
      context.strokeStyle = 'rgba(91, 70, 56, 0.14)';
      context.lineWidth = 1.5;
      context.stroke();
      drawWrappedText(context, {
        text: 'Editorial UI, canonical preview sync, and hand-coded polish.',
        x: 124,
        y: 1144,
        maxWidth: 700,
        lineHeight: 40,
        maxLines: 2,
        font: `600 29px ${FONT_FAMILY}`,
        fillStyle: '#2f2330'
      });
      break;
    case 'conversation-quote':
    case 'quote-led-cover':
      drawRoundedRectPath(context, 92, 842, 486, 264, 28);
      context.fillStyle = 'rgba(33, 40, 66, 0.82)';
      context.fill();
      context.strokeStyle = 'rgba(237, 219, 188, 0.5)';
      context.lineWidth = 2;
      context.stroke();

      context.fillStyle = 'rgba(246, 228, 195, 0.82)';
      context.font = `700 74px ${FONT_FAMILY}`;
      context.fillText('\u201C', 126, 892);
      drawWrappedText(context, {
        text: quoteText || card.title,
        x: 172,
        y: 882,
        maxWidth: 356,
        lineHeight: 42,
        maxLines: 4,
        font: `600 31px ${FONT_FAMILY}`,
        fillStyle: theme.textQuote
      });
      context.fillStyle = 'rgba(247, 239, 227, 0.74)';
      context.font = `500 20px ${FONT_FAMILY}`;
      context.fillText(card.title, 126, 1056);
      break;
    case 'chapter-opener-cover': {
      drawRoundedRectPath(context, 92, 824, 776, 312, 32);
      context.fillStyle = 'rgba(33, 40, 66, 0.8)';
      context.fill();
      context.strokeStyle = 'rgba(237, 219, 188, 0.42)';
      context.lineWidth = 2;
      context.stroke();

      const titleEndY = drawWrappedText(context, {
        text: card.title,
        x: 128,
        y: 900,
        maxWidth: 696,
        lineHeight: 64,
        maxLines: 2,
        font: `700 58px ${FONT_FAMILY}`,
        fillStyle: theme.textTitle
      });

      context.strokeStyle = 'rgba(239, 221, 190, 0.36)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(128, titleEndY + 20);
      context.lineTo(812, titleEndY + 20);
      context.stroke();
      break;
    }
    case 'motion-storyboard':
    case 'motion-concept':
      drawTagRow(context, theme, ['storyboard', 'voiceover'], { y: 104 });
      context.beginPath();
      context.arc(808, 658, 34, 0, Math.PI * 2);
      context.fillStyle = 'rgba(33, 40, 66, 0.88)';
      context.fill();
      context.strokeStyle = 'rgba(239, 221, 190, 0.6)';
      context.lineWidth = 2;
      context.stroke();
      context.beginPath();
      context.moveTo(798, 642);
      context.lineTo(798, 674);
      context.lineTo(824, 658);
      context.closePath();
      context.fillStyle = 'rgba(247, 239, 227, 0.92)';
      context.fill();
      break;
    case 'document-poster':
      drawTagRow(context, theme, ['deck preview'], { y: 104, gap: 0 });
      break;
    case 'reading-editorial':
      drawTagRow(context, theme, ['books', 'notes'], { y: 104 });
      break;
    case 'identity-led-composition':
      drawTagRow(context, theme, ['family', 'heritage'], { y: 104 });
      break;
    case 'single-image-editorial':
      drawTagRow(context, theme, ['family archive'], { y: 104, gap: 0 });
      break;
    case 'arcade-cover-art':
      drawTagRow(context, theme, ['arcade', 'strategy'], { y: 104 });
      break;
    case 'reflective-note-cover':
      drawTagRow(context, theme, ['quiet thoughts'], { y: 104, gap: 0 });
      break;
    default:
      break;
  }

  return Buffer.from(canvas.toBuffer('image/png'));
}

function buildArcadeCover(card) {
  const theme = pickTheme(card.id);
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const context = canvas.getContext('2d');

  const vertical = context.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  vertical.addColorStop(0, '#f3e8d6');
  vertical.addColorStop(0.56, '#d8c3a4');
  vertical.addColorStop(1, '#25314c');
  context.fillStyle = vertical;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const halo = context.createRadialGradient(
    CARD_WIDTH * 0.5,
    CARD_HEIGHT * 0.26,
    CARD_WIDTH * 0.03,
    CARD_WIDTH * 0.5,
    CARD_HEIGHT * 0.26,
    CARD_WIDTH * 0.42
  );
  halo.addColorStop(0, 'rgba(255, 242, 221, 0.98)');
  halo.addColorStop(0.45, 'rgba(255, 242, 221, 0.54)');
  halo.addColorStop(1, 'rgba(255, 242, 221, 0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  drawTopChip(context, theme, card);
  drawTagRow(context, theme, ['arcade', 'strategy'], { y: 104 });

  const marqueeGradient = context.createLinearGradient(0, 0, CARD_WIDTH, 0);
  marqueeGradient.addColorStop(0, '#2b3754');
  marqueeGradient.addColorStop(1, '#4c2945');
  drawRoundedRectPath(context, 120, 170, 720, 148, 28);
  context.fillStyle = marqueeGradient;
  context.fill();
  context.shadowColor = 'rgba(36, 26, 18, 0.22)';
  context.shadowBlur = 24;
  context.shadowOffsetY = 12;
  context.strokeStyle = 'rgba(239, 224, 197, 0.54)';
  context.lineWidth = 3;
  context.stroke();
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  context.fillStyle = '#f5ead7';
  context.font = `700 54px ${FONT_FAMILY}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('GAMES', CARD_WIDTH / 2, 244);
  context.font = `500 18px ${FONT_FAMILY}`;
  context.fillStyle = 'rgba(245, 234, 215, 0.82)';
  context.fillText('mini arcade + systems thinking', CARD_WIDTH / 2, 286);

  const cabinetX = 188;
  const cabinetY = 390;
  const cabinetWidth = 584;
  const cabinetHeight = 520;

  drawRoundedRectPath(context, cabinetX, cabinetY, cabinetWidth, cabinetHeight, 40);
  context.fillStyle = '#212842';
  context.fill();
  context.strokeStyle = 'rgba(239, 224, 197, 0.22)';
  context.lineWidth = 2;
  context.stroke();

  drawRoundedRectPath(context, cabinetX + 40, cabinetY + 44, cabinetWidth - 80, 272, 26);
  const screenGradient = context.createLinearGradient(cabinetX, cabinetY + 44, cabinetX + cabinetWidth, cabinetY + 316);
  screenGradient.addColorStop(0, '#1d2338');
  screenGradient.addColorStop(0.5, '#2d4465');
  screenGradient.addColorStop(1, '#1b2f50');
  context.fillStyle = screenGradient;
  context.fill();

  context.strokeStyle = 'rgba(191, 206, 232, 0.28)';
  context.lineWidth = 1.5;
  for (let x = cabinetX + 64; x < cabinetX + cabinetWidth - 32; x += 42) {
    context.beginPath();
    context.moveTo(x, cabinetY + 60);
    context.lineTo(x, cabinetY + 302);
    context.stroke();
  }
  for (let y = cabinetY + 62; y < cabinetY + 300; y += 38) {
    context.beginPath();
    context.moveTo(cabinetX + 54, y);
    context.lineTo(cabinetX + cabinetWidth - 54, y);
    context.stroke();
  }

  context.fillStyle = 'rgba(240, 224, 194, 0.92)';
  context.font = `700 34px ${FONT_FAMILY}`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText('01', cabinetX + 84, cabinetY + 118);
  context.fillText('02', cabinetX + 84, cabinetY + 196);
  context.fillText('03', cabinetX + 84, cabinetY + 274);
  context.font = `600 24px ${FONT_FAMILY}`;
  context.fillText('arcade instinct', cabinetX + 164, cabinetY + 118);
  context.fillText('strategy bias', cabinetX + 164, cabinetY + 196);
  context.fillText('built for play', cabinetX + 164, cabinetY + 274);

  context.save();
  context.translate(cabinetX + 470, cabinetY + 196);
  context.fillStyle = '#efdcb6';
  context.beginPath();
  context.moveTo(-10, 28);
  context.lineTo(28, 10);
  context.lineTo(10, -14);
  context.lineTo(18, -48);
  context.lineTo(-8, -26);
  context.lineTo(-34, -46);
  context.lineTo(-28, -12);
  context.lineTo(-50, 10);
  context.lineTo(-14, 20);
  context.closePath();
  context.fill();
  context.restore();

  drawRoundedRectPath(context, cabinetX + 52, cabinetY + 352, cabinetWidth - 104, 118, 24);
  context.fillStyle = 'rgba(244, 235, 223, 0.1)';
  context.fill();
  context.strokeStyle = 'rgba(239, 224, 197, 0.18)';
  context.lineWidth = 1.5;
  context.stroke();

  context.beginPath();
  context.arc(cabinetX + 186, cabinetY + 410, 28, 0, Math.PI * 2);
  context.fillStyle = '#bc9460';
  context.fill();
  context.beginPath();
  context.arc(cabinetX + 186, cabinetY + 410, 12, 0, Math.PI * 2);
  context.fillStyle = '#f6ead6';
  context.fill();

  context.fillStyle = '#f6ead6';
  context.fillRect(cabinetX + 320, cabinetY + 392, 76, 16);
  context.fillRect(cabinetX + 404, cabinetY + 392, 76, 16);
  context.fillRect(cabinetX + 362, cabinetY + 350, 16, 100);

  context.font = `600 24px ${FONT_FAMILY}`;
  context.fillStyle = 'rgba(246, 234, 214, 0.88)';
  context.fillText('Playful enough to invite you in.', cabinetX + 72, cabinetY + 534);
  context.fillText('Structured enough to still feel like the site.', cabinetX + 72, cabinetY + 572);

  drawRoundedRectPath(context, 96, 1020, 768, 172, 28);
  context.fillStyle = 'rgba(33, 40, 66, 0.82)';
  context.fill();
  context.strokeStyle = 'rgba(239, 224, 197, 0.32)';
  context.lineWidth = 1.5;
  context.stroke();

  drawWrappedText(context, {
    text: card.title,
    x: 132,
    y: 1062,
    maxWidth: 696,
    lineHeight: 62,
    maxLines: 2,
    font: `700 54px ${FONT_FAMILY}`,
    fillStyle: theme.textTitle
  });

  drawWrappedText(context, {
    text: 'Arcade energy, strategy bias, and systems thinking turned into a custom cover instead of another weak page screenshot.',
    x: 132,
    y: 1136,
    maxWidth: 676,
    lineHeight: 34,
    maxLines: 2,
    font: `500 24px ${FONT_FAMILY}`,
    fillStyle: theme.textBody
  });

  return sharp(Buffer.from(canvas.toBuffer('image/png')))
    .webp({ quality: 90, effort: 6 })
    .toBuffer();
}

async function composeEditorialCover(options) {
  const {
    card,
    treatment,
    sources,
    quote
  } = options;

  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error(`No source buffers were supplied for ${card.id}`);
  }

  const theme = pickTheme(card.id);
  const backdrop = buildBackdrop(theme);
  const frames = getLayoutFrames(treatment);

  const panelComposites = [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const sourceIndex = frame.sourceIndex ?? frameIndex;
    const source = sources[sourceIndex] || sources[sourceIndex % sources.length] || sources[0];
    panelComposites.push(await createPanelComposite(source, frame));
  }

  const overlay = buildTextOverlay(card, theme, treatment, quote);

  return sharp(backdrop)
    .composite([...panelComposites, { input: overlay, left: 0, top: 0 }])
    .webp({ quality: 88, effort: 6 })
    .toBuffer();
}

async function renderPdfFirstPage(pdfSourcePath) {
  const pdfBuffer = await readBinaryFromSource(pdfSourcePath);
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,
    verbosity: VerbosityLevel.ERRORS
  });

  const documentHandle = await loadingTask.promise;
  const page = await documentHandle.getPage(1);
  const viewport = page.getViewport({ scale: 2.5 });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  const pageBuffer = Buffer.from(canvas.toBuffer('image/png'));
  await documentHandle.cleanup();
  await documentHandle.destroy();

  return pageBuffer;
}

async function buildPhotoCover(card, sourcePath, treatment) {
  const sourceBuffer = await readBinaryFromSource(sourcePath);
  return composeEditorialCover({
    card,
    treatment,
    sources: [sourceBuffer]
  });
}

async function buildPdfCover(card, pdfSourcePath, treatment) {
  const pageBuffer = await renderPdfFirstPage(pdfSourcePath);
  const effectiveTreatment = treatment || 'document-poster';

  return composeEditorialCover({
    card,
    treatment: effectiveTreatment,
    sources: [pageBuffer]
  });
}

async function buildCollageCover(card, sourcePaths, treatment) {
  const effectiveSources = Array.isArray(sourcePaths)
    ? [...new Set(sourcePaths.filter(Boolean))].slice(0, 8)
    : [];
  if (effectiveSources.length === 0) {
    throw new Error(`Collage generation requires at least one source for ${card.id}`);
  }

  const buffers = [];
  for (const source of effectiveSources) {
    buffers.push(await readBinaryFromSource(source));
  }

  return composeEditorialCover({
    card,
    treatment,
    sources: buffers
  });
}

function resolveRequestPath(requestPath) {
  const normalizedPath = decodeURIComponent(requestPath.split('?')[0] || '/');
  const safePath = path.normalize(normalizedPath).replace(/^\.+/, '');

  const candidates = [];
  if (safePath === '/' || safePath === '\\') {
    candidates.push('index.html');
  } else {
    candidates.push(safePath.replace(/^[/\\]/, ''));
    if (!path.extname(safePath)) {
      candidates.push(`${safePath.replace(/^[/\\]/, '')}.html`);
      candidates.push(path.join(safePath.replace(/^[/\\]/, ''), 'index.html'));
    }
  }

  return candidates;
}

async function createStaticServer(rootPath, preferredPort) {
  const server = createServer(async (request, response) => {
    try {
      const candidates = resolveRequestPath(request.url || '/');

      let resolvedFilePath = null;
      for (const candidate of candidates) {
        const absoluteCandidate = path.resolve(rootPath, candidate);
        if (!absoluteCandidate.startsWith(rootPath)) continue;

        try {
          const stats = await fs.stat(absoluteCandidate);
          if (stats.isFile()) {
            resolvedFilePath = absoluteCandidate;
            break;
          }
        } catch {
          // Continue through candidate list until a file is found.
        }
      }

      if (!resolvedFilePath) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }

      const extension = path.extname(resolvedFilePath).toLowerCase();
      const body = await fs.readFile(resolvedFilePath);
      response.writeHead(200, {
        'content-type': MIME_TYPES[extension] || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(String(error));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start preview server'));
        return;
      }
      resolve({
        server,
        port: address.port,
        close: () => new Promise((closeResolve) => server.close(() => closeResolve()))
      });
    });
  });
}

async function captureScreenshotPreview(browserPage, serverPort, routePath, selectors = []) {
  const url = `http://127.0.0.1:${serverPort}${routePath}`;

  await browserPage.goto(url, {
    waitUntil: 'networkidle',
    timeout: 45_000
  });

  await browserPage.waitForTimeout(550);

  for (const selector of selectors) {
    const locator = browserPage.locator(selector).first();
    if ((await locator.count()) === 0) continue;

    try {
      await locator.waitFor({ state: 'visible', timeout: 4_000 });
      return await locator.screenshot({ animations: 'disabled' });
    } catch {
      // Try next selector fallback.
    }
  }

  return browserPage.screenshot({
    animations: 'disabled'
  });
}

async function writeCardPreview(card, buffer) {
  const outputPath = toRepoAbsolute(card.previewImage);
  await ensureDirectory(path.dirname(outputPath));
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function generateNonScreenshotCards(cards) {
  const generated = [];
  const deferredScreenshots = [];

  for (const card of cards) {
    const generation = card.generation || {};
    const treatment = generation.treatment || 'editorial-composite';

    if (generation.type === 'screenshot') {
      deferredScreenshots.push(card);
      continue;
    }

    let outputBuffer;
    if (generation.type === 'pdf') {
      outputBuffer = await buildPdfCover(card, generation.source, treatment);
    } else if (generation.type === 'collage') {
      outputBuffer = await buildCollageCover(card, generation.sources || [], treatment);
    } else if (generation.type === 'image') {
      outputBuffer = await buildPhotoCover(card, generation.source, treatment);
    } else if (generation.type === 'synthetic') {
      if (treatment === 'arcade-cover-art') {
        outputBuffer = await buildArcadeCover(card);
      } else {
        throw new Error(`Unknown synthetic treatment for ${card.id}: ${treatment}`);
      }
    } else {
      throw new Error(`Unknown generation type for ${card.id}: ${generation.type}`);
    }

    const outputPath = await writeCardPreview(card, outputBuffer);
    generated.push({ id: card.id, outputPath });
  }

  return { generated, deferredScreenshots };
}

async function generateScreenshotCards(cards) {
  if (cards.length === 0) return [];

  const server = await createStaticServer(repoRoot, SCREENSHOT_PORT);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1480, height: 980 } });

  const generated = [];

  try {
    for (const card of cards) {
      const generation = card.generation || {};
      const screenshot = await captureScreenshotPreview(
        page,
        server.port,
        generation.routePath,
        generation.selectors || []
      );

      const outputBuffer = await composeEditorialCover({
        card,
        treatment: generation.treatment || 'editorial-composite',
        quote: generation.quote || '',
        sources: [screenshot]
      });

      const outputPath = await writeCardPreview(card, outputBuffer);
      generated.push({ id: card.id, outputPath });
    }
  } finally {
    await page.close();
    await browser.close();
    await server.close();
  }

  return generated;
}

async function main() {
  const cards = [...PROJECT_CARD_PREVIEWS, ...ABOUT_CARD_PREVIEWS];
  const outputDirAbsolute = toRepoAbsolute(CARD_PREVIEW_MANIFEST.outputDir);
  await ensureDirectory(outputDirAbsolute);

  const { generated, deferredScreenshots } = await generateNonScreenshotCards(cards);
  const generatedScreenshots = await generateScreenshotCards(deferredScreenshots);

  const allGenerated = [...generated, ...generatedScreenshots]
    .sort((left, right) => left.id.localeCompare(right.id));

  console.log(`Generated ${allGenerated.length} card previews (manifest ${CARD_PREVIEW_MANIFEST.version}).`);
  for (const entry of allGenerated) {
    const relativePath = path.relative(repoRoot, entry.outputPath).replace(/\\/g, '/');
    console.log(`${entry.id}: ${relativePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

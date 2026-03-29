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
const CARD_HEIGHT = 1200;
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

async function buildPhotoCover(sourcePath) {
  const sourceBuffer = await readBinaryFromSource(sourcePath);
  return sharp(sourceBuffer)
    .resize(CARD_WIDTH, CARD_HEIGHT, {
      fit: 'cover',
      position: 'attention'
    })
    .modulate({
      brightness: 1.02,
      saturation: 1.05
    })
    .webp({
      quality: 86,
      effort: 5
    })
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
  const viewport = page.getViewport({ scale: 2.4 });

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

async function buildPdfCover(pdfSourcePath) {
  const pageBuffer = await renderPdfFirstPage(pdfSourcePath);

  const base = sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 3,
      background: { r: 14, g: 22, b: 38 }
    }
  });

  const frameWidth = Math.round(CARD_WIDTH * 0.84);
  const frameHeight = Math.round(CARD_HEIGHT * 0.78);
  const frameLeft = Math.round((CARD_WIDTH - frameWidth) / 2);
  const frameTop = Math.round((CARD_HEIGHT - frameHeight) / 2 - 20);

  const paper = await sharp(pageBuffer)
    .resize(frameWidth - 24, frameHeight - 24, {
      fit: 'contain',
      background: { r: 248, g: 247, b: 244 }
    })
    .flatten({ background: { r: 248, g: 247, b: 244 } })
    .png()
    .toBuffer();

  const frame = await sharp({
    create: {
      width: frameWidth,
      height: frameHeight,
      channels: 4,
      background: { r: 222, g: 214, b: 201, alpha: 1 }
    }
  })
    .composite([{ input: paper, left: 12, top: 12 }])
    .png()
    .toBuffer();

  const shadow = await sharp({
    create: {
      width: frameWidth + 26,
      height: frameHeight + 26,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.42 }
    }
  })
    .blur(18)
    .png()
    .toBuffer();

  return base
    .composite([
      { input: shadow, left: frameLeft - 13, top: frameTop - 2 },
      { input: frame, left: frameLeft, top: frameTop }
    ])
    .webp({ quality: 88, effort: 5 })
    .toBuffer();
}

async function buildTile(imageBuffer, width, height) {
  const inner = await sharp(imageBuffer)
    .resize(width - 6, height - 6, {
      fit: 'cover',
      position: 'attention'
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 240, g: 233, b: 221, alpha: 1 }
    }
  })
    .composite([{ input: inner, left: 3, top: 3 }])
    .png()
    .toBuffer();
}

async function buildCollageCover(sources) {
  const selectedSources = sources.slice(0, 4);
  if (selectedSources.length === 0) {
    throw new Error('Collage requires at least one source image');
  }

  const buffers = [];
  for (const source of selectedSources) {
    buffers.push(await readBinaryFromSource(source));
  }

  const backdrop = await sharp(buffers[0])
    .resize(CARD_WIDTH, CARD_HEIGHT, {
      fit: 'cover',
      position: 'attention'
    })
    .blur(10)
    .modulate({
      brightness: 0.72,
      saturation: 0.9
    })
    .png()
    .toBuffer();

  const pad = 38;
  const gap = 18;
  const innerWidth = CARD_WIDTH - pad * 2;
  const innerHeight = CARD_HEIGHT - pad * 2;
  const leftWidth = Math.round(innerWidth * 0.57);
  const rightWidth = innerWidth - leftWidth - gap;
  const rightTopHeight = Math.round((innerHeight - gap) * 0.54);
  const rightBottomHeight = innerHeight - rightTopHeight - gap;

  const composites = [];

  const leftTile = await buildTile(buffers[0], leftWidth, innerHeight);
  composites.push({ input: leftTile, left: pad, top: pad });

  const secondSource = buffers[1] || buffers[0];
  const topTile = await buildTile(secondSource, rightWidth, rightTopHeight);
  composites.push({ input: topTile, left: pad + leftWidth + gap, top: pad });

  const thirdSource = buffers[2] || buffers[0];
  const bottomTile = await buildTile(thirdSource, rightWidth, rightBottomHeight);
  composites.push({ input: bottomTile, left: pad + leftWidth + gap, top: pad + rightTopHeight + gap });

  if (buffers[3]) {
    const accentWidth = Math.round(rightWidth * 0.6);
    const accentHeight = Math.round(rightBottomHeight * 0.5);
    const accentTile = await buildTile(buffers[3], accentWidth, accentHeight);
    composites.push({
      input: accentTile,
      left: pad + leftWidth + gap + Math.round(rightWidth * 0.25),
      top: pad + rightTopHeight + gap + Math.round(rightBottomHeight * 0.24)
    });
  }

  return sharp(backdrop)
    .composite(composites)
    .webp({ quality: 86, effort: 5 })
    .toBuffer();
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
          // Ignore and continue through candidate list.
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

  await browserPage.waitForTimeout(450);

  for (const selector of selectors) {
    const locator = browserPage.locator(selector).first();
    if ((await locator.count()) === 0) continue;

    try {
      await locator.waitFor({ state: 'visible', timeout: 3_500 });
      return await locator.screenshot({ animations: 'disabled' });
    } catch {
      // Try next selector fallback.
    }
  }

  return browserPage.screenshot({
    clip: {
      x: 0,
      y: 88,
      width: 1440,
      height: 820
    },
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

    if (generation.type === 'screenshot') {
      deferredScreenshots.push(card);
      continue;
    }

    let outputBuffer;
    if (generation.type === 'pdf') {
      outputBuffer = await buildPdfCover(generation.source);
    } else if (generation.type === 'collage') {
      outputBuffer = await buildCollageCover(generation.sources || []);
    } else if (generation.type === 'image') {
      outputBuffer = await buildPhotoCover(generation.source);
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

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

      const outputBuffer = await sharp(screenshot)
        .resize(CARD_WIDTH, CARD_HEIGHT, {
          fit: 'cover',
          position: 'attention'
        })
        .webp({ quality: 86, effort: 5 })
        .toBuffer();

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

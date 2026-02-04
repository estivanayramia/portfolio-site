import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getBrowserLaunchConfig } from './browser-path.mjs';
import puppeteer from 'puppeteer';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const OUT_DIR = path.join(REPO_ROOT, 'assets', 'img', 'projects', 'previews');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Preview sources for project cards.
 * - pdf: screenshots the PDF (cover / first page) via Chromium's PDF viewer.
 * - page: screenshots the local HTML page (useful when there is no PDF asset).
 */
const PREVIEW_SOURCES = [
  {
    slug: 'portfolio',
    type: 'page',
    htmlPath: path.join(REPO_ROOT, 'EN', 'projects', 'portfolio.html'),
  },
  {
    slug: 'loreal-maps-campaign',
    type: 'pdf',
    pdfPath: path.join(
      REPO_ROOT,
      'assets',
      'img',
      'Portolio-Media',
      'Portfolio Media',
      'projects-',
      'loreal-maps-retail-playbook.pdf'
    ),
  },
  {
    slug: 'franklin-templeton-concept',
    type: 'pdf',
    pdfPath: path.join(
      REPO_ROOT,
      'assets',
      'img',
      'Portolio-Media',
      'Portfolio Media',
      'projects-',
      'franklin-templeton-concept.pdf'
    ),
  },
  {
    slug: 'endpoint-linkedin-campaign',
    type: 'pdf',
    pdfPath: path.join(
      REPO_ROOT,
      'assets',
      'img',
      'Portolio-Media',
      'Portfolio Media',
      'projects-',
      'endpoint-linkedin-campaign.pdf'
    ),
  },
  {
    slug: 'endpoint-elosity-video',
    type: 'page',
    htmlPath: path.join(REPO_ROOT, 'EN', 'projects', 'endpoint-elosity-video.html'),
  },
  {
    slug: 'endpoint-competitive-playbook',
    type: 'pdf',
    pdfPath: path.join(
      REPO_ROOT,
      'assets',
      'img',
      'Portolio-Media',
      'Portfolio Media',
      'projects-',
      'endpoint-competitive-playbook.pdf'
    ),
  },
];

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function cropPngBuffer(buffer, clip) {
  const png = PNG.sync.read(buffer);

  const x = Math.max(0, Math.min(png.width - 1, clip.x));
  const y = Math.max(0, Math.min(png.height - 1, clip.y));
  const width = Math.max(1, Math.min(png.width - x, clip.width));
  const height = Math.max(1, Math.min(png.height - y, clip.height));

  const out = new PNG({ width, height });

  for (let row = 0; row < height; row += 1) {
    const srcStart = ((y + row) * png.width + x) << 2;
    const srcEnd = srcStart + (width << 2);
    const dstStart = (row * width) << 2;
    png.data.copy(out.data, dstStart, srcStart, srcEnd);
  }

  return PNG.sync.write(out);
}

async function main() {
  await ensureDir(OUT_DIR);

  const browser = await puppeteer.launch({
    headless: true,
    ...getBrowserLaunchConfig(),
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    for (const source of PREVIEW_SOURCES) {
      const rawShotPath = path.join(OUT_DIR, `${source.slug}.raw.png`);
      const finalPath = path.join(OUT_DIR, `${source.slug}.png`);

      if (source.type === 'pdf') {
        if (!fs.existsSync(source.pdfPath)) {
          throw new Error(`Missing PDF: ${source.pdfPath}`);
        }

        const pdfUrl = pathToFileURL(source.pdfPath).toString();

        // Puppeteer may try to download PDFs when navigating directly.
        // Use a minimal HTML wrapper with <embed> so Chromium renders the PDF.
        await page.setContent(
          `<!doctype html><html><head><meta charset="utf-8" />
          <style>html,body{margin:0;height:100%;background:#0b0f1a}embed{width:100%;height:100%;border:0}</style>
          </head><body><embed src="${pdfUrl}" type="application/pdf" /></body></html>`,
          { waitUntil: 'load' }
        );
        await page.waitForSelector('embed');
        await sleep(1200);
        await page.screenshot({ path: rawShotPath });
      } else if (source.type === 'page') {
        if (!fs.existsSync(source.htmlPath)) {
          throw new Error(`Missing HTML page: ${source.htmlPath}`);
        }

        const pageUrl = pathToFileURL(source.htmlPath).toString();
        await page.goto(pageUrl, { waitUntil: 'load' });
        await sleep(800);
        await page.screenshot({ path: rawShotPath });
      } else {
        throw new Error(`Unknown preview type for ${source.slug}: ${source.type}`);
      }

      const buffer = await fsp.readFile(rawShotPath);

      // Heuristic crop tuned for Chromium (PDF viewer + static HTML pages).
      // Goal: 16:9 thumbnail that cleanly fits the card aspect-video container.
      const cropped = cropPngBuffer(buffer, { x: 80, y: 140, width: 1280, height: 720 });
      await fsp.writeFile(finalPath, cropped);

      await fsp.unlink(rawShotPath);
      console.log(`Wrote ${path.relative(REPO_ROOT, finalPath).replace(/\\/g, '/')}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

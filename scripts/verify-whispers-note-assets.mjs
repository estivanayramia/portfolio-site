#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const filePath = 'EN/hobbies/whispers.html';
const html = fs.readFileSync(filePath, 'utf8');

const trackMatch = html.match(/<div class="carousel-track" id="carouselTrack">([\s\S]*?)<\/div>\s*<div class="carousel-dots"/);
if (!trackMatch) {
  console.error(`[verify-whispers-note-assets] FAIL: could not locate carousel track in ${filePath}`);
  process.exit(1);
}

const trackHtml = trackMatch[1];
const referencedAssets = [
  ...trackHtml.matchAll(/\b(?:src|srcset)="([^"]+)"/g)
].map((match) => match[1].trim());

if (referencedAssets.some((asset) => /\.heic$/i.test(asset))) {
  console.error('[verify-whispers-note-assets] FAIL: HEIC references remain in the whispers carousel');
  process.exit(1);
}

const missing = [];
const untracked = [];

for (const asset of referencedAssets) {
  if (!asset.startsWith('/assets/img/Portolio-Media/Portfolio-Media/whispers-/')) continue;

  const relativePath = asset.replace(/^\//, '');
  if (!fs.existsSync(relativePath)) {
    missing.push(relativePath);
    continue;
  }

  try {
    execSync(`git ls-files --error-unmatch "${relativePath}"`, { stdio: 'ignore' });
  } catch {
    untracked.push(relativePath);
  }
}

if (missing.length > 0) {
  console.error('[verify-whispers-note-assets] FAIL: missing assets');
  for (const asset of missing) console.error(`- ${asset}`);
  process.exit(1);
}

if (untracked.length > 0) {
  console.error('[verify-whispers-note-assets] FAIL: untracked assets referenced in whispers carousel');
  for (const asset of untracked) console.error(`- ${asset}`);
  process.exit(1);
}

console.log(`[verify-whispers-note-assets] PASS: verified ${referencedAssets.length} whispers carousel asset references`);

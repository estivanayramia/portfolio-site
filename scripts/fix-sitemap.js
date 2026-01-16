const fs = require('fs');
const path = require('path');

const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');

// Read sitemap.xml
let content = fs.readFileSync(sitemapPath, 'utf8');

console.log('Updating sitemap.xml URLs to include .html extensions...');

// Replace all URLs that don't already have .html and aren't directories (don't end with /)
// Match patterns like:
// - /en/about -> /en/about.html
// - /en/projects/portfolio -> /en/projects/portfolio.html
// - /en/hobbies/gym -> /en/hobbies/gym.html
// - /en/hobbies-games/2048 -> /en/hobbies-games/2048.html
// But NOT:
// - /en/ (leave as is)
// - /en/projects/ (leave as is)
// - /en/hobbies/ (leave as is)

content = content.replace(
  /<loc>(https:\/\/www\.estivanayramia\.com\/[^<]+)<\/loc>/g,
  (match, url) => {
    // If URL already ends with .html or /, leave it alone
    if (url.endsWith('.html') || url.endsWith('/')) {
      return match;
    }
    // Otherwise, add .html
    return `<loc>${url}.html</loc>`;
  }
);

// Write back to file
fs.writeFileSync(sitemapPath, content, 'utf8');

console.log('✓ sitemap.xml updated successfully');
console.log('All non-directory URLs now include .html extensions');

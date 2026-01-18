const fs = require('fs');
const path = require('path');

const llmsPath = path.join(__dirname, '..', 'llms.txt');
let content = fs.readFileSync(llmsPath, 'utf8');

console.log('Updating llms.txt URLs to include /EN/ or /en/ prefix and .html extensions...');

// Prefer uppercase 'EN' folder if present on disk (Cloudflare Pages is case-sensitive)
const enDirName = fs.existsSync(path.join(__dirname, '..', 'EN')) ? '/EN' : '/en';

// Update project URLs
const projectReplacements = [
  ['/projects/portfolio', `${enDirName}/projects/portfolio.html`],
  ['/projects/logistics', `${enDirName}/projects/logistics.html`],
  ['/projects/discipline', `${enDirName}/projects/discipline.html`],
  ['/projects/documentation', `${enDirName}/projects/documentation.html`],
  ['/projects/multilingual', `${enDirName}/projects/multilingual.html`],
  ['/projects/competitive-strategy', `${enDirName}/projects/competitive-strategy.html`]
];

projectReplacements.forEach(([oldUrl, newUrl]) => {
  const regex = new RegExp(`https://www\\.estivanayramia\\.com${oldUrl.replace('/', '\\/')}`, 'g');
  content = content.replace(regex, `https://www.estivanayramia.com${newUrl}`);
});

// Update hobby URLs
const hobbyReplacements = [
  ['/hobbies/gym', `${enDirName}/hobbies/gym.html`],
  ['/hobbies/photography', `${enDirName}/hobbies/photography.html`],
  ['/hobbies/car', `${enDirName}/hobbies/car.html`],
  ['/hobbies/cooking', `${enDirName}/hobbies/cooking.html`],
  ['/hobbies/whispers', `${enDirName}/hobbies/whispers.html`],
  ['/hobbies/reading', `${enDirName}/hobbies/reading.html`]
];

hobbyReplacements.forEach(([oldUrl, newUrl]) => {
  const regex = new RegExp(`https://www\\.estivanayramia\\.com${oldUrl.replace('/', '\\/')}`, 'g');
  content = content.replace(regex, `https://www.estivanayramia.com${newUrl}`);
});

// Update key pages - be more careful with these to avoid double-replacing
content = content.replace('https://www.estivanayramia.com/\n', `https://www.estivanayramia.com${enDirName}/index.html\n`);
content = content.replace('https://www.estivanayramia.com/projects/\n', `https://www.estivanayramia.com${enDirName}/projects/index.html\n`);
content = content.replace('https://www.estivanayramia.com/hobbies/\n', `https://www.estivanayramia.com${enDirName}/hobbies/index.html\n`);
content = content.replace('https://www.estivanayramia.com/about\n', `https://www.estivanayramia.com${enDirName}/about.html\n`);
content = content.replace('https://www.estivanayramia.com/contact\n', `https://www.estivanayramia.com${enDirName}/contact.html\n`);
content = content.replace('https://www.estivanayramia.com/overview\n', `https://www.estivanayramia.com${enDirName}/overview.html\n`);
content = content.replace('https://www.estivanayramia.com/deep-dive\n', `https://www.estivanayramia.com${enDirName}/deep-dive.html\n`);

fs.writeFileSync(llmsPath, content, 'utf8');

console.log(' llms.txt updated successfully');
console.log('All URLs now use /en/ prefix and .html extensions');

const fs = require('fs');
const path = require('path');

const llmsPath = path.join(__dirname, '..', 'llms.txt');
let content = fs.readFileSync(llmsPath, 'utf8');

console.log('Updating llms.txt URLs to include /en/ prefix and .html extensions...');

// Update project URLs
const projectReplacements = [
  ['/projects/portfolio', '/en/projects/portfolio.html'],
  ['/projects/logistics', '/en/projects/logistics.html'],
  ['/projects/discipline', '/en/projects/discipline.html'],
  ['/projects/documentation', '/en/projects/documentation.html'],
  ['/projects/multilingual', '/en/projects/multilingual.html'],
  ['/projects/competitive-strategy', '/en/projects/competitive-strategy.html']
];

projectReplacements.forEach(([oldUrl, newUrl]) => {
  const regex = new RegExp(`https://www\\.estivanayramia\\.com${oldUrl.replace('/', '\\/')}`, 'g');
  content = content.replace(regex, `https://www.estivanayramia.com${newUrl}`);
});

// Update hobby URLs
const hobbyReplacements = [
  ['/hobbies/gym', '/en/hobbies/gym.html'],
  ['/hobbies/photography', '/en/hobbies/photography.html'],
  ['/hobbies/car', '/en/hobbies/car.html'],
  ['/hobbies/cooking', '/en/hobbies/cooking.html'],
  ['/hobbies/whispers', '/en/hobbies/whispers.html'],
  ['/hobbies/reading', '/en/hobbies/reading.html']
];

hobbyReplacements.forEach(([oldUrl, newUrl]) => {
  const regex = new RegExp(`https://www\\.estivanayramia\\.com${oldUrl.replace('/', '\\/')}`, 'g');
  content = content.replace(regex, `https://www.estivanayramia.com${newUrl}`);
});

// Update key pages - be more careful with these to avoid double-replacing
content = content.replace('https://www.estivanayramia.com/\n', 'https://www.estivanayramia.com/en/index.html\n');
content = content.replace('https://www.estivanayramia.com/projects/\n', 'https://www.estivanayramia.com/en/projects/index.html\n');
content = content.replace('https://www.estivanayramia.com/hobbies/\n', 'https://www.estivanayramia.com/en/hobbies/index.html\n');
content = content.replace('https://www.estivanayramia.com/about\n', 'https://www.estivanayramia.com/en/about.html\n');
content = content.replace('https://www.estivanayramia.com/contact\n', 'https://www.estivanayramia.com/en/contact.html\n');
content = content.replace('https://www.estivanayramia.com/overview\n', 'https://www.estivanayramia.com/en/overview.html\n');
content = content.replace('https://www.estivanayramia.com/deep-dive\n', 'https://www.estivanayramia.com/en/deep-dive.html\n');

fs.writeFileSync(llmsPath, content, 'utf8');

console.log(' llms.txt updated successfully');
console.log('All URLs now use /en/ prefix and .html extensions');

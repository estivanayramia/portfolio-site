const fs = require('fs');
const path = process.argv[2] || 'lighthouse-results/desktop-projects.report.json';
const j = JSON.parse(fs.readFileSync(path, 'utf8'));
const audit = j.audits && (j.audits['color-contrast'] || j.audits['color-contrast']);
if (!audit) {
  console.error('No color-contrast audit found');
  process.exit(1);
}
const items = (audit.details && audit.details.items) || [];
console.log('color-contrast failing items:', items.length);
for (const it of items.slice(0, 25)) {
  const n = it.node || {};
  console.log('\n---');
  if (n.selector) console.log('selector:', n.selector);
  if (n.snippet) console.log('snippet:', n.snippet.replace(/\s+/g, ' ').slice(0, 200));
  if (it.contrastRatio) console.log('ratio:', it.contrastRatio);
}

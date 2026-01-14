/**
 * Generate site-facts.json from actual HTML content
 * This ensures the chatbot only mentions real projects and hobbies
 */

const fs = require('fs');
const path = require('path');

// Simple HTML parser - extract text content between tags
function extractTextContent(html, startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return '';
  
  const searchFrom = startIdx + startMarker.length;
  const endIdx = html.indexOf(endMarker, searchFrom);
  if (endIdx === -1) return '';
  
  const content = html.substring(searchFrom, endIdx);
  // Remove HTML tags and clean up whitespace
  return content
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract canonical URL from HTML
function extractCanonicalUrl(html) {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/);
  return match ? match[1] : '';
}

// Extract meta description
function extractDescription(html) {
  const match = html.match(/<meta name="description" content="([^"]+)"/);
  return match ? match[1] : '';
}

// Extract title from card in index page
function extractCardTitle(cardHtml) {
  const match = cardHtml.match(/<h2[^>]*>([^<]+)<\/h2>/);
  return match ? match[1].trim() : '';
}

// Extract summary from card in index page
function extractCardSummary(cardHtml) {
  const match = cardHtml.match(/<p class="text-sm[^>]*>([^<]+)<\/p>/);
  return match ? match[1].trim() : '';
}

// Extract link from card
function extractCardLink(cardHtml) {
  const match = cardHtml.match(/<a href="([^"]+)"/);
  return match ? match[1] : '';
}

// Parse projects from index page
function parseProjectsIndex(indexPath) {
  const html = fs.readFileSync(indexPath, 'utf-8');
  const projects = [];
  
  // Split by article tags
  const articles = html.split(/<article[^>]*>/);
  
  for (let i = 1; i < articles.length; i++) {
    const article = articles[i];
    const endIdx = article.indexOf('</article>');
    if (endIdx === -1) continue;
    
    const cardHtml = article.substring(0, endIdx);
    const title = extractCardTitle(cardHtml);
    const summary = extractCardSummary(cardHtml);
    const link = extractCardLink(cardHtml);
    
    if (title && link) {
      projects.push({
        title,
        summary: summary || title,
        url: link.startsWith('/') ? `https://www.estivanayramia.com${link}` : link,
        path: link
      });
    }
  }
  
  return projects;
}

// Parse hobbies from index page
function parseHobbiesIndex(indexPath) {
  const html = fs.readFileSync(indexPath, 'utf-8');
  const hobbies = [];
  
  // Split by article tags
  const articles = html.split(/<article[^>]*>/);
  
  for (let i = 1; i < articles.length; i++) {
    const article = articles[i];
    const endIdx = article.indexOf('</article>');
    if (endIdx === -1) continue;
    
    const cardHtml = article.substring(0, endIdx);
    const title = extractCardTitle(cardHtml);
    const summary = extractCardSummary(cardHtml);
    const link = extractCardLink(cardHtml);
    
    if (title && link) {
      hobbies.push({
        title,
        summary: summary || title,
        url: link.startsWith('/') ? `https://www.estivanayramia.com${link}` : link,
        path: link
      });
    }
  }
  
  return hobbies;
}

// Main execution
function generateSiteFacts() {
  const rootDir = path.join(__dirname, '..');
  
  console.log('🔍 Scanning repository for projects and hobbies...');
  
  // Parse projects
  const projectsIndexPath = path.join(rootDir, 'projects', 'index.html');
  const projects = parseProjectsIndex(projectsIndexPath);
  console.log(`✅ Found ${projects.length} projects`);
  
  // Parse hobbies
  const hobbiesIndexPath = path.join(rootDir, 'hobbies', 'index.html');
  const hobbies = parseHobbiesIndex(hobbiesIndexPath);
  console.log(`✅ Found ${hobbies.length} hobbies`);
  
  // Create site facts object
  const siteFacts = {
    generated: new Date().toISOString(),
    projects: projects,
    hobbies: hobbies,
    meta: {
      projectCount: projects.length,
      hobbyCount: hobbies.length,
      source: 'Generated from HTML content by scripts/generate-site-facts.js'
    }
  };
  
  // Write to assets/data/site-facts.json
  const outputDir = path.join(rootDir, 'assets', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'site-facts.json');
  fs.writeFileSync(outputPath, JSON.stringify(siteFacts, null, 2), 'utf-8');
  
  console.log(`\n✨ Generated site-facts.json with:`);
  console.log(`   - ${projects.length} projects`);
  console.log(`   - ${hobbies.length} hobbies`);
  console.log(`\n📄 Output: ${outputPath}`);
  
  // Print summary
  console.log('\n📋 Projects:');
  projects.forEach(p => console.log(`   - ${p.title}`));
  
  console.log('\n🎨 Hobbies:');
  hobbies.forEach(h => console.log(`   - ${h.title}`));
  
  return siteFacts;
}

// Run if called directly
if (require.main === module) {
  try {
    generateSiteFacts();
  } catch (error) {
    console.error('❌ Error generating site-facts.json:', error);
    process.exit(1);
  }
}

module.exports = { generateSiteFacts };

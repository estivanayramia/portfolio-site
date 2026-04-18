/**
 * Generate site-facts.json from actual HTML content
 * This is the SINGLE SOURCE OF TRUTH for chatbot grounding
 * 
 * Features:
 * - Parses actual HTML pages for projects and hobbies
 * - Extracts real summaries from page content (not invented)
 * - Validates URLs exist in the repository
 * - Fails build if banned terms or fake projects are detected
 * - Generates structured data for worker and AEO
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'assets', 'data', 'site-facts.json');
const BASE_URL = 'https://www.estivanayramia.com';

const MOJIBAKE_MAP = {
  '\u00c3\u00a9': '\u00e9',
  '\u00c3\u00a1': '\u00e1',
  '\u00c3\u00a8': '\u00e8',
  '\u00c3\u00b3': '\u00f3',
  '\u00c3\u00ba': '\u00fa',
  '\u00c3\u00b1': '\u00f1',
  '\u00c3\u00bc': '\u00fc',
  '\u00e2\u20ac\u201c': '-',
  '\u00e2\u20ac\u201d': '-',
  '\u00e2\u20ac\u02dc': "'",
  '\u00e2\u20ac\u2122': "'",
  '\u00e2\u20ac\u0153': '"',
  '\u00e2\u20ac\u009d': '"',
  '\u00c2\u00a9': '\u00a9',
  '\u00c2 ': ' ',
  '\u00c2': ''
};

function cleanText(value) {
  let output = String(value || '').trim();
  for (const [bad, good] of Object.entries(MOJIBAKE_MAP)) {
    output = output.split(bad).join(good);
  }
  return output.replace(/\s+/g, ' ').trim();
}

function normalizeRepoRelativePath(maybeAbsolutePath) {
  return String(maybeAbsolutePath || '').replace(/^\/+/, '');
}

function getContentPath(relPath) {
  const normalized = normalizeRepoRelativePath(relPath);
  const enCandidate = path.join(ROOT_DIR, 'EN', normalized);
  if (
    fs.existsSync(enCandidate) ||
    fs.existsSync(enCandidate + '.html') ||
    fs.existsSync(path.join(enCandidate, 'index.html'))
  ) {
    return enCandidate;
  }

  const candidate = path.join(ROOT_DIR, normalized);
  return candidate;
}

// Banned terms that should NEVER appear in generated facts
// If these are found, the build fails
const BANNED_TERMS = [
  'getwispers',
  'get wispers',
  'whispers app',
  'whispers application',
  'conflict playbook',
  'discipline system',
  'messaging app',
  'chat app',
  'sticky note app'
];

// Extract canonical URL from HTML
function extractCanonicalUrl(html) {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/);
  return match ? cleanText(match[1]) : '';
}

// Extract meta description
function extractDescription(html) {
  const match = html.match(/<meta name="description" content="([^"]+)"/);
  return match ? cleanText(match[1]) : '';
}

// Extract title from card in index page
function extractCardTitle(cardHtml) {
  const match = cardHtml.match(/<(?:h[23]|div|p)[^>]*class="[^"]*card-title[^"]*"[^>]*>([^<]+)<\/(?:h[23]|div|p)>|<h[23][^>]*>([^<]+)<\/h[23]>/);
  return match ? cleanText(match[1] || match[2]) : '';
}

// Extract summary from card in index page
function extractCardSummary(cardHtml) {
  const match = cardHtml.match(/<p class="(?:card-description|text-sm)[^"]*"[^>]*>([^<]+)<\/p>/);
  return match ? cleanText(match[1]) : '';
}

// Extract link from card
function extractCardLink(cardHtml) {
  const match = cardHtml.match(/<a href="([^"]+)"/);
  return match ? cleanText(match[1]) : '';
}

// Extract tags from card spans
function extractCardTags(cardHtml) {
  const tags = [];
  const tagMatches = cardHtml.matchAll(/<span class="text-xs bg-[^"]*"[^>]*>([^<]+)<\/span>/g);
  for (const tm of tagMatches) {
    tags.push(cleanText(tm[1]));
  }
  return tags;
}

// Generate slug ID from title
function generateId(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

// Convert file path to canonical URL path (clean URLs without .html)
function toCanonicalPath(filePath) {
  // Remove .html extension for canonical URLs
  return filePath.replace(/\.html$/, '');
}

// Convert a canonical route (e.g. "/projects/portfolio") to a real content file path
// (e.g. "/projects/portfolio.html" or "/projects/index.html") for repo verification.
function toContentFilePath(routePath) {
  const link = String(routePath || '');
  const normalized = normalizeRepoRelativePath(link);
  const enCandidate = path.join(ROOT_DIR, 'EN', normalized);

  // If the link already points at a concrete file that exists (rare), keep it.
  if (fs.existsSync(enCandidate)) {
    return link;
  }

  // Most pages are served as clean URLs but stored as .html in EN/
  if (fs.existsSync(enCandidate + '.html')) {
    return link.endsWith('.html') ? link : (link + '.html');
  }

  // Directory-based routes
  if (fs.existsSync(path.join(enCandidate, 'index.html'))) {
    const withSlash = link.endsWith('/') ? link : (link + '/');
    return withSlash + 'index.html';
  }

  // Fallback: keep original (validation will catch missing files)
  return link;
}

// Parse projects from index page
function parseProjectsIndex(indexPath) {
  const html = fs.readFileSync(indexPath, 'utf-8');
  const projects = [];

  const coverflowCards = Array.from(
    html.matchAll(/<article[^>]*class="[^"]*coverflow-card[^"]*"[^>]*>([\s\S]*?)<\/article>/g)
  ).map((match) => match[1]);

  const cardBlocks = coverflowCards.length > 0
    ? coverflowCards
    : html
        .split(/<article[^>]*>/)
        .slice(1)
        .map((article) => {
          const endIdx = article.indexOf('</article>');
          return endIdx === -1 ? '' : article.substring(0, endIdx);
        })
        .filter(Boolean);

  for (const cardHtml of cardBlocks) {
    const title = extractCardTitle(cardHtml);
    const summary = extractCardSummary(cardHtml);
    const link = extractCardLink(cardHtml);
    const tags = extractCardTags(cardHtml);
    
    if (title && link) {
      // Use clean URL path
      let canonicalPath = toCanonicalPath(link);
      
      projects.push({
        id: generateId(title),
        title,
        summary: summary || title,
        url: canonicalPath,
        fullUrl: `${BASE_URL}${canonicalPath}`,
        filePath: toContentFilePath(canonicalPath),
        tags
      });
    }
  }
  
  return projects;
}

// Parse hobbies from the About page carousel/cards
function parseHobbiesFromAboutPage(aboutPath) {
  const html = fs.readFileSync(aboutPath, 'utf-8');
  const hobbies = [];

  const coverflowCards = Array.from(
    html.matchAll(/<article[^>]*class="[^"]*coverflow-card[^"]*"[^>]*>([\s\S]*?)<\/article>/g)
  ).map((match) => match[1]);

  for (const cardHtml of coverflowCards) {
    const title = extractCardTitle(cardHtml);
    const summary = extractCardSummary(cardHtml);
    const link = extractCardLink(cardHtml);

    if (!title || !link) continue;
    if (!/^\/hobbies(?:\/|$)|^\/hobbies-games$/i.test(link)) continue;

    const canonicalPath = toCanonicalPath(link);
    hobbies.push({
      id: generateId(title),
      title,
      summary: summary || title,
      url: canonicalPath,
      fullUrl: `${BASE_URL}${canonicalPath}`,
      filePath: toContentFilePath(canonicalPath),
    });
  }

  return hobbies;
}

/**
 * Validate generated facts for banned terms and duplicates
 * Returns { errors: [], warnings: [] }
 * If errors.length > 0, build should fail
 */
function validateFacts(siteFacts, rootDir) {
  const errors = [];
  const warnings = [];
  
  // 1. Check for banned terms in all text fields
  const allText = JSON.stringify(siteFacts).toLowerCase();
  for (const term of BANNED_TERMS) {
    if (allText.includes(term.toLowerCase())) {
      errors.push(`Banned term found: "${term}"`);
    }
  }
  
  // 2. Check that "Whispers" is NOT in projects (it's a hobby)
  for (const project of siteFacts.projects) {
    if (project.title.toLowerCase().includes('whispers')) {
      errors.push(`"Whispers" found in projects - should be hobby only: ${project.title}`);
    }
  }
  
  // 3. Check for duplicate titles
  const projectTitles = siteFacts.projects.map(p => p.title.toLowerCase());
  const duplicateProjects = projectTitles.filter((t, i) => projectTitles.indexOf(t) !== i);
  if (duplicateProjects.length > 0) {
    errors.push(`Duplicate project titles: ${duplicateProjects.join(', ')}`);
  }
  
  const hobbyTitles = siteFacts.hobbies.map(h => h.title.toLowerCase());
  const duplicateHobbies = hobbyTitles.filter((t, i) => hobbyTitles.indexOf(t) !== i);
  if (duplicateHobbies.length > 0) {
    errors.push(`Duplicate hobby titles: ${duplicateHobbies.join(', ')}`);
  }
  
  // 4. Verify all file paths exist
  const allItems = [...siteFacts.projects, ...siteFacts.hobbies];
  for (const item of allItems) {
    const filePath = getContentPath(item.filePath);
    // Check for file as-is, or with .html extension (for clean URLs)
    if (!fs.existsSync(filePath) && !fs.existsSync(filePath + '.html')) {
      errors.push(`HTML file not found: ${item.filePath} (for "${item.title}")`);
    }
  }
  
  // 5. Warnings for missing/short data
  for (const item of allItems) {
    if (!item.summary || item.summary.length < 20) {
      warnings.push(`Short or missing summary: ${item.title}`);
    }
  }
  
  return { errors, warnings };
}

// Main execution
function generateSiteFacts() {
  console.log('🔍 Generating site-facts.json from actual HTML content...\n');
  
  // Parse projects
  console.log('📁 Parsing projects...');
  const projectsIndexPath = getContentPath(path.join('projects', 'index.html'));
  const projects = parseProjectsIndex(projectsIndexPath);
  projects.forEach(p => console.log(`   → ${p.title}`));
  console.log(`✅ Found ${projects.length} projects\n`);
  
  // Parse hobbies
  console.log('🎨 Parsing hobbies...');
  const aboutPath = getContentPath('about.html');
  const hobbies = parseHobbiesFromAboutPage(aboutPath);
  hobbies.forEach(h => console.log(`   → ${h.title}`));
  console.log(`✅ Found ${hobbies.length} hobbies\n`);
  
  // Deterministic output: do not bake timestamps into committed artifacts.
  // If you want a build timestamp, pass SITE_FACTS_GENERATED_AT in CI.
  const generatedAt = process.env.SITE_FACTS_GENERATED_AT;

  // Stable ordering for deterministic output.
  projects.sort((a, b) => a.url.localeCompare(b.url));
  hobbies.sort((a, b) => a.url.localeCompare(b.url));

  // Create site facts object
  const siteFacts = {
    ...(generatedAt ? { generated: generatedAt } : {}),
    version: 'v2',
    baseUrl: BASE_URL,
    projects: projects,
    hobbies: hobbies,
    meta: {
      projectCount: projects.length,
      hobbyCount: hobbies.length,
      source: 'Generated from HTML content by scripts/generate-site-facts.js'
    }
  };
  
  // Validate facts
  console.log('🔒 Validating facts...');
  const { errors, warnings } = validateFacts(siteFacts, ROOT_DIR);
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ VALIDATION ERRORS:');
    errors.forEach(e => console.log(`   - ${e}`));
    console.log('\n🛑 Build failed due to validation errors.');
    process.exit(1);
  }
  
  console.log('✅ Validation passed\n');
  
  // Write to assets/data/site-facts.json
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(siteFacts, null, 2) + '\n', 'utf-8');
  
  console.log(`📄 Output written to: ${OUTPUT_PATH}`);
  console.log(`\n✨ Site facts generated successfully!`);
  console.log(`   - ${projects.length} projects`);
  console.log(`   - ${hobbies.length} hobbies`);
  
  // Print summary
  console.log('\n📋 Projects:');
  projects.forEach(p => console.log(`   - ${p.title} → ${p.url}`));
  
  console.log('\n🎨 Hobbies:');
  hobbies.forEach(h => console.log(`   - ${h.title} → ${h.url}`));
  
  return siteFacts;
}

// Run if called directly
if (require.main === module) {
  try {
    generateSiteFacts();
  } catch (error) {
    console.error('\n❌ Error generating site-facts.json:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { generateSiteFacts, validateFacts, BANNED_TERMS };

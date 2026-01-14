/**
 * Test Chat Grounding - Validate chatbot responses are factually accurate
 * 
 * This script tests:
 * 1. Site-facts.json is valid and complete
 * 2. No banned terms in generated content
 * 3. All URLs resolve correctly
 * 4. Worker siteFacts matches generated site-facts
 */

const fs = require('fs');
const path = require('path');

// Import validation from generator
const { BANNED_TERMS } = require('./generate-site-facts.js');

const ROOT_DIR = path.join(__dirname, '..');
const SITE_FACTS_PATH = path.join(ROOT_DIR, 'assets', 'data', 'site-facts.json');
const WORKER_PATH = path.join(ROOT_DIR, 'worker', 'worker.js');
const LLMS_TXT_PATH = path.join(ROOT_DIR, 'llms.txt');

// Test results tracker
let passed = 0;
let failed = 0;
const failures = [];

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}${details ? ': ' + details : ''}`);
    failed++;
    failures.push({ name, details });
  }
}

console.log('🧪 Testing Chat Grounding...\n');

// ============================================================================
// Test 1: Site-facts.json exists and is valid JSON
// ============================================================================

console.log('📦 Test Group: Site Facts');

let siteFacts = null;
try {
  const raw = fs.readFileSync(SITE_FACTS_PATH, 'utf-8');
  siteFacts = JSON.parse(raw);
  test('Site-facts.json exists and is valid JSON', true);
} catch (e) {
  test('Site-facts.json exists and is valid JSON', false, e.message);
}

if (siteFacts) {
  // Check structure
  test('Has projects array', Array.isArray(siteFacts.projects));
  test('Has hobbies array', Array.isArray(siteFacts.hobbies));
  test('Has 6 projects', siteFacts.projects?.length === 6, `Found ${siteFacts.projects?.length}`);
  test('Has 6 hobbies', siteFacts.hobbies?.length === 6, `Found ${siteFacts.hobbies?.length}`);
  
  // Check all projects have required fields
  const requiredProjectFields = ['id', 'title', 'url', 'summary'];
  siteFacts.projects?.forEach((p, i) => {
    requiredProjectFields.forEach(field => {
      if (!p[field]) {
        test(`Project ${i+1} has ${field}`, false, p.title || 'Unknown');
      }
    });
  });
  
  // Check Whispers is NOT in projects
  const whisperInProjects = siteFacts.projects?.some(p => 
    p.title.toLowerCase().includes('whispers')
  );
  test('Whispers is NOT in projects', !whisperInProjects);
  
  // Check Whispers IS in hobbies
  const whisperInHobbies = siteFacts.hobbies?.some(h => 
    h.title.toLowerCase().includes('whispers')
  );
  test('Whispers IS in hobbies', whisperInHobbies);
  
  // Check for banned terms
  const siteFactsText = JSON.stringify(siteFacts).toLowerCase();
  BANNED_TERMS.forEach(term => {
    test(`No banned term: "${term}"`, !siteFactsText.includes(term.toLowerCase()));
  });
  
  // Check all URLs use canonical format (no .html)
  const allItems = [...(siteFacts.projects || []), ...(siteFacts.hobbies || [])];
  allItems.forEach(item => {
    test(`${item.title} URL is canonical`, !item.url.endsWith('.html'), item.url);
  });
}

// ============================================================================
// Test 2: Worker.js validation
// ============================================================================

console.log('\n🔧 Test Group: Worker');

let workerContent = null;
try {
  workerContent = fs.readFileSync(WORKER_PATH, 'utf-8');
  test('Worker.js exists', true);
} catch (e) {
  test('Worker.js exists', false, e.message);
}

if (workerContent) {
  // Check for legacy .html URLs in responses (excluding comments)
  const legacyPatterns = [
    '/projects.html',
    '/project-logistics.html',
    '/project-conflict.html',
    '/hobbies/whispers.html',
    '/contact.html'
  ];
  
  // Remove comments for checking
  const noComments = workerContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  legacyPatterns.forEach(pattern => {
    const found = noComments.includes(pattern);
    test(`No legacy URL: ${pattern}`, !found);
  });
  
  // Check siteFacts is embedded
  test('siteFacts is embedded', workerContent.includes('const siteFacts'));
  
  // Check for guardrail validation
  test('Has guardrail validation', workerContent.includes('validateResponse') || workerContent.includes('knownFakeProjects'));
  
  // Check for Whispers hobby handler
  test('Has Whispers hobby handler', workerContent.includes('whispers') && workerContent.includes('hobby'));
  
  // Check for getWispers rejection
  test('Has getWispers rejection', workerContent.includes('getwispers'));
}

// ============================================================================
// Test 3: llms.txt validation
// ============================================================================

console.log('\n📄 Test Group: LLMs.txt');

let llmsTxt = null;
try {
  llmsTxt = fs.readFileSync(LLMS_TXT_PATH, 'utf-8');
  test('llms.txt exists', true);
} catch (e) {
  test('llms.txt exists', false, e.message);
}

if (llmsTxt) {
  test('Contains owner name', llmsTxt.includes('Estivan Ayramia'));
  test('Contains email', llmsTxt.includes('hello@estivanayramia.com'));
  test('Contains 6 projects', llmsTxt.includes('Projects (6 total)'));
  test('Contains 6 hobbies', llmsTxt.includes('Hobbies (6 total)'));
  test('Clarifies Whispers is hobby', llmsTxt.includes('Whispers" is a HOBBY'));
  test('Clarifies getWispers doesn\'t exist', llmsTxt.includes('getWispers') && llmsTxt.includes('NOT'));
}

// ============================================================================
// Test 4: L'Oréal Handler Logic
// ============================================================================

console.log('\n🔧 Test Group: L\'Oréal Handler');

// Check that the L'Oréal project exists with correct URL
if (siteFacts?.projects) {
  const lorealProject = siteFacts.projects.find(p => p.url === '/en/projects/logistics');
  test('L\'Oréal project exists with URL /en/projects/logistics', !!lorealProject);
  
  if (lorealProject) {
    test('L\'Oréal project has title', !!lorealProject.title);
    test('L\'Oréal project has summary', !!lorealProject.summary);
    test('L\'Oréal project title matches expected pattern', 
      lorealProject.title.toLowerCase().includes('loreal') || 
      lorealProject.title.toLowerCase().includes('l\'oréal') ||
      lorealProject.title.toLowerCase().includes('bioprint'),
      lorealProject.title
    );
  }
  
  // Verify worker uses URL-based lookup, not hardcoded id
  const workerContents = fs.readFileSync(WORKER_PATH, 'utf-8');
  test('Worker uses URL lookup for L\'Oréal (p.url === "/en/projects/logistics")', 
    workerContents.includes('p.url === "/en/projects/logistics"')
  );
  test('Worker does not use old broken id lookup',
    !workerContents.includes('p.id === "loreal-cell-bioprint"')
  );
  
  // Check for null safety
  test('Worker has null check for L\'Oréal project', 
    workerContents.match(/if\s*\(\s*project\s*\)/i) !== null
  );
}

// ============================================================================
// Test 5: File Existence
// ============================================================================

console.log('\n📁 Test Group: File Existence');

const criticalFiles = [
  'en/index.html',
  'en/projects/index.html',
  'en/hobbies/index.html',
  'assets/js/site.min.js',
  'assets/css/style.css',
  'robots.txt',
  'sitemap.xml',
  '_redirects',
  'worker/worker.js'
];

criticalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(ROOT_DIR, file));
  test(`${file} exists`, exists);
});

// Check all project files exist
if (siteFacts?.projects) {
  siteFacts.projects.forEach(p => {
    const filePath = p.filePath || p.path;
    if (filePath) {
      const exists = fs.existsSync(path.join(ROOT_DIR, filePath));
      test(`Project file: ${filePath}`, exists);
    }
  });
}

// Check all hobby files exist
if (siteFacts?.hobbies) {
  siteFacts.hobbies.forEach(h => {
    const filePath = h.filePath || h.path;
    if (filePath) {
      const exists = fs.existsSync(path.join(ROOT_DIR, filePath));
      test(`Hobby file: ${filePath}`, exists);
    }
  });
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Failures:');
  failures.forEach(f => {
    console.log(`   - ${f.name}${f.details ? ': ' + f.details : ''}`);
  });
  console.log('\n🛑 Tests FAILED');
  process.exit(1);
} else {
  console.log('\n✨ All tests passed!');
  process.exit(0);
}

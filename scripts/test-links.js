#!/usr/bin/env node

/**
 * Link Integrity Test
 * 
 * Scans all HTML files in /en/ for internal links (href, src) and verifies:
 * 1. Target files exist (if absolute paths to local files)
 * 2. Target redirects exist in _redirects (if old URLs)
 * 3. No broken internal links
 * 
 * Usage: node scripts/test-links.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

let passedTests = 0;
let failedTests = 0;
const failures = [];

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function pass(message) {
  passedTests++;
  log('✅', message, colors.green);
}

function fail(message) {
  failedTests++;
  failures.push(message);
  log('❌', message, colors.red);
}

/**
 * Get all HTML files in a directory recursively
 */
function getHTMLFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getHTMLFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Extract all href and src attributes from HTML content
 */
function extractLinks(htmlContent) {
  const links = [];
  
  // Match href="..." and src="..."
  const hrefRegex = /(?:href|src)=["']([^"']+)["']/g;
  let match;
  
  while ((match = hrefRegex.exec(htmlContent)) !== null) {
    links.push(match[1]);
  }
  
  return links;
}

/**
 * Filter for internal links only (not external URLs, anchors, or mailto)
 */
function isInternalLink(link) {
  if (!link) return false;
  if (link.startsWith('http://') || link.startsWith('https://')) return false;
  if (link.startsWith('mailto:')) return false;
  if (link.startsWith('tel:')) return false;
  if (link.startsWith('#')) return false;
  if (link.startsWith('data:')) return false;
  return true;
}

/**
 * Normalize a link to a file path (remove query strings and anchors)
 */
function normalizeLink(link) {
  // Remove query strings and anchors
  return link.split('?')[0].split('#')[0];
}

/**
 * Check if a file or redirect exists for a given link
 */
function checkLinkExists(link) {
  const normalized = normalizeLink(link);
  
  // Handle absolute paths starting with /
  if (normalized.startsWith('/')) {
    const filePath = path.join(ROOT_DIR, normalized);
    
    // Check if file exists as-is
    if (fs.existsSync(filePath)) {
      return { exists: true, type: 'file', path: filePath };
    }
    
    // Check if file exists with .html extension
    const htmlPath = `${filePath}.html`;
    if (fs.existsSync(htmlPath)) {
      return { exists: true, type: 'file', path: htmlPath };
    }
    
    // Check if it's a directory with index.html
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return { exists: true, type: 'file', path: indexPath };
    }
    
    // Check if redirect exists in _redirects
    const redirectsPath = path.join(ROOT_DIR, '_redirects');
    if (fs.existsSync(redirectsPath)) {
      const redirectsContent = fs.readFileSync(redirectsPath, 'utf-8');
      const redirectLines = redirectsContent.split('\n');
      
      for (const line of redirectLines) {
        if (line.trim().startsWith('#') || !line.trim()) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const source = parts[0];
          // Match exact path or path with .html
          if (source === normalized || source === `${normalized}.html`) {
            return { exists: true, type: 'redirect', target: parts[1] };
          }
        }
      }
    }
    
    return { exists: false, type: 'missing' };
  }
  
  // Relative paths - these are harder to validate without context
  return { exists: true, type: 'relative' };
}

/**
 * Main test function
 */
function runLinkIntegrityTests() {
  console.log(`${colors.cyan}🔗 Testing Link Integrity...${colors.reset}\n`);
  
  // Get all HTML files in /en/ or /EN/ (prefer EN when present)
  const enDir = fs.existsSync(path.join(ROOT_DIR, 'EN')) ? path.join(ROOT_DIR, 'EN') : path.join(ROOT_DIR, 'en');
  if (!fs.existsSync(enDir)) {
    fail('/en/ or /EN/ directory does not exist');
    return;
  }
  
  const htmlFiles = getHTMLFiles(enDir);
  log('📄', `Found ${htmlFiles.length} HTML files in /en/`, colors.cyan);
  
  const allLinks = new Set();
  const brokenLinks = [];
  
  // Scan each HTML file
  htmlFiles.forEach(filePath => {
    const relativePath = path.relative(ROOT_DIR, filePath);
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const links = extractLinks(htmlContent);
    
    links.forEach(link => {
      if (isInternalLink(link)) {
        allLinks.add(link);
        
        const result = checkLinkExists(link);
        if (!result.exists) {
          brokenLinks.push({
            file: relativePath,
            link: link,
          });
        }
      }
    });
  });
  
  log('🔍', `Found ${allLinks.size} unique internal links`, colors.cyan);
  
  if (brokenLinks.length === 0) {
    pass('All internal links are valid (files exist or redirects exist)');
  } else {
    fail(`Found ${brokenLinks.length} broken internal links`);
    
    // Group by link for better readability
    const linkGroups = {};
    brokenLinks.forEach(({ file, link }) => {
      if (!linkGroups[link]) {
        linkGroups[link] = [];
      }
      linkGroups[link].push(file);
    });
    
    console.log(`\n${colors.yellow}Broken Links:${colors.reset}`);
    Object.keys(linkGroups).forEach(link => {
      console.log(`\n  ${colors.red}${link}${colors.reset}`);
      console.log(`  Found in ${linkGroups[link].length} file(s):`);
      linkGroups[link].forEach(file => {
        console.log(`    - ${file}`);
      });
    });
  }
  
  // Test specific critical paths
  console.log(`\n${colors.cyan}📁 Test Group: Critical Paths${colors.reset}`);
  
  const criticalPaths = [
    '/en/',
    '/en/about',
    '/en/contact',
    '/en/projects/',
    '/en/hobbies/',
    '/en/hobbies-games/',
    '/assets/js/site.min.js',
    '/assets/css/style.css',
  ];
  
  criticalPaths.forEach(testPath => {
    const result = checkLinkExists(testPath);
    if (result.exists) {
      pass(`Critical path exists: ${testPath}`);
    } else {
      fail(`Critical path missing: ${testPath}`);
    }
  });
  
  // Test hobby pages have proper HTML structure
  console.log(`\n${colors.cyan}🔍 Test Group: HTML Structure${colors.reset}`);
  
  const hobbyPages = ['whispers.html', 'cooking.html', 'car.html'];
  hobbyPages.forEach(hobbyFile => {
    const hobbyPath = path.join(enDir, 'hobbies', hobbyFile);
    if (fs.existsSync(hobbyPath)) {
      const hobbyContent = fs.readFileSync(hobbyPath, 'utf-8');
      const hasHead = /<head[\s>]/.test(hobbyContent);
      const hasBody = /<body[\s>]/.test(hobbyContent);
      
      if (hasHead && hasBody) {
        pass(`${hobbyFile} has proper HTML structure (head + body)`);
      } else {
        fail(`${hobbyFile} missing proper HTML structure (head: ${hasHead}, body: ${hasBody})`);
      }
    }
  });
  
  // Test mini-game pages don't link to old root game URLs
  console.log(`\n${colors.cyan}🎮 Test Group: Mini-Game Links${colors.reset}`);
  
  const gameTestPath = path.join(enDir, 'hobbies-games', 'xx142-b2exe.html');
  if (fs.existsSync(gameTestPath)) {
    const gameContent = fs.readFileSync(gameTestPath, 'utf-8');
    const badLinks = ['/2048.html', '/invaders.html', '/breaker.html', '/snake.html'];
    let hasBadLinks = false;
    
    badLinks.forEach(badLink => {
      if (gameContent.includes(`href="${badLink}"`)) {
        hasBadLinks = true;
        fail(`xx142-b2exe.html contains legacy link: ${badLink}`);
      }
    });
    
    if (!hasBadLinks) {
      pass('xx142-b2exe.html does not contain legacy game links');
    }
  }
  
  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  if (failedTests === 0) {
    console.log(`${colors.green}📊 Results: ${passedTests} passed, ${failedTests} failed${colors.reset}`);
    console.log(`${colors.green}✨ All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}📊 Results: ${passedTests} passed, ${failedTests} failed${colors.reset}`);
    console.log(`${colors.red}❌ Some tests failed!${colors.reset}\n`);
    console.log(`${colors.yellow}Failed tests:${colors.reset}`);
    failures.forEach(failure => {
      console.log(`  - ${failure}`);
    });
    process.exit(1);
  }
}

// Run tests
runLinkIntegrityTests();

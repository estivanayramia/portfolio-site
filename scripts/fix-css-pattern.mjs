/**
 * CSS Pattern Fix Script
 * Fixes the broken CSS loading pattern in all HTML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function fixCSS() {
    console.log('='.repeat(60));
    console.log('Fixing CSS Loading Patterns');
    console.log('='.repeat(60));
    
    const enDir = path.join(rootDir, 'en');
    let fixed = 0;
    
    // Fix all HTML files in /en
    function fixDir(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                fixDir(fullPath);
            } else if (item.endsWith('.html')) {
                let content = fs.readFileSync(fullPath, 'utf8');
                const relPath = path.relative(rootDir, fullPath);
                
                // Check for broken patterns
                const hasBrokenPattern = 
                    content.includes('data-media="(min-width: 769px)"') ||
                    content.includes('media="(max-width: 768px)"') && content.includes('theme.min.css');
                
                if (hasBrokenPattern) {
                    // Remove ALL theme.min.css and theme.css related lines
                    // Pattern 1: <link rel="stylesheet" href="/assets/css/theme.min.css" media="(max-width: 768px)">
                    // Pattern 2: <link rel="stylesheet" href="/assets/css/theme.min.css" media="print" data-media="(min-width: 769px)" data-onload-rel="stylesheet">
                    // Pattern 3: <noscript><link rel="stylesheet" href="/assets/css/theme.min.css"></noscript>
                    
                    // Remove theme.min.css loading lines
                    content = content.replace(/<link[^>]*href="\/assets\/css\/theme\.min\.css"[^>]*>\s*\n?/g, '');
                    
                    // Remove old theme.css lines (except the one we want)
                    content = content.replace(/<link[^>]*href="\/assets\/css\/theme\.css"[^>]*media="[^"]*"[^>]*>\s*\n?/g, '');
                    
                    // Remove noscript wrappers for theme CSS
                    content = content.replace(/<noscript>\s*<link[^>]*href="\/assets\/css\/theme[^"]*"[^>]*>\s*<\/noscript>\s*\n?/g, '');
                    
                    // Remove duplicate/empty lines
                    content = content.replace(/(\n\s*){3,}/g, '\n\n');
                    
                    // Add the correct theme.css loading if not present
                    if (!content.includes('href="/assets/css/theme.css"')) {
                        // Find where to insert (after Analytics loaded comment or after site.min.js)
                        const insertPoint = content.indexOf('<!-- Analytics loaded');
                        if (insertPoint > -1) {
                            const insertAfter = content.indexOf('\n', insertPoint);
                            content = content.slice(0, insertAfter) + '\n\n    <!-- Theme CSS - loads reliably for all viewports -->\n    <link rel="stylesheet" href="/assets/css/theme.css">' + content.slice(insertAfter);
                        } else {
                            // Insert before </head>
                            content = content.replace('</head>', '    <!-- Theme CSS - loads reliably for all viewports -->\n    <link rel="stylesheet" href="/assets/css/theme.css">\n</head>');
                        }
                    }
                    
                    fs.writeFileSync(fullPath, content);
                    fixed++;
                    console.log(`✅ Fixed: ${relPath}`);
                }
            }
        }
    }
    
    fixDir(enDir);
    
    console.log('\n' + '='.repeat(60));
    console.log(`Fixed ${fixed} files`);
    console.log('='.repeat(60));
}

fixCSS();

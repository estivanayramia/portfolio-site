/**
 * CSS Loading Verification Script
 * Verifies that all HTML files load theme.css correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function checkCSS() {
    console.log('='.repeat(60));
    console.log('CSS Loading Verification');
    console.log('='.repeat(60));
    
    const enDir = path.join(rootDir, 'en');
    let total = 0;
    let passed = 0;
    let failed = 0;
    
    // Check all HTML files in /en
    function checkDir(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                checkDir(fullPath);
            } else if (item.endsWith('.html')) {
                total++;
                const content = fs.readFileSync(fullPath, 'utf8');
                const relPath = path.relative(rootDir, fullPath);
                
                // Check for correct CSS pattern - only checking for theme CSS specifically
                const hasThemeCSS = content.includes('href="/assets/css/theme.css"');
                // Only flag if the broken pattern is for theme.min.css, not Google Fonts
                const hasBrokenThemePattern = content.includes('theme.min.css') && content.includes('data-media="(min-width: 769px)"');
                
                if (hasThemeCSS && !hasBrokenThemePattern) {
                    passed++;
                    console.log(`✅ ${relPath}`);
                } else {
                    failed++;
                    console.log(`❌ ${relPath}`);
                    if (!hasThemeCSS) {
                        console.log(`   Missing: href="/assets/css/theme.css"`);
                    }
                    if (hasBrokenThemePattern) {
                        console.log(`   Has broken theme.min.css pattern`);
                    }
                }
            }
        }
    }
    
    checkDir(enDir);
    
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Total:  ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
        process.exit(1);
    }
}

checkCSS();

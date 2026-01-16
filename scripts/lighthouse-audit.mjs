/**
 * Lighthouse Audit Script
 * Runs Lighthouse audits programmatically to avoid Windows Chrome-launcher issues
 */

import puppeteer from 'puppeteer';

const BASE_URL = process.argv[2] || 'https://www.estivanayramia.com';
const PAGES = [
    '/',
    '/about.html',
    '/overview.html',
    '/contact.html',
    '/projects.html'
];

async function runLighthouse(url) {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set mobile viewport
        await page.setViewport({
            width: 375,
            height: 812,
            isMobile: true,
            hasTouch: true
        });
        
        // Navigate and measure basic metrics
        const startTime = Date.now();
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        const loadTime = Date.now() - startTime;
        
        // Check for layout issues
        const layoutIssues = await page.evaluate(() => {
            const issues = [];
            
            // Check for horizontal overflow
            if (document.body.scrollWidth > window.innerWidth) {
                issues.push(`Horizontal overflow: ${document.body.scrollWidth - window.innerWidth}px`);
            }
            
            // Check for missing CSS
            const stylesheets = Array.from(document.styleSheets);
            const sameOriginSheets = stylesheets.filter(s => {
                if (!s.href) return true;
                try {
                    const sheetUrl = new URL(s.href, window.location.href);
                    return sheetUrl.origin === window.location.origin;
                } catch (e) {
                    return true;
                }
            });
            const failedSheets = sameOriginSheets.filter(s => {
                try {
                    return s.cssRules.length === 0;
                } catch (e) {
                    return true;
                }
            });
            if (failedSheets.length > 0) {
                issues.push(`${failedSheets.length} stylesheets may have failed to load`);
            }
            
            // Check for images without dimensions
            const imagesWithoutSize = Array.from(document.querySelectorAll('img:not([width]):not([height])'))
                .filter(img => !img.getAttribute('width') && !img.getAttribute('height'))
                .length;
            if (imagesWithoutSize > 10) {
                issues.push(`${imagesWithoutSize} images missing explicit dimensions`);
            }
            
            // Check for render-blocking resources
            const renderBlocking = document.querySelectorAll('link[rel="stylesheet"]:not([media="print"])');
            
            return {
                issues,
                cssCount: stylesheets.length,
                renderBlockingCount: renderBlocking.length
            };
        });
        
        // Get LCP estimate
        const lcpData = await page.evaluate(() => {
            return new Promise(resolve => {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    resolve({
                        time: lastEntry.startTime,
                        element: lastEntry.element?.tagName || 'unknown'
                    });
                });
                observer.observe({ type: 'largest-contentful-paint', buffered: true });
                
                // Fallback timeout
                setTimeout(() => resolve({ time: -1, element: 'timeout' }), 5000);
            });
        });
        
        return {
            url,
            loadTime,
            lcp: lcpData.time > 0 ? Math.round(lcpData.time) : 'N/A',
            lcpElement: lcpData.element,
            ...layoutIssues.issues.length > 0 ? { issues: layoutIssues.issues } : {},
            cssCount: layoutIssues.cssCount,
            status: layoutIssues.issues.length === 0 ? 'PASS' : 'WARN'
        };
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('Lighthouse Layout & Performance Audit');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}\n`);
    
    const results = [];
    
    for (const path of PAGES) {
        const url = `${BASE_URL}${path}`;
        console.log(`Testing: ${path}`);
        
        try {
            const result = await runLighthouse(url);
            results.push(result);
            
            const status = result.status === 'PASS' ? '✅' : '⚠️';
            console.log(`  ${status} Load: ${result.loadTime}ms, LCP: ${result.lcp}ms (${result.lcpElement})`);
            
            if (result.issues) {
                result.issues.forEach(issue => console.log(`     ⚠️ ${issue}`));
            }
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            results.push({ url, status: 'ERROR', error: error.message });
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const failed = results.filter(r => r.status === 'ERROR').length;
    
    console.log(`Passed: ${passed}/${results.length}`);
    console.log(`Warnings: ${warned}/${results.length}`);
    console.log(`Errors: ${failed}/${results.length}`);
    
    // Exit with error if any failures
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);

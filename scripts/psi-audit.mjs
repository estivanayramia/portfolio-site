/**
 * PageSpeed Insights Audit Script
 * Uses the PageSpeed Insights API to get real Lighthouse scores
 */

const BASE_URL = process.argv[2] || 'https://www.estivanayramia.com';
const PAGES = [
    '/',
    '/about.html',
    '/overview.html',
    '/contact.html',
    '/projects.html'
];

async function runPSI(url, strategy = 'mobile') {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=${strategy}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const categories = data.lighthouseResult?.categories || {};
    
    return {
        url,
        strategy,
        performance: Math.round((categories.performance?.score || 0) * 100),
        accessibility: Math.round((categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
        seo: Math.round((categories.seo?.score || 0) * 100),
        fcp: data.lighthouseResult?.audits?.['first-contentful-paint']?.displayValue || 'N/A',
        lcp: data.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue || 'N/A',
        cls: data.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue || 'N/A',
        tbt: data.lighthouseResult?.audits?.['total-blocking-time']?.displayValue || 'N/A',
    };
}

async function main() {
    console.log('='.repeat(60));
    console.log('PageSpeed Insights Audit');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}\n`);
    
    for (const path of PAGES) {
        const url = `${BASE_URL}${path}`;
        console.log(`\nTesting: ${url}`);
        console.log('-'.repeat(50));
        
        // Test both mobile and desktop
        for (const strategy of ['mobile', 'desktop']) {
            console.log(`\n${strategy.toUpperCase()}:`);
            
            try {
                // Add delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const result = await runPSI(url, strategy);
                
                console.log(`  Performance:    ${result.performance}%`);
                console.log(`  Accessibility:  ${result.accessibility}%`);
                console.log(`  Best Practices: ${result.bestPractices}%`);
                console.log(`  SEO:            ${result.seo}%`);
                console.log(`  `);
                console.log(`  FCP: ${result.fcp}`);
                console.log(`  LCP: ${result.lcp}`);
                console.log(`  CLS: ${result.cls}`);
                console.log(`  TBT: ${result.tbt}`);
                
            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Done');
    console.log('='.repeat(60));
}

main().catch(console.error);

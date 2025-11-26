/**
 * Lazy Loader - Defers render-blocking scripts for better PageSpeed
 * Loads analytics (GTM, Clarity) and dependencies (Marked.js) after page load
 */

(function() {
    'use strict';

    // Configuration
    const ANALYTICS_DELAY = 2000; // Delay analytics by 2s for faster initial paint
    const GTM_ID = 'G-MCN4RXCY6Q';
    const CLARITY_ID = 'ubbdpwxnae';

    /**
     * Inject a script element into the document
     * @param {string} src - Script source URL
     * @param {boolean} async - Whether script should be async
     * @param {Function} callback - Optional callback on load
     */
    function injectScript(src, async = true, callback = null) {
        const script = document.createElement('script');
        script.src = src;
        script.async = async;
        if (callback) {
            script.onload = callback;
        }
        document.body.appendChild(script);
    }

    /**
     * Inject inline script content
     * @param {string} content - Script content to inject
     */
    function injectInlineScript(content) {
        const script = document.createElement('script');
        script.textContent = content;
        document.body.appendChild(script);
    }

    /**
     * Load Google Analytics 4 (gtag.js)
     */
    function loadGoogleAnalytics() {
        // Create dataLayer if not exists
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;
        
        gtag('js', new Date());
        gtag('config', GTM_ID);

        // Load gtag script
        injectScript(`https://www.googletagmanager.com/gtag/js?id=${GTM_ID}`);
    }

    /**
     * Load Microsoft Clarity
     */
    function loadClarity() {
        window.clarity = window.clarity || function() {
            (window.clarity.q = window.clarity.q || []).push(arguments);
        };

        const clarityScript = `
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");
        `;
        injectInlineScript(clarityScript);
    }

    /**
     * Load Marked.js for markdown parsing in chat
     */
    function loadMarkedJS(callback) {
        injectScript(
            'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
            true,
            callback
        );
    }

    /**
     * Use requestIdleCallback if available, else setTimeout
     * @param {Function} fn - Function to execute when idle
     * @param {number} timeout - Fallback timeout in ms
     */
    function onIdle(fn, timeout = 2000) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(fn, { timeout: timeout });
        } else {
            setTimeout(fn, timeout);
        }
    }

    /**
     * Initialize lazy loading after page load
     */
    function init() {
        // Load Marked.js immediately but async (needed for chat)
        loadMarkedJS(function() {
            console.log('[LazyLoader] Marked.js loaded');
        });

        // Defer analytics until idle to minimize main thread work
        onIdle(function() {
            loadGoogleAnalytics();
            console.log('[LazyLoader] Google Analytics loaded');
        }, ANALYTICS_DELAY);

        onIdle(function() {
            loadClarity();
            console.log('[LazyLoader] Microsoft Clarity loaded');
        }, ANALYTICS_DELAY + 100);
    }

    // Start lazy loading after page has fully loaded
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();

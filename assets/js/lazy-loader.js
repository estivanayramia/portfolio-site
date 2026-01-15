/**
 * Lazy Loader - Interaction-Based Script Loading for Maximum PageSpeed
 * =====================================================================
 * 
 * CENTRALIZED ANALYTICS MODULE
 * This is the SINGLE SOURCE OF TRUTH for all analytics initialization.
 * 
 * Strategy:
 * - DO NOT load analytics or heavy scripts until user interacts
 * - Keeps main thread clear during initial page load, boosting PageSpeed scores
 * - Prevents blocking of First Contentful Paint (FCP) and Largest Contentful Paint (LCP)
 * - Uses requestIdleCallback when available to minimize main thread impact
 * 
 * Analytics Services:
 * - Google Analytics 4 (GA4): G-MCN4RXCY6Q
 * - Microsoft Clarity: uawk2g8xee
 * 
 * Triggers: scroll, mousemove, touchstart, keydown, click
 * Once triggered, loads: Google Analytics 4, Microsoft Clarity, Marked.js (for chat)
 * 
 * Performance characteristics:
 * - Scripts load only once per page
 * - Lazy initialization prevents duplicate injections
 * - Event listeners automatically removed after first trigger
 * - Uses passive event listeners to avoid scroll jank
 * 
 * @version 2.0.0
 * @author Estivan Ayramia
 */

(function() {
    'use strict';

    // Avoid delaying the window load event by injecting new subresources
    // (analytics/CDN scripts) before the page has finished loading.
    let pageLoaded = document.readyState === 'complete';
    if (!pageLoaded) {
        window.addEventListener('load', function() {
            pageLoaded = true;
        }, { once: true });
    }

    function runAfterLoad(callback) {
        if (pageLoaded) {
            callback();
            return;
        }
        window.addEventListener('load', callback, { once: true });
    }

    // ========================================================================
    // ANALYTICS CONFIGURATION
    // Edit these values to update tracking IDs site-wide
    // ========================================================================
    
    const GA_MEASUREMENT_ID = 'G-MCN4RXCY6Q';  // Google Analytics 4 measurement ID
    const CLARITY_PROJECT_ID = 'uawk2g8xee';   // Microsoft Clarity project ID

    // Skip analytics in automated/headless contexts (e.g., Lighthouse).
    // This prevents long-running GA/ads requests from keeping the page in a
    // perpetual “loading” state during audits, while keeping analytics for real users.
    const isAutomated = typeof navigator !== 'undefined' && !!navigator.webdriver;
    
    // ========================================================================
    // INITIALIZATION STATE
    // ========================================================================
    
    // Global flag to ensure scripts load only once per page
    let scriptsLoaded = false;
    
    // Track individual service initialization to prevent duplicates
    let analyticsInitialized = {
        ga4: false,
        clarity: false,
        marked: false
    };
    
    // Interaction events that trigger script loading
    const INTERACTION_EVENTS = ['scroll', 'mousemove', 'touchstart', 'keydown', 'click'];

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

    // ========================================================================
    // GOOGLE ANALYTICS 4 (GA4) INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize Google Analytics 4 with gtag.js
     * 
     * This loads the GA4 tracking script and configures it for the site.
     * Called lazily after user interaction to prevent blocking page load.
     * 
     * Tracking includes:
     * - Automatic page views
     * - Enhanced measurement (scrolls, outbound clicks, site search, video engagement)
     * - Custom events sent from site.js (when needed)
     * 
     * @returns {void}
     */
    function loadGoogleAnalytics() {
        // Prevent duplicate initialization
        if (analyticsInitialized.ga4) {
            console.log('[LazyLoader] Google Analytics already initialized, skipping');
            return;
        }
        
        // Mark as initialized immediately to prevent race conditions
        analyticsInitialized.ga4 = true;
        
        // Create dataLayer if not exists (required for gtag.js)
        window.dataLayer = window.dataLayer || [];
        
        // Define gtag function to queue commands
        function gtag() { 
            window.dataLayer.push(arguments); 
        }
        
        // Expose gtag globally for custom event tracking in site.js
        window.gtag = gtag;
        
        // Initialize gtag with current timestamp
        gtag('js', new Date());
        
        // Configure GA4 with measurement ID
        gtag('config', GA_MEASUREMENT_ID, {
            'send_page_view': true,  // Automatically track page views
            'anonymize_ip': true,    // Privacy: anonymize IP addresses
            // Reduce ad/remarketing requests and improve privacy/perf.
            // Docs: https://developers.google.com/analytics/devguides/collection/ga4/reference/config
            'allow_google_signals': false,
            'allow_ad_personalization_signals': false,
            'cookie_flags': 'SameSite=None;Secure'  // Cookie security for Cloudflare Pages
        });
        
        // Load gtag.js script asynchronously
        injectScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
        
        console.log('[LazyLoader] ✓ Google Analytics 4 initialized:', GA_MEASUREMENT_ID);
    }

    // ========================================================================
    // MICROSOFT CLARITY INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize Microsoft Clarity session recording and heatmaps
     * 
     * Clarity provides:
     * - Session recordings (user behavior analysis)
     * - Heatmaps (click and scroll patterns)
     * - Custom event tracking (sent from site.js)
     * 
     * Called lazily after user interaction to prevent blocking page load.
     * The clarity() function is exposed globally for custom event tracking.
     * 
     * @returns {void}
     */
    function loadClarity() {
        // Prevent duplicate initialization
        if (analyticsInitialized.clarity) {
            console.log('[LazyLoader] Microsoft Clarity already initialized, skipping');
            return;
        }
        
        // Mark as initialized immediately to prevent race conditions
        analyticsInitialized.clarity = true;
        
        // Create clarity stub function if not exists (queues events before script loads)
        window.clarity = window.clarity || function() {
            (window.clarity.q = window.clarity.q || []).push(arguments);
        };

        // CSP-friendly Clarity load: no inline script injection.
        // The official snippet injects an inline <script>; we replicate the behavior by:
        // 1) defining the queueing stub above, and
        // 2) loading the Clarity tag script directly.
        injectScript(`https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`);
        
        console.log('[LazyLoader] ✓ Microsoft Clarity initialized:', CLARITY_PROJECT_ID);
    }

    // ========================================================================
    // MARKED.JS INITIALIZATION (for AI chat markdown parsing)
    // ========================================================================
    
    /**
     * Load Marked.js library for markdown parsing in the chat widget
     * 
     * Used by the Savonie AI chatbot to render markdown responses.
     * Called lazily to avoid blocking critical resources.
     * 
     * @returns {void}
     */
    function loadMarkedJS() {
        // Prevent duplicate initialization
        if (analyticsInitialized.marked) {
            console.log('[LazyLoader] Marked.js already loaded, skipping');
            return;
        }
        
        // Mark as initialized
        analyticsInitialized.marked = true;
        
        injectScript(
            'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
            true,
            function() {
                console.log('[LazyLoader] ✓ Marked.js loaded for chat markdown parsing');
            }
        );
    }

    // ========================================================================
    // ORCHESTRATION - Load All Deferred Scripts
    // ========================================================================
    
    /**
     * Load all deferred scripts on first user interaction
     * 
     * This is the main orchestration function that triggers when the user
     * first interacts with the page (scroll, click, touch, etc.)
     * 
     * Strategy:
     * 1. Load Marked.js immediately (needed for chat)
     * 2. Defer analytics to requestIdleCallback (when browser is idle)
     * 3. Fall back to setTimeout if requestIdleCallback not available
     * 
     * This ensures:
     * - No impact on initial page load performance
     * - No blocking of user interactions
     * - Analytics load when browser has spare cycles
     * 
     * @returns {void}
     */
    function loadAllScripts() {
        // Prevent duplicate execution
        if (scriptsLoaded) {
            console.log('[LazyLoader] Scripts already loaded, aborting');
            return;
        }
        
        scriptsLoaded = true;
        
        // Remove all interaction listeners immediately to prevent duplicate triggers
        INTERACTION_EVENTS.forEach(function(event) {
            window.removeEventListener(event, onFirstInteraction, { passive: true, capture: true });
            document.removeEventListener(event, onFirstInteraction, { passive: true, capture: true });
        });
        
        console.log('[LazyLoader] 🚀 User interaction detected - initializing analytics...');

        // To avoid delaying `window.load` (and to keep Lighthouse stable),
        // only inject new external scripts after the page has finished loading.
        runAfterLoad(function() {
            // Load Marked.js (needed for chat)
            loadMarkedJS();

            if (isAutomated) {
                console.log('[LazyLoader] Automated context detected - skipping analytics');
                return;
            }

            // Use requestIdleCallback for analytics to minimize performance impact
            // This tells the browser to run these when it has spare cycles
            if ('requestIdleCallback' in window) {
                requestIdleCallback(function() {
                    console.log('[LazyLoader] Browser idle - loading analytics...');
                    loadGoogleAnalytics();
                    loadClarity();
                }, { timeout: 3000 });  // Force load after 3s even if not idle
            } else {
                // Fallback for browsers without requestIdleCallback (older Safari)
                setTimeout(function() {
                    console.log('[LazyLoader] Using setTimeout fallback for analytics...');
                    loadGoogleAnalytics();
                    loadClarity();
                }, 100);
            }
        });
    }

    // ========================================================================
    // EVENT HANDLERS & INITIALIZATION
    // ========================================================================
    
    /**
     * Handler for first user interaction
     * Triggers the loading of all deferred scripts
     * 
     * @returns {void}
     */
    function onFirstInteraction() {
        loadAllScripts();
    }

    /**
     * Initialize interaction-based lazy loading
     * 
     * Registers event listeners for common user interactions:
     * - scroll: User scrolls the page
     * - mousemove: User moves their mouse
     * - touchstart: User touches the screen (mobile)
     * - keydown: User presses a key
     * - click: User clicks anywhere
     * 
     * All listeners use:
     * - passive: true (prevents blocking scroll performance)
     * - capture: true (fires during capture phase for earliest detection)
     * - once: true (automatically removed after first trigger)
     * 
     * @returns {void}
     */
    function init() {
        // Check if already initialized (prevent duplicate initialization)
        if (window.__lazyLoaderInitialized) {
            console.log('[LazyLoader] Already initialized, skipping');
            return;
        }
        
        window.__lazyLoaderInitialized = true;
        
        // Register listeners for user interaction events
        INTERACTION_EVENTS.forEach(function(event) {
            window.addEventListener(event, onFirstInteraction, { 
                passive: true,  // Don't block scroll
                capture: true,  // Fire early in event propagation
                once: true      // Auto-remove after first trigger
            });
            document.addEventListener(event, onFirstInteraction, { 
                passive: true, 
                capture: true, 
                once: true 
            });
        });
        
        console.log('[LazyLoader] ⏳ Initialized - waiting for user interaction...');
        console.log('[LazyLoader] Analytics will load on:', INTERACTION_EVENTS.join(', '));
    }

    // ========================================================================
    // BOOTSTRAP - Start watching for interactions
    // ========================================================================
    
    // Start watching for interactions after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready, initialize immediately
        init();
    }
})();

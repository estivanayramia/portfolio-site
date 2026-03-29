/**
 * ============================================================================
 * PORTFOLIO SITE - MAIN JAVASCRIPT
 * ============================================================================
 * 
 * Purpose: Core functionality for the portfolio website including:
 * - Mobile-optimized navigation and scroll handling
 * - Dark/light theme management with system preference detection
 * - GSAP animations with ScrollTrigger
 * - Progressive PDF preview loading with graceful fallbacks
 * - Savonie AI chatbot integration
 * - PWA support with service worker
 * - Achievement system
 * - Custom analytics event tracking (theme changes, scroll depth, interactions)
 * 
 * Architecture Overview:
 * 1. Core Utilities (user interaction tracking, guarded reload)
 * 2. Feature Modules (theme, animations, PDFs, chat, etc.)
 * 3. Analytics Integration (custom events sent to GA4 & Clarity)
 * 4. Initialization & Startup
 * 
 * Analytics Integration:
 * ----------------------
 * Analytics initialization is handled by lazy-loader.js (loaded via defer).
 * This file sends CUSTOM EVENTS to the analytics services after they're loaded.
 * 
 * Services used:
 * - Google Analytics 4 (GA4): G-MCN4RXCY6Q
 * - Microsoft Clarity: uawk2g8xee
 * 
 * How it works:
 * 1. lazy-loader.js loads analytics on first user interaction (scroll, click, etc.)
 * 2. This file checks if analytics are loaded before sending events
 * 3. Custom events: theme toggle, scroll depth, navigation clicks, form submissions
 * 4. All analytics code is defensive (checks typeof before calling)
 * 
 * To verify analytics:
 * - GA4: https://analytics.google.com → Realtime → Events
 * - Clarity: https://clarity.microsoft.com → Dashboard → Recordings
 * 
 * @version 2.1.0
 * @author Estivan Ayramia
 * @license MIT
 */

// ============================================================================
// CORE UTILITIES - User Interaction Tracking
// ============================================================================

/**
 * User Interaction State Tracker
 * 
 * Tracks whether the user is actively scrolling/touching to prevent
 * unwanted reloads or focus changes that could cause scroll position jumps.
 * 
 * This is CRITICAL for mobile Safari where forced reloads during user
 * interaction can cause the viewport to jump unexpectedly, creating a
 * jarring user experience.
 * 
 * Events monitored: touchstart, touchmove, wheel, scroll
 * Debounce period: 1000ms after last interaction
 */
let __userInteracting = false;
let __userInteractingTimer = null;
const __markUserInteraction = () => {
    __userInteracting = true;
    if (__userInteractingTimer) clearTimeout(__userInteractingTimer);
    __userInteractingTimer = setTimeout(() => { __userInteracting = false; }, 1000);
};
['touchstart', 'touchmove', 'wheel', 'scroll'].forEach(ev => {
    try { window.addEventListener(ev, __markUserInteraction, { passive: true }); } catch (e) { window.addEventListener(ev, __markUserInteraction); }
});

// Deferred stylesheet activation (CSP-friendly replacement for inline onload handlers)
// Pattern supported: <link rel="stylesheet" media="print" data-media="all|(min-width: 769px)|...">
const __initDeferredStylesheets = () => {
    try {
        const links = document.querySelectorAll('link[rel="stylesheet"][media="print"][data-media]');
        links.forEach(link => {
            const targetMedia = link.getAttribute('data-media') || 'all';
            const apply = () => {
                try { link.media = targetMedia; } catch (e) {}
            };

            // Apply as soon as the stylesheet finishes loading.
            try { link.addEventListener('load', apply, { once: true }); } catch (e) { link.addEventListener('load', apply); }
            try { link.addEventListener('error', apply, { once: true }); } catch (e) { link.addEventListener('error', apply); }

            // If already loaded/cached by the time we attach listeners.
            setTimeout(() => {
                try { if (link.sheet) apply(); } catch (e) {}
            }, 0);
        });
    } catch (e) {}
};
__initDeferredStylesheets();

// CSP-friendly replacement for: <link rel="preload" as="style" onload="this.rel='stylesheet'">
const __initPreloadStylesheets = () => {
    try {
        const links = document.querySelectorAll('link[rel="preload"][as="style"][data-onload-rel]');
        links.forEach(link => {
            const targetRel = link.getAttribute('data-onload-rel') || 'stylesheet';
            const apply = () => {
                try {
                    link.rel = targetRel;
                    link.removeAttribute('data-onload-rel');
                } catch (e) {}
            };

            try { link.addEventListener('load', apply, { once: true }); } catch (e) { link.addEventListener('load', apply); }

            // If already fetched before we attached listeners (best-effort).
            try {
                if (typeof performance !== 'undefined' && typeof performance.getEntriesByName === 'function') {
                    const href = link.href;
                    const entries = href ? performance.getEntriesByName(href) : [];
                    if (entries && entries.length) {
                        const entry = entries[0];
                        if (entry && typeof entry.responseEnd === 'number' && entry.responseEnd > 0) {
                            apply();
                        }
                    }
                }
            } catch (e) {}
        });
    } catch (e) {}
};
__initPreloadStylesheets();

// Carousel + lightbox (CSP-friendly replacement for inline hobby page scripts)
// Enables the hobby pages to avoid inline <script> blocks.
const __initCarouselAndLightbox = () => {
    try {
        const track = document.getElementById('carouselTrack');
        if (!track) return;
        if (track.dataset && track.dataset.carouselInit === '1') return;

        const wrapMode = !!(track.dataset && track.dataset.carouselWrap === '1');

        const noteCardImages = Array.from(document.querySelectorAll('.note-card img'));
        const isWhispersStyle = noteCardImages.length > 0;

        const slides = Array.from(document.querySelectorAll('.carousel-slide'));
        if (!slides.length) return;

        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        const dotsContainer = document.getElementById('carouselDots');
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-image');
        const closeBtn = document.querySelector('.lightbox-close');
        const prevLightboxBtn = document.querySelector('.lightbox-prev');
        const nextLightboxBtn = document.querySelector('.lightbox-next');

        if (!prevBtn || !nextBtn || !dotsContainer || !lightbox || !lightboxImg || !closeBtn || !prevLightboxBtn || !nextLightboxBtn) return;

        const slideImages = slides.map(s => s.querySelector('img')).filter(Boolean);
        const lightboxImages = isWhispersStyle ? noteCardImages : slideImages;
        if (!lightboxImages.length) return;

        let currentIndex = 0;
        let currentLightboxIndex = 0;

        const getSlidesPerView = () => {
            if (!isWhispersStyle) return (window.innerWidth >= 768 ? 3 : 2);
            if (window.innerWidth >= 1024) return 5;
            if (window.innerWidth >= 768) return 4;
            if (window.innerWidth >= 640) return 3;
            return 2;
        };
        let slidesPerView = getSlidesPerView();

        const clearDots = () => {
            try { dotsContainer.innerHTML = ''; } catch (e) {
                while (dotsContainer.firstChild) dotsContainer.removeChild(dotsContainer.firstChild);
            }
        };

        const closeLightbox = () => {
            try {
                lightbox.classList.remove('active');
                lightbox.setAttribute('aria-hidden', 'true');
            } catch (e) {}
        };

        const getTotalPages = () => Math.ceil(slides.length / slidesPerView);

        const updateCarousel = () => {
            try {
                const slideWidth = (slides[0] && slides[0].offsetWidth ? slides[0].offsetWidth : 0) + 16;
                const totalPages = getTotalPages();

                if (isWhispersStyle) {
                    const maxStart = Math.max(0, slides.length - slidesPerView);
                    currentIndex = Math.max(0, Math.min(currentIndex, maxStart));
                    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
                } else {
                    currentIndex = Math.max(0, Math.min(currentIndex, totalPages - 1));
                    track.style.transform = `translateX(-${currentIndex * slideWidth * slidesPerView}px)`;
                }

                Array.from(document.querySelectorAll('.carousel-dot')).forEach((d, i) => {
                    const activeIndex = isWhispersStyle ? Math.floor(currentIndex / slidesPerView) : currentIndex;
                    d.classList.toggle('active', i === activeIndex);
                });
            } catch (e) {}
        };

        const buildDots = () => {
            clearDots();
            const totalPages = getTotalPages();
            for (let i = 0; i < totalPages; i++) {
                const dot = document.createElement('button');
                dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
                try { dot.setAttribute('aria-label', `Go to page ${i + 1}`); } catch (e) {}
                dot.addEventListener('click', () => {
                    if (isWhispersStyle) {
                        const maxStart = Math.max(0, slides.length - slidesPerView);
                        currentIndex = Math.max(0, Math.min(i * slidesPerView, maxStart));
                    } else {
                        currentIndex = wrapMode ? ((i + totalPages) % totalPages) : Math.max(0, Math.min(i, totalPages - 1));
                    }
                    updateCarousel();
                });
                dotsContainer.appendChild(dot);
            }
            updateCarousel();
        };

        prevBtn.addEventListener('click', () => {
            const totalPages = getTotalPages();

            if (isWhispersStyle) {
                const maxStart = Math.max(0, slides.length - slidesPerView);
                if (wrapMode) {
                    currentIndex = currentIndex - slidesPerView;
                    if (currentIndex < 0) currentIndex = maxStart;
                } else {
                    currentIndex = Math.max(0, currentIndex - slidesPerView);
                }
            } else {
                currentIndex = wrapMode ? ((currentIndex - 1 + totalPages) % totalPages) : Math.max(0, Math.min(currentIndex - 1, totalPages - 1));
            }
            updateCarousel();
        });
        nextBtn.addEventListener('click', () => {
            const totalPages = getTotalPages();

            if (isWhispersStyle) {
                const maxStart = Math.max(0, slides.length - slidesPerView);
                if (wrapMode) {
                    currentIndex = currentIndex + slidesPerView;
                    if (currentIndex > maxStart) currentIndex = 0;
                } else {
                    currentIndex = Math.min(maxStart, currentIndex + slidesPerView);
                }
            } else {
                currentIndex = wrapMode ? ((currentIndex + 1) % totalPages) : Math.max(0, Math.min(currentIndex + 1, totalPages - 1));
            }
            updateCarousel();
        });

        const showLightboxImage = (index) => {
            const img = lightboxImages[index];
            if (!img) return;
            currentLightboxIndex = index;
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt || '';
            try { lightboxImg.style.transform = img.style && img.style.transform ? img.style.transform : ''; } catch (e) {}

            if (isWhispersStyle) {
                try { prevLightboxBtn.style.display = index > 0 ? 'block' : 'none'; } catch (e) {}
                try { nextLightboxBtn.style.display = index < lightboxImages.length - 1 ? 'block' : 'none'; } catch (e) {}
            }
        };

        const openLightboxAt = (index) => {
            showLightboxImage(index);
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');
        };

        if (isWhispersStyle) {
            lightboxImages.forEach((img, i) => {
                img.addEventListener('click', () => openLightboxAt(i));
            });
        } else {
            slides.forEach((slide, i) => {
                slide.addEventListener('click', () => openLightboxAt(i));
            });
        }

        closeBtn.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

        prevLightboxBtn.addEventListener('click', (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (isWhispersStyle) {
                if (currentLightboxIndex > 0) showLightboxImage(currentLightboxIndex - 1);
            } else {
                showLightboxImage((currentLightboxIndex - 1 + lightboxImages.length) % lightboxImages.length);
            }
        });
        nextLightboxBtn.addEventListener('click', (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (isWhispersStyle) {
                if (currentLightboxIndex < lightboxImages.length - 1) showLightboxImage(currentLightboxIndex + 1);
            } else {
                showLightboxImage((currentLightboxIndex + 1) % lightboxImages.length);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') prevLightboxBtn.click();
            if (e.key === 'ArrowRight') nextLightboxBtn.click();
        });

        window.addEventListener('resize', () => {
            const next = getSlidesPerView();
            if (next !== slidesPerView) {
                slidesPerView = next;
                buildDots();
            } else {
                updateCarousel();
            }
        });

        try { track.dataset.carouselInit = '1'; } catch (e) {}
        buildDots();
    } catch (e) {}
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __initCarouselAndLightbox);
} else {
    __initCarouselAndLightbox();
}

// Diagnostic collectors intentionally removed from runtime build.
// Keep a no-op hook so existing safe calls remain harmless.
const __logCollect = () => {};

/**
 * Guarded Page Reload Utility
 *
 * Attempts to reload the page only when the user is NOT actively interacting.
 * This prevents the scroll-jump bug on mobile devices (especially iOS Safari)
 * where a reload during scrolling causes the viewport to jump unexpectedly.
 *
 * @param {Object} opts - Configuration options
 * @param {number} [opts.MAX=30000] - Maximum milliseconds to wait before forcing reload
 * @param {number} [opts.RETRY=500] - Milliseconds between retry attempts
 * @param {Function} [opts.fallback] - Fallback function if reload fails
 */
window.tryGuardedReload = function(opts) {
    opts = opts || {};
    const MAX = (typeof opts.MAX === 'number') ? opts.MAX : 30000;
    const RETRY = (typeof opts.RETRY === 'number') ? opts.RETRY : 500;
    const fallback = (opts && typeof opts.fallback === 'function') ? opts.fallback : null;
    const start = Date.now();

    (function attempt() {
        try {
            const interacting = !!__userInteracting;
            if (!interacting) {
                try { window.location.reload(); } catch (e) { try { window.location.href = window.location.href; } catch (_) {} }
                return;
            }
            if (Date.now() - start < MAX) {
                setTimeout(attempt, RETRY);
                return;
            }
            if (fallback) {
                try { fallback(); } catch (e) { try { window.location.reload(); } catch (_) {} }
            } else {
                try { window.location.reload(); } catch (e) { try { window.location.href = window.location.href; } catch (_) {} }
            }
        } catch (e) {
            if (fallback) { try { fallback(); } catch (_) { try { window.location.reload(); } catch (_) {} } }
            else { try { window.location.reload(); } catch (_) {} }
        }
    })();
};

// ============================================================================
// FEATURE MODULES
// ============================================================================

// ==========================================================================
// Dark Mode Toggle
// ==========================================================================

/**
 * Initialize Dark Mode Theme Management
 * 
 * Handles theme switching between light and dark modes with:
 * - System preference detection (prefers-color-scheme media query)
 * - LocalStorage persistence across sessions
 * - Manual toggle with immediate visual feedback
 * - Automatic theme sync on page loads
 * - Analytics tracking for theme changes
 * 
 * Theme state stored in:
 * - data-theme attribute on <html> element ("light" | "dark")
 * - localStorage key "theme" for persistence
 * - localStorage key "theme_manual" if user manually toggled
 * 
 * CSS Implementation:
 * - Uses [data-theme="dark"] selectors for dark mode styles
 * - Tailwind dark: variants work through theme.css overrides
 */
const initDarkMode = () => {
    const toggleButton = document.getElementById('theme-toggle');
    if (!toggleButton) return;

    // Check for system dark mode preference
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Check for saved theme preference or use system preference, fallback to light mode
    const savedTheme = localStorage.getItem('theme');
    const currentTheme = savedTheme || (prefersDarkMode ? 'dark' : 'light');
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Save the theme if it was auto-detected from system
    if (!savedTheme) {
        localStorage.setItem('theme', currentTheme);
    }

    // Set initial icon
    toggleButton.innerHTML = currentTheme === 'dark' ? '<span style="color: #e1d4c2">🔆</span>' : '<span style="color: #212842">🌙</span>';

    // Toggle theme function
    const toggleTheme = () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update icon
        toggleButton.innerHTML = newTheme === 'dark' ? '<span style="color: #e1d4c2">🔆</span>' : '<span style="color: #212842">🌙</span>';
        
        // Track analytics (both Clarity and GA4)
        if (typeof clarity === 'function') {
            clarity('event', 'theme_toggle', { theme: newTheme });
        }
        if (typeof gtag === 'function') {
            gtag('event', 'theme_toggle', {
                'event_category': 'user_preference',
                'event_label': newTheme
            });
        }
        
        // Update ARIA label
        toggleButton.setAttribute('aria-label', `Switch to ${theme} mode`);
    };

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem('theme_manual')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            toggleButton.innerHTML = newTheme === 'dark' ? '<span style="color: #e1d4c2">🔆</span>' : '<span style="color: #212842">🌙</span>';
        }
    });

    // Add event listeners for both click and touch
    toggleButton.addEventListener('click', () => {
        toggleTheme();
        // Mark that user has manually set theme preference
        localStorage.setItem('theme_manual', 'true');
    });
};

// ==========================================================================
// Mobile Menu Interaction
// ==========================================================================

/**
 * Initialize Mobile Menu Toggle
 * 
 * Manages hamburger menu for mobile/tablet viewports:
 * - Toggle menu visibility on button click
 * - Close menu when clicking outside
 * - Close menu when selecting a link
 * - ARIA attribute management for accessibility
 * - Icon rotation animation
 * 
 * Requires DOM elements:
 * - #mobile-menu-toggle button
 * - #mobile-menu navigation container
 */
const initMobileMenu = () => {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (!menuToggle || !mobileMenu) return;

    let scrollY = 0;
    let overlay = null;

    const ensureOverlay = () => {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.zIndex = '35';
        overlay.style.background = 'rgba(0,0,0,0.35)';
        overlay.addEventListener('click', () => closeMenu());
        return overlay;
    };

    const openMenu = () => {
        scrollY = window.scrollY;
        // Prevent background interaction while menu is open
        try {
            const ov = ensureOverlay();
            if (!ov.parentElement) document.body.appendChild(ov);
        } catch (e) {}

        mobileMenu.classList.remove('hidden');
        menuToggle.setAttribute('aria-expanded', 'true');
        // Lock scroll
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        
        const icon = menuToggle.querySelector('svg');
        if (icon) icon.style.transform = 'rotate(90deg)';
    };

    const closeMenu = () => {
        if (mobileMenu.classList.contains('hidden')) return;
        
        mobileMenu.classList.add('hidden');
        menuToggle.setAttribute('aria-expanded', 'false');

        if (overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }

        // Unlock scroll
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
        
        const icon = menuToggle.querySelector('svg');
        if (icon) icon.style.transform = 'rotate(0deg)';
    };

    const toggleMenu = () => {
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
        if (isExpanded) closeMenu();
        else openMenu();
    };

    menuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!menuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
            closeMenu();
        }
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    // Close on navigation
    window.addEventListener('hashchange', closeMenu);
    window.addEventListener('popstate', closeMenu);

    // Event delegation for links
    mobileMenu.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) {
            closeMenu();
        }
    });
};

// ========================================================================== 
// aria-current="page" for Navigation
// ==========================================================================

const initAriaCurrent = () => {
    const normalize = (p) => {
        try {
            if (!p) return '/';
            // Strip query/hash if present
            p = String(p).split('#')[0].split('?')[0];
            // Convert .html routes to clean URL form
            if (p.endsWith('.html')) p = p.slice(0, -5);
            // Remove trailing slash (except root)
            if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
            return p || '/';
        } catch (e) {
            return '/';
        }
    };

    const currentPath = normalize(window.location && window.location.pathname);
    const links = document.querySelectorAll('header a[href], #mobile-menu a[href]');
    links.forEach((a) => {
        try {
            const href = a.getAttribute('href');
            if (!href) return;
            // Ignore external links, mailto, hashes
            if (/^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href) || href.startsWith('#')) return;

            const linkPath = normalize(href);
            if (linkPath === currentPath) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        } catch (e) {}
    });
};

// ==========================================================================
// GSAP Animations
// ==========================================================================

/**
 * Initialize GSAP ScrollTrigger Animations
 * 
 * Manages scroll-triggered animations throughout the site:
 * - Fade-up animations for content elements ([data-gsap="fade-up"])
 * - Parallax effect on hero sections
 * - Card hover interactions
 * - Graceful degradation if GSAP not loaded
 * 
 * Configuration:
 * - Duration: 0.4s (faster animations per user feedback)
 * - Trigger point: top 92% (elements animate sooner)
 * - Easing: power2.out (snappy, responsive feel)
 * 
 * Performance:
 * - Elements start visible (opacity: 1) to prevent blank screens
 * - Only animates elements with [data-gsap] attribute
 * - Uses will-change and transform for GPU acceleration
 * 
 * @requires gsap.js
 * @requires ScrollTrigger plugin
 */
const initAnimations = () => {
    const isMobile = (typeof window !== 'undefined')
        && (typeof window.matchMedia === 'function')
        && window.matchMedia('(max-width: 768px)').matches;

    const prefersReducedMotion = (typeof window !== 'undefined')
        && (typeof window.matchMedia === 'function')
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const allAnimated = document.querySelectorAll('[data-gsap]');
    const revealWithoutAnimation = () => {
        allAnimated.forEach(el => {
            el.classList.remove('opacity-0', 'translate-y-8', 'translate-y-6', 'translate-y-4');
            el.dataset.gsapState = 'fallback-visible';
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.style.transform = 'none';
        });
    };

    // If GSAP unavailable, keep content visible and exit
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        console.warn('GSAP or ScrollTrigger not loaded; revealing content without animations.');
        revealWithoutAnimation();
        return;
    }

    // Reduced motion: keep layout stable (no transform-based entrance/scroll animations)
    if (prefersReducedMotion) {
        revealWithoutAnimation();
        return;
    }

    allAnimated.forEach((el) => {
        el.classList.remove('opacity-0', 'translate-y-8', 'translate-y-6', 'translate-y-4');
        el.style.removeProperty('opacity');
        el.style.removeProperty('visibility');
        el.style.removeProperty('transform');
    });

    // Register ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);
    if (typeof ScrollTrigger.getAll === 'function') {
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    }

    // Fade Up Animations
    const fadeElements = document.querySelectorAll('[data-gsap="fade-up"]');
    gsap.killTweensOf(fadeElements);
    
    fadeElements.forEach(element => {
        const delay = parseFloat(element.getAttribute('data-gsap-delay') || '0') * 0.5;
        const hadFallbackVisible = element.dataset.gsapState === 'fallback-visible';
        const rect = element.getBoundingClientRect();
        const keepVisibleFromFallback = hadFallbackVisible && rect.top < window.innerHeight;

        element.removeAttribute('data-gsap-state');

        // On mobile, do not re-hide elements that were already visible before GSAP loaded.
        if (keepVisibleFromFallback) {
            gsap.set(element, {
                autoAlpha: 1,
                y: 0,
                clearProps: 'opacity,visibility,transform'
            });
            return;
        }

        gsap.fromTo(element, {
            autoAlpha: 0,
            y: 20
        }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
            delay,
            ease: 'power2.out',
            clearProps: 'opacity,visibility,transform',
            onComplete: () => {
                element.style.opacity = '1';
                element.style.transform = 'none';
            },
            scrollTrigger: {
                trigger: element,
                start: 'top 92%',
                toggleActions: 'play none none none'
            }
        });
    });

    // Parallax effect for hero section (if exists)
    const heroSection = document.querySelector('section:first-of-type[data-hero-parallax="true"]');
    if (heroSection && !isMobile && !heroSection.classList.contains('no-parallax')) {
        gsap.to(heroSection, {
            yPercent: 20,
            ease: 'none',
            scrollTrigger: {
                trigger: heroSection,
                start: 'top top',
                end: 'bottom top',
                scrub: true
            }
        });
    }

    // Card hover animations
    const cards = document.querySelectorAll('.card-hover');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            gsap.to(card, { y: -8, duration: 0.3, ease: 'power2.out' });
        });
        card.addEventListener('mouseleave', () => {
            gsap.to(card, { y: 0, duration: 0.3, ease: 'power2.out' });
        });
    });
};

const loadGSAPAndInit = () => {
    const isMobile = (typeof window !== 'undefined') && (typeof window.matchMedia === 'function') && window.matchMedia('(max-width: 768px)').matches;
    
    const loadScripts = () => {
        if (window.gsap && window.ScrollTrigger) {
            initAnimations();
            return;
        }
        const gsapScript = document.createElement('script');
        gsapScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js';
        gsapScript.onload = () => {
            const stScript = document.createElement('script');
            stScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js';
            stScript.onload = () => {
                initAnimations();
            };
            document.body.appendChild(stScript);
        };
        document.body.appendChild(gsapScript);
    };

    if (isMobile) {
        // Mobile: Reveal content immediately (static)
        initAnimations();
        
        // Load GSAP on interaction
        const onInteraction = () => {
            ['scroll', 'touchstart', 'mousemove'].forEach(ev => window.removeEventListener(ev, onInteraction));
            loadScripts();
        };
        ['scroll', 'touchstart', 'mousemove'].forEach(ev => window.addEventListener(ev, onInteraction, { once: true, passive: true }));
    } else {
        // Desktop: Load GSAP immediately (content stays hidden until loaded)
        loadScripts();
    }
};

// ==========================================================================
// Smooth Scroll for Anchor Links
// ==========================================================================

const initSmoothScroll = () => {
    // Global handler for href="#" to prevent scroll jumps
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (!anchor) return;
        
        const href = anchor.getAttribute('href');
        
        // Strictly prevent default for "#" links
        if (href === '#') {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // Smooth scroll for internal anchors
        if (href && href.startsWith('#') && href.length > 1) {
            // Ignore if it's just a hash change for routing (if you had that)
            // But here we assume #id is a scroll target
            const targetElement = document.querySelector(href);
            if (targetElement) {
                e.preventDefault();
                const headerOffset = 100;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        }
    }, { passive: false });
};

// ==========================================================================
// Form Validation
// ==========================================================================

const initFormValidation = () => {
    const form = document.querySelector('form[action*="formspree.io"]');
    if (!form) return;

    const inputs = form.querySelectorAll('input, textarea, select');
    const fileInput = form.querySelector('input[type="file"][name="file"]');
    const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
    const ACCEPT_EXT = ['csv','doc','docx','pdf','txt','xls','xlsx','jpg','jpeg','png','gif','svg','webp'];
    const linkInput = form.querySelector('input[name="link"]');

    const isSafeUrl = (val) => {
        if (!val) return true;
        let trimmed = val.trim();

        // Automatically prepend https:// if missing
        if (!/^https?:\/\//i.test(trimmed)) {
            trimmed = `https://${trimmed}`;
        }

        let u;
        try {
            u = new URL(trimmed);
        } catch (_) {
            return false;
        }
        const banned = ['javascript:', 'data:', 'file:', 'blob:', 'chrome:', 'chrome-extension:'];
        if (banned.includes(u.protocol)) return false;
        return true;
    };

    // Update linkInput value on blur
    if (linkInput) {
        linkInput.addEventListener('blur', () => {
            if (linkInput.value && !/^https?:\/\//i.test(linkInput.value)) {
                linkInput.value = `https://${linkInput.value.trim()}`;
            }
        });
    }

    // Helper to show inline error
    const showError = (input, message) => {
        input.classList.add('border-red-500');
        let errorEl = input.parentElement.querySelector('.inline-error');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'inline-error text-xs text-red-600 mt-1';
            input.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
    };

    // Helper to clear inline error
    const clearError = (input) => {
        input.classList.remove('border-red-500');
        const errorEl = input.parentElement.querySelector('.inline-error');
        if (errorEl) errorEl.remove();
    };

    // Real-time validation for each input
    inputs.forEach(input => {
        // Validate on blur
        input.addEventListener('blur', () => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                showError(input, 'This field is required');
            } else if (input.type === 'email' && input.value && !input.checkValidity()) {
                showError(input, 'Please enter a valid email address');
            } else if (input.type === 'url' && input.value && !isSafeUrl(input.value)) {
                showError(input, 'Please enter a valid URL');
            } else if (!input.checkValidity()) {
                showError(input, input.validationMessage || 'Invalid input');
            } else {
                clearError(input);
            }
        });

        // Clear error as user types
        input.addEventListener('input', () => {
            if (input.classList.contains('border-red-500')) {
                // Re-validate on input to clear error when fixed
                if (input.checkValidity() && input.value.trim()) {
                    clearError(input);
                }
            }
        });
    });

    // Ensure a status container exists
    let status = form.querySelector('#form-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'form-status';
        status.className = 'text-sm mt-3';
        form.appendChild(status);
    }

    const setSubmitting = (submitting) => {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = submitting;
            btn.classList.toggle('loading', submitting);
        }
    };

    const submitForm = async () => {
        setSubmitting(true);
        status.textContent = '';
        try {
            const formData = new FormData(form);
            // Validate file if present
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const f = fileInput.files[0];
                const ext = (f.name.split('.').pop() || '').toLowerCase();
                if (!ACCEPT_EXT.includes(ext)) {
                    status.className = 'text-sm mt-3 text-red-700';
                    status.textContent = 'Unsupported file type. Please upload one of: CSV, DOC, DOCX, PDF, TXT, XLS, XLSX, JPG, JPEG, PNG, GIF, SVG, WEBP.';
                    setSubmitting(false);
                    return;
                }
                if (f.size > MAX_FILE_BYTES) {
                    status.className = 'text-sm mt-3 text-red-700';
                    status.textContent = 'File too large (max 5MB). Please upload a smaller file.';
                    setSubmitting(false);
                    return;
                }
            }
            // Validate link if present
            if (linkInput && linkInput.value && !isSafeUrl(linkInput.value)) {
                status.className = 'text-sm mt-3 text-red-700';
                status.textContent = 'Please enter a valid link starting with https:// or http://';
                setSubmitting(false);
                return;
            }
            const res = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' },
                mode: 'cors',
                credentials: 'omit'
            });
            if (res.ok) {
                form.reset();
                // Replace form with mini-game easter egg
                const card = form.parentElement;
                if (card) {
                    card.innerHTML = `
                        <h2 class="text-2xl font-bold text-indigodeep mb-2">Thanks - message sent!</h2>
                        <p class="text-sm text-chocolate mb-4">Enjoy a quick game while you're here.</p>
                        <div id="mini-game-root" class="w-full bg-white border border-chocolate/10 rounded-xl p-4"></div>
                    `;
                    initMiniGame('mini-game-root');
                }
            } else {
                status.className = 'text-sm mt-3 text-red-700';
                status.textContent = 'Sorry, something went wrong. Trying fallback...';
                // Fallback to normal submission (opens in new tab)
                try {
                    form.setAttribute('target', '_blank');
                    form.submit();
                } catch (_) {
                    // keep error visible
                    status.textContent = 'Sorry, something went wrong. Please try again or email hello@estivanayramia.com.';
                }
            }
        } catch (err) {
            status.className = 'text-sm mt-3 text-red-700';
            status.textContent = 'Network error detected. Opening fallback submit...';
            // Fallback to normal submission (opens in new tab)
            try {
                form.setAttribute('target', '_blank');
                form.submit();
            } catch (_) {
                status.textContent = 'Network error. Please check your connection or email hello@estivanayramia.com.';
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Form submission handling
    form.addEventListener('submit', (e) => {
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.checkValidity()) {
                isValid = false;
                input.classList.add('border-red-500');
            }
        });

        e.preventDefault();
        if (!isValid) {
                    // Focus on first invalid field (prevent scrolling the viewport)
                    const firstInvalid = form.querySelector('.border-red-500');
                    if (firstInvalid) {
                        try { firstInvalid.focus({ preventScroll: true }); } catch (e) { try { __logCollect && __logCollect('focus-fallback', { selector: firstInvalid.tagName + (firstInvalid.id ? '#'+firstInvalid.id : '' ) }); } catch(_){} firstInvalid.focus(); }
                    }
            status.className = 'text-sm mt-3 text-red-700';
            status.textContent = 'Please complete required fields highlighted in red.';
            return;
        }
        submitForm();
    });
};

// ==========================================================================
// Mini Game: Catch the Orbs
// ==========================================================================

const initMiniGame = (rootId) => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const highKey = 'mgHighScore';
    const lbKey = 'mgLeaderboard';
    const highScore = parseInt(localStorage.getItem(highKey) || '0', 10);
    const loadLeaderboard = () => {
        try {
            const raw = localStorage.getItem(lbKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(r => typeof r.name === 'string' && typeof r.score === 'number').slice(0, 25);
        } catch (_) { return []; }
    };
    const saveLeaderboard = (list) => {
        try { localStorage.setItem(lbKey, JSON.stringify(list.slice(0,25))); } catch (_) {}
    };
    let leaderboard = loadLeaderboard();

    root.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium text-indigodeep">Score: <span id="mg-score">0</span> <span id="mg-mult" class="ml-2 text-ink/60">x1</span></div>
            <div class="text-xs text-ink/60">Best: <span id="mg-best">${highScore}</span></div>
        </div>
        <div class="flex items-center justify-between mb-2">
            <div class="text-xs text-ink/60">Lives: <span id="mg-lives">❤❤❤</span></div>
            <button id="mg-start" class="text-xs bg-indigodeep text-white px-3 py-1 rounded-full">Start</button>
        </div>
        <canvas id="mg-canvas" class="w-full rounded border border-chocolate/10" style="touch-action: none; height: 320px;"></canvas>
        <p class="text-xs text-ink/60 mt-2">Catch the orbs. Golden orbs are bonus. Tap/drag on mobile, or use ◀ ▶.</p>
    `;

    const canvas = root.querySelector('#mg-canvas');
    const scoreEl = root.querySelector('#mg-score');
    const multEl = root.querySelector('#mg-mult');
    const bestEl = root.querySelector('#mg-best');
    const livesEl = root.querySelector('#mg-lives');
    const startBtn = root.querySelector('#mg-start');
    const ctx = canvas.getContext('2d');

    const DPR = window.devicePixelRatio || 1;
    const PADDLE_W = 90;
    const PADDLE_H = 12;

    const state = {
        running: false,
        score: 0,
        best: highScore,
        w: 0,
        h: 0,
        paddle: { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H },
        orbs: [],
        particles: [],
        lastSpawn: 0,
        orbInterval: 900,
        baseSpeed: 2.2,
        lives: 3,
        combo: 0,
        comboTimer: 0,
        shake: 0,
        t: 0
    };

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width * DPR);
        canvas.height = Math.floor(320 * DPR);
        state.w = canvas.width;
        state.h = canvas.height;
        state.paddle.y = state.h - 30 * DPR;
        if (state.paddle.x === 0) state.paddle.x = state.w / 2 - (state.paddle.w * DPR) / 2;
        draw();
    };

    const heartStr = (n) => '❤❤❤'.slice(0, n);
    const vibrate = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

    const addParticles = (x, y, color = '#212842', count = 10) => {
        for (let i = 0; i < count; i++) {
            state.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 3 * DPR,
                vy: (-Math.random()) * 3 * DPR,
                life: 600,
                color,
                r: 2 * DPR
            });
        }
    };

    const spawnOrb = () => {
        const r = (8 + Math.random() * 2) * DPR;
        const x = r + Math.random() * (state.w - 2*r);
        // 15% chance to be gold bonus orb
        const isGold = Math.random() < 0.15;
        const color = isGold ? '#eab308' : '#362017';
        const vy = (state.baseSpeed + Math.random()*1.5 + state.score*0.01) * DPR;
        state.orbs.push({ x, y: r+2, r, vy, color, type: isGold ? 'gold' : 'normal' });
    };

    const drawBackground = () => {
        const grad = ctx.createLinearGradient(0, 0, state.w, state.h);
        const h = (Math.sin(state.t*0.001) + 1) / 2; // 0..1
        grad.addColorStop(0, `rgba(${210 + 20*h | 0}, ${200 + 10*h | 0}, 180, 0.6)`);
        grad.addColorStop(1, `rgba(${200}, ${190}, ${170}, 0.6)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, state.w, state.h);
    };

    const draw = () => {
        const shakeX = state.shake ? (Math.random()*state.shake - state.shake/2) : 0;
        const shakeY = state.shake ? (Math.random()*state.shake - state.shake/2) : 0;
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0,0,state.w,state.h);
        ctx.translate(shakeX, shakeY);
        drawBackground();

        // paddle (glow if combo)
        const glow = Math.min(state.combo, 6);
        ctx.shadowColor = 'rgba(33,40,66,0.6)';
        ctx.shadowBlur = glow * 2 * DPR;
        ctx.fillStyle = '#212842';
        ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.w*DPR, state.paddle.h*DPR);
        ctx.shadowBlur = 0;

        // particles
        state.particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life/600);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        });

        // orbs
        state.orbs.forEach(o => {
            ctx.beginPath();
            ctx.fillStyle = o.color;
            ctx.shadowColor = o.type === 'gold' ? 'rgba(234,179,8,0.6)' : 'rgba(54,32,23,0.3)';
            ctx.shadowBlur = o.type === 'gold' ? 8*DPR : 4*DPR;
            ctx.arc(o.x, o.y, o.r, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    };

    const step = (ts) => {
        if (!state.running) return;
        if (!state.last) state.last = ts;
        const dt = ts - state.last;
        state.t += dt;
        state.last = ts;
        state.comboTimer += dt;
        if (state.comboTimer > 1600 && state.combo > 0) {
            state.combo = 0;
            multEl.textContent = 'x1';
        }
        if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.5*DPR);

        // spawn
        if (ts - state.lastSpawn > state.orbInterval) {
            spawnOrb();
            state.lastSpawn = ts;
            if (state.orbInterval > 420) state.orbInterval -= 8; // ramp difficulty
        }

        // update orbs
        const pw = state.paddle.w * DPR;
        const ph = state.paddle.h * DPR;
        const px = state.paddle.x;
        const py = state.paddle.y;
        state.orbs.forEach(o => { o.y += o.vy; });

        // particles update
        for (let i = state.particles.length-1; i>=0; i--) {
            const p = state.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.04*DPR; p.life -= dt;
            if (p.life <= 0) state.particles.splice(i,1);
        }

        // collisions and misses
        for (let i = state.orbs.length - 1; i >= 0; i--) {
            const o = state.orbs[i];
            if (o.y + o.r >= py && o.x >= px && o.x <= px + pw) {
                // caught
                const bonus = o.type === 'gold' ? 5 : 1;
                state.combo = Math.min(state.combo + 1, 9);
                state.comboTimer = 0;
                const mult = 1 + Math.floor(state.combo/3); // x1..x4
                state.score += bonus * mult;
                scoreEl.textContent = state.score;
                multEl.textContent = 'x' + mult;
                addParticles(o.x, py, o.color, o.type === 'gold' ? 18 : 10);
                state.shake = Math.min(6*DPR, state.shake + (o.type==='gold'?4:2));
                vibrate(o.type==='gold'?25:12);
                state.orbs.splice(i,1);
                // confetti on milestones
                if (state.score % 10 === 0) addParticles(o.x, o.y, '#e1d4c2', 24);
            } else if (o.y - o.r > state.h) {
                // missed
                state.orbs.splice(i,1);
                state.lives -= 1;
                livesEl.textContent = heartStr(state.lives);
                state.combo = 0; multEl.textContent = 'x1';
                state.shake = 10*DPR; vibrate(60);
                if (state.lives <= 0) { endGame(); return; }
            }
        }

        draw();
        requestAnimationFrame(step);
    };

    const endGame = () => {
        state.running = false;
        if (state.score > state.best) {
            state.best = state.score; localStorage.setItem(highKey, String(state.best));
            bestEl.textContent = state.best;
        }
        startBtn.textContent = 'Restart';
        const endMsg = document.createElement('div');
        endMsg.className = 'mt-3 text-sm text-indigodeep mg-end';
        endMsg.innerHTML = `
            <div class="mb-1 font-medium">Game over! Final score: ${state.score}</div>
            <p class="text-ink/80 mb-2">Hope you enjoyed this little easter egg - I'll be in touch soon.</p>
            <p class="text-ink/60">Want more surprises? Explore a few corners of the site:</p>
            <div class="mt-2 flex flex-wrap gap-2">
                <a href="overview.html" class="text-xs px-3 py-1 rounded-full border border-chocolate/20 text-indigodeep hover:bg-beige transition-colors">Overview</a>
                <a href="deep-dive.html" class="text-xs px-3 py-1 rounded-full border border-chocolate/20 text-indigodeep hover:bg-beige transition-colors">Deep Dive</a>
                <a href="projects.html" class="text-xs px-3 py-1 rounded-full border border-chocolate/20 text-indigodeep hover:bg-beige transition-colors">Projects</a>
            </div>
            ${state.score > 0 ? `<div class='mt-4 border-t border-chocolate/10 pt-3'>
                <p class='text-ink/70 mb-2'>Submit your score to the local leaderboard (device-only) or view current rankings.</p>
                <div class='flex flex-col sm:flex-row gap-2 sm:items-center'>
                    <input id='mg-name' maxlength='16' placeholder='Username (3-16 chars)' class='flex-1 px-3 py-2 text-sm border border-chocolate/20 rounded focus:outline-none focus:ring-2 focus:ring-indigodeep'/>
                    <button id='mg-save' class='text-xs bg-indigodeep text-white px-4 py-2 rounded-full'>Save Score</button>
                    <button id='mg-view' class='text-xs bg-chocolate text-white px-4 py-2 rounded-full'>View Leaderboard</button>
                </div>
                <div id='mg-name-error' class='mt-2 text-xs text-red-600 hidden'></div>
                <div id='mg-leaderboard' class='mt-3 hidden'></div>
            </div>`: ''}
        `;
        root.appendChild(endMsg);

        // Leaderboard logic
        const nameInput = endMsg.querySelector('#mg-name');
        const saveBtn = endMsg.querySelector('#mg-save');
        const viewBtn = endMsg.querySelector('#mg-view');
        const errorBox = endMsg.querySelector('#mg-name-error');
        const lbBox = endMsg.querySelector('#mg-leaderboard');

        if (!saveBtn || !viewBtn) return; // score == 0 case

        const banned = [
            'fuck','shit','bitch','cunt','dick','piss','cock','asshole','retard','fag','faggot','nigger','nigga','spic','chink','whore','slut','bastard','twat','rape','cum','penis','vagina'
        ];

        const normalize = (s) => s.toLowerCase()
            .replace(/[@]/g,'a').replace(/[$]/g,'s').replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t');

        const isClean = (s) => {
            const norm = normalize(s).replace(/[_-]/g,'');
            return !banned.some(b => norm.includes(b));
        };

        const validPattern = /^[A-Za-z0-9_-]{3,16}$/;

        const renderLeaderboard = () => {
            if (!lbBox) return;
            let html = `<table class='w-full text-xs'><thead><tr class='text-indigodeep'><th class='text-left pb-1'>#</th><th class='text-left pb-1'>User</th><th class='text-right pb-1'>Score</th></tr></thead><tbody>`;
            leaderboard.slice(0,10).forEach((r,i) => {
                html += `<tr class='border-t border-chocolate/10'><td class='py-1 pr-2'>${i+1}</td><td class='py-1 pr-2'>${r.name}</td><td class='py-1 text-right'>${r.score}</td></tr>`;
            });
            if (leaderboard.length === 0) html += `<tr><td colspan='3' class='py-2 text-ink/60'>No scores yet.</td></tr>`;
            html += `</tbody></table>`;
            lbBox.innerHTML = html;
        };

        viewBtn.addEventListener('click', () => {
            lbBox.classList.toggle('hidden');
            if (!lbBox.classList.contains('hidden')) {
                renderLeaderboard();
                viewBtn.textContent = 'Hide Leaderboard';
            } else {
                viewBtn.textContent = 'View Leaderboard';
            }
        });

        saveBtn.addEventListener('click', () => {
            const name = (nameInput.value || '').trim();
            if (!validPattern.test(name)) {
                errorBox.textContent = 'Username must be 3-16 chars: letters, numbers, _ or - only.';
                errorBox.classList.remove('hidden');
                return;
            }
            if (!isClean(name)) {
                errorBox.textContent = 'Please choose a different name (profanity not allowed).';
                errorBox.classList.remove('hidden');
                return;
            }
            errorBox.classList.add('hidden');
            leaderboard.push({ name, score: state.score, ts: Date.now() });
            leaderboard.sort((a,b) => b.score - a.score || a.ts - b.ts);
            leaderboard = leaderboard.slice(0,25);
            saveLeaderboard(leaderboard);
            renderLeaderboard();
            lbBox.classList.remove('hidden');
            viewBtn.textContent = 'Hide Leaderboard';
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saved';
        });
    };

    const start = () => {
        // reset
        state.running = true;
        state.score = 0; scoreEl.textContent = '0';
        state.orbs = []; state.particles = [];
        state.lastSpawn = 0; state.orbInterval = 900; state.baseSpeed = 2.2;
        state.lives = 3; livesEl.textContent = heartStr(3);
        state.combo = 0; multEl.textContent = 'x1';
        state.t = 0; state.shake = 0;
        [...root.querySelectorAll('.mg-end')].forEach(n => n.remove());
        requestAnimationFrame(step);
    };

    // Controls
    const moveTo = (clientX) => {
        const rect = canvas.getBoundingClientRect();
        let x = (clientX - rect.left) * DPR - (state.paddle.w * DPR)/2;
        x = Math.max(0, Math.min(x, state.w - state.paddle.w*DPR));
        state.paddle.x = x;
    };
    canvas.addEventListener('mousemove', (e) => moveTo(e.clientX));
    canvas.addEventListener('touchstart', (e) => { if (e.touches[0]) moveTo(e.touches[0].clientX); }, {passive:true});
    canvas.addEventListener('touchmove', (e) => { if (e.touches[0]) moveTo(e.touches[0].clientX); }, {passive:true});
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') moveTo((canvas.getBoundingClientRect().left + (state.paddle.x/DPR)) - 24);
        if (e.key === 'ArrowRight') moveTo((canvas.getBoundingClientRect().left + (state.paddle.x/DPR)) + 24);
    });

    startBtn.addEventListener('click', () => {
        startBtn.textContent = 'Playing...';
        start();
    });

    window.addEventListener('resize', resize);
    resize();
    draw();
};

// ==========================================================================
// Lazy Loading
// ==========================================================================

const initLazyLoading = () => {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    } else {
        // Fallback for older browsers
        images.forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
};

// ======================================================================
// Progressive PDF Preview Loader
// ======================================================================

/**
 * Initialize Progressive PDF Preview System
 * 
 * Attempts to display PDF previews inline using iframes with:
 * - Stable background placeholder during loading
 * - Smooth fade-in transition when ready
 * - Graceful fallback if PDF cannot be embedded
 * - No flashing or jarring visual changes
 * 
 * How it works:
 * 1. Finds all .preview-panel elements
 * 2. Locates associated PDF link in same section
 * 3. Creates hidden iframe with opacity: 0
 * 4. Shows loading spinner overlay
 * 5. On iframe load, fades in PDF smoothly (0.3s transition)
 * 6. On error/timeout, shows friendly fallback message
 * 
 * Browser Compatibility:
 * - Some browsers block iframe embedding of PDFs
 * - Hosting providers may block cross-origin framing
 * - Fallback message guides users to open/download buttons
 * 
 * Performance:
 * - 3-second timeout for slow connections
 * - 100ms render delay after load for content stability
 * - Uses CSS transitions for smooth UX
 */
const initPdfPreviews = () => {
    try {
        document.querySelectorAll('.preview-panel').forEach(panel => {
            try {
                const section = panel.closest('section') || panel.parentElement;
                if (!section) return;
                // find first PDF link within the same section
                const pdfLink = section.querySelector('a[href$=".pdf"]');
                if (!pdfLink) return;
                const pdfUrl = pdfLink.href;

                // Mark as loaded so other scripts don't try to load it again
                panel.dataset.pdfLoaded = 'true';

                // helper to show fallback message
                const showFallback = (reason) => {
                    try {
                        panel.innerHTML = '<div class="rounded-xl border border-chocolate/20 bg-white/40 overflow-hidden p-8 text-center"><p class="text-sm text-chocolate/70">Inline PDF preview may be blocked by hosting or browser settings. Use the buttons below to open or download the deck.</p></div>';
                        __logCollect && __logCollect('pdf.preview.fallback', { url: pdfUrl, reason: reason });
                    } catch (e) {}
                };

                // prepare placeholder / spinner with stable background
                panel.innerHTML = '<div class="py-12 bg-white/30 rounded-xl border border-chocolate/10 flex items-center justify-center min-h-[480px]">\n  <div class="text-sm text-chocolate/60 flex items-center gap-2"><svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Loading preview…</div>\n</div>';

                // create iframe but keep it hidden until load confirmed
                const iframe = document.createElement('iframe');
                iframe.setAttribute('aria-label', 'PDF preview');
                iframe.style.cssText = 'width:100%;height:480px;border:0;border-radius:12px;background:#fff;opacity:0;position:absolute;top:0;left:0;';
                iframe.referrerPolicy = 'strict-origin-when-cross-origin';
                
                // Set panel to relative positioning for absolute iframe
                panel.style.position = 'relative';
                panel.style.minHeight = '480px';

                let loaded = false;
                let settled = false;
                
                const finalize = (success) => {
                    if (settled) return;
                    settled = true;
                    
                    if (success) {
                        // Smoothly fade in the iframe
                        iframe.style.position = 'relative';
                        iframe.style.opacity = '1';
                        iframe.style.transition = 'opacity 0.3s ease';
                        // Remove placeholder
                        const placeholder = panel.querySelector('div');
                        if (placeholder) placeholder.remove();
                        __logCollect && __logCollect('pdf.preview.loaded', { url: pdfUrl });
                    } else {
                        try { iframe.remove(); } catch(_){}
                        showFallback('load_failed');
                    }
                };

                iframe.addEventListener('load', () => {
                    loaded = true;
                    // Give it a moment to actually render content
                    setTimeout(() => finalize(true), 100);
                });
                
                iframe.addEventListener('error', () => finalize(false));

                // attempt to set src
                try {
                    iframe.src = pdfUrl;
                    panel.appendChild(iframe);
                    __logCollect && __logCollect('pdf.preview.attempt', { url: pdfUrl });
                } catch (e) {
                    finalize(false);
                    return;
                }

                // fallback timeout: if not loaded within 5s, assume success (browser swallowed load event)
                setTimeout(() => {
                    if (!loaded) finalize(true);
                }, 5000);
            } catch (e) {}
        });
    } catch (e) {}
};

// ==========================================================================
// Scroll to Top Button
// ==========================================================================

const initScrollToTop = () => {
    const scrollBtn = document.getElementById('scroll-to-top');
    if (!scrollBtn) return;
    const progressCircle = scrollBtn.querySelector('.scroll-progress-circle');

    let ringCircumference = 0;

    const updateProgressRing = () => {
        if (!progressCircle || ringCircumference <= 0) return;

        const pageHeight = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const progress = pageHeight <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / pageHeight));
        progressCircle.style.strokeDashoffset = String(ringCircumference * (1 - progress));
    };

    const initializeProgressRing = () => {
        if (!progressCircle) return;

        const radius = parseFloat(progressCircle.getAttribute('r') || progressCircle.r?.baseVal?.value || '0');
        ringCircumference = radius > 0 ? 2 * Math.PI * radius : 0;
        if (ringCircumference <= 0) return;

        progressCircle.style.strokeDasharray = String(ringCircumference);
        progressCircle.style.strokeDashoffset = String(ringCircumference);
        updateProgressRing();
    };

    // Show/hide button based on scroll position.
    const toggleButton = () => {
        const pageHeight = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const scrollThreshold = pageHeight * 0.25;
        const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;

        if (currentScroll > scrollThreshold) {
            scrollBtn.classList.add('show');
            scrollBtn.style.setProperty('opacity', '1', 'important');
            scrollBtn.style.setProperty('visibility', 'visible', 'important');
            scrollBtn.style.setProperty('pointer-events', 'auto', 'important');
        } else {
            scrollBtn.classList.remove('show');
            scrollBtn.style.setProperty('opacity', '0', 'important');
            scrollBtn.style.setProperty('visibility', 'hidden', 'important');
            scrollBtn.style.setProperty('pointer-events', 'none', 'important');
        }

        updateProgressRing();
    };

    // Scroll to top smoothly
    const scrollToTop = () => {
        // Track analytics (both Clarity and GA4)
        if (typeof clarity === 'function') {
            clarity('event', 'scroll_to_top_clicked');
        }
        if (typeof gtag === 'function') {
            gtag('event', 'scroll_to_top', {
                'event_category': 'navigation',
                'event_label': 'button_click'
            });
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // Event listeners
    window.addEventListener('scroll', toggleButton);
    window.addEventListener('resize', () => {
        initializeProgressRing();
        toggleButton();
    });
    scrollBtn.addEventListener('click', scrollToTop);

    // Check initial position
    initializeProgressRing();
    toggleButton();
};

// ==========================================================================
// Achievement System
// ==========================================================================
// Translation System for Achievements and Easter Eggs
// ==========================================================================

const getCurrentLanguage = () => {
    return document.documentElement.lang || 'en';
};

const translations = {
    // Achievement notification text
    achievement: {
        en: {
            unlocked: 'Achievement Unlocked!',
            explorer: { name: 'Explorer', description: 'Visited all main pages' },
            reader: { name: 'Deep Diver', description: 'Read the full Deep Dive' },
            gamer: { name: 'Game Master', description: 'Played the contact form game' },
            chatter: { name: 'Conversationalist', description: 'Opened the chat' },
            nightOwl: { name: 'Night Owl', description: 'Toggled dark mode' },
            konami: { name: 'Secret Discoverer', description: 'Found the Konami code' },
            networker: { name: 'Networker', description: 'Visited social profiles' },
            formFiller: { name: 'Messenger', description: 'Submitted the contact form' }
        },
        es: {
            unlocked: '¡Logro Desbloqueado!',
            explorer: { name: 'Explorador', description: 'Visitó todas las páginas principales' },
            reader: { name: 'Buzo Profundo', description: 'Leyó la inmersión completa' },
            gamer: { name: 'Maestro del Juego', description: 'Jugó el juego del formulario de contacto' },
            chatter: { name: 'Conversador', description: 'Abrió el chat' },
            nightOwl: { name: 'Noctámbulo', description: 'Alternó el modo oscuro' },
            konami: { name: 'Descubridor Secreto', description: 'Encontró el código Konami' },
            networker: { name: 'Redactor', description: 'Visitó perfiles sociales' },
            formFiller: { name: 'Mensajero', description: 'Envió el formulario de contacto' }
        },
        ar: {
            unlocked: 'تم إلغاء قفل الإنجاز!',
            explorer: { name: 'المستكشف', description: 'زار جميع الصفحات الرئيسية' },
            reader: { name: 'الغواص العميق', description: 'قرأ الغوص الكامل' },
            gamer: { name: 'سيد اللعبة', description: 'لعب لعبة نموذج الاتصال' },
            chatter: { name: 'المحادث', description: 'فتح الدردشة' },
            nightOwl: { name: 'بومة الليل', description: 'بدّل الوضع المظلم' },
            konami: { name: 'المكتشف السري', description: 'وجد رمز كونامي' },
            networker: { name: 'الشبكي', description: 'زار الملفات الشخصية الاجتماعية' },
            formFiller: { name: 'الرسول', description: 'أرسل نموذج الاتصال' }
        }
    },
    // Konami code messages
    konami: {
        en: {
            title: '🎮 You found the secret!',
            message: 'Congratulations! You\'ve unlocked the Konami code.',
            giftText: 'Click the gift for a surprise!',
            stats: 'You\'re one of the {percent}% who found this!',
            compliments: [
                "You're absolutely amazing! 🌟",
                "You're a coding wizard! 🧙‍♂️",
                "You're incredibly talented! 🎨",
                "You're a problem-solving genius! 🧠",
                "You're making the world better! 🌍",
                "You're a creative powerhouse! ⚡",
                "You're inspiring others! 💫",
                "You're a true innovator! 🚀",
                "You're exceptionally skilled! 🏆",
                "You're a digital artist! 🎭",
                "You're building something incredible! 🏗️",
                "You're a technology trailblazer! 🗺️",
                "You're exceptionally creative! 🎨",
                "You're a user experience master! 🎯",
                "You're a design virtuoso! 🎨"
            ]
        },
        es: {
            title: '🎮 ¡Encontraste el secreto!',
            message: '¡Felicitaciones! Has desbloqueado el código Konami.',
            giftText: '¡Haz clic en el regalo para una sorpresa!',
            stats: '¡Eres uno del {percent}% que encontró esto!',
            compliments: [
                "¡Eres absolutamente increíble! 🌟",
                "¡Eres un mago de la programación! 🧙‍♂️",
                "¡Eres increíblemente talentoso! 🎨",
                "¡Eres un genio para resolver problemas! 🧠",
                "¡Estás haciendo el mundo mejor! 🌍",
                "¡Eres una potencia creativa! ⚡",
                "¡Estás inspirando a otros! 💫",
                "¡Eres un verdadero innovador! 🚀",
                "¡Eres excepcionalmente hábil! 🏆",
                "¡Eres un artista digital! 🎭",
                "¡Estás construyendo algo increíble! 🏗️",
                "¡Eres un pionero de la tecnología! 🗺️",
                "¡Eres excepcionalmente creativo! 🎨",
                "¡Eres un maestro de la experiencia del usuario! 🎯",
                "¡Eres un virtuoso del diseño! 🎨"
            ]
        },
        ar: {
            title: '🎮 لقد وجدت السر!',
            message: 'تهانينا! لقد قمت بفتح رمز كونامي.',
            giftText: 'انقر على الهدية للحصول على مفاجأة!',
            stats: 'أنت واحد من {percent}% الذين وجدوا هذا!',
            compliments: [
                "أنت رائع تماماً! 🌟",
                "أنت ساحر برمجة! 🧙‍♂️",
                "أنت موهوب بشكل لا يصدق! 🎨",
                "أنت عبقري في حل المشكلات! 🧠",
                "أنت تجعل العالم أفضل! 🌍",
                "أنت قوة إبداعية! ⚡",
                "أنت تلهم الآخرين! 💫",
                "أنت مبتكر حقيقي! 🚀",
                "أنت ماهر بشكل استثنائي! 🏆",
                "أنت فنان رقمي! 🎭",
                "أنت تبني شيئاً مذهلاً! 🏗️",
                "أنت رائد تكنولوجيا! 🗺️",
                "أنت مبدع بشكل استثنائي! 🎨",
                "أنت خبير في تجربة المستخدم! 🎯",
                "أنت فنان تصميم! 🎨"
            ]
        }
    },
    // Chat messages and suggestions
    chat: {
        welcome: {
            en: "Hello! I am Savonie. Ask me anything about Estivan.",
            es: "¡Hola! Soy Savonie. Pregúntame cualquier cosa sobre Estivan.",
            ar: "مرحباً! أنا سافوني. اسألني أي شيء عن استيفان."
        },
        defaultChips: {
            en: [
                "What does Estivan do?",
                "Tell me about his background",
                "What are his skills?",
                "How can I contact him?"
            ],
            es: [
                "¿Qué hace Estivan?",
                "Háblame de su experiencia",
                "¿Cuáles son sus habilidades?",
                "¿Cómo puedo contactarlo?"
            ],
            ar: [
                "ماذا يفعل استيفان؟",
                "أخبرني عن خلفيته",
                "ما هي مهاراته؟",
                "كيف يمكنني الاتصال به؟"
            ]
        },
        contextualSuggestions: {
            en: {
                skills: ["What projects have you worked on?", "Tell me about your experience", "What are you learning currently?"],
                background: ["What are your main skills?", "Tell me about your education", "What industries have you worked in?"],
                projects: ["Can you show me your code?", "What technologies did you use?", "How long did it take to build?"],
                contact: ["Are you available for freelance work?", "What's your typical response time?", "Do you work remotely?"],
                education: ["What certifications do you have?", "What's your favorite programming language?", "How do you stay updated with technology?"],
                projectResponse: ["Can you tell me more about that project?", "What challenges did you face?", "What did you learn from it?"],
                skillResponse: ["How did you learn that?", "Have you used it in projects?", "What's your proficiency level?"],
                early: ["What are your main skills?", "Tell me about your background", "What projects are you proud of?"]
            },
            es: {
                skills: ["¿En qué proyectos has trabajado?", "Háblame de tu experiencia", "¿Qué estás aprendiendo actualmente?"],
                background: ["¿Cuáles son tus principales habilidades?", "Háblame de tu educación", "¿En qué industrias has trabajado?"],
                projects: ["¿Puedes mostrarme tu código?", "¿Qué tecnologías usaste?", "¿Cuánto tiempo tomó construirlo?"],
                contact: ["¿Estás disponible para trabajo freelance?", "¿Cuál es tu tiempo típico de respuesta?", "¿Trabajas de forma remota?"],
                education: ["¿Qué certificaciones tienes?", "¿Cuál es tu lenguaje de programación favorito?", "¿Cómo te mantienes actualizado con la tecnología?"],
                projectResponse: ["¿Puedes contarme más sobre ese proyecto?", "¿Qué desafíos enfrentaste?", "¿Qué aprendiste de ello?"],
                skillResponse: ["¿Cómo aprendiste eso?", "¿Lo has usado en proyectos?", "¿Cuál es tu nivel de competencia?"],
                early: ["¿Cuáles son tus principales habilidades?", "Háblame de tu experiencia", "¿De qué proyectos estás orgulloso?"]
            },
            ar: {
                skills: ["ما هي المشاريع التي عملت عليها؟", "أخبرني عن تجربتك", "ماذا تتعلم حالياً؟"],
                background: ["ما هي مهاراتك الرئيسية؟", "أخبرني عن تعليمك", "في أي صناعات عملت؟"],
                projects: ["هل يمكنك إظهار كودك؟", "ما هي التقنيات التي استخدمتها؟", "كم من الوقت استغرق بناؤه؟"],
                contact: ["هل أنت متاح للعمل الحر؟", "ما هو وقت ردك المعتاد؟", "هل تعمل عن بعد؟"],
                education: ["ما هي الشهادات التي لديك؟", "ما هو لغة البرمجة المفضلة لديك؟", "كيف تحافظ على تحديث نفسك بالتكنولوجيا؟"],
                projectResponse: ["هل يمكنك إخباري المزيد عن هذا المشروع؟", "ما هي التحديات التي واجهتها؟", "ماذا تعلمت منه؟"],
                skillResponse: ["كيف تعلمت ذلك؟", "هل استخدمته في مشاريع؟", "ما هو مستوى مهارتك؟"],
                early: ["ما هي مهاراتك الرئيسية؟", "أخبرني عن خلفيتك", "ما هي المشاريع التي تفخر بها؟"]
            }
        }
    }
};

// ==========================================================================

const initAchievements = () => {
    const STORAGE_KEY = 'portfolio_achievements';
    
    // Achievement definitions (now using translations)
    const achievements = {
        explorer: { id: 'explorer', icon: '🗺️' },
        reader: { id: 'reader', icon: '📖' },
        gamer: { id: 'gamer', icon: '🎮' },
        chatter: { id: 'chatter', icon: '💬' },
        nightOwl: { id: 'nightOwl', icon: '🌙' },
        konami: { id: 'konami', icon: '🎯' },
        networker: { id: 'networker', icon: '🔗' },
        formFiller: { id: 'formFiller', icon: '✉️' }
    };

    // Get achievements from storage
    const getAchievements = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    };

    // Save achievements to storage
    const saveAchievements = (unlocked) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
        } catch {}
    };

    // Unlock achievement
    const unlock = (achievementId) => {
        const unlocked = getAchievements();
        if (unlocked[achievementId]) return; // Already unlocked
        
        const lang = getCurrentLanguage();
        const t = translations.achievement[lang] || translations.achievement.en;
        const translatedAchievement = {
            ...achievements[achievementId],
            ...(t && t[achievementId] ? t[achievementId] : {})
        };
        
        unlocked[achievementId] = {
            unlockedAt: new Date().toISOString(),
            ...translatedAchievement
        };
        saveAchievements(unlocked);
        showAchievementNotification(translatedAchievement);

        // Also mirror to arcade achievements store so the Arcade Achievements drawer
        // can show site achievements consistently.
        try {
            const key = 'arcade_achievements';
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(list) && !list.includes(achievementId)) {
                list.push(achievementId);
                localStorage.setItem(key, JSON.stringify(list));
            }
            if (window.ArcadeAchievements && typeof window.ArcadeAchievements.updateUI === 'function') {
                window.ArcadeAchievements.updateUI();
            }
        } catch {}
    };

    // Show achievement notification
    const showAchievementNotification = (achievement) => {
        const lang = getCurrentLanguage();
        const t = translations.achievement[lang] || translations.achievement.en;

        const toObj = (a) => {
            if (!a) return {};
            if (typeof a === 'string') return { id: a };
            if (typeof a === 'object') return a;
            return {};
        };

        const a = toObj(achievement);
        const rawId = a.id || a.achievementId || a.key;
        const id = typeof rawId === 'string' ? rawId : '';
        const normalizedId = id.replace(/^site_/, '');

        let resolved = {
            icon: a.icon,
            name: a.name || a.title,
            description: a.description || a.desc
        };

        // If we were only given an id (or missing details), try to resolve from ArcadeAchievements
        if ((!resolved.name || !resolved.description || !resolved.icon) && id && window.ArcadeAchievements && typeof window.ArcadeAchievements.getDefinitions === 'function') {
            const defs = window.ArcadeAchievements.getDefinitions();
            const def = defs && defs[id];
            if (def) {
                resolved = {
                    icon: resolved.icon || def.icon,
                    name: resolved.name || def.title || def.name,
                    description: resolved.description || def.description || def.desc
                };
            }
        }

        // Resolve site translations by id as a last resort
        if ((!resolved.name || !resolved.description) && t && normalizedId && t[normalizedId]) {
            resolved = {
                icon: resolved.icon || (achievements[normalizedId] && achievements[normalizedId].icon),
                name: resolved.name || t[normalizedId].name,
                description: resolved.description || t[normalizedId].description
            };
        }

        const safeIcon = resolved.icon || '🏆';
        const safeName = resolved.name || 'Achievement';
        const safeDesc = resolved.description || '';
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">${safeIcon}</div>
            <div class="achievement-content">
                <div class="achievement-title">${(t && t.unlocked) ? t.unlocked : 'Achievement Unlocked!'}</div>
                <div class="achievement-name">${safeName}</div>
                <div class="achievement-desc">${safeDesc}</div>
            </div>
            <button class="achievement-close" aria-label="Close achievement notification">×</button>
        `;
        document.body.appendChild(notification);

        // Close button functionality
        const closeButton = notification.querySelector('.achievement-close');
        const closeNotification = () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        };
        
        closeButton.addEventListener('click', closeNotification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 4 seconds (unless manually closed)
        const autoCloseTimeout = setTimeout(() => {
            if (document.body.contains(notification)) {
                closeNotification();
            }
        }, 4000);

        // Clear auto-close if manually closed
        closeButton.addEventListener('click', () => clearTimeout(autoCloseTimeout));
    };

    // Track page visits
    const trackPageVisit = () => {
        const visitedKey = 'portfolio_visited_pages';
        try {
            const visited = JSON.parse(localStorage.getItem(visitedKey) || '[]');
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            if (!visited.includes(currentPage)) {
                visited.push(currentPage);
                localStorage.setItem(visitedKey, JSON.stringify(visited));
            }

            // Check if all main pages visited
            const mainPages = ['index.html', 'overview.html', 'deep-dive.html', 'about.html', 'projects.html', 'contact.html'];
            const visitedAll = mainPages.every(page => visited.includes(page));
            if (visitedAll) unlock('explorer');

            // Check specific pages
            if (currentPage === 'deep-dive.html') unlock('reader');
        } catch {}
    };

    // Track dark mode toggle
    const trackDarkMode = () => {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => unlock('nightOwl'));
        }
    };

    // Track external links (social profiles)
    const trackExternalLinks = () => {
        document.querySelectorAll('a[href*="linkedin.com"], a[href*="github.com"]').forEach(link => {
            link.addEventListener('click', () => unlock('networker'));
        });
    };

    // Initialize tracking
    trackPageVisit();
    trackDarkMode();
    trackExternalLinks();

    // Expose unlock function globally for form submission
    window.unlockAchievement = unlock;
};

// ==========================================================================
// Konami Code Easter Egg
// ==========================================================================

const initKonamiCode = () => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    const triggerEasterEgg = () => {
        // Dispatch custom event for analytics tracking
        window.dispatchEvent(new Event('konami-activated'));
        
        // Unlock achievement
        if (window.unlockAchievement) {
            window.unlockAchievement('konami');
        }

        // Get current language translations
        const lang = getCurrentLanguage();
        const konamiText = translations.konami[lang];

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'konami-modal';
        modal.innerHTML = `
            <div class="konami-content">
                <div class="konami-header">
                    <h2>${konamiText.title}</h2>
                    <button class="konami-close" aria-label="Close">&times;</button>
                </div>
                <div class="konami-body">
                    <p class="konami-message">${konamiText.message}</p>
                    <div class="konami-gift">
                        <div class="gift-emoji">🎁</div>
                        <p class="gift-text">${konamiText.giftText}</p>
                        <div class="compliment-container" style="display: none;">
                            <p class="compliment-text"></p>
                        </div>
                    </div>
                    <div class="konami-stats">
                        <p>${konamiText.stats.replace('{percent}', Math.floor(Math.random() * 10) + 1)}</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => modal.classList.add('show'), 100);

        // Gift click functionality
        const giftEmoji = modal.querySelector('.gift-emoji');
        const complimentContainer = modal.querySelector('.compliment-container');
        const complimentText = modal.querySelector('.compliment-text');
        const giftText = modal.querySelector('.gift-text');

        const compliments = konamiText.compliments;

        giftEmoji.addEventListener('click', () => {
            // Hide gift emoji and text
            giftEmoji.style.display = 'none';
            giftText.style.display = 'none';

            // Show random compliment
            const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
            complimentText.textContent = randomCompliment;
            complimentContainer.style.display = 'block';

            // Add opening animation
            giftEmoji.classList.add('gift-opened');

            // Trigger confetti
            createConfetti();

            // Add sparkle effect
            setTimeout(() => {
                complimentContainer.classList.add('sparkle');
            }, 500);
        });

        // Close handlers
        const close = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };
        modal.querySelector('.konami-close').addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    };

    // Confetti function
    const createConfetti = () => {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe', '#fd79a8', '#e17055'];
        const confettiCount = 50;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            document.body.appendChild(confetti);

            // Remove confetti after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, 5000);
        }
    };

    // Listen for Konami code
    document.addEventListener('keydown', (e) => {
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                konamiIndex = 0;
                triggerEasterEgg();
            }
        } else {
            konamiIndex = 0;
        }
    });
};

// ==========================================================================
// PWA Service Worker Registration
// ==========================================================================

const initPWA = () => {
    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
        let hasController = !!navigator.serviceWorker.controller;
        let refreshing = false;

        // Avoid forcing a reload the very first time a SW takes control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!hasController) {
                    hasController = true;
                    return;
                }
                // Do NOT auto-reload on SW updates.
                // Auto-reloads can interrupt in-page UI (like the contact success-game).
                // The new SW will take effect naturally on next navigation/load.
                if (refreshing) return;
                refreshing = true;
        });

        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {

                    // Best-effort: check for updates at most once per session.
                    try {
                        const key = 'sw_last_update_ts';
                        const now = Date.now();
                        const last = parseInt(sessionStorage.getItem(key) || '0', 10);
                        if (!Number.isFinite(last) || now - last > 6 * 60 * 60 * 1000) {
                            sessionStorage.setItem(key, String(now));
                            registration.update().catch(() => {});
                        }
                    } catch (e) {}
                })
                .catch((error) => {
                    // Service worker registration failed - continue without it
                });
        });
    }

    // Prompt to install PWA
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Optionally show install button (you can add this to your UI)
    });
};

// ==========================================================================
// ANALYTICS EVENT TRACKING
// ==========================================================================
//
// This module sends CUSTOM EVENTS to analytics services (GA4 & Clarity).
// Analytics initialization is handled by lazy-loader.js on first user interaction.
//
// Events tracked:
// - Button clicks (CTAs, contact links)
// - Navigation clicks (page navigation)
// - Social media links (LinkedIn, GitHub)
// - Form submissions
// - Scroll depth milestones (25%, 50%, 75%, 100%)
// - Theme toggles (light/dark mode)
//
// All analytics calls are defensive (checks if functions exist before calling).
// This ensures no errors if analytics fail to load or are blocked by ad blockers.
//
// ==========================================================================

/**
 * Analytics debug hook intentionally kept as a no-op in production.
 * @param {string} tag - Event name
 * @param {Object} payload - Optional event data
 */
const trackEventDebug = () => {};

/**
 * Initialize custom analytics event tracking
 * Called after DOM is ready to attach event listeners
 */
const initAnalytics = () => {
    // Track button clicks with custom labels
    const trackClick = (element, label) => {
        const eventName = `button_click_${label}`;
        trackEventDebug(eventName);
        
        // Send to Clarity
        if (typeof clarity === 'function') {
            clarity('event', eventName);
        }
        
        // Send to GA4
        if (typeof gtag === 'function') {
            gtag('event', 'button_click', {
                'event_category': 'engagement',
                'event_label': label
            });
        }
    };

    // Track all CTA buttons
    document.querySelectorAll('a[href*="contact"], button[type="submit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const label = btn.textContent.trim().replace(/\s+/g, '_').toLowerCase();
            trackClick(btn, label);
        });
    });

    // Track navigation clicks
    document.querySelectorAll('nav a').forEach((link) => {
        link.addEventListener('click', () => {
            const page = link.getAttribute('href') || 'unknown';
            trackEventDebug('navigation_click', { page });
            
            // Send to Clarity
            if (typeof clarity === 'function') {
                clarity('event', 'navigation_click', { page });
            }
            
            // Send to GA4
            if (typeof gtag === 'function') {
                gtag('event', 'navigation_click', {
                    'event_category': 'navigation',
                    'event_label': page
                });
            }
        });
    });

    // Track social media clicks
    document.querySelectorAll('a[href*="linkedin.com"], a[href*="github.com"]').forEach((link) => {
        link.addEventListener('click', () => {
            const platform = link.href.includes('linkedin') ? 'linkedin' : 'github';
            trackEventDebug('social_click', { platform });
            
            // Send to Clarity
            if (typeof clarity === 'function') {
                clarity('event', 'social_click', { platform });
            }
            
            // Send to GA4
            if (typeof gtag === 'function') {
                gtag('event', 'social_click', {
                    'event_category': 'social',
                    'event_label': platform
                });
            }
        });
    });

    // Track form submissions
    const form = document.querySelector('form[action*="formspree.io"]');
    if (form) {
        form.addEventListener('submit', () => {
            trackEventDebug('form_submission');
            
            // Send to Clarity
            if (typeof clarity === 'function') {
                clarity('event', 'form_submission');
            }
            
            // Send to GA4
            if (typeof gtag === 'function') {
                gtag('event', 'form_submission', {
                    'event_category': 'engagement',
                    'event_label': 'contact_form'
                });
            }
        });
    }

    // Track scroll depth milestones (25%, 50%, 75%, 100%)
    let maxScrollDepth = 0;
    let scrollEventsLogged = { 25: false, 50: false, 75: false, 100: false };
    
    window.addEventListener('scroll', () => {
        const scrollDepth = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
        
        if (scrollDepth > maxScrollDepth) {
            maxScrollDepth = scrollDepth;
            
            // Check each milestone and fire once
            if (maxScrollDepth >= 25 && !scrollEventsLogged[25]) {
                scrollEventsLogged[25] = true;
                trackEventDebug('scroll_25_percent');
                
                if (typeof clarity === 'function') {
                    clarity('event', 'scroll_25_percent');
                }
                if (typeof gtag === 'function') {
                    gtag('event', 'scroll', {
                        'event_category': 'engagement',
                        'event_label': '25_percent'
                    });
                }
            }
            
            if (maxScrollDepth >= 50 && !scrollEventsLogged[50]) {
                scrollEventsLogged[50] = true;
                trackEventDebug('scroll_50_percent');
                
                if (typeof clarity === 'function') {
                    clarity('event', 'scroll_50_percent');
                }
                if (typeof gtag === 'function') {
                    gtag('event', 'scroll', {
                        'event_category': 'engagement',
                        'event_label': '50_percent'
                    });
                }
            }
            if (maxScrollDepth >= 75 && !scrollEventsLogged[75]) {
                scrollEventsLogged[75] = true;
                trackEventDebug('scroll_75_percent');
                
                if (typeof clarity === 'function') {
                    clarity('event', 'scroll_75_percent');
                }
                if (typeof gtag === 'function') {
                    gtag('event', 'scroll', {
                        'event_category': 'engagement',
                        'event_label': '75_percent'
                    });
                }
            }
            
            if (maxScrollDepth >= 100 && !scrollEventsLogged[100]) {
                scrollEventsLogged[100] = true;
                trackEventDebug('scroll_100_percent');
                
                if (typeof clarity === 'function') {
                    clarity('event', 'scroll_100_percent');
                }
                if (typeof gtag === 'function') {
                    gtag('event', 'scroll', {
                        'event_category': 'engagement',
                        'event_label': '100_percent'
                    });
                }
            }
        }
    });

    // Track Konami code usage (easter egg)
    window.addEventListener('konami-activated', () => {
        trackEventDebug('konami_code_activated');
        
        if (typeof clarity === 'function') {
            clarity('event', 'konami_code_activated');
        }
        if (typeof gtag === 'function') {
            gtag('event', 'easter_egg', {
                'event_category': 'engagement',
                'event_label': 'konami_code'
            });
        }
    });

    // Track achievement unlocks
    const originalUnlock = window.unlockAchievement;
    if (originalUnlock) {
        window.unlockAchievement = (...args) => {
            const achievementId = args.length > 1 ? args[1] : args[0];
            trackEventDebug('achievement_unlocked', { achievement: achievementId });
            
            if (typeof clarity === 'function') {
                clarity('event', 'achievement_unlocked', { achievement: achievementId });
            }
            if (typeof gtag === 'function') {
                gtag('event', 'achievement_unlock', {
                    'event_category': 'gamification',
                    'event_label': achievementId
                });
            }
            
            originalUnlock.apply(window, args);
        };
    }
};

// ==========================================================================
// Performance Monitoring (LCP)
// ==========================================================================

const initPerformanceMonitoring = () => {
    // Monitor Largest Contentful Paint
    if ('PerformanceObserver' in window) {
        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                
                // Send to Clarity
                if (typeof clarity === 'function') {
                    clarity('set', 'lcp', Math.round(lastEntry.renderTime || lastEntry.loadTime));
                }
                
                // Warn if LCP is poor (> 2.5s)
                const lcp = lastEntry.renderTime || lastEntry.loadTime;
                if (lcp > 2500) {
                    console.warn('Poor LCP detected:', lcp, 'ms');
                }
            });
            
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
            // Performance monitoring not supported
        }
    }

    // Monitor Core Web Vitals
    if ('web-vital' in window) {
        // First Input Delay (FID)
        try {
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    const fid = entry.processingStart - entry.startTime;
                    if (typeof clarity === 'function') {
                        clarity('set', 'fid', Math.round(fid));
                    }
                });
            });
            fidObserver.observe({ type: 'first-input', buffered: true });
        } catch (e) {}

        // Cumulative Layout Shift (CLS)
        try {
            let clsScore = 0;
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsScore += entry.value;
                    }
                }
                if (typeof clarity === 'function') {
                    clarity('set', 'cls', clsScore.toFixed(4));
                }
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {}
    }
};

// ==========================================================================
// Phase 2: Enhanced Functionality
// ==========================================================================

const initPhase2 = () => {
    // A. Email Interceptor - Use Event Delegation
    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="mailto:"]');
        if (!link) return;
        
        e.preventDefault();
        
        // Extract email from href
        const email = link.href.replace('mailto:', '').split('?')[0];
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).then(() => {
                // Visual feedback: change text if link has inner text
                if (link.innerText || link.textContent) {
                    const originalText = link.innerText || link.textContent;
                    link.innerText = 'Copied! ✅';
                    
                    // Revert after 2 seconds
                    setTimeout(() => {
                        link.innerText = originalText;
                    }, 2000);
                }
            }).catch(() => {
                // Fallback: open mailto if clipboard fails
                window.location.href = link.href;
            });
        } else {
            // Fallback: open mailto if clipboard API not available
            window.location.href = link.href;
        }
    });
    
    // B. Copyright Year Update
    try {
        const yearEl = document.getElementById('copyright-year');
        if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    } catch (e) {}

    // Back-compat for older footer markup
    try {
        const footerYear = document.querySelector('footer p.text-xs');
        if (footerYear) {
            const currentYear = new Date().getFullYear();
            footerYear.innerHTML = footerYear.innerHTML.replace(/&copy;\s*\d{4}/, `&copy; ${currentYear}`);
        }
    } catch (e) {}
    
    // C. Honeypot Check on Contact Form
    const contactForm = document.querySelector('form[action*="formspree"]');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            const honeypot = contactForm.querySelector('input[name="website_url"]');
            if (honeypot && honeypot.value) {
                // Bot detected - prevent submission
                e.preventDefault();
                return false;
            }
        });
    }
};

// ==========================================================================
// Initialization
// ==========================================================================

const __isEnglishChromePage = () => {
    try {
        const lang = (document.documentElement && document.documentElement.lang) ? document.documentElement.lang.toLowerCase() : 'en';
        const path = (window.location && window.location.pathname) ? window.location.pathname : '/';
        if (path.startsWith('/es/') || path.startsWith('/ar/')) return false;
        return lang === 'en';
    } catch (e) {
        return false;
    }
};

const __ensureStandardEnglishChrome = () => {
    if (!__isEnglishChromePage()) return;

    // Header: inject only if missing (avoid clobbering per-page scripts)
    try {
        const hasStandardHeader = !!document.querySelector('header #brand-logo, header #mobile-menu-toggle');
        if (!hasStandardHeader) {
            const header = document.createElement('header');
            header.className = 'fixed top-0 left-0 right-0 z-40 bg-beige/95 backdrop-blur-sm border-b border-chocolate/10';
            header.innerHTML = `
        <nav class="max-w-7xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between gap-2">
            <a href="/index.html" id="brand-logo" class="text-lg sm:text-xl font-semibold text-indigodeep hover:text-chocolate transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded inline-flex items-center shrink min-w-0" aria-label="Go to Portfolio home page">
                <img src="/assets/img/logo-ea.webp" alt="Estivan Ayramia logo" class="h-8 w-8 mr-2 object-contain shrink-0" width="300" height="264" fetchpriority="high">
                <span translate="no" class="notranslate truncate">Estivan Ayramia</span>
            </a>
            
            <!-- Main Navigation -->
            <ul class="hidden md:flex items-center space-x-8">
                <li><a href="/index.html" class="text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded" data-nav-key="home">Home</a></li>
                <li><a href="/projects.html" class="text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded" data-nav-key="projects">Projects</a></li>
                <li><a href="/overview.html" class="text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded" data-nav-key="overview">Overview</a></li>
                <li><a href="/deep-dive.html" class="text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded" data-nav-key="deep-dive">Deep Dive</a></li>
                <li><a href="/about.html" class="text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded" data-nav-key="about">About</a></li>
                <li><a href="/contact.html" class="text-sm font-medium text-beige bg-indigodeep border border-white/20 px-5 py-2 rounded-full hover:bg-chocolate transition-colors dark:bg-indigodeep dark:text-beige dark:hover:bg-white dark:hover:text-indigodeep dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige" data-nav-key="contact">Contact</a></li>
            </ul>
            
            <!-- Language Switcher -->
            <div id="lang-switcher" class="flex items-center space-x-3 shrink-0" style="z-index: 20;">
                <a href="#" class="text-xs font-semibold text-indigodeep underline focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded" data-lang-key="en">EN</a>
                <a href="/es/index.html" class="text-xs text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded">ES</a>
                <a href="/ar/index.html" class="text-xs text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded">AR</a>
            </div>
            
            <!-- Dark Mode Toggle -->
            <button type="button" id="theme-toggle" class="text-base font-medium text-beige bg-indigodeep border border-white/20 px-5 py-2 rounded-full hover:bg-chocolate transition-colors dark:bg-indigodeep dark:text-beige dark:hover:bg-white dark:hover:text-indigodeep dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige" aria-label="Switch to light mode"><span style="color: #e1d4c2">🔆</span></button>
            
            <!-- Mobile Menu Toggle -->
            <button type="button" id="mobile-menu-toggle" class="md:hidden text-chocolate focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded p-2" aria-label="Toggle mobile menu" aria-expanded="false">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
            </button>
        </nav>
        
        <!-- Mobile Menu -->
        <div id="mobile-menu" class="hidden md:hidden border-t border-chocolate/10 bg-beige">
            <ul class="px-6 py-4 space-y-3">
                <li><a href="/index.html" class="block text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded py-2" data-nav-key="home">Home</a></li>
                <li><a href="/projects.html" class="block text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded py-2" data-nav-key="projects">Projects</a></li>
                <li><a href="/overview.html" class="block text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded py-2" data-nav-key="overview">Overview</a></li>
                <li><a href="/deep-dive.html" class="block text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded py-2" data-nav-key="deep-dive">Deep Dive</a></li>
                <li><a href="/about.html" class="block text-sm text-chocolate hover:text-indigodeep transition-colors focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige rounded py-2" data-nav-key="about">About</a></li>
                <li><a href="/contact.html" class="block text-sm font-medium text-beige bg-indigodeep border border-white/20 px-5 py-2 rounded-full hover:bg-chocolate transition-colors text-center dark:bg-indigodeep dark:text-beige dark:hover:bg-white dark:hover:text-indigodeep dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-indigodeep focus:ring-offset-2 focus:ring-offset-beige" data-nav-key="contact">Contact</a></li>
            </ul>
        </div>
            `;

            if (document.body) {
                document.body.insertBefore(header, document.body.firstChild);
            }

            // Ensure content isn't hidden under fixed header
            const hasMainPad = !!document.querySelector('main.pt-24');
            if (!hasMainPad) {
                document.body && document.body.classList && document.body.classList.add('pt-24');
            }

            // Set EN link to current English path
            try {
                const enLink = header.querySelector('[data-lang-key="en"]');
                if (enLink) {
                    const p = window.location.pathname || '/';
                    enLink.href = (p === '/' ? '/index.html' : p);
                }
            } catch (e) {}
        }
    } catch (e) {}

    // Footer: inject only if missing
    try {
        const hasFooter = !!document.querySelector('footer.bg-indigodeep.text-beige.py-12');
        if (!hasFooter) {
            const footer = document.createElement('footer');
            footer.className = 'bg-indigodeep text-beige py-12';
            footer.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 lg:px-12">
            <div class="grid md:grid-cols-3 gap-12 mb-12">
                <div class="space-y-4">
                    <a href="/" class="flex items-center space-x-3 mb-4 hover:opacity-80 transition-opacity">
                        <img src="/assets/img/logo-ea.webp" alt="Estivan Ayramia logo" class="h-12 w-12 object-contain" width="300" height="264">
                        <h3 class="text-xl font-semibold text-white">Estivan Ayramia</h3>
                    </a>
                    <p class="text-sm text-beige/80 leading-relaxed">Chaldean from El Cajon. General Business graduate from SDSU. Building systems, working with people, and turning chaos into clean execution.</p>
                </div>
                <div class="space-y-4">
                    <h3 class="text-sm font-semibold text-white uppercase tracking-wider">Quick Links</h3>
                    <ul class="space-y-2">
                        <li><a href="/overview.html" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">Overview</a></li>
                        <li><a href="/deep-dive.html" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">Deep Dive</a></li>
                        <li><a href="/projects/" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">Projects</a></li>
                        <li><a href="/about.html" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">About</a></li>
                    </ul>
                </div>
                <div class="space-y-4">
                    <h3 class="text-sm font-semibold text-white uppercase tracking-wider">Connect</h3>
                    <ul class="space-y-2">
                        <li><a href="https://www.linkedin.com/in/estivanayramia" target="_blank" rel="noopener noreferrer" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">LinkedIn ↗</a></li>
                        <li><a href="https://github.com/estivanayramia/" target="_blank" rel="noopener noreferrer" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">GitHub ↗</a></li>
                        <li><a href="/contact.html" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">Contact</a></li>
                        <li><a href="/assets/docs/Estivan-Ayramia-Resume.pdf" download="" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">Resume (PDF)</a></li>
                        <li><a href="/privacy.html" class="text-sm text-beige/80 hover:text-white inline-block transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigodeep rounded">Privacy Policy</a></li>
                    </ul>
                </div>
            </div>
            <div class="border-t border-beige/20 pt-8 text-center">
                <p class="text-sm text-beige/80">© <span id="copyright-year">2025</span> Estivan Ayramia. All rights reserved.</p>
            </div>
        </div>
            `;
            document.body && document.body.appendChild(footer);
        }
    } catch (e) {}
};

const __arcadeStorageKey = 'site_played_games_v1';

const __safeJsonParse = (val, fallback) => {
    try {
        return JSON.parse(val);
    } catch (e) {
        return fallback;
    }
};

const __getPlayedGames = () => {
    try {
        const raw = localStorage.getItem(__arcadeStorageKey);
        const data = __safeJsonParse(raw, {});
        return (data && typeof data === 'object') ? data : {};
    } catch (e) {
        return {};
    }
};

const __setPlayedGames = (obj) => {
    try {
        localStorage.setItem(__arcadeStorageKey, JSON.stringify(obj || {}));
    } catch (e) {}
};

const __normalizePath = (p) => {
    try {
        return (p || '/').replace(/\/+$/, '') || '/';
    } catch (e) {
        return '/';
    }
};

const __getCurrentGameId = () => {
    try {
        const filter = document.body && document.body.getAttribute('data-arcade-achievements-filter');
        if (filter && /^mini_/.test(filter)) return filter.replace(/^mini_/, '');
        if (filter && /^arcade_/.test(filter)) return filter.replace(/^arcade_/, '');

        const path = __normalizePath(window.location.pathname || '/');

        // /hobbies-games/<slug> or /hobbies-games/<slug>.html
        const hg = path.match(/^\/hobbies-games\/(.+)$/);
        if (hg && hg[1]) return hg[1].replace(/\.html$/i, '');

        // /<name>.html
        const base = path.split('/').pop() || '';
        if (base.endsWith('.html')) return base.replace(/\.html$/i, '');
        return null;
    } catch (e) {
        return null;
    }
};

const __markGamePlayed = (gameId) => {
    if (!gameId) return;
    try {
        const played = __getPlayedGames();
        played[gameId] = { lastPlayedAt: Date.now() };
        __setPlayedGames(played);
    } catch (e) {}
};

const __hashString = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
};

const __mulberry32 = (seed) => {
    let t = seed >>> 0;
    return function() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

const __shuffleInPlace = (arr, rnd) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const __GAME_CATALOG = [
    { id: 'snake', href: '/snake.html', emoji: '🐍', title: 'Snake', subtitle: 'Classic growth game' },
    { id: 'breaker', href: '/breaker.html', emoji: '🧱', title: 'Block Breaker', subtitle: 'Smash the bricks' },
    { id: '2048', href: '/2048.html', emoji: '🧩', title: '2048', subtitle: 'Merge the numbers' },
    { id: 'invaders', href: '/invaders.html', emoji: '👾', title: 'Space Invaders', subtitle: 'Defend the earth' },
    { id: 'racer', href: '/hobbies-games/racer.html', emoji: '🏎️', title: 'Racer', subtitle: 'Fast reflex racing' },
    { id: 'oh-flip', href: '/hobbies-games/oh-flip.html', emoji: '🤸', title: 'Oh Flip', subtitle: 'Timing + tricks' },
    { id: 'onoff', href: '/hobbies-games/onoff.html', emoji: '⚡', title: 'ON/OFF', subtitle: 'Switch-based puzzle' },
    { id: '1024-moves', href: '/hobbies-games/1024-moves.html', emoji: '🧠', title: '1024 Moves', subtitle: 'Move-limited strategy' },
    { id: 'back-attacker', href: '/hobbies-games/back-attacker.html', emoji: '🛡️', title: 'Back Attacker', subtitle: 'Survive the attacks' },
    { id: 'nano-wirebot', href: '/hobbies-games/nano-wirebot.html', emoji: '🤖', title: 'Nano Wirebot', subtitle: 'Precision platforming' },
    { id: 'off-the-line', href: '/hobbies-games/off-the-line.html', emoji: '🧷', title: 'Off The Line', subtitle: 'Don’t cross the line' },
    { id: 'pizza-undelivery', href: '/hobbies-games/pizza-undelivery.html', emoji: '🍕', title: 'Pizza Undelivery', subtitle: 'Fast food chaos' },
    { id: 'the-matr13k', href: '/hobbies-games/the-matr13k.html', emoji: '🧬', title: 'The Matr13k', subtitle: 'Pattern puzzle' },
    { id: 'triangle-back-to-home', href: '/hobbies-games/triangle-back-to-home.html', emoji: '🔺', title: 'Triangle: Back to Home', subtitle: 'Geometry adventure' },
    { id: 'xx142-b2exe', href: '/hobbies-games/xx142-b2exe.html', emoji: '🧪', title: 'XX142-B2EXE', subtitle: 'Experimental arcade' }
];

const __renderSuggestionGrid = (gridEl, opts) => {
    if (!gridEl) return;

    const count = (opts && opts.count) ? opts.count : 6;
    const currentId = (opts && opts.currentId) ? opts.currentId : null;

    const played = __getPlayedGames();
    const now = Date.now();

    const candidates = __GAME_CATALOG.filter(g => g && g.id && g.href && g.id !== currentId);
    const unplayed = candidates.filter(g => !played[g.id]);
    const playedList = candidates.filter(g => !!played[g.id]);

    // Rotate / randomize: daily seed + per-page increment
    const day = Math.floor(now / 86400000);
    const n = parseInt(sessionStorage.getItem('site_suggest_nonce') || '0', 10) || 0;
    sessionStorage.setItem('site_suggest_nonce', String(n + 1));
    const seed = (day * 1000) + n + __hashString(String(window.location.pathname || '/'));
    const rnd = __mulberry32(seed);

    __shuffleInPlace(unplayed, rnd);
    // Prefer least-recently-played among played ones, then shuffle within similar recency
    playedList.sort((a, b) => {
        const ta = (played[a.id] && played[a.id].lastPlayedAt) ? played[a.id].lastPlayedAt : 0;
        const tb = (played[b.id] && played[b.id].lastPlayedAt) ? played[b.id].lastPlayedAt : 0;
        return ta - tb;
    });
    // Light shuffle for variety while keeping recency bias
    __shuffleInPlace(playedList, rnd);

    const chosen = [];
    for (const g of unplayed) {
        if (chosen.length >= count) break;
        chosen.push(g);
    }
    for (const g of playedList) {
        if (chosen.length >= count) break;
        chosen.push(g);
    }

    const tileClass = 'flex flex-col items-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all group border border-white/5 hover:border-white/20';
    const emojiClass = 'text-4xl mb-3 group-hover:scale-110 transition-transform';

    gridEl.innerHTML = chosen.map(g => `
        <a href="${g.href}" class="${tileClass}" data-game-id="${g.id}">
            <div class="${emojiClass}">${g.emoji || '🎮'}</div>
            <div class="font-bold text-sm">${g.title || g.id}</div>
            <div class="text-xs opacity-60 mt-1">${g.subtitle || ''}</div>
        </a>
    `).join('');
};

const __initDynamicGameSuggestions = () => {
    try {
        const currentId = __getCurrentGameId();
        if (currentId) __markGamePlayed(currentId);

        // Find any existing "quick links" grids by matching the tile style
        const grids = new Set();
        document.querySelectorAll('a[class*="bg-white/5"][class*="rounded-xl"][class*="hover:bg-white/10"]').forEach(a => {
            const grid = a.closest('.grid');
            if (grid) grids.add(grid);
        });

        grids.forEach(grid => {
            // Only touch grids that look like the game quick-links (6 tiles typically)
            const links = grid.querySelectorAll('a');
            if (!links || links.length < 4) return;
            __renderSuggestionGrid(grid, { count: 6, currentId });
        });
    } catch (e) {}
};

const init = () => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            __ensureStandardEnglishChrome();
            initDarkMode();
            initAriaCurrent();
            initMobileMenu();
            __initDynamicGameSuggestions();
            loadGSAPAndInit();
            initSmoothScroll();
            initFormValidation();
            initLazyLoading();
            initScrollToTop();
            initPdfPreviews();
            initAchievements();
            initKonamiCode();
            initPWA();
            initAnalytics();
            initPerformanceMonitoring();
            initPhase2(); // Phase 2: Enhanced Functionality
        });
    } else {
        // DOM already loaded
        __ensureStandardEnglishChrome();
        initDarkMode();
        initAriaCurrent();
        initMobileMenu();
        __initDynamicGameSuggestions();
        loadGSAPAndInit();
        initSmoothScroll();
        initFormValidation();
        initLazyLoading();
        initScrollToTop();
        initPdfPreviews();
        initAchievements();
        initKonamiCode();
        initPWA();
        initAnalytics();
        initPerformanceMonitoring();
        initPhase2(); // Phase 2: Enhanced Functionality
    }
};

// Start the site
init();

// ==========================================================================
// Savonie AI Chatbot Integration
// ==========================================================================

/**
 * Savonie AI Chatbot System
 * 
 * Interactive AI assistant powered by Cloudflare Workers:
 * - Context-aware responses about portfolio projects
 * - Dynamic suggestion chips based on page content
 * - Draggable chat window for better UX
 * - Session history with localStorage persistence
 * - Voice input support (Web Speech API)
 * - Project card rendering with images
 * - Multi-language support (EN, AR, ES)
 * 
 * Architecture:
 * - Frontend: Native JavaScript with DOM manipulation
 * - Backend: Cloudflare Worker at portfolio-chat.eayramia.workers.dev
 * - Storage: localStorage for chat history and preferences
 * 
 * Features:
 * - Contextual chip suggestions that adapt to conversation
 * - Visual project cards with links
 * - Typing indicators for AI responses
 * - Markdown support in messages
 * - Auto-scroll to latest message
 * - Welcome message on first visit
 * 
 * Accessibility:
 * - ARIA labels and live regions
 * - Keyboard navigation support
 * - Focus management
 * - Screen reader friendly
 * 
 * @requires DOM elements: chat-widget, chat-window, chat-messages, etc.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ======================================================================
    // Configuration
    // ======================================================================
    
    const CHAT_ENDPOINT = (() => {
        const explicitEndpoint = document.documentElement.getAttribute('data-chat-endpoint') || window.__SAVONIE_CHAT_ENDPOINT;
        if (explicitEndpoint) {
            return explicitEndpoint;
        }

        const host = window.location.hostname;
        if (/^(?:www\.)?estivanayramia\.com$/i.test(host)) {
            return `${window.location.origin}/chat`;
        }
        return 'https://portfolio-chat.eayramia.workers.dev/chat';
    })();
    const RESUME_URL = '/assets/docs/Estivan-Ayramia-Resume.pdf';
    const LINKEDIN_URL = 'https://www.linkedin.com/in/estivanayramia';
    const WELCOME_DELAY = 2500;

    // Project Data Mapping
    const projectData = {
        logistics: {
            title: 'Logistics System',
            summary: 'A systems-focused project centered on execution, coordination, and operational clarity.',
            img: '/assets/img/project-logistics.jpg',
            link: '/projects/logistics'
        },
        conflict: {
            title: 'Conflict Playbook',
            summary: 'A practical framework for navigating conflict with structure, empathy, and outcomes.',
            img: '/assets/img/project-conflict.jpg',
            link: '/deep-dive#conflict'
        },
        discipline: {
            title: 'Discipline Routine',
            summary: 'A repeatable routine and mindset system for sustainable discipline and follow-through.',
            img: '/assets/img/project-discipline.jpg',
            link: '/projects/discipline'
        },
        website: {
            title: 'Portfolio Website',
            summary: 'The site you’re on—built for speed, clarity, and a clean browsing experience.',
            img: '/assets/img/og-image.png',
            link: '/'
        }
    };

    // ======================================================================
    // DOM Element References
    // ======================================================================
    // Note: Using 'domElements' (abbreviated as 'els' for brevity in this large function)
    
    const els = {
        widget: document.getElementById('chat-widget'),
        window: document.getElementById('chat-window'),
        header: document.getElementById('chat-header'),
        messages: document.getElementById('chat-messages'),
        input: document.getElementById('chat-input'),
        sendBtn: document.getElementById('send-btn'),
        toggleBtn: document.getElementById('chat-toggle'),
        closeBtn: document.getElementById('close-chat'),
        bubble: document.getElementById('welcome-bubble'),
        chipsContainer: document.getElementById('chat-chips'),
        suggestionsBtn: document.getElementById('suggestions-btn'),
        // New: stable selectors for suggestion controls
        suggestionsContainer: document.querySelector('[data-chat-suggestions="container"]'),
        suggestionsToggle: document.querySelector('[data-chat-suggestions-toggle="button"]'),
        suggestionsClose: null // Will be set dynamically when X button is created
    };

    /* Scroll progress fallback: set --scroll-scale on .scroll-progress for browsers
       that do not support scroll-linked animation timelines. */
    (function registerScrollProgressFallback() {
        try {
            if (window.CSS && CSS.supports && CSS.supports('animation-timeline','scroll()')) return;
        } catch (e) {}

        const el = document.querySelector('.scroll-progress');
        if (!el) return;

        let ticking = false;

        function update() {
            const doc = document.documentElement;
            const scrollTop = window.scrollY || doc.scrollTop || 0;
            const docHeight = Math.max((doc.scrollHeight || document.body.scrollHeight || 0) - window.innerHeight, 0);
            const frac = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
            el.style.setProperty('--scroll-scale', frac);
            ticking = false;
        }

        const schedule = function() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        };

        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule, { passive: true });

        // Initial sync
        requestAnimationFrame(update);
    })();

    // Position widget based on language
    const pageLang = document.documentElement.lang || 'en';
    if (pageLang === 'ar' && els.widget) {
        els.widget.style.left = '1rem';
        els.widget.style.right = 'auto';
        if (els.bubble) {
            els.bubble.style.left = '1rem';
            els.bubble.style.right = 'auto';
        }
    } else if (els.widget) {
        els.widget.style.right = '1rem';
        els.widget.style.left = 'auto';
        if (els.bubble) {
            els.bubble.style.right = '1rem';
            els.bubble.style.left = 'auto';
        }
    }

    // State
    let chatHistory = [];
    let isSending = false; // Prevent duplicate sends
    let isInitialized = false;

    const historyStorageKey = `savonie_history:${pageLang}:${window.location.pathname || '/'}`;
    const MAX_HISTORY_ITEMS = 50;

    function buildSafePageContext() {
        try {
            const parts = [];
            const path = window.location.pathname || '/';
            parts.push(`path: ${path}`);
            parts.push(`title: ${document.title || ''}`);
            const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            if (metaDescription) {
                parts.push(`description: ${metaDescription}`);
            }

            const headings = Array.from(document.querySelectorAll('h1, h2'))
                .map((h) => (h.textContent || '').trim())
                .filter(Boolean)
                .slice(0, 10);

            if (headings.length) {
                parts.push('headings:');
                headings.forEach((t) => parts.push(`- ${t}`));
            }

            const combined = parts.join('\n');
            // Cap to ~3.5k chars to avoid leaking too much content.
            return combined.length > 3500 ? combined.slice(0, 3500) : combined;
        } catch (e) {
            return `${window.location.pathname || '/'} | ${document.title || ''}`;
        }
    }

    function buildStructuredPageContext() {
        try {
            const headings = Array.from(document.querySelectorAll('h1, h2'))
                .map((h) => (h.textContent || '').trim())
                .filter(Boolean)
                .slice(0, 10);

            return {
                route: window.location.pathname || '/',
                title: document.title || '',
                buildVersion: document.querySelector('meta[name="build-version"]')?.getAttribute('content') || '',
                description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
                headings,
                text: buildSafePageContext()
            };
        } catch (e) {
            return {
                route: window.location.pathname || '/',
                title: document.title || '',
                buildVersion: '',
                description: '',
                headings: [],
                text: buildSafePageContext()
            };
        }
    }
    
    // Helper function to add close button to chips container - DEPRECATED (handled by renderChips)
    // function addChipsCloseButton() { ... }

    // Fix: Suggestions Toggle Button Logic - DEPRECATED (handled by main listener below)
    // if (els.suggestionsBtn) { ... }
    
    // 1. Initialize - restore history from session
    try { 
        const saved = sessionStorage.getItem(historyStorageKey);
        if (saved) {
            chatHistory = JSON.parse(saved);
            chatHistory.forEach((item) => {
                if (item && item.kind === 'card') {
                    addCardToUI(item.cardId);
                    return;
                }

                if (!item || item.kind !== 'text') return;

                const div = document.createElement('div');
                const userClass = 'bg-[#212842] text-white rounded-tr-none self-end ml-auto';
                const botClass = 'bg-white text-[#362017] rounded-tl-none border border-[#362017]/5 self-start';
                div.className = `p-3 rounded-lg shadow-sm max-w-[85%] mb-3 text-sm leading-relaxed ${item.sender === 'user' ? userClass : botClass}`;
                if (item.sender === 'bot') {
                    div.replaceChildren(renderBotContent(item.text));
                } else {
                    div.textContent = item.text;
                }
                els.messages?.appendChild(div);
            });
            // Scroll to bottom after loading history (with delay to ensure DOM is ready)
            setTimeout(() => {
                if (els.messages) {
                    els.messages.scrollTop = els.messages.scrollHeight;
                }
            }, 100);
        }
    } catch(e) {}
    
    // Add welcome message only if no history
    if (chatHistory.length === 0) {
        const currentLang = document.documentElement.lang || 'en';
        const welcomeMessage = translations.chat.welcome[currentLang] || "Hello! I am Savonie. Ask me anything about Estivan.";
        addMessageToUI(welcomeMessage, 'bot', false);
    }

    // Always update chips based on current language, regardless of history
    if (els.chipsContainer) {
        const currentLang = document.documentElement.lang || 'en';
        const defaultChips = translations.chat.defaultChips[currentLang] || translations.chat.defaultChips['en'];
        
        renderChips(defaultChips);
    }

    syncHomeProofStats();
    initPageCloseFloatingUiGuard();
    
    isInitialized = true;

    // 2. Welcome Bubble Timer (only show twice max)
    const bubbleShowCount = parseInt(sessionStorage.getItem('savonie_bubble_count') || '0');
    if (bubbleShowCount < 2) {
        setTimeout(() => {
            if (els.window?.classList.contains('hidden') && chatHistory.length === 0) {
                els.bubble?.classList.remove('opacity-0', 'translate-y-4');
                els.bubble?.classList.add('opacity-100', 'translate-y-0');
                sessionStorage.setItem('savonie_bubble_count', (bubbleShowCount + 1).toString());
            }
        }, WELCOME_DELAY);
    }

    // 3. Event Listeners
    els.toggleBtn?.addEventListener('click', toggleChat);
    els.closeBtn?.addEventListener('click', toggleChat);
    els.sendBtn?.addEventListener('click', handleSend);
    els.input?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;

        const isTextArea = (e.target && e.target.tagName === 'TEXTAREA');
        if (isTextArea && e.shiftKey) return; // newline

        e.preventDefault();
        handleSend();
    });
    
    // ======================================================================
    // SUGGESTIONS CONTROL - Lightbulb and X Button
    // ======================================================================
    
    function setSuggestionsVisible(isVisible) {
        if (!els.suggestionsContainer) {
            return;
        }

        if (isVisible) {
            els.suggestionsContainer.classList.remove('savonie-suggestions-hidden');
            els.suggestionsContainer.removeAttribute('hidden');
            els.suggestionsContainer.style.display = 'flex';
        } else {
            els.suggestionsContainer.classList.add('savonie-suggestions-hidden');
            els.suggestionsContainer.setAttribute('hidden', 'true');
            els.suggestionsContainer.style.display = 'none';
        }

    }

    function attachSuggestionHandlers() {
        if (!els.suggestionsContainer) {
            return;
        }

        if (els.suggestionsToggle) {
            els.suggestionsToggle.addEventListener('click', () => {
                const isHidden = els.suggestionsContainer.classList.contains('savonie-suggestions-hidden') || 
                                 els.suggestionsContainer.hasAttribute('hidden') ||
                                 els.suggestionsContainer.style.display === 'none';
                const nextVisible = isHidden;
                setSuggestionsVisible(nextVisible);
            });
        }
    }

    // Attach handlers immediately (DOM is already ready due to DOMContentLoaded)
    attachSuggestionHandlers();

    // 3.1 Static Chip Buttons (pre-existing in HTML)
    if (els.chipsContainer) {
        els.chipsContainer.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleSend(btn.textContent || '');
            });
        });
    }

    // 3.5 Voice Input (Speech Recognition)
    const micBtn = document.getElementById('mic-btn');
    let recognition = null;
    let isListening = false;

    if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = document.documentElement.lang || 'en-US';

        recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add('listening');
            micBtn.setAttribute('aria-label', 'Listening...');
        };

        recognition.onend = () => {
            isListening = false;
            micBtn.classList.remove('listening');
            micBtn.setAttribute('aria-label', 'Voice input');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (els.input && transcript) {
                els.input.value = transcript;
                try { els.input.focus({ preventScroll: true }); } catch (e) { els.input.focus(); }
            }
        };

        recognition.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            isListening = false;
            micBtn.classList.remove('listening');
        };

        micBtn.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else if (micBtn) {
        // Hide mic button if speech recognition is not supported
        micBtn.style.display = 'none';
    }

    // Generate contextual chip suggestions based on conversation
    function generateContextualChips(history) {
        const suggestions = [];
        const lastUserMessage = [...history].reverse().find(msg => msg.sender === 'user')?.text?.toLowerCase() || '';
        const lastBotMessage = [...history].reverse().find(msg => msg.sender === 'bot')?.text?.toLowerCase() || '';
        
        // Detect language of the last user message
        const detectedLang = detectLanguage(lastUserMessage);
        const contextualSuggestions = translations.chat.contextualSuggestions;
        
        // Analyze conversation context and suggest relevant follow-ups
        if (lastUserMessage.includes('skill') || lastUserMessage.includes('technology') || lastUserMessage.includes('expertise') ||
            lastUserMessage.includes('habilidad') || lastUserMessage.includes('tecnología') || lastUserMessage.includes('experiencia') ||
            lastUserMessage.includes('مهارة') || lastUserMessage.includes('تكنولوجيا') || lastUserMessage.includes('خبرة')) {
            suggestions.push(...(contextualSuggestions[detectedLang]?.skills || [
                "What projects have you worked on?", "Tell me about your experience", "What are you learning currently?"
            ]));
        } else if (lastUserMessage.includes('background') || lastUserMessage.includes('experience') || lastUserMessage.includes('career') ||
                   lastUserMessage.includes('fondo') || lastUserMessage.includes('experiencia') || lastUserMessage.includes('carrera') ||
                   lastUserMessage.includes('خلفية') || lastUserMessage.includes('خبرة') || lastUserMessage.includes('مسيرة')) {
            suggestions.push(...(contextualSuggestions[detectedLang]?.background || [
                "What are your main skills?", "Tell me about your education", "What industries have you worked in?"
            ]));
        } else if (lastUserMessage.includes('project') || lastUserMessage.includes('work') || lastUserMessage.includes('portfolio') ||
                   lastUserMessage.includes('proyecto') || lastUserMessage.includes('trabajo') || lastUserMessage.includes('portafolio') ||
                   lastUserMessage.includes('مشروع') || lastUserMessage.includes('عمل') || lastUserMessage.includes('محفظة')) {
            suggestions.push(...(contextualSuggestions[detectedLang]?.projects || [
                "Can you show me your code?", "What technologies did you use?", "How long did it take to build?"
            ]));
        } else if (lastUserMessage.includes('contact') || lastUserMessage.includes('reach') || lastUserMessage.includes('email') ||
                   lastUserMessage.includes('contacto') || lastUserMessage.includes('alcanzar') || lastUserMessage.includes('correo') ||
                   lastUserMessage.includes('اتصال') || lastUserMessage.includes('الوصول') || lastUserMessage.includes('بريد')) {
            suggestions.push(...(contextualSuggestions[detectedLang]?.contact || [
                "Are you available for freelance work?", "What's your typical response time?", "Do you work remotely?"
            ]));
        } else if (lastUserMessage.includes('education') || lastUserMessage.includes('study') || lastUserMessage.includes('learn') ||
                   lastUserMessage.includes('educación') || lastUserMessage.includes('estudio') || lastUserMessage.includes('aprender') ||
                   lastUserMessage.includes('تعليم') || lastUserMessage.includes('دراسة') || lastUserMessage.includes('تعلم')) {
            suggestions.push(...(contextualSuggestions[detectedLang]?.education || [
                "What certifications do you have?", "What's your favorite programming language?", "How do you stay updated with technology?"
            ]));
        } else if (lastBotMessage.includes('project') || lastBotMessage.includes('work') ||
                   lastBotMessage.includes('proyecto') || lastBotMessage.includes('trabajo') ||
                   lastBotMessage.includes('مشروع') || lastBotMessage.includes('عمل')) {
            suggestions.push(...(contextualSuggestions[detectedLang]?.projectResponse || [
                "Can you tell me more about that project?", "What challenges did you face?", "What did you learn from it?"
            ]));
        } else if (lastBotMessage.includes('skill') || lastBotMessage.includes('technology') ||
                   lastBotMessage.includes('habilidad') || lastBotMessage.includes('tecnología') ||
                   lastBotMessage.includes('مهارة') || lastBotMessage.includes('تكنولوجيا')) {
            suggestions.push(...(contextualSuggestions[detectedLang]?.skillResponse || [
                "How did you learn that?", "Have you used it in projects?", "What's your proficiency level?"
            ]));
        } else if (history.length < 4) {
            // Early conversation - general suggestions
            suggestions.push(...(contextualSuggestions[detectedLang]?.early || [
                "What are your main skills?", "Tell me about your background", "What projects are you proud of?"
            ]));
        }
        
        // Limit to 3 suggestions and ensure variety
        return suggestions.slice(0, 3);
    }

    // Simple language detection based on character patterns
    function detectLanguage(text) {
        if (!text) return 'en';
        
        // Arabic detection (Arabic script)
        const arabicChars = /[\u0600-\u06FF]/;
        if (arabicChars.test(text)) return 'ar';
        
        // Spanish detection (common Spanish words and patterns)
        const spanishWords = /\b(qué|como|dónde|cuándo|por qué|está|son|tiene|trabajo|habilidades?|experiencia|proyecto|contacto)\b/i;
        if (spanishWords.test(text)) return 'es';
        
        // Default to English
        return 'en';
    }

    // 4. Functions
    
    function getSafeLinkTarget(rawUrl) {
        const input = String(rawUrl || '').trim();
        if (!input) return null;

        if (input.startsWith('/')) {
            return {
                href: input,
                external: false
            };
        }

        try {
            const u = new URL(input, window.location.origin);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

            const sameOrigin = u.origin === window.location.origin;
            return {
                href: sameOrigin ? `${u.pathname}${u.search}${u.hash}` : u.toString(),
                external: !sameOrigin
            };
        } catch (_) {
            return null;
        }
    }

    function createSafeLink(target, label) {
        const a = document.createElement('a');
        a.href = target.href;
        if (target.external) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        a.className = 'text-[#212842] underline hover:text-[#362017] font-medium';
        a.textContent = label;
        return a;
    }

    // Helper: Parse simple markdown links into safe DOM nodes (no innerHTML)
    function parseMarkdown(text) {
        const frag = document.createDocumentFragment();
        if (!text) return frag;

        const appendTextWithLinks = (parent, raw) => {
            const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\bhttps?:\/\/[^\s<]+/g;
            const s = String(raw);
            let lastIndex = 0;
            let m;
            while ((m = pattern.exec(s)) !== null) {
                if (m.index > lastIndex) {
                    parent.appendChild(document.createTextNode(s.slice(lastIndex, m.index)));
                }

                if (m[1] && m[2]) {
                    const safe = getSafeLinkTarget(m[2]);
                    if (safe) {
                        parent.appendChild(createSafeLink(safe, m[1]));
                    } else {
                        parent.appendChild(document.createTextNode(m[0]));
                    }
                } else {
                    const safe = getSafeLinkTarget(m[0]);
                    if (safe) {
                        parent.appendChild(createSafeLink(safe, m[0]));
                    } else {
                        parent.appendChild(document.createTextNode(m[0]));
                    }
                }

                lastIndex = pattern.lastIndex;
            }

            if (lastIndex < s.length) {
                parent.appendChild(document.createTextNode(s.slice(lastIndex)));
            }
        };

        const lines = String(text).split(/\n/);
        for (let i = 0; i < lines.length; i++) {
            appendTextWithLinks(frag, lines[i]);
            if (i < lines.length - 1) frag.appendChild(document.createElement('br'));
        }

        return frag;
    }

    function sanitizeMarkdownHtmlToFragment(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');

        const allowedTags = new Set(['P', 'BR', 'STRONG', 'EM', 'CODE', 'PRE', 'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE']);
        const walk = (node) => {
            const children = Array.from(node.childNodes);
            for (const child of children) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const el = /** @type {HTMLElement} */ (child);
                    const tag = el.tagName;

                    if (!allowedTags.has(tag)) {
                        const replacement = document.createTextNode(el.textContent || '');
                        el.replaceWith(replacement);
                        continue;
                    }

                    // Strip all attributes by default.
                    const rawHref = tag === 'A' ? el.getAttribute('href') : null;
                    const attrs = Array.from(el.attributes);
                    for (const a of attrs) el.removeAttribute(a.name);

                    if (tag === 'A') {
                        const safe = getSafeLinkTarget(rawHref);
                        if (!safe) {
                            const replacement = document.createTextNode(el.textContent || '');
                            el.replaceWith(replacement);
                            continue;
                        }
                        el.setAttribute('href', safe.href);
                        if (safe.external) {
                            el.setAttribute('target', '_blank');
                            el.setAttribute('rel', 'noopener noreferrer');
                        }
                        el.className = 'text-[#212842] underline hover:text-[#362017] font-medium';
                    }

                    walk(el);
                }
            }
        };

        walk(template.content);
        return template.content;
    }

    function renderBotContent(text) {
        const raw = String(text || '');
        const marked = (typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function') ? window.marked : null;
        if (!marked) return parseMarkdown(raw);

        // Prevent raw HTML injection.
        const escaped = raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        try {
            const html = marked.parse(escaped);
            return sanitizeMarkdownHtmlToFragment(html);
        } catch (e) {
            return parseMarkdown(raw);
        }
    }

    async function syncHomeProofStats() {
        const projectCountNode = document.querySelector('[data-home-proof-project-count]');
        if (!projectCountNode) return;

        try {
            const response = await fetch('/assets/data/site-facts.json', { cache: 'no-cache' });
            if (!response.ok) return;

            const siteFacts = await response.json();
            const projectCount = Array.isArray(siteFacts?.projects) ? siteFacts.projects.length : 0;
            if (projectCount > 0) {
                projectCountNode.textContent = String(projectCount);
            }
        } catch (_) {
            // Keep the build-time fallback if the facts file is unavailable.
        }
    }

    // Helper: Render chips and ensure close button exists
    function renderChips(chips) {
        if (!els.chipsContainer) return;
        
        els.chipsContainer.innerHTML = '';
        
        if (!chips || chips.length === 0) {
            setSuggestionsVisible(false);
            return;
        }

        // Render chips
        chips.forEach(chipText => {
            const btn = document.createElement('button');
            btn.className = 'chip-btn text-xs bg-white border border-[#212842]/20 text-[#212842] px-3 py-1 rounded-full hover:bg-[#212842] hover:text-white transition-colors';
            btn.textContent = chipText;
            btn.addEventListener('click', () => {
                handleSend(chipText);
            });
            els.chipsContainer.appendChild(btn);
        });

        // Always add close button with proper data attribute
        const closeBtn = document.createElement('button');
        closeBtn.className = 'chip-close-btn text-xs text-[#362017]/60 hover:text-[#362017] px-2 py-1 ml-2 transition-colors';
        closeBtn.setAttribute('data-chat-suggestions-close', 'button');
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Hide suggestions';
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSuggestionsVisible(false);
        });
        els.chipsContainer.appendChild(closeBtn);
        
        // Store reference to close button
        els.suggestionsClose = closeBtn;
        
        // Show container
        setSuggestionsVisible(true);
    }

    function initPageCloseFloatingUiGuard() {
        // Guard against footer overlap while keeping controls pinned to viewport corners.
        const guardedSections = Array.from(document.querySelectorAll('footer'));
        const scrollBtn = document.getElementById('scroll-to-top');
        const chatToggle = document.getElementById('chat-toggle');
        const SAFE_GAP = 12;
        const MAX_LIFT = 2000;

        const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && Number(style.opacity || '1') > 0.01;
        };

        const getGuardTop = () => {
            let nearestTop = Number.POSITIVE_INFINITY;
            guardedSections.forEach((section) => {
                const rect = section.getBoundingClientRect();
                if (!rect || rect.height <= 0 || rect.bottom <= 0) return;
                nearestTop = Math.min(nearestTop, rect.top);
            });
            return Number.isFinite(nearestTop) ? nearestTop : null;
        };

        const syncFloatingUiGuard = () => {
            const guardTop = getGuardTop();
            const currentLift = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--floating-ui-lift')) || 0;
            let lift = 0;

            if (guardTop !== null && guardTop < window.innerHeight) {
                const tracked = [scrollBtn, chatToggle];
                tracked.forEach((el) => {
                    if (!isVisible(el)) return;
                    const rect = el.getBoundingClientRect();
                    if (!rect || rect.height <= 0) return;
                    const overlap = rect.bottom + SAFE_GAP - guardTop;
                    const candidateLift = currentLift + overlap;
                    if (candidateLift > lift) {
                        lift = candidateLift;
                    }
                });
            }

            lift = Math.min(MAX_LIFT, Math.max(0, Math.round(lift)));

            const pageCloseActive = lift > 0;
            document.documentElement.style.setProperty('--floating-ui-lift', `${Math.round(lift)}px`);
            document.body.classList.toggle('page-close-ui-guard', pageCloseActive);
            if (els.bubble) {
                if (pageCloseActive) {
                    els.bubble.classList.add('opacity-0', 'translate-y-4');
                } else {
                    els.bubble.classList.remove('opacity-0', 'translate-y-4');
                }
            }
        };

        window.addEventListener('scroll', syncFloatingUiGuard, { passive: true });
        window.addEventListener('resize', syncFloatingUiGuard);
        syncFloatingUiGuard();
    }

    function toggleChat() {
        const wasHidden = els.window?.classList.contains('hidden');
        const isRTL = document.documentElement.dir === 'rtl';
        
        if (wasHidden) {
            // Opening: remove hidden, add flex
            els.window?.classList.remove('hidden');
            els.window?.classList.add('flex');

            // Track open event
            if (typeof clarity === 'function') clarity('event', 'chat_open');
            if (typeof gtag === 'function') gtag('event', 'chat_open', {'event_category': 'Chatbot'});
        } else {
            // Closing: remove flex, add hidden
            els.window?.classList.remove('flex');
            els.window?.classList.add('hidden');

            // Track close event
            if (typeof clarity === 'function') clarity('event', 'chat_close');
            if (typeof gtag === 'function') gtag('event', 'chat_close', {'event_category': 'Chatbot'});
        }
        
        if (!els.window?.classList.contains('hidden')) {
            // Chat window is now visible
            if (wasHidden) {
                // Position the chat window relative to the chat widget button
                const widgetRect = els.widget?.getBoundingClientRect();
                if (widgetRect) {
                    const windowWidth = 20; // 20rem = 320px
                    const windowHeight = 31.25; // 31.25rem = 500px
                    const padding = 1; // 1rem

                    // Calculate position to appear above and aligned with the widget
                    let leftPos = widgetRect.left / 16;
                    let topPos = widgetRect.top / 16 - windowHeight - padding;

                    // Ensure it stays within viewport bounds
                    if (leftPos + windowWidth > window.innerWidth / 16) {
                        leftPos = window.innerWidth / 16 - windowWidth - padding;
                    }
                    if (leftPos < padding) {
                        leftPos = padding;
                    }
                    if (topPos < padding) {
                        topPos = padding; // Keep it at top if not enough space above
                    }

                    // Apply positioning
                    els.window.style.position = 'fixed';
                    els.window.style.left = `${leftPos}rem`;
                    els.window.style.top = `${topPos}rem`;
                    els.window.style.right = 'auto';
                    els.window.style.zIndex = '10000';
                } else {
                    // Fallback: reset to default positioning
                    els.window.style.position = '';
                    els.window.style.left = '';
                    els.window.style.top = '';
                    els.window.style.right = '';
                    els.window.style.zIndex = '';
                }
            }
            if(els.bubble) els.bubble.style.display = 'none';
            setTimeout(() => {
                try { els.input?.focus({ preventScroll: true }); } catch (e) { els.input?.focus && els.input.focus(); }
                // Scroll to bottom when opening chat (only scroll the chat container)
                if (els.messages) {
                    els.messages.scrollTop = els.messages.scrollHeight;
                }
            }, 100);
        }

        if (!els.window?.classList.contains('hidden')) {
            document.body.classList.remove('page-close-ui-guard');
        }
    }

    // Enhanced network detection for mobile compatibility
    async function isActuallyOnline() {
        // First check navigator.onLine
        if (navigator.onLine) {
            return true;
        }
        
        // On mobile, navigator.onLine can be unreliable, so try a quick fetch
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch('/favicon.ico', { 
                method: 'HEAD', 
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async function handleSend(forcedText = '') {
        const rawText = typeof forcedText === 'string' && forcedText.length
            ? forcedText
            : (els.input?.value || '');
        const text = rawText.trim();
        if (!text || isSending) return;

        isSending = true;
        if (els.input) {
            els.input.value = '';
        }

        // Google Analytics event tracking
        if(typeof gtag === 'function') {
            gtag('event', 'chat_question', {
                'event_category': 'Chatbot',
                'event_label': 'User Asked Question'
            });
        }
        // Clarity event tracking
        if(typeof clarity === 'function') {
            clarity('event', 'chat_question');
        }

        // Enhanced network check for mobile devices
        const online = await isActuallyOnline();
        if (!online) {
            addMessageToUI(text, 'user');
            addMessageToUI("You appear to be offline. Please check your connection and try again.", 'bot');
            isSending = false;
            return;
        }

        addMessageToUI(text, 'user');
        const loadingId = addMessageToUI('Thinking...', 'bot', true);

        // Enhanced fetch with timeout and retry logic
        const REQUEST_TIMEOUT = 30000; // 30 seconds
        const MAX_RETRIES = 2;
        let lastError = null;
        let data = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

            try {
                const response = await fetch(CHAT_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: text,
                        pageContext: buildStructuredPageContext(),
                        pageContent: buildSafePageContext(),
                        language: pageLang
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Handle HTTP error responses
                if (!response.ok) {
                    if (response.status >= 500) {
                        // Server error - may be worth retrying
                        lastError = { type: 'server', status: response.status };
                        if (attempt < MAX_RETRIES) {
                            await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
                            continue;
                        }
                    } else if (response.status === 429) {
                        // Rate limited
                        lastError = { type: 'rate_limit' };
                        break; // Don't retry rate limits
                    } else {
                        // Other client errors
                        lastError = { type: 'client', status: response.status };
                        break;
                    }
                }

                data = await response.json();
                lastError = null; // Success!
                break;

            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                if (fetchError.name === 'AbortError') {
                    lastError = { type: 'timeout' };
                    if (attempt < MAX_RETRIES) {
                        continue; // Retry on timeout
                    }
                } else {
                    lastError = { type: 'network', message: fetchError.message };
                    if (attempt < MAX_RETRIES) {
                        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                        continue;
                    }
                }
            }
        }

        // Handle errors after all retries exhausted
        if (lastError) {
            removeMessage(loadingId);
            let errorMessage;
            switch (lastError.type) {
                case 'timeout':
                    errorMessage = "The request took too long. The AI service might be busy. Please try again in a moment.";
                    break;
                case 'rate_limit':
                    errorMessage = "Too many requests. Please wait a moment before sending another message.";
                    break;
                case 'server':
                    errorMessage = "The AI service is temporarily unavailable. Please try again in a few seconds.";
                    break;
                case 'network':
                    errorMessage = "Connection lost. Please check your internet connection and try again.";
                    break;
                default:
                    errorMessage = "Something went wrong. Please try again.";
            }
            addMessageToUI(errorMessage, 'bot');
            isSending = false;
            return;
        }

        // Success - process the response
        removeMessage(loadingId);

        // Contract-level error types (may be absent)
        if (data && data.errorType) {
            let friendly = 'Something went wrong. Please try again.';
            if (data.errorType === 'RateLimit') {
                friendly = 'Too many requests. Please wait a moment before trying again.';
            } else if (data.errorType === 'BadRequest') {
                friendly = 'Please rephrase your question and try again.';
            } else if (data.errorType === 'UpstreamError') {
                friendly = 'Service hiccup—please try again in a moment.';
            }
            addMessageToUI(friendly, 'bot');
            isSending = false;
            return;
        }

        // Handle Smart Signals response
        if (data.reply) {
            addMessageToUI(data.reply, 'bot');
        }

        // Handle chips (suggestion buttons)
        if (data.chips && Array.isArray(data.chips) && els.chipsContainer) {
            renderChips(data.chips);
        }

        // Handle actions
        if (data.action) {
            if (data.action === 'download_resume') {
                // Open in a new tab (works well on mobile); keep a download fallback.
                try {
                    window.open(RESUME_URL, '_blank', 'noopener');
                } catch (e) {
                    const link = document.createElement('a');
                    link.href = RESUME_URL;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.download = 'Estivan-Ayramia-Resume.pdf';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            } else if (data.action === 'email_link') {
                window.location.href = 'mailto:hello@estivanayramia.com';
            } else if (data.action === 'open_linkedin') {
                try {
                    window.open(LINKEDIN_URL, '_blank', 'noopener');
                } catch (e) {}
            }
        }

        // Handle card
        if (data.card) {
            addCardToUI(data.card);
        }

        // Generate contextual chips based on conversation
        if (!data.chips && chatHistory.length > 0) {
            const contextualChips = generateContextualChips(chatHistory);
            if (contextualChips.length > 0 && els.chipsContainer) {
                renderChips(contextualChips);
            }
        }

        isSending = false;
    }

    function addMessageToUI(text, sender, isLoading = false) {
        if (!els.messages) return;
        const div = document.createElement('div');
        div.id = isLoading ? 'loading-msg' : '';
        const userClass = 'bg-[#212842] text-white rounded-tr-none self-end ml-auto';
        const botClass = 'bg-white text-[#362017] rounded-tl-none border border-[#362017]/5 self-start';
        
        div.className = `p-3 rounded-lg shadow-sm max-w-[70%] mb-3 text-sm leading-relaxed ${sender === 'user' ? userClass : botClass}`;
        
        els.messages.appendChild(div);
        
        const reducedMotion = typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const typingText = String(text)
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\s+\n/g, '\n')
            .trim();
        const shouldTypewriter = sender === 'bot'
            && !isLoading
            && !reducedMotion
            && typingText.length > 0;

        // Stage bot replies so they feel generated in real time before final markdown rendering.
        if (shouldTypewriter) {
            let charIndex = 0;
            div.textContent = '';

            const targetDuration = Math.min(2200, Math.max(720, typingText.length * 16));
            const stepCount = Math.max(14, Math.min(72, Math.round(targetDuration / 28)));
            const chunkSize = Math.max(1, Math.ceil(typingText.length / stepCount));
            const stepDelay = Math.max(12, Math.round(targetDuration / Math.ceil(typingText.length / chunkSize)));

            const typeInterval = setInterval(() => {
                if (charIndex < typingText.length) {
                    charIndex = Math.min(typingText.length, charIndex + chunkSize);
                    div.textContent = typingText.slice(0, charIndex);
                    els.messages.scrollTop = els.messages.scrollHeight;
                } else {
                    clearInterval(typeInterval);
                    div.replaceChildren(renderBotContent(text));
                    els.messages.scrollTop = els.messages.scrollHeight;
                }
            }, stepDelay);
        } else {
            if (sender === 'bot') {
                div.replaceChildren(renderBotContent(text));
            } else {
                div.textContent = text;
            }
        }

        if (!isLoading && isInitialized) {
            chatHistory.push({ kind: 'text', text, sender });
            if (chatHistory.length > MAX_HISTORY_ITEMS) {
                chatHistory = chatHistory.slice(chatHistory.length - MAX_HISTORY_ITEMS);
            }
            sessionStorage.setItem(historyStorageKey, JSON.stringify(chatHistory));
        }
        
        els.messages.scrollTop = els.messages.scrollHeight;
        return div.id;
    }

    function addCardToUI(cardId) {
        if (!els.messages || !projectData[cardId]) return;
        
        const project = projectData[cardId];

        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden border border-[#362017]/10 mb-3 max-w-[85%] self-start';

        const body = document.createElement('div');
        body.className = 'p-3';

        const title = document.createElement('h4');
        title.className = 'font-semibold text-[#212842] mb-1';
        title.textContent = project.title;

        const summary = document.createElement('p');
        summary.className = 'text-xs text-[#362017]/80 mb-3 leading-relaxed';
        summary.textContent = project.summary || '';

        const view = document.createElement('a');
        view.href = project.link;
        view.className = 'inline-block bg-[#212842] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#362017] transition-colors';
        view.textContent = 'View';

        body.appendChild(title);
        if (project.summary) body.appendChild(summary);
        body.appendChild(view);

        // Optional image header
        if (project.img) {
            const img = document.createElement('img');
            img.src = project.img;
            img.alt = project.title;
            img.className = 'w-full h-32 object-cover';
            img.addEventListener('error', () => {
                try { img.remove(); } catch (e) {}
            });
            card.appendChild(img);
        }

        card.appendChild(body);
        
        els.messages.appendChild(card);
        els.messages.scrollTop = els.messages.scrollHeight;

        if (isInitialized) {
            chatHistory.push({ kind: 'card', cardId });
            if (chatHistory.length > MAX_HISTORY_ITEMS) {
                chatHistory = chatHistory.slice(chatHistory.length - MAX_HISTORY_ITEMS);
            }
            sessionStorage.setItem(historyStorageKey, JSON.stringify(chatHistory));
        }
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // 5. Draggable Header Logic with Viewport Constraints
    if (els.header && els.window) {
        let isDragging = false, startX, startY, initialLeft, initialTop;
        const isRTL = document.documentElement.dir === 'rtl';

        // Set initial cursor
        els.header.style.cursor = 'move';

        els.header.addEventListener('mousedown', (e) => {
            if (e.target.closest('#close-chat')) return; // Don't drag when clicking close
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = els.window.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            els.header.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';

            // Make window absolutely positioned for dragging
            if (els.window.style.position !== 'fixed') {
                els.window.style.position = 'fixed';
                if (isRTL) {
                    // For RTL, use right positioning
                    const rightPos = window.innerWidth - rect.right;
                    els.window.style.right = `${rightPos}px`;
                    els.window.style.left = 'auto';
                } else {
                    els.window.style.left = `${initialLeft}px`;
                }
                els.window.style.top = `${initialTop}px`;
                els.window.style.zIndex = '10000';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Viewport constraints (with padding)
            const windowWidth = els.window.offsetWidth;
            const windowHeight = els.window.offsetHeight;
            const padding = 10;

            if (isRTL) {
                // For RTL: constrain right position
                let newRight = (window.innerWidth - initialLeft - windowWidth) - dx;
                newRight = Math.max(padding, Math.min(newRight, window.innerWidth - windowWidth - padding));
                els.window.style.right = `${newRight}px`;
                els.window.style.left = 'auto';
            } else {
                // For LTR: constrain left position
                let newLeft = initialLeft + dx;
                newLeft = Math.max(padding, Math.min(newLeft, window.innerWidth - windowWidth - padding));
                els.window.style.left = `${newLeft}px`;
                els.window.style.right = 'auto';
            }

            // Always constrain top position
            let newTop = initialTop + dy;
            newTop = Math.max(padding, Math.min(newTop, window.innerHeight - windowHeight - padding));
            els.window.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            els.header.style.cursor = 'move';
            document.body.style.userSelect = '';
        });
    }    // 6. Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close chat
        if (e.key === 'Escape' && !els.window?.classList.contains('hidden')) {
            toggleChat();
        }
        // Ctrl/Cmd + K to toggle chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            toggleChat();
        }
    });
});

// ==========================================================================
// PDF Preview Toggle (for project pages)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Helper: produce the default fallback markup (keeps existing copy consistent)
    const defaultFallback = () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'rounded-xl border border-chocolate/20 bg-white/40 overflow-hidden p-8 text-center';
        const p = document.createElement('p');
        p.className = 'text-sm text-chocolate/70';
        p.textContent = 'Inline PDF preview may be blocked by hosting or browser settings. Use the buttons below to open or download the deck.';
        wrapper.appendChild(p);
        return wrapper;
    };

    // Try to load a PDF into an iframe; if it fails, show fallback
    const tryLoadPdf = (panel, pdfUrl) => {
        if (!panel || !pdfUrl) return;
        if (panel.dataset.pdfLoaded) return; // already attempted

        // Insert a lightweight loading state
        panel.innerHTML = '';
        const loading = document.createElement('div');
        loading.className = 'py-12 text-sm text-chocolate/60';
        loading.textContent = 'Attempting to load inline preview…';
        panel.appendChild(loading);

        const iframe = document.createElement('iframe');
        iframe.src = pdfUrl;
        iframe.title = 'PDF preview';
        iframe.style.width = '100%';
        iframe.style.height = '480px';
        iframe.style.border = '0';
        iframe.loading = 'lazy';

        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            // Loading took too long - assume success (browser swallowed load event for PDF)

            // Clean up loading state
            try { loading.remove(); } catch(e) {}
            if (!panel.contains(iframe)) panel.appendChild(iframe);
            panel.dataset.pdfLoaded = 'true';
        }, 5000);

        const onFail = () => {
            clearTimeout(timeout);
            try { iframe.remove(); } catch (e) {}
            panel.innerHTML = '';
            panel.appendChild(defaultFallback());
            panel.dataset.pdfLoaded = 'false';
        };

        iframe.addEventListener('load', () => {
            clearTimeout(timeout);
            // If iframe content is accessible, treat as success.
            try {
                try { loading.remove(); } catch(e) {}
                if (!panel.contains(iframe)) panel.appendChild(iframe);
                panel.dataset.pdfLoaded = 'true';
            } catch (e) {
                // If something goes wrong, fallback
                onFail();
            }
        });

        iframe.addEventListener('error', onFail);

        // Append iframe so browser begins loading
        panel.appendChild(iframe);
    };

    // Initialize toggles and progressive load for every preview-toggle on the page
    document.querySelectorAll('.preview-toggle').forEach((btn) => {
        // Find the preview panel within the same section
        const section = btn.closest('section');
        const panel = section && section.querySelector('.preview-panel');

        // Attempt to find a PDF link within the same section (first match)
        let pdfLink = null;
        if (section) {
            pdfLink = section.querySelector('a[href$=".pdf"]') || section.querySelector('a[href*=".pdf?"]');
        }
        const pdfUrl = pdfLink ? pdfLink.getAttribute('href') : null;

        // If a PDF URL exists, try to progressively load the iframe now (so the preview is ready).
        // This preserves the user's expectation that an inline preview appears when possible.
        if (panel && pdfUrl) {
            tryLoadPdf(panel, pdfUrl);
        }

        btn.addEventListener('click', () => {
            if (!panel) return;
            panel.classList.toggle('hidden');
            const isVisible = !panel.classList.contains('hidden');
            btn.textContent = isVisible ? 'Hide preview' : 'Show preview';

            // Track PDF toggle
            if (typeof clarity === 'function') clarity('event', isVisible ? 'pdf_preview_show' : 'pdf_preview_hide');
            if (typeof gtag === 'function') gtag('event', isVisible ? 'pdf_preview_show' : 'pdf_preview_hide', {'event_category': 'PDF'});

            // If the panel becomes visible and we haven't attempted loading yet, try again
            if (isVisible && !panel.dataset.pdfLoaded && pdfUrl) {
                tryLoadPdf(panel, pdfUrl);
            }
        });
    });
});

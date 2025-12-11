/**
 * Portfolio Site Logic
 * Handles interactions, animations, and performance
 */

// Track recent user interaction to avoid forcing reloads or focusing
// while the user is actively scrolling/touching (prevents unexpected jumps)
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

// Lightweight remote-free log collector: enable with ?collect-logs=1
const __collectLogsEnabled = (typeof window !== 'undefined') && new URLSearchParams(window.location.search).has('collect-logs');
const __collectedLogs = [];
const __saveCollected = () => {
    try { localStorage.setItem('site_collect_logs', JSON.stringify(__collectedLogs.slice(-1000))); } catch (e) {}
};
const __logCollect = (msg, data) => {
    if (!__collectLogsEnabled) return;
    try {
        const entry = { t: Date.now(), msg: String(msg), data: data || null, scrollY: window.scrollY || 0 };
        __collectedLogs.push(entry);
        __saveCollected();
    } catch (e) {}
};

// Determine if snapshot mode is requested: ?collect-logs=snapshots
const __collectLogsParam = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search).get('collect-logs') : null;
const __collectSnapshots = !!(__collectLogsParam && /snapshot/i.test(__collectLogsParam));

// Lightweight, privacy-conscious DOM snapshot helper
const __maybeTakeSnapshot = (reason, target) => {
    if (!__collectSnapshots) return;
    try {
        const active = document.activeElement;
        const getElInfo = (el) => {
            if (!el || !el.getBoundingClientRect) return null;
            const r = el.getBoundingClientRect();
            return {
                tag: el.tagName || null,
                id: el.id || null,
                classes: el.className || null,
                rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) },
                focusable: typeof el.tabIndex === 'number' ? el.tabIndex : null,
                ariaRole: el.getAttribute && (el.getAttribute('role') || null)
            };
        };

        const payload = {
            reason: reason || null,
            ts: Date.now(),
            scrollY: window.scrollY || 0,
            innerWidth: window.innerWidth || 0,
            innerHeight: window.innerHeight || 0,
            docHeight: document.documentElement.scrollHeight || document.body.scrollHeight || 0,
            target: getElInfo(target || document.activeElement) || null,
            activeElement: getElInfo(active) || null
        };
        __logCollect('snapshot', payload);
    } catch (e) {}
};

if (__collectLogsEnabled) {
    // Throttled scroll logger
    let __scrollTimer = null;
    window.addEventListener('scroll', () => {
        if (__scrollTimer) return;
        __scrollTimer = setTimeout(() => {
            __logCollect('scroll', { y: window.scrollY, innerHeight: window.innerHeight, docHeight: document.documentElement.scrollHeight });
            __scrollTimer = null;
        }, 200);
    }, { passive: true });

    // Service worker controller change
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                __logCollect('controllerchange', { controller: !!navigator.serviceWorker.controller });
            });
        }
    } catch (e) {}

    // Wrap location.reload to log calls
    try {
        const __origReload = window.location.reload.bind(window.location);
        window.location.reload = function() {
            __logCollect('location.reload called');
            return __origReload();
        };
    } catch (e) {}

    // Download button (small, non-intrusive)
    const __createDownloadButton = () => {
        const btn = document.createElement('button');
        btn.id = 'collect-logs-btn';
        btn.textContent = 'Logs';
        Object.assign(btn.style, { position: 'fixed', left: '8px', bottom: '12px', zIndex: 99999, padding: '6px 8px', fontSize: '12px', background: 'rgba(33,40,66,0.85)', color: '#e1d4c2', border: '1px solid rgba(225,212,194,0.08)', borderRadius: '6px' });
        btn.addEventListener('click', () => {
            try {
                const payload = JSON.stringify(__collectedLogs, null, 2);
                const blob = new Blob([payload], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `site-logs-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (e) {
                // fallback: show in new window
                const w = window.open();
                if (w) w.document.write('<pre>' + (JSON.stringify(__collectedLogs, null, 2)) + '</pre>');
            }
        });
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(btn);
        });
    };
    __createDownloadButton();
    
    // Additional non-intrusive diagnostics (only when collect-logs enabled)
    try {
        // Log visibility / focus / navigation events
        document.addEventListener('visibilitychange', () => __logCollect('visibilitychange', { hidden: document.hidden }));
        window.addEventListener('hashchange', (e) => __logCollect('hashchange', { oldURL: e.oldURL, newURL: e.newURL }));
        window.addEventListener('popstate', (e) => __logCollect('popstate', { state: e.state }));
        window.addEventListener('beforeunload', (e) => __logCollect('beforeunload', {}));

        // Focus tracking (focusin bubbles; capture target)
        window.addEventListener('focusin', (e) => {
            try { __logCollect('focusin', { tag: e.target && e.target.tagName, id: e.target && e.target.id || null, class: e.target && e.target.className || null }); } catch (err) {}
        });

        // Wrap .focus to detect fallbacks or calls that might scroll
        (function(){
            const origFocus = HTMLElement.prototype.focus;
            if (!origFocus.__wrappedByCollectLogs) {
                HTMLElement.prototype.focus = function() {
                    try { __logCollect('element.focus.called', { tag: this.tagName, id: this.id || null, options: arguments[0] || null }); } catch (e) {}
                    try { __maybeTakeSnapshot && __maybeTakeSnapshot('focus', this); } catch (e) {}
                    try { return origFocus.apply(this, arguments); } catch (e) { try { return origFocus.call(this); } catch(_) {} }
                };
                HTMLElement.prototype.focus.__wrappedByCollectLogs = true;
            }
        })();

        // Wrap scrollIntoView to log calls
        (function(){
            const proto = Element.prototype;
            if (!proto.__scrollIntoViewLogged) {
                const orig = proto.scrollIntoView;
                proto.scrollIntoView = function() {
                    try { __logCollect('element.scrollIntoView', { tag: this.tagName, id: this.id || null, args: Array.from(arguments) }); } catch (e) {}
                    try { __maybeTakeSnapshot && __maybeTakeSnapshot('scrollIntoView', this); } catch (e) {}
                    return orig.apply(this, arguments);
                };
                proto.__scrollIntoViewLogged = true;
            }
        })();

        // Wrap window.scrollTo and scrollBy to log programmatic scrolls
        try {
            const origScrollTo = window.scrollTo;
            window.scrollTo = function() {
                try { __logCollect('window.scrollTo', { args: Array.from(arguments) }); } catch (e) {}
                try { __maybeTakeSnapshot && __maybeTakeSnapshot('window.scrollTo', null); } catch (e) {}
                return origScrollTo.apply(window, arguments);
            };
        } catch (e) {}
        try {
            const origScrollBy = window.scrollBy;
            window.scrollBy = function() {
                try { __logCollect('window.scrollBy', { args: Array.from(arguments) }); } catch (e) {}
                try { __maybeTakeSnapshot && __maybeTakeSnapshot('window.scrollBy', null); } catch (e) {}
                return origScrollBy.apply(window, arguments);
            };
        } catch (e) {}

        // Wrap fetch to log request/responses (lightweight)
        try {
            const origFetch = window.fetch;
            window.fetch = function(input, init) {
                try { __logCollect('fetch.start', { url: (input && input.url) || input, method: (init && init.method) || 'GET' }); } catch (e) {}
                return origFetch.apply(this, arguments).then(res => {
                    try { __logCollect('fetch.end', { url: (res && res.url) || input, status: res.status }); } catch (e) {}
                    return res;
                }).catch(err => { try { __logCollect('fetch.error', { url: input, message: err && err.message }); } catch(_){} throw err; });
            };
        } catch (e) {}

        // Wrap XHR to log sends
        try {
            const OrigXHR = window.XMLHttpRequest;
            function WrappedXHR() {
                const xhr = new OrigXHR();
                let _url = null;
                const origOpen = xhr.open;
                xhr.open = function(method, url) {
                    _url = url;
                    try { __logCollect('xhr.open', { method: method, url: url }); } catch (e) {}
                    return origOpen.apply(xhr, arguments);
                };
                const origSend = xhr.send;
                xhr.send = function() {
                    try {
                        __logCollect('xhr.send', { url: _url });
                    } catch (e) {}
                    xhr.addEventListener('loadend', function() {
                        try { __logCollect('xhr.loadend', { url: _url, status: xhr.status }); } catch (e) {}
                    });
                    return origSend.apply(xhr, arguments);
                };
                return xhr;
            }
            WrappedXHR.prototype = OrigXHR.prototype;
            window.XMLHttpRequest = WrappedXHR;
        } catch (e) {}

        // Log resize/orientation events
        window.addEventListener('resize', () => __logCollect('resize', { innerWidth: window.innerWidth, innerHeight: window.innerHeight }));
        window.addEventListener('orientationchange', () => __logCollect('orientationchange', { orientation: window.orientation }));

        // Wrap serviceWorker.register to observe registration/updatefound if possible
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.register) {
                const origRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
                navigator.serviceWorker.register = function() {
                    const args = arguments;
                    try { __logCollect('sw.register.start', { scope: (args && args[1] && args[1].scope) || null, script: args && args[0] }); } catch(e){}
                    return origRegister.apply(navigator.serviceWorker, arguments).then(reg => {
                        try { __logCollect('sw.register.done', { scope: reg.scope }); } catch(e){}
                        try {
                            reg.addEventListener('updatefound', () => __logCollect('sw.updatefound', {}));
                            if (reg.waiting) __logCollect('sw.waiting', {});
                        } catch(e){}
                        return reg;
                    }).catch(err => { try { __logCollect('sw.register.error', { message: err && err.message }); } catch(e){} throw err; });
                };
            }
        } catch (e) {}

        // Hook ScrollTrigger.refresh if present to log refresh calls
        try {
            if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger && ScrollTrigger.refresh) {
                const origRefresh = ScrollTrigger.refresh.bind(ScrollTrigger);
                ScrollTrigger.refresh = function() {
                    try { __logCollect('ScrollTrigger.refresh', { args: Array.from(arguments) }); } catch(e){}
                    return origRefresh.apply(this, arguments);
                };
            }
        } catch (e) {}

        // Touch/pointer end snapshots — helpful to know last user gesture
        ['touchend','pointerup','mouseup'].forEach(ev => {
            window.addEventListener(ev, (e) => {
                try { __logCollect('gesture.'+ev, { x: (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX) || e.clientX || null, y: (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY) || e.clientY || null }); } catch(_) {}
            }, { passive: true });
        });

        // Monitor body/document height changes via MutationObserver (log when height changes)
        try {
            let lastDocHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
            const mo = new MutationObserver(() => {
                try {
                    const h = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
                    if (h !== lastDocHeight) {
                        __logCollect('docHeight.change', { from: lastDocHeight, to: h });
                        try { __maybeTakeSnapshot && __maybeTakeSnapshot('docHeight.change', document.documentElement); } catch (e) {}
                        lastDocHeight = h;
                    }
                } catch (e) {}
            });
            mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true });
        } catch (e) {}

        // -- Extended safe instrumentation (privacy-conscious) -----------------
        try {
            const MAX_ENTRY_BYTES = 8 * 1024; // cap large entries

            const safeStringify = (obj) => {
                try {
                    const s = JSON.stringify(obj, (k, v) => {
                        // redact obvious sensitive keys
                        if (typeof k === 'string' && /pass(word)?|token|secret|auth|credit|cc-number|card|ssn|cvv/i.test(k)) return '[REDACTED]';
                        // avoid dumping large blobs
                        if (typeof v === 'string' && v.length > 200) return v.slice(0, 200) + '…[truncated]';
                        return v;
                    });
                    if (s.length > MAX_ENTRY_BYTES) return s.slice(0, MAX_ENTRY_BYTES) + '...[truncated]';
                    return s;
                } catch (e) { return String(obj); }
            };

            // Console wrapper
            try {
                ['log','info','warn','error','debug'].forEach(method => {
                    const orig = console[method] && console[method].bind(console);
                    if (!orig) return;
                    console[method] = function() {
                        try { __logCollect('console.'+method, { args: Array.from(arguments).map(a => (typeof a === 'object' ? safeStringify(a) : String(a))) }); } catch(e){}
                        try { if (method === 'error' || method === 'warn') __maybeTakeSnapshot && __maybeTakeSnapshot('console.'+method, document.activeElement); } catch(e){}
                        return orig.apply(console, arguments);
                    };
                });
            } catch (e) {}

            // Global error & unhandledrejection
            window.addEventListener('error', (ev) => {
                try {
                    __logCollect('window.error', { message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, stack: ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 1000) : null });
                    try { __maybeTakeSnapshot && __maybeTakeSnapshot('error', ev && ev.target ? ev.target : document.activeElement); } catch (e) {}
                } catch (e) {}
            });
            window.addEventListener('unhandledrejection', (ev) => {
                try { __logCollect('unhandledrejection', { reason: ev.reason && (ev.reason.stack ? String(ev.reason.stack).slice(0,1000) : String(ev.reason)) }); } catch (e) {}
            });

            // Storage wrappers (log keys only + length)
            try {
                const _lsSet = localStorage.setItem.bind(localStorage);
                localStorage.setItem = function(k, v) {
                    try { __logCollect('localStorage.setItem', { key: String(k), size: (v && v.length) || 0 }); } catch(e){}
                    return _lsSet(k, v);
                };
            } catch (e) {}
            try {
                const _ssSet = sessionStorage.setItem.bind(sessionStorage);
                sessionStorage.setItem = function(k, v) {
                    try { __logCollect('sessionStorage.setItem', { key: String(k), size: (v && v.length) || 0 }); } catch(e){}
                    return _ssSet(k, v);
                };
            } catch (e) {}

            // navigator.sendBeacon wrapper
            try {
                if (navigator && navigator.sendBeacon) {
                    const _sendBeacon = navigator.sendBeacon.bind(navigator);
                    navigator.sendBeacon = function(url, data) {
                        try { __logCollect('navigator.sendBeacon', { url: String(url), dataSize: (data && data.size) || null }); } catch(e){}
                        return _sendBeacon(url, data);
                    };
                }
            } catch (e) {}

            // Delegate click and form events (avoid capturing form values)
            try {
                document.addEventListener('click', (e) => {
                    try {
                        const t = e.target && (e.target.closest ? e.target.closest('a,button,input,select,textarea,summary') : e.target);
                        if (!t) return;
                        const tag = (t.tagName || '').toLowerCase();
                        const info = { tag, id: t.id || null, classes: t.className || null };
                        if (tag === 'a' && t.href) info.href = (t.href.length>200? t.href.slice(0,200)+'…': t.href);
                        __logCollect('dom.click', info);
                        try {
                            if (['a','button','input','textarea','select'].includes(tag)) {
                                __maybeTakeSnapshot && __maybeTakeSnapshot('click', t);
                            }
                        } catch (e) {}
                    } catch (e) {}
                }, { passive: true });

                document.addEventListener('submit', (e) => {
                    try {
                        const form = e.target;
                        if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return;
                        const fields = Array.from(form.elements || []).filter(n => n.name).map(n => ({ name: n.name, type: n.type || n.tagName }));
                        __logCollect('form.submit', { action: form.action || null, method: form.method || 'GET', fields });
                    } catch (e) {}
                }, true);
            } catch (e) {}

            // Input events: log type and length only (no values)
            try {
                document.addEventListener('input', (e) => {
                    try {
                        const el = e.target;
                        if (!el) return;
                        const tag = el.tagName && el.tagName.toLowerCase();
                        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                            const info = { tag, type: el.type || null, name: el.name || null, valueLength: (el.value && el.value.length) || 0 };
                            __logCollect('input', info);
                        }
                    } catch (e) {}
                }, { passive: true });
            } catch (e) {}

            // Selection logging (length + container tag)
            try {
                document.addEventListener('selectionchange', () => {
                    try {
                        const sel = document.getSelection && document.getSelection();
                        if (!sel) return;
                        const txt = sel.toString();
                        const container = sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.tagName;
                        __logCollect('selectionchange', { length: txt.length, container: container || null });
                    } catch (e) {}
                });
            } catch (e) {}

            // Clipboard events (log action only)
            try {
                ['copy','cut','paste'].forEach(ev => {
                    document.addEventListener(ev, (e) => { try { __logCollect('clipboard.'+ev, {}); } catch(_) {} });
                });
            } catch (e) {}

            // Performance: longtask and resource observer (lightweight)
            try {
                if ('PerformanceObserver' in window) {
                    try {
                        const po = new PerformanceObserver((list) => {
                            list.getEntries().forEach(en => {
                                try {
                                    if (en.entryType === 'longtask') {
                                        __logCollect('perf.longtask', { duration: Math.round(en.duration) });
                                    } else if (en.entryType === 'resource') {
                                        __logCollect('perf.resource', { name: en.name, initiatorType: en.initiatorType, duration: Math.round(en.duration) });
                                    }
                                } catch(e) {}
                            });
                        });
                        po.observe({ entryTypes: ['longtask','resource'] });
                    } catch (e) {}
                }
            } catch (e) {}

            // Log when event listeners are attached (helps find dynamic behavior)
            try {
                const origAdd = EventTarget.prototype.addEventListener;
                EventTarget.prototype.addEventListener = function(type, listener, options) {
                    try { __logCollect('addEventListener', { target: this && this.tagName ? this.tagName : (this && this.constructor && this.constructor.name) || 'unknown', type: type }); } catch(e) {}
                    return origAdd.apply(this, arguments);
                };
            } catch (e) {}
        } catch (e) {}
        // ---------------------------------------------------------------------
    } catch (e) {}
    // Guarded reload: retry until user is idle, then reload.
    // Defaults: MAX = 30000 ms, RETRY = 500 ms.
    // Usage: window.tryGuardedReload({ MAX: 30000, RETRY: 500, fallback: () => window.location.reload() });
    window.tryGuardedReload = function(opts) {
        opts = opts || {};
        const MAX = (typeof opts.MAX === 'number') ? opts.MAX : 30000;
        const RETRY = (typeof opts.RETRY === 'number') ? opts.RETRY : 500;
        const fallback = (opts && typeof opts.fallback === 'function') ? opts.fallback : null;
        const start = Date.now();

        (function attempt() {
            try {
                const interacting = (typeof window.__userInteracting !== 'undefined') ? window.__userInteracting : false;
                if (!interacting) {
                    try { window.location.reload(); } catch (e) { try { window.location.href = window.location.href; } catch(_) {} }
                    return;
                }
                if (Date.now() - start < MAX) {
                    setTimeout(attempt, RETRY);
                    return;
                }
                // Timed out — fallback
                if (fallback) {
                    try { fallback(); } catch (e) { try { window.location.reload(); } catch(_) {} }
                } else {
                    try { window.location.reload(); } catch (e) { try { window.location.href = window.location.href; } catch(_) {} }
                }
            } catch (e) {
                if (fallback) { try { fallback(); } catch(_) { try { window.location.reload(); } catch(_) {} } }
                else { try { window.location.reload(); } catch(_) {} }
            }
        })();
    };
}

// ==========================================================================
// Dark Mode Toggle
// ==========================================================================

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
        
        // Track analytics
        if (typeof clarity === 'function') {
            clarity('event', 'theme_toggle', { theme: newTheme });
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

const initMobileMenu = () => {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (!menuToggle || !mobileMenu) return;

    // Handler function for menu toggle
    const toggleMenu = () => {
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

        // Toggle menu visibility
        mobileMenu.classList.toggle('hidden');

        // Update ARIA attribute
        menuToggle.setAttribute('aria-expanded', !isExpanded);

        // Animate icon (optional enhancement)
        const icon = menuToggle.querySelector('svg');
        if (icon) {
            icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
        }
    };

    // Add click event for menu toggle
    menuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        toggleMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
            mobileMenu.classList.add('hidden');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Close menu when clicking a link
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            menuToggle.setAttribute('aria-expanded', 'false');
            // Reset icon rotation
            const icon = menuToggle.querySelector('svg');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
};

// ==========================================================================
// GSAP Animations
// ==========================================================================

const initAnimations = () => {
    // Always unhide elements first to avoid blank screens
    const allAnimated = document.querySelectorAll('[data-gsap]');
    allAnimated.forEach(el => {
        el.classList.remove('opacity-0', 'translate-y-8');
        el.style.opacity = '1';
        el.style.transform = 'none';
    });

    // If GSAP unavailable, keep content visible and exit
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        console.warn('GSAP or ScrollTrigger not loaded; revealing content without animations.');
        return;
    }

    // Register ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // Fade Up Animations
    const fadeElements = document.querySelectorAll('[data-gsap="fade-up"]');
    
    fadeElements.forEach(element => {
        const delay = element.getAttribute('data-gsap-delay') || 0;
        
        gsap.from(element, {
            opacity: 0,
            y: 20,
            duration: 0.4,
            delay: parseFloat(delay) * 0.5,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 92%',
                toggleActions: 'play none none none'
            }
        });
    });

    // Parallax effect for hero section (if exists)
    const heroSection = document.querySelector('section:first-of-type');
    if (heroSection) {
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

// ==========================================================================
// Smooth Scroll for Anchor Links
// ==========================================================================

const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            // Don't prevent default for # only
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
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
        });
    });
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
                credentials: 'omit',
                redirect: 'follow'
            });
            if (res.ok) {
                form.reset();
                // Replace form with mini-game easter egg
                const card = form.parentElement;
                if (card) {
                    card.innerHTML = `
                        <h2 class="text-2xl font-bold text-indigodeep mb-2">Thanks — message sent!</h2>
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
            <p class="text-ink/80 mb-2">Hope you enjoyed this little easter egg — I'll be in touch soon.</p>
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
// Progressive PDF preview loader
// Tries to show an inline iframe preview, falls back when blocked.
// Respects collect-logs gating via __logCollect and records attempts.
// ======================================================================
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

                // fallback timeout: if not loaded within 3s, show fallback
                setTimeout(() => {
                    if (!loaded) finalize(false);
                }, 3000);
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

    // Show/hide button based on scroll position (25% of page height)
    const toggleButton = () => {
        const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollThreshold = pageHeight * 0.25;
        const currentScroll = window.scrollY;

        if (currentScroll > scrollThreshold) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    };

    // Scroll to top smoothly
    const scrollToTop = () => {
        // Track analytics
        if (typeof clarity === 'function') {
            clarity('event', 'scroll_to_top_clicked');
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // Event listeners
    window.addEventListener('scroll', toggleButton);
    scrollBtn.addEventListener('click', scrollToTop);

    // Check initial position
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
        const translatedAchievement = {
            ...achievements[achievementId],
            ...translations.achievement[lang][achievementId]
        };
        
        unlocked[achievementId] = {
            unlockedAt: new Date().toISOString(),
            ...translatedAchievement
        };
        saveAchievements(unlocked);
        showAchievementNotification(translatedAchievement);
    };

    // Show achievement notification
    const showAchievementNotification = (achievement) => {
        const lang = getCurrentLanguage();
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-content">
                <div class="achievement-title">${translations.achievement[lang].unlocked}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.description}</div>
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
                if (refreshing) return;
                refreshing = true;

                // Use guarded reload helper when available so we don't reload mid-scroll
                if (typeof window.tryGuardedReload === 'function') {
                    window.tryGuardedReload({ MAX: 30000, RETRY: 500, fallback: () => { try { window.location.reload(); } catch(e) { try { window.location.href = window.location.href; } catch(_) {} } } });
                } else {
                    const __doReloadFallback = () => {
                        if (!__userInteracting) {
                            window.location.reload();
                        } else {
                            setTimeout(__doReloadFallback, 500);
                        }
                    };
                    __doReloadFallback();
                }
        });

        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {

                    // Periodically check for updates
                    setInterval(() => {
                        registration.update();
                    }, 60000);

                    // If there's an update waiting, skip waiting and reload
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    // Detect updates found
                    registration.addEventListener('updatefound', () => {
                        const newSW = registration.installing;
                        if (newSW) {
                            newSW.addEventListener('statechange', () => {
                                if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New content is available; activate immediately
                                    newSW.postMessage({ type: 'SKIP_WAITING' });
                                }
                            });
                        }
                    });
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
// Analytics Tracking (Microsoft Clarity)
// ==========================================================================

// Debug helper: logs analytics events when ?debug-analytics=1 is in URL
const trackEventDebug = (tag, payload) => {
    try {
        if (window.location.search.includes('debug-analytics=1')) {
            console.log('[analytics]', tag, payload || null);
        }
    } catch (e) {
        // fail silently
    }
};

const initAnalytics = () => {
    // Track button clicks
    const trackClick = (element, label) => {
        const eventName = `button_click_${label}`;
        trackEventDebug(eventName);
        if (typeof clarity === 'function') {
            clarity('event', eventName);
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
            if (typeof clarity === 'function') {
                clarity('event', 'navigation_click', { page });
            }
        });
    });

    // Track social media clicks
    document.querySelectorAll('a[href*="linkedin.com"], a[href*="github.com"]').forEach((link) => {
        link.addEventListener('click', () => {
            const platform = link.href.includes('linkedin') ? 'linkedin' : 'github';
            trackEventDebug('social_click', { platform });
            if (typeof clarity === 'function') {
                clarity('event', 'social_click', { platform });
            }
        });
    });

    // Track form submissions
    const form = document.querySelector('form[action*="formspree.io"]');
    if (form) {
        form.addEventListener('submit', () => {
            trackEventDebug('form_submission');
            if (typeof clarity === 'function') {
                clarity('event', 'form_submission');
            }
        });
    }

    // Track scroll depth
    let maxScrollDepth = 0;
    let scrollEventsLogged = { 25: false, 50: false, 75: false, 100: false };
    window.addEventListener('scroll', () => {
        const scrollDepth = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
        if (scrollDepth > maxScrollDepth) {
            maxScrollDepth = scrollDepth;
            if (maxScrollDepth >= 25 && !scrollEventsLogged[25]) {
                scrollEventsLogged[25] = true;
                trackEventDebug('scroll_25_percent');
                if (typeof clarity === 'function') clarity('event', 'scroll_25_percent');
            }
            if (maxScrollDepth >= 50 && !scrollEventsLogged[50]) {
                scrollEventsLogged[50] = true;
                trackEventDebug('scroll_50_percent');
                if (typeof clarity === 'function') clarity('event', 'scroll_50_percent');
            }
            if (maxScrollDepth >= 75 && !scrollEventsLogged[75]) {
                scrollEventsLogged[75] = true;
                trackEventDebug('scroll_75_percent');
                if (typeof clarity === 'function') clarity('event', 'scroll_75_percent');
            }
            if (maxScrollDepth >= 100 && !scrollEventsLogged[100]) {
                scrollEventsLogged[100] = true;
                trackEventDebug('scroll_100_percent');
                if (typeof clarity === 'function') clarity('event', 'scroll_100_percent');
            }
        }
    });

    // Track Konami code usage
    window.addEventListener('konami-activated', () => {
        trackEventDebug('konami_code_activated');
        if (typeof clarity === 'function') {
            clarity('event', 'konami_code_activated');
        }
    });

    // Track achievement unlocks
    const originalUnlock = window.unlockAchievement;
    if (originalUnlock) {
        window.unlockAchievement = (achievementId) => {
            trackEventDebug('achievement_unlocked', { achievement: achievementId });
            if (typeof clarity === 'function') {
                clarity('event', 'achievement_unlocked', { achievement: achievementId });
            }
            originalUnlock(achievementId);
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
    const footerYear = document.querySelector('footer p.text-xs');
    if (footerYear) {
        const currentYear = new Date().getFullYear();
        footerYear.innerHTML = footerYear.innerHTML.replace(/&copy;\s*\d{4}/, `&copy; ${currentYear}`);
    }
    
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

const init = () => {
    // Developer signature
    console.log('%c Designed by Estivan Ayramia ', 'background: #212842; color: #e1d4c2; padding: 4px; border-radius: 4px;');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initDarkMode();
            initMobileMenu();
            initAnimations();
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
        initDarkMode();
        initMobileMenu();
        initAnimations();
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
// Savonie AI Chatbot with Smart Signals
// ==========================================================================

// --- Savonie AI Chatbot ---
document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const WORKER_URL = 'https://portfolio-chat.eayramia.workers.dev';
    const WELCOME_DELAY = 2500;

    // Project Data Mapping
    const projectData = {
        logistics: {
            title: "Logistics System",
            img: "assets/img/project-logistics.jpg",
            link: "/deep-dive.html#logistics"
        },
        conflict: {
            title: "Conflict Playbook",
            img: "assets/img/project-conflict.jpg",
            link: "/deep-dive.html#conflict"
        },
        discipline: {
            title: "Discipline Routine",
            img: "assets/img/project-discipline.jpg",
            link: "/deep-dive.html#discipline"
        },
        website: {
            title: "Portfolio Website",
            img: "assets/img/og-image.png",
            link: "/"
        }
    };

    // Elements
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
        suggestionsBtn: document.getElementById('suggestions-btn')
    };

    // Position widget based on language
    const lang = document.documentElement.lang;
    if (lang === 'ar' && els.widget) {
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
    
    // Helper function to add close button to chips container
    function addChipsCloseButton() {
        if (!els.chipsContainer) return;
        
        // Check if close button already exists
        const existingCloseBtn = els.chipsContainer.querySelector('.chip-close-btn');
        if (existingCloseBtn) return;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'chip-close-btn text-xs text-[#362017]/60 hover:text-[#362017] px-2 py-1 ml-2 transition-colors';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Hide suggestions';
        closeBtn.setAttribute('aria-label', 'Hide suggestions');
        
        // Fix: Close button hides suggestions
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            els.chipsContainer.classList.add('hidden');
            els.chipsContainer.style.display = 'none';
        });
        
        els.chipsContainer.appendChild(closeBtn);
    }
    
    // 1. Initialize - restore history from session
    try { 
        const saved = sessionStorage.getItem('savonie_history');
        if (saved) {
            chatHistory = JSON.parse(saved);
            chatHistory.forEach(msg => {
                const div = document.createElement('div');
                const userClass = 'bg-[#212842] text-white rounded-tr-none self-end ml-auto';
                const botClass = 'bg-white text-[#362017] rounded-tl-none border border-[#362017]/5 self-start';
                div.className = `p-3 rounded-lg shadow-sm max-w-[85%] mb-3 text-sm leading-relaxed ${msg.sender === 'user' ? userClass : botClass}`;
                if (typeof marked !== 'undefined' && msg.sender === 'bot') {
                    div.innerHTML = marked.parse(msg.text);
                } else {
                    div.textContent = msg.text;
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
        
        // Add default chips for home page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (currentPage === 'index.html' && els.chipsContainer) {
            const defaultChips = translations.chat.defaultChips[currentLang] || [
                "What does Estivan do?",
                "Tell me about his background",
                "What are his skills?",
                "How can I contact him?"
            ];
            
            els.chipsContainer.innerHTML = '';
            defaultChips.forEach(chipText => {
                const btn = document.createElement('button');
                btn.className = 'chip-btn text-xs bg-white border border-[#212842]/20 text-[#212842] px-3 py-1 rounded-full hover:bg-[#212842] hover:text-white transition-colors';
                btn.textContent = chipText;
                btn.addEventListener('click', () => {
                    if (els.input) {
                        els.input.value = chipText;
                        handleSend();
                    }
                });
                els.chipsContainer.appendChild(btn);
            });
            
            // Add close button using helper function
            addChipsCloseButton();
        }
    }
    
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
    els.input?.addEventListener('keypress', (e) => e.key === 'Enter' && handleSend());
    
    // Fix: Lightbulb icon toggle for chat suggestions
    els.suggestionsBtn?.addEventListener('click', () => {
        if (els.chipsContainer) {
            // Check visibility using computed styles to be accurate
            const computedStyle = window.getComputedStyle(els.chipsContainer);
            const isCurrentlyVisible = computedStyle.display !== 'none' && 
                                       !els.chipsContainer.classList.contains('hidden');
            
            if (isCurrentlyVisible) {
                // Hide suggestions
                els.chipsContainer.classList.add('hidden');
                els.chipsContainer.style.display = 'none';
                els.suggestionsBtn.setAttribute('aria-pressed', 'false');
            } else {
                // Show suggestions
                els.chipsContainer.classList.remove('hidden');
                els.chipsContainer.style.display = 'flex';
                els.suggestionsBtn.setAttribute('aria-pressed', 'true');
                
                // Generate contextual chips if none are showing
                if (els.chipsContainer.children.length === 0 && chatHistory.length > 0) {
                    const contextualChips = generateContextualChips(chatHistory);
                    if (contextualChips.length > 0) {
                        contextualChips.forEach(chipText => {
                            const btn = document.createElement('button');
                            btn.className = 'chip-btn text-xs bg-white border border-[#212842]/20 text-[#212842] px-3 py-1 rounded-full hover:bg-[#212842] hover:text-white transition-colors';
                            btn.textContent = chipText;
                            btn.addEventListener('click', () => {
                                if (els.input) {
                                    els.input.value = chipText;
                                    handleSend();
                                }
                            });
                            els.chipsContainer.appendChild(btn);
                        });

                        // Add close button
                        addChipsCloseButton();
                    }
                }
            }
        }
    });

    // 3.1 Static Chip Buttons (pre-existing in HTML)
    if (els.chipsContainer) {
        els.chipsContainer.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (els.input) {
                    els.input.value = btn.textContent;
                    handleSend();
                }
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
    function toggleChat() {
        const wasHidden = els.window?.classList.contains('hidden');
        const isRTL = document.documentElement.dir === 'rtl';
        
        if (wasHidden) {
            // Opening: remove hidden, add flex
            els.window?.classList.remove('hidden');
            els.window?.classList.add('flex');
        } else {
            // Closing: remove flex, add hidden
            els.window?.classList.remove('flex');
            els.window?.classList.add('hidden');
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

    async function handleSend() {
        if (!els.input) return;
        const text = els.input.value.trim();
        if (!text || isSending) return;

        isSending = true;

        // Google Analytics event tracking
        if(typeof gtag === 'function') {
            gtag('event', 'chat_question', {
                'event_category': 'Chatbot',
                'event_label': 'User Asked Question'
            });
        }

        // Enhanced network check for mobile devices
        const online = await isActuallyOnline();
        if (!online) {
            addMessageToUI(text, 'user');
            els.input.value = '';
            addMessageToUI("You appear to be offline. Please check your connection and try again.", 'bot');
            isSending = false;
            return;
        }

        // Detect user language from their input
        const detectedLanguage = detectLanguage(text);
        const pageLanguage = document.documentElement.lang || 'en';
        // Use detected language if it's different from page language, otherwise use page language
        const language = detectedLanguage !== 'en' ? detectedLanguage : pageLanguage;

        addMessageToUI(text, 'user');
        els.input.value = '';
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
                const response = await fetch(WORKER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: text,
                        language: language,
                        pageContent: document.body.innerText.substring(0, 2000) 
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

        // Handle Smart Signals response
        if (data.reply) {
            addMessageToUI(data.reply, 'bot');
        }

        // Handle chips (suggestion buttons)
        if (data.chips && Array.isArray(data.chips) && els.chipsContainer) {
            els.chipsContainer.innerHTML = '';
            data.chips.forEach(chipText => {
                const btn = document.createElement('button');
                btn.className = 'chip-btn text-xs bg-white border border-[#212842]/20 text-[#212842] px-3 py-1 rounded-full hover:bg-[#212842] hover:text-white transition-colors';
                btn.textContent = chipText;
                btn.addEventListener('click', () => {
                    if (els.input) {
                        els.input.value = chipText;
                        handleSend();
                    }
                });
                els.chipsContainer.appendChild(btn);
            });
            
            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'chip-close-btn text-xs text-[#362017]/60 hover:text-[#362017] px-2 py-1 ml-2 transition-colors';
            closeBtn.innerHTML = '×';
            closeBtn.title = 'Hide suggestions';
            closeBtn.addEventListener('click', () => {
                els.chipsContainer.style.display = 'none';
            });
            els.chipsContainer.appendChild(closeBtn);
        }

        // Handle actions
        if (data.action) {
            if (data.action === 'download_resume') {
                const link = document.createElement('a');
                link.href = '/assets/resume.pdf';
                link.download = 'Estivan_Ayramia_Resume.pdf';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (data.action === 'email_link') {
                window.location.href = 'mailto:hello@estivanayramia.com';
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
                els.chipsContainer.innerHTML = '';
                contextualChips.forEach(chipText => {
                    const btn = document.createElement('button');
                    btn.className = 'chip-btn text-xs bg-white border border-[#212842]/20 text-[#212842] px-3 py-1 rounded-full hover:bg-[#212842] hover:text-white transition-colors';
                    btn.textContent = chipText;
                    btn.addEventListener('click', () => {
                        if (els.input) {
                            els.input.value = chipText;
                            handleSend();
                        }
                    });
                    els.chipsContainer.appendChild(btn);
                });
                
                // Add close button
                const closeBtn = document.createElement('button');
                closeBtn.className = 'chip-close-btn text-xs text-[#362017]/60 hover:text-[#362017] px-2 py-1 ml-2 transition-colors';
                closeBtn.innerHTML = '×';
                closeBtn.title = 'Hide suggestions';
                closeBtn.addEventListener('click', () => {
                    els.chipsContainer.style.display = 'none';
                });
                els.chipsContainer.appendChild(closeBtn);
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
        
        // Typewriter effect for bot messages (but not loading messages)
        if (sender === 'bot' && !isLoading) {
            let charIndex = 0;
            div.textContent = '';
            
            const typeInterval = setInterval(() => {
                if (charIndex < text.length) {
                    div.textContent += text[charIndex];
                    charIndex++;
                    els.messages.scrollTop = els.messages.scrollHeight;
                } else {
                    clearInterval(typeInterval);
                    // Convert to markdown after typing is complete
                    if (typeof marked !== 'undefined') {
                        div.innerHTML = marked.parse(text);
                    }
                    els.messages.scrollTop = els.messages.scrollHeight;
                }
            }, 12);
        } else {
            div.textContent = text;
        }

        if (!isLoading && isInitialized) {
            chatHistory.push({ text, sender });
            sessionStorage.setItem('savonie_history', JSON.stringify(chatHistory));
        }
        
        els.messages.scrollTop = els.messages.scrollHeight;
        return div.id;
    }

    function addCardToUI(cardId) {
        if (!els.messages || !projectData[cardId]) return;
        
        const project = projectData[cardId];
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden border border-[#362017]/10 mb-3 max-w-[85%] self-start';
        
        card.innerHTML = `
            <img src="${project.img}" alt="${project.title}" class="w-full h-32 object-cover" onerror="this.src='assets/img/og-image.png'">
            <div class="p-3">
                <h4 class="font-semibold text-[#212842] mb-2">${project.title}</h4>
                <a href="${project.link}" class="inline-block bg-[#212842] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#362017] transition-colors">
                    View Project
                </a>
            </div>
        `;
        
        els.messages.appendChild(card);
        els.messages.scrollTop = els.messages.scrollHeight;
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
            // Loading took too long — assume blocked and fallback
            try { iframe.remove(); } catch (e) {}
            panel.innerHTML = '';
            panel.appendChild(defaultFallback());
            panel.dataset.pdfLoaded = 'false';
        }, 2500);

        const onFail = () => {
            clearTimeout(timeout);
            try { iframe.remove(); } catch (e) {}
            panel.innerHTML = '';
            panel.appendChild(defaultFallback());
            panel.dataset.pdfLoaded = 'false';
        };

        iframe.addEventListener('load', () => {
            clearTimeout(timeout);
            // If iframe content is accessible, treat as success. If access throws, still consider success
            // in many cases the PDF will render even if cross-origin access is blocked; show the iframe.
            try {
                panel.innerHTML = '';
                panel.appendChild(iframe);
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
            btn.textContent = panel.classList.contains('hidden') ? 'Show preview' : 'Hide preview';
            // If the panel becomes visible and we haven't attempted loading yet, try again
            if (!panel.classList.contains('hidden') && !panel.dataset.pdfLoaded && pdfUrl) {
                tryLoadPdf(panel, pdfUrl);
            }
        });
    });
});

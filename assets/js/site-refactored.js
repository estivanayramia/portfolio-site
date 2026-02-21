/**
 * ============================================================================
 * PORTFOLIO SITE - REFACTORED INSTRUMENTATION
 * ============================================================================
 * 
 * Enhanced client-side diagnostics with:
 * - Unified error capture with automatic DOM snapshots
 * - Breadcrumb trail for user actions
 * - FPS sampling for performance correlation
 * - Lightweight overlay UI for real-time diagnostics
 * - Safe log APIs with privacy redaction
 * 
 * Opt-in via ?collect-logs=1 or ?collect-logs=snapshots
 * Privacy-conscious: no form values, sensitive keys redacted, local-only
 * 
 * @version 3.0.0
 * @author Estivan Ayramia
 * @license MIT
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION & GATES
    // ========================================================================
    
    const urlParams = new URLSearchParams(window.location.search);
    const logsParam = urlParams.get('collect-logs');
    const logsEnabled = urlParams.has('collect-logs');
    const snapshotsEnabled = logsParam && /snapshot/i.test(logsParam);
    
    if (!logsEnabled) {
        // Stub APIs when disabled
        window.__logCollect = () => {};
        window.__maybeTakeSnapshot = () => {};
        window.__pushBreadcrumb = () => {};
        window.__getCollectedLogs = () => [];
        window.__clearCollectedLogs = () => {};
        window.__downloadCollectedLogs = () => {};
        return;
    }

    // ========================================================================
    // CORE STATE
    // ========================================================================
    
    const MAX_LOGS = 1000;
    const MAX_BREADCRUMBS = 50;
    const MAX_STACK_CHARS = 2000;
    const collectedLogs = [];
    const breadcrumbs = [];
    let lastError = null;
    let fpsRunning = false;
    let fpsValue = 0;
    let lastFpsSample = 0;

    // ========================================================================
    // UTILITY: SAFE STRINGIFY WITH REDACTION
    // ========================================================================
    
    const safeStringify = (obj, maxBytes = 8192) => {
        try {
            const s = JSON.stringify(obj, (k, v) => {
                if (typeof k === 'string' && /pass(word)?|token|secret|auth|credit|cc-number|card|ssn|cvv/i.test(k)) {
                    return '[REDACTED]';
                }
                if (typeof v === 'string' && v.length > 300) {
                    return v.slice(0, 300) + '…[truncated]';
                }
                return v;
            });
            if (s.length > maxBytes) return s.slice(0, maxBytes) + '…[truncated]';
            return s;
        } catch (e) {
            return String(obj);
        }
    };

    // ========================================================================
    // CORE API: LOG COLLECTION
    // ========================================================================
    
    const saveLogs = () => {
        try {
            const payload = collectedLogs.slice(-MAX_LOGS);
            localStorage.setItem('site_collect_logs', JSON.stringify(payload));
        } catch (e) {}
    };

    window.__logCollect = (msg, data) => {
        try {
            const entry = {
                t: Date.now(),
                msg: String(msg),
                data: data || null,
                scrollY: window.scrollY || 0,
                breadcrumbs: breadcrumbs.slice(-10) // last 10 for context
            };
            collectedLogs.push(entry);
            if (collectedLogs.length > MAX_LOGS) collectedLogs.shift();
            saveLogs();
            updateOverlay();
        } catch (e) {}
    };

    // ========================================================================
    // BREADCRUMBS
    // ========================================================================
    
    window.__pushBreadcrumb = (type, info) => {
        try {
            breadcrumbs.push({
                t: Date.now(),
                type: String(type),
                info: info || null
            });
            if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
        } catch (e) {}
    };

    // ========================================================================
    // ERROR LOGGING WITH AUTO-SNAPSHOT
    // ========================================================================
    
    const logError = (error, context = {}) => {
        try {
            const severity = context.severity || 'error';
            const source = context.source || 'unknown';
            
            let stack = null;
            if (error && error.stack) {
                stack = String(error.stack).slice(0, MAX_STACK_CHARS);
            }
            
            const errorEntry = {
                severity,
                source,
                message: error && error.message ? String(error.message) : String(error),
                stack,
                filename: error && error.filename,
                lineno: error && error.lineno,
                colno: error && error.colno,
                breadcrumbs: breadcrumbs.slice(-15)
            };
            
            lastError = errorEntry;
            window.__logCollect('error', errorEntry);
            
            // Auto-snapshot on critical errors
            if (severity === 'error' || severity === 'critical') {
                window.__maybeTakeSnapshot && window.__maybeTakeSnapshot('error:' + source, error && error.target);
            }
            
            updateOverlay();
        } catch (e) {}
    };

    // Global error handlers
    window.addEventListener('error', (ev) => {
        logError(ev.error || ev, {
            source: 'window.error',
            severity: 'error',
            filename: ev.filename,
            lineno: ev.lineno,
            colno: ev.colno
        });
    });

    window.addEventListener('unhandledrejection', (ev) => {
        logError(ev.reason, {
            source: 'unhandledrejection',
            severity: 'error'
        });
    });

    // ========================================================================
    // DOM SNAPSHOT
    // ========================================================================
    
    window.__maybeTakeSnapshot = (reason, target) => {
        if (!snapshotsEnabled) return;
        try {
            const active = document.activeElement;
            const getElInfo = (el) => {
                if (!el || !el.getBoundingClientRect) return null;
                const r = el.getBoundingClientRect();
                return {
                    tag: el.tagName || null,
                    id: el.id || null,
                    classes: (el.className && String(el.className).slice(0, 100)) || null,
                    rect: {
                        x: Math.round(r.x),
                        y: Math.round(r.y),
                        w: Math.round(r.width),
                        h: Math.round(r.height)
                    }
                };
            };

            const payload = {
                reason: reason || null,
                ts: Date.now(),
                viewport: {
                    scrollY: window.scrollY || 0,
                    innerWidth: window.innerWidth || 0,
                    innerHeight: window.innerHeight || 0,
                    docHeight: document.documentElement.scrollHeight || 0
                },
                target: getElInfo(target),
                activeElement: getElInfo(active),
                breadcrumbs: breadcrumbs.slice(-10)
            };
            
            window.__logCollect('snapshot', payload);
        } catch (e) {}
    };

    // ========================================================================
    // FPS METER
    // ========================================================================
    
    const startFpsMeter = () => {
        if (fpsRunning) return;
        fpsRunning = true;
        
        let frames = 0;
        let lastTime = performance.now();
        
        const tick = () => {
            if (!fpsRunning) return;
            
            frames++;
            const now = performance.now();
            const elapsed = now - lastTime;
            
            if (elapsed >= 1000) {
                fpsValue = Math.round((frames * 1000) / elapsed);
                frames = 0;
                lastTime = now;
                
                // Log FPS sample every 5 seconds
                if (now - lastFpsSample > 5000) {
                    window.__logCollect('fps.sample', { fps: fpsValue });
                    lastFpsSample = now;
                }
                
                updateOverlay();
            }
            
            requestAnimationFrame(tick);
        };
        
        requestAnimationFrame(tick);
    };

    const stopFpsMeter = () => {
        fpsRunning = false;
        fpsValue = 0;
        updateOverlay();
    };

    // ========================================================================
    // LOG MANAGEMENT APIs
    // ========================================================================
    
    window.__getCollectedLogs = () => {
        return collectedLogs.slice();
    };

    window.__clearCollectedLogs = () => {
        collectedLogs.length = 0;
        breadcrumbs.length = 0;
        lastError = null;
        try {
            localStorage.removeItem('site_collect_logs');
        } catch (e) {}
        updateOverlay();
    };

    window.__downloadCollectedLogs = () => {
        try {
            const payload = JSON.stringify({
                logs: collectedLogs,
                breadcrumbs,
                lastError,
                exportedAt: Date.now()
            }, null, 2);
            
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
            // Fallback: open in new window
            const w = window.open();
            if (w) {
                w.document.write('<pre>' + safeStringify({ logs: collectedLogs, breadcrumbs, lastError }) + '</pre>');
            }
        }
    };

    // ========================================================================
    // OVERLAY UI
    // ========================================================================
    
    let overlayVisible = false;
    let overlayElement = null;

    const createDiagOverlay = () => {
        if (overlayElement) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'diag-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            background: rgba(33, 40, 66, 0.95);
            color: #e1d4c2; /* dynamic: diagnostic overlay, cannot use Tailwind (cssText) */
            border: 1px solid rgba(225, 212, 194, 0.2);
            border-radius: 12px;
            padding: 16px;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 13px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(10px);
            max-width: 320px;
            pointer-events: auto;
            transition: opacity 0.2s ease;
        `;
        
        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(225, 212, 194, 0.1); padding-bottom: 8px;">
                <span style="font-weight: 600; font-size: 14px;">📊 Diagnostics</span>
                <button id="diag-toggle" class="text-beige" style="background: transparent; border: none;  cursor: pointer; font-size: 18px; padding: 0; width: 24px; height: 24px;">×</button>
            </div>
            <div style="display: grid; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(225, 212, 194, 0.7);">Logs:</span>
                    <span id="diag-log-count" style="font-weight: 600;">0</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: rgba(225, 212, 194, 0.7);">FPS:</span>
                    <span id="diag-fps" style="font-weight: 600;">–</span>
                </div>
                <div id="diag-last-error" style="margin-top: 4px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 11px; display: none;">
                    <div style="font-weight: 600; margin-bottom: 4px; color: #ef4444;">Last Error:</div>
                    <div id="diag-error-msg" style="word-break: break-word; color: rgba(225, 212, 194, 0.9);"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;">
                    <button id="diag-download" style="padding: 6px 10px; background: rgba(167, 139, 250, 0.2); border: 1px solid rgba(167, 139, 250, 0.3); color: #a78bfa; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">Download</button>
                    <button id="diag-clear" style="padding: 6px 10px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;">Clear</button>
                </div>
                <button id="diag-snapshot" style="padding: 6px 10px; background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.3); color: #22c55e; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; margin-top: 2px;">📸 Snapshot</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        overlayElement = overlay;
        
        // Event handlers
        document.getElementById('diag-toggle').addEventListener('click', () => {
            overlayVisible = false;
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 200);
        });
        
        document.getElementById('diag-download').addEventListener('click', () => {
            window.__downloadCollectedLogs();
        });
        
        document.getElementById('diag-clear').addEventListener('click', () => {
            if (confirm('Clear all collected logs and breadcrumbs?')) {
                window.__clearCollectedLogs();
            }
        });
        
        document.getElementById('diag-snapshot').addEventListener('click', () => {
            window.__maybeTakeSnapshot('manual', document.activeElement);
            alert('Snapshot captured! Use Download to export.');
        });
        
        overlayVisible = true;
    };

    const updateOverlay = () => {
        if (!overlayElement) return;
        
        try {
            const logCount = document.getElementById('diag-log-count');
            const fpsEl = document.getElementById('diag-fps');
            const errorBox = document.getElementById('diag-last-error');
            const errorMsg = document.getElementById('diag-error-msg');
            
            if (logCount) logCount.textContent = collectedLogs.length;
            if (fpsEl) fpsEl.textContent = fpsRunning ? fpsValue : '–';
            
            if (lastError && errorBox && errorMsg) {
                errorBox.style.display = 'block';
                errorMsg.textContent = (lastError.message || 'Unknown error').slice(0, 120);
            } else if (errorBox) {
                errorBox.style.display = 'none';
            }
        } catch (e) {}
    };

    // ========================================================================
    // LIGHTWEIGHT INSTRUMENTATION HOOKS
    // ========================================================================
    
    // Scroll logging (throttled)
    let scrollTimer = null;
    window.addEventListener('scroll', () => {
        if (scrollTimer) return;
        scrollTimer = setTimeout(() => {
            window.__pushBreadcrumb('scroll', { y: window.scrollY });
            scrollTimer = null;
        }, 300);
    }, { passive: true });

    // Click tracking
    document.addEventListener('click', (e) => {
        try {
            const t = e.target && (e.target.closest ? e.target.closest('a,button,input') : e.target);
            if (!t) return;
            const info = {
                tag: t.tagName,
                id: t.id || null,
                href: (t.href && t.href.slice(0, 100)) || null
            };
            window.__pushBreadcrumb('click', info);
        } catch (err) {}
    }, { passive: true });

    // Navigation events
    window.addEventListener('hashchange', () => {
        window.__pushBreadcrumb('hashchange', { hash: location.hash });
    });
    window.addEventListener('popstate', () => {
        window.__pushBreadcrumb('popstate', {});
    });

    // Performance observer for longtasks
    try {
        if ('PerformanceObserver' in window) {
            const po = new PerformanceObserver((list) => {
                list.getEntries().forEach(en => {
                    if (en.entryType === 'longtask' && en.duration > 50) {
                        window.__logCollect('perf.longtask', { duration: Math.round(en.duration) });
                    }
                });
            });
            po.observe({ entryTypes: ['longtask'] });
        }
    } catch (e) {}

    // Service worker events
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.__logCollect('sw.controllerchange', {});
            });
        }
    } catch (e) {}

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    document.addEventListener('DOMContentLoaded', () => {
        createDiagOverlay();
        startFpsMeter();
        updateOverlay();
        
        // Restore logs from localStorage
        try {
            const stored = localStorage.getItem('site_collect_logs');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    collectedLogs.push(...parsed.slice(-MAX_LOGS));
                    updateOverlay();
                }
            }
        } catch (e) {}
        
        window.__logCollect('diagnostics.init', {
            logsEnabled: true,
            snapshotsEnabled,
            url: location.href
        });
    });

    // Show overlay toggle button (small pill in bottom-right, near chat)
    const createToggleButton = () => {
        const btn = document.createElement('button');
        btn.id = 'diag-show-btn';
        btn.textContent = '📊';
        btn.title = 'Show Diagnostics';
        btn.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 10000;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(33, 40, 66, 0.9);
            color: #e1d4c2; /* dynamic: diagnostic FAB button, cannot use Tailwind (cssText) */
            border: 1px solid rgba(225, 212, 194, 0.2);
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: transform 0.2s ease;
        `;
        
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
        });
        
        btn.addEventListener('click', () => {
            if (overlayElement) {
                overlayElement.style.display = 'block';
                overlayElement.style.opacity = '1';
                overlayVisible = true;
                updateOverlay();
            }
        });
        
        document.body.appendChild(btn);
    };

    document.addEventListener('DOMContentLoaded', createToggleButton);

})();

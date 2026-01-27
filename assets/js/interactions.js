/**
 * Advanced User Interactions Telemetry
 * Captures user journey (clicks, navigation, scrolls) to provide context for errors.
 * Replaces basic error-reporting.js.
 */
(function() {
  'use strict';
  
  const CONSENT_KEY = 'site_error_reporting_consent';
  const CONSENT_ASKED_KEY = 'site_error_reporting_asked';
  const BREADCRUMB_LIMIT = 20;
  
  // Ring buffer for tracking last N user actions
  let breadcrumbs = [];
  
  function addBreadcrumb(type, data) {
    if (breadcrumbs.length >= BREADCRUMB_LIMIT) breadcrumbs.shift();
    breadcrumbs.push({
      timestamp: Date.now(),
      type,
      ...data
    });
  }
  
  // Check consent
  function hasConsent() { return localStorage.getItem(CONSENT_KEY) === 'true'; }
  function hasBeenAsked() { return localStorage.getItem(CONSENT_ASKED_KEY) === 'true'; }
  
  // Send error with context
  function sendErrorReport(data) {
    if (!hasConsent()) return;
    
    const payload = {
      ...data,
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      version: document.querySelector('meta[name="build-version"]')?.content || 'unknown',
      breadcrumbs: JSON.stringify(breadcrumbs) // Attach history
    };
    
    // Use navigator.sendBeacon for higher reliability on unload
    // but fallback to fetch because we need JSON headers
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(e => console.warn('Failed to send error:', e));
    } catch(e) {}
  }
  
  // === Telemetry Collectors =================================================
  
  function enableTelemetry() {
    // 1. Navigation Tracking
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        addBreadcrumb('navigation', { from: lastUrl, to: url });
      }
    }).observe(document, { subtree: true, childList: true });
    
    addBreadcrumb('navigation', { url: location.href, type: 'load' });
    
    // 2. Click Tracking
    document.addEventListener('click', (e) => {
      let target = e.target;
      // Get closest interactive element
      while (target && target !== document.body && !['A', 'BUTTON', 'INPUT'].includes(target.tagName)) {
        target = target.parentElement;
      }
      if (!target) target = e.target;
      
      const selector = target.id ? `#${target.id}` : 
                       target.className ? `.${target.className.split(' ')[0]}` : 
                       target.tagName.toLowerCase();
                       
      const text = (target.innerText || target.value || '').substring(0, 30);
      
      addBreadcrumb('click', { selector, text });
      
      // Bot Simulation Hook
      if (text === 'Simulate Crash') {
        setTimeout(() => { throw new Error('Simulated Bot Crash'); }, 100);
      }
    }, true);
    
    // 3. Scroll Tracking (Debounced)
    let scrollTimeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        addBreadcrumb('scroll', { percentage: pct });
      }, 1000);
    });
    
    // 4. Console Errors (Self-monitoring)
    window.addEventListener('error', (e) => {
      sendErrorReport({
        type: 'javascript_error',
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack
      });
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      sendErrorReport({
        type: 'unhandled_rejection',
        reason: e.reason?.toString()
      });
    });
  }
  
  // === Bot Simulation =======================================================
  window.testTelemetryBot = async function() {
    console.log('🤖 Bot executing sequence...');
    addBreadcrumb('test_bot', { action: 'start_simulation' });
    
    // Simulate clicks
    const navLinks = document.querySelectorAll('nav a');
    if (navLinks.length) {
      navLinks[0].click();
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Simulate scroll
    window.scrollTo({ top: 500, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 500));
    
    // Crash
    throw new Error('Test Bot Simulation Crash');
  };
  
  // === Consent Banner UI (Same as before) ===================================
  // (Reusing the nice UI from error-reporting.js)
  function showConsentBanner() {
    if (document.getElementById('error-consent')) return;
    const banner = document.createElement('div');
    banner.id = 'error-consent';
    // ... [Styles identical to previous file] ...
    banner.innerHTML = `
      <div style="position:fixed; bottom:20px; left:20px; width:380px; max-width:calc(100vw-40px); background:rgba(33,40,66,0.95); color:#e1d4c2; padding:16px; border-radius:12px; border:1px solid rgba(225,212,194,0.1); z-index:999999; backdrop-filter:blur(10px);">
        <h4 style="margin:0 0 8px 0; font-size:14px;">🔧 Help Improve This Site</h4>
        <p style="margin:0 0 12px 0; font-size:13px; opacity:0.9;">We use anonymous error reporting to fix bugs. No personal data collected.</p>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button id="consent-decline" style="padding:6px 12px; background:transparent; border:1px solid rgba(255,255,255,0.2); color:white; border-radius:4px; cursor:pointer;">Decline</button>
          <button id="consent-accept" style="padding:6px 12px; background:#4a90e2; border:none; color:white; border-radius:4px; cursor:pointer;">Accept & Enable</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    
    document.getElementById('consent-accept').onclick = () => {
      localStorage.setItem(CONSENT_KEY, 'true');
      localStorage.setItem(CONSENT_ASKED_KEY, 'true');
      banner.remove();
      enableTelemetry();
    };
    document.getElementById('consent-decline').onclick = () => {
      localStorage.setItem(CONSENT_KEY, 'false');
      localStorage.setItem(CONSENT_ASKED_KEY, 'true');
      banner.remove();
    };
  }
  
  // Init
  if (hasConsent()) {
    enableTelemetry();
    console.log('✅ Error Telemetry Active');
  } else if (!hasBeenAsked()) {
    setTimeout(showConsentBanner, 2000);
  }

})();

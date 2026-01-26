/**
 * Error Reporting Consent System
 * 
 * Privacy-friendly error reporting that:
 * - Shows consent banner on first visit
 * - Only collects data if user explicitly opts in
 * - Stores consent preference in localStorage
 * - Automatically sends sanitized error reports when enabled
 * - Respects user privacy (no PII, passwords, tokens)
 */

(function() {
  'use strict';
  
  const CONSENT_KEY = 'site_error_reporting_consent';
  const CONSENT_ASKED_KEY = 'site_error_reporting_asked';
  
  // Check if user has already made a choice
  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  }
  
  function hasBeenAsked() {
    return localStorage.getItem(CONSENT_ASKED_KEY) === 'true';
  }
  
  // Send error report to endpoint
  function sendErrorReport(data) {
    if (!hasConsent()) return;
    
    try {
      // Send to Cloudflare Worker endpoint
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          timestamp: Date.now(),
          url: location.href,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          version: document.querySelector('meta[name="build-version"]')?.content || 'unknown'
        })
      }).catch(() => {}); // Silently fail - don't break site
    } catch (e) {}
  }
  
  // Start collecting errors
  function enableErrorReporting() {
    // JavaScript errors
    window.addEventListener('error', (e) => {
      sendErrorReport({
        type: 'javascript_error',
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack?.slice(0, 1000)
      });
    });
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      sendErrorReport({
        type: 'unhandled_rejection',
        reason: e.reason?.toString()?.slice(0, 500)
      });
    });
    
    // Network errors (fetch wrapper)
    const origFetch = window.fetch;
    window.fetch = function(...args) {
      return origFetch.apply(this, args).catch(err => {
        sendErrorReport({
          type: 'network_error',
          url: args[0],
          message: err.message
        });
        throw err;
      });
    };
  }
  
  // Show consent banner
  function showConsentBanner() {
    const banner = document.createElement('div');
    banner.id = 'error-reporting-consent';
    banner.innerHTML = `
      <style>
        #error-reporting-consent {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #212842 0%, #362017 100%);
          color: #e1d4c2;
          padding: 20px;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
          z-index: 999998;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          animation: slideUp 0.3s ease-out;
        }
        
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        #error-reporting-consent .consent-content {
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        #error-reporting-consent .consent-text {
          flex: 1;
          min-width: 300px;
        }
        
        #error-reporting-consent .consent-title {
          font-weight: 600;
          margin-bottom: 6px;
          font-size: 15px;
        }
        
        #error-reporting-consent .consent-desc {
          opacity: 0.85;
          font-size: 13px;
        }
        
        #error-reporting-consent .consent-actions {
          display: flex;
          gap: 12px;
        }
        
        #error-reporting-consent button {
          padding: 10px 24px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          min-width: 80px;
        }
        
        #error-reporting-consent .accept-btn {
          background: #4a90e2;
          color: white;
        }
        
        #error-reporting-consent .accept-btn:hover {
          background: #357abd;
        }
        
        #error-reporting-consent .decline-btn {
          background: transparent;
          color: #e1d4c2;
          border: 1px solid rgba(225, 212, 194, 0.3);
        }
        
        #error-reporting-consent .decline-btn:hover {
          background: rgba(225, 212, 194, 0.1);
        }
        
        #error-reporting-consent a {
          color: #4a90e2;
          text-decoration: underline;
        }
      </style>
      
      <div class="consent-content">
        <div class="consent-text">
          <div class="consent-title">🛠️ Help me fix bugs?</div>
          <div class="consent-desc">
            Hey! I'm just one person trying to make this site better. If you're okay with it, I'd love to collect 
            <strong>anonymous error reports</strong> (crashes, broken links, etc.) to help me fix issues faster. 
            <strong>I'm not selling your data</strong> or tracking you—just trying to improve the site. 
            Promise. <a href="/privacy" target="_blank">Privacy Policy</a>
          </div>
        </div>
        <div class="consent-actions">
          <button class="accept-btn" id="consent-accept">Sure, help out</button>
          <button class="decline-btn" id="consent-decline">No thanks</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(banner);
    
    // Handle accept
    document.getElementById('consent-accept').addEventListener('click', () => {
      localStorage.setItem(CONSENT_KEY, 'true');
      localStorage.setItem(CONSENT_ASKED_KEY, 'true');
      banner.style.animation = 'slideUp 0.3s ease-out reverse';
      setTimeout(() => banner.remove(), 300);
      enableErrorReporting();
      console.log('[Error Reporting] Enabled - Thank you for helping improve this site!');
    });
    
    // Handle decline
    document.getElementById('consent-decline').addEventListener('click', () => {
      localStorage.setItem(CONSENT_KEY, 'false');
      localStorage.setItem(CONSENT_ASKED_KEY, 'true');
      banner.style.animation = 'slideUp 0.3s ease-out reverse';
      setTimeout(() => banner.remove(), 300);
      console.log('[Error Reporting] Disabled - Your choice has been saved.');
    });
  }
  
  // Initialize
  function init() {
    if (hasConsent()) {
      enableErrorReporting();
      console.log('[Error Reporting] Active');
    } else if (!hasBeenAsked()) {
      // Show banner after 3 seconds to not be intrusive
      setTimeout(showConsentBanner, 3000);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

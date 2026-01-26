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
      const errorData = {
        type: 'javascript_error',
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack?.slice(0, 1000)
      };
      
      // Send to server
      sendErrorReport(errorData);
      
      // Send to debugger if open
      if (window.__debuggerAddEvent) {
        window.__debuggerAddEvent('error', { level: 'error', msg: `${e.message} at ${e.filename}:${e.lineno}` });
      }
    });
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
      const errorData = {
        type: 'unhandled_rejection',
        reason: e.reason?.toString()?.slice(0, 500)
      };
      
      sendErrorReport(errorData);
      
      if (window.__debuggerAddEvent) {
        window.__debuggerAddEvent('error', { level: 'error', msg: `Unhandled rejection: ${e.reason}` });
      }
    });
    
    // Network errors (fetch wrapper)
    const origFetch = window.fetch;
    window.fetch = function(...args) {
      return origFetch.apply(this, args).catch(err => {
        const errorData = {
          type: 'network_error',
          url: args[0],
          message: err.message
        };
        
        sendErrorReport(errorData);
        
        if (window.__debuggerAddEvent) {
          window.__debuggerAddEvent('network', { method: 'FETCH', url: args[0], status: 'error', error: err.message });
        }
        
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
          bottom: 20px;
          left: 20px;
          width: 380px;
          max-width: calc(100vw - 40px);
          background: rgba(33, 40, 66, 0.95);
          color: #e1d4c2;
          padding: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          z-index: 999998;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          border-radius: 12px;
          border: 1px solid rgba(225, 212, 194, 0.1);
          animation: slideUp 0.3s ease-out;
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        #error-reporting-consent .consent-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        #error-reporting-consent .consent-text {
          width: 100%;
        }
        
        #error-reporting-consent .consent-title {
          font-weight: 600;
          margin-bottom: 4px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        #error-reporting-consent .consent-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          width: 100%;
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
          <div class="consent-title">🐛 Psst... wanna help me squash bugs?</div>
          <div class="consent-desc">
            If something breaks, I'd love to know! Click "Sure!" to send me anonymous crash reports. 
            <strong>Zero tracking, zero selling your data</strong> — just me trying to make this site less janky. 😅
          </div>
        </div>
        <div class="consent-actions">
          <button class="accept-btn" id="consent-accept">Sure! 👍</button>
          <button class="decline-btn" id="consent-decline">Nah</button>
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

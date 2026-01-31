/**
 * Diagnostics Panel Debugger
 * Run this in the browser console on /dashboard to diagnose button issues
 * 
 * Usage:
 * 1. Open dashboard in browser
 * 2. Open DevTools console (F12)
 * 3. Copy and paste this entire script
 * 4. Run: window.debugDiagnosticsPanel()
 */

(function() {
  'use strict';

  window.debugDiagnosticsPanel = function() {
    console.log('%c=== DIAGNOSTICS PANEL DEBUGGER ===', 'color: cyan; font-size: 16px; font-weight: bold');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL:', window.location.href);
    console.log('');

    const results = {
      passed: [],
      failed: [],
      warnings: []
    };

    function pass(test) {
      console.log('%c✓ PASS:', 'color: green; font-weight: bold', test);
      results.passed.push(test);
    }

    function fail(test, details) {
      console.error('%c✗ FAIL:', 'color: red; font-weight: bold', test);
      if (details) console.error('  Details:', details);
      results.failed.push({ test, details });
    }

    function warn(test, details) {
      console.warn('%c⚠ WARN:', 'color: orange; font-weight: bold', test);
      if (details) console.warn('  Details:', details);
      results.warnings.push({ test, details });
    }

    // Test 1: Check if dashboard is loaded
    console.log('%c\n1. Dashboard State', 'color: yellow; font-weight: bold');
    const dashboard = document.getElementById('dashboard');
    if (dashboard && dashboard.style.display !== 'none') {
      pass('Dashboard is visible');
    } else {
      fail('Dashboard is not visible', { display: dashboard?.style.display });
    }

    // Test 2: Check DOM elements exist
    console.log('%c\n2. DOM Elements', 'color: yellow; font-weight: bold');
    const elements = {
      'open-diagnostics': document.getElementById('open-diagnostics'),
      'close-diagnostics': document.getElementById('close-diagnostics'),
      'diagnostics-mount': document.getElementById('diagnostics-mount'),
      'diagnostics-status': document.getElementById('diagnostics-status')
    };

    Object.entries(elements).forEach(([id, el]) => {
      if (el) {
        pass(`Element #${id} exists`);
        console.log(`  HTML:`, el.outerHTML.substring(0, 150));
      } else {
        fail(`Element #${id} NOT FOUND`);
      }
    });

    // Test 3: Check button states
    console.log('%c\n3. Button States', 'color: yellow; font-weight: bold');
    const openBtn = elements['open-diagnostics'];
    const closeBtn = elements['close-diagnostics'];

    if (openBtn) {
      console.log('Open button:');
      console.log('  - disabled:', openBtn.disabled);
      console.log('  - display:', getComputedStyle(openBtn).display);
      console.log('  - visibility:', getComputedStyle(openBtn).visibility);
      console.log('  - pointer-events:', getComputedStyle(openBtn).pointerEvents);
      console.log('  - opacity:', getComputedStyle(openBtn).opacity);
      
      if (getComputedStyle(openBtn).pointerEvents === 'none') {
        fail('Open button has pointer-events: none');
      } else {
        pass('Open button is clickable (pointer-events)');
      }
    }

    if (closeBtn) {
      console.log('Close button:');
      console.log('  - disabled:', closeBtn.disabled);
      console.log('  - display:', getComputedStyle(closeBtn).display);
      console.log('  - visibility:', getComputedStyle(closeBtn).visibility);
      console.log('  - pointer-events:', getComputedStyle(closeBtn).pointerEvents);
    }

    // Test 4: Check event listeners
    console.log('%c\n4. Event Listeners', 'color: yellow; font-weight: bold');
    if (openBtn) {
      const listeners = getEventListeners ? getEventListeners(openBtn) : null;
      if (listeners && listeners.click) {
        pass(`Open button has ${listeners.click.length} click listener(s)`);
        console.log('  Listeners:', listeners.click);
      } else if (!getEventListeners) {
        warn('Cannot check listeners (getEventListeners not available)');
      } else {
        fail('Open button has NO click listeners');
      }
    }

    // Test 5: Check JavaScript globals
    console.log('%c\n5. JavaScript Globals', 'color: yellow; font-weight: bold');
    const globals = {
      '__SavonieHUD': window.__SavonieHUD,
      '__SavonieTelemetry': window.__SavonieTelemetry,
      '__SavonieDiagnosticsConsent': window.__SavonieDiagnosticsConsent,
      'diagnosticsState': window.diagnosticsState
    };

    Object.entries(globals).forEach(([name, value]) => {
      if (value !== undefined) {
        pass(`${name} is defined`);
        console.log(`  Value:`, value);
        
        if (name === '__SavonieHUD' && value) {
          console.log('  - open function:', typeof value.open);
          console.log('  - close function:', typeof value.close);
        }
      } else {
        fail(`${name} is undefined`);
      }
    });

    // Test 6: Check scripts loaded
    console.log('%c\n6. Scripts Loaded', 'color: yellow; font-weight: bold');
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src);
    const requiredScripts = [
      'dashboard.js',
      'telemetry-core.js',
      'debugger-hud.min.js'
    ];

    requiredScripts.forEach(script => {
      const found = scripts.some(src => src.includes(script));
      if (found) {
        pass(`${script} is loaded`);
      } else {
        warn(`${script} might not be loaded`, { allScripts: scripts });
      }
    });

    // Test 7: Check diagnostics mount content
    console.log('%c\n7. Diagnostics Mount Content', 'color: yellow; font-weight: bold');
    const mount = elements['diagnostics-mount'];
    if (mount) {
      console.log('Mount innerHTML length:', mount.innerHTML.length);
      console.log('Mount children count:', mount.children.length);
      if (mount.children.length > 0) {
        console.log('Mount first child:', mount.children[0].className);
        warn('Mount has pre-existing content', { html: mount.innerHTML.substring(0, 200) });
      } else {
        pass('Mount is empty (ready for HUD)');
      }
    }

    // Test 8: Check for CSS conflicts
    console.log('%c\n8. CSS Conflicts', 'color: yellow; font-weight: bold');
    const diagnosticsPanel = document.querySelector('.diagnostics-panel');
    if (diagnosticsPanel) {
      const styles = getComputedStyle(diagnosticsPanel);
      console.log('Diagnostics panel:');
      console.log('  - z-index:', styles.zIndex);
      console.log('  - position:', styles.position);
      console.log('  - pointer-events:', styles.pointerEvents);
      
      if (styles.pointerEvents === 'none') {
        fail('Diagnostics panel has pointer-events: none');
      }
    }

    // Test 9: Try manual click
    console.log('%c\n9. Manual Click Test', 'color: yellow; font-weight: bold');
    if (openBtn && !openBtn.disabled) {
      console.log('Attempting programmatic click on open button...');
      try {
        openBtn.click();
        pass('Programmatic click executed');
      } catch (e) {
        fail('Programmatic click failed', e);
      }
    } else if (openBtn && openBtn.disabled) {
      warn('Open button is disabled, skipping click test');
    }

    // Test 10: Check for JavaScript errors
    console.log('%c\n10. Console Errors Check', 'color: yellow; font-weight: bold');
    console.log('Check the console above for any JavaScript errors');
    warn('Manual review required for console errors');

    // Test 11: Check Savonie HUD tabs if rendered
    console.log('%c\n11. Savonie HUD Tabs', 'color: yellow; font-weight: bold');
    const savoniePanel = document.querySelector('.savonie-panel');
    if (savoniePanel) {
      pass('Savonie panel is rendered');
      const tabs = savoniePanel.querySelectorAll('.savonie-tab');
      console.log('  - Tab count:', tabs.length);
      tabs.forEach((tab, i) => {
        console.log(`  - Tab ${i}:`, tab.textContent, '| aria-selected:', tab.getAttribute('aria-selected'));
      });
      
      if (tabs.length > 0) {
        console.log('\nAttempting to click first tab...');
        try {
          tabs[0].click();
          pass('Tab click executed');
        } catch (e) {
          fail('Tab click failed', e);
        }
      }
    } else {
      warn('Savonie panel not yet rendered');
    }

    // Summary
    console.log('%c\n=== SUMMARY ===', 'color: cyan; font-size: 16px; font-weight: bold');
    console.log(`%c✓ Passed: ${results.passed.length}`, 'color: green');
    console.log(`%c✗ Failed: ${results.failed.length}`, 'color: red');
    console.log(`%c⚠ Warnings: ${results.warnings.length}`, 'color: orange');

    if (results.failed.length > 0) {
      console.log('%c\nFailed Tests:', 'color: red; font-weight: bold');
      results.failed.forEach(f => {
        console.log(`  - ${f.test}`);
        if (f.details) console.log('    Details:', f.details);
      });
    }

    // Recommended actions
    console.log('%c\n=== RECOMMENDED ACTIONS ===', 'color: magenta; font-weight: bold');
    if (results.failed.some(f => f.test.includes('listener'))) {
      console.log('• Event listeners are missing - check if dashboard.js initDiagnosticsPanel() is running');
    }
    if (results.failed.some(f => f.test.includes('pointer-events'))) {
      console.log('• CSS is blocking clicks - check dashboard.css for pointer-events: none');
    }
    if (results.failed.some(f => f.test.includes('undefined'))) {
      console.log('• JavaScript modules not loaded - check script loading order');
    }
    if (results.warnings.some(w => w.test.includes('pre-existing content'))) {
      console.log('• Mount has pre-rendered content - initDiagnosticsPanel() may not be clearing it');
    }

    console.log('%c\n=== END REPORT ===', 'color: cyan; font-size: 16px; font-weight: bold');
    
    return {
      passed: results.passed.length,
      failed: results.failed.length,
      warnings: results.warnings.length,
      details: results
    };
  };

  // Auto-run if in dashboard
  if (window.location.pathname.includes('dashboard')) {
    console.log('%c[Auto-Debug] Dashboard detected, run window.debugDiagnosticsPanel() to start', 'color: cyan');
  }

  console.log('%c[Debug Script Loaded] Run: window.debugDiagnosticsPanel()', 'color: green; font-weight: bold');
})();

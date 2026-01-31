/**
 * Debug utility: Check what element is receiving clicks at button centers
 * 
 * Usage in browser console:
 *   await fetch('/scripts/debug-click-target.js').then(r => r.text()).then(eval);
 *   window.debugClickTargets();
 */

window.debugClickTargets = function(options = {}) {
  const { visualize = true } = options;
  
  console.log('%c[Debug Click Targets] Starting analysis...', 'color: cyan; font-weight: bold');
  
  const buttons = [
    { id: 'open-diagnostics', label: 'Open Diagnostics' },
    { id: 'close-diagnostics', label: 'Close Diagnostics' },
    // Also check typical tab buttons if they exist
    ...Array.from(document.querySelectorAll('button.savonie-tab')).map((b, i) => ({
      element: b,
      id: b.id || `tab-${i}`,
      label: `Tab: ${b.textContent?.trim() || 'Untitled'}`
    }))
  ];
  
  // Clean up any previous visualization overlays
  const existingOverlays = document.querySelectorAll('.debug-overlay-rect');
  existingOverlays.forEach(el => el.remove());

  const results = [];
  
  buttons.forEach(item => {
    let btn = item.element;
    const { id, label } = item;
    
    if (!btn && id) {
      btn = document.getElementById(id);
    }
    
    if (!btn) {
      if (!id.startsWith('tab-')) { // Don't warn for dynamic tabs if not found
          results.push({ id, label, error: 'Button not found in DOM' });
      }
      return;
    }
    
    const rect = btn.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
       results.push({ id, label, error: 'Button is not visible (0x0 dim)' });
       return;
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // What element is at the center?
    const elementAtCenter = document.elementFromPoint(centerX, centerY);
    
    // Computed styles
    const computed = window.getComputedStyle(btn);

    const isSameElement = elementAtCenter && (elementAtCenter === btn || btn.contains(elementAtCenter));
    
    // Visualize blocking element if requested
    if (visualize && !isSameElement && elementAtCenter) {
      const blockRect = elementAtCenter.getBoundingClientRect();
      const div = document.createElement('div');
      div.className = 'debug-overlay-rect';
      div.style.position = 'fixed';
      div.style.left = `${blockRect.left}px`;
      div.style.top = `${blockRect.top}px`;
      div.style.width = `${blockRect.width}px`;
      div.style.height = `${blockRect.height}px`;
      div.style.border = '2px solid red';
      div.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
      div.style.zIndex = '999999';
      div.style.pointerEvents = 'none'; // Don't interfere with interactions
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'center';
      div.style.color = 'red';
      div.style.fontSize = '12px';
      div.style.fontWeight = 'bold';
      div.style.textShadow = '0px 0px 2px white';
      div.textContent = `BLOCKING: <${elementAtCenter.tagName?.toLowerCase()}>.${elementAtCenter.className?.split(' ').join('.')}`;
      document.body.appendChild(div);
      
      // Auto-remove after 5 seconds to not be annoying
      setTimeout(() => div.remove(), 5000);
    }
    
    results.push({
      id,
      label,
      button: btn,
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      center: { x: centerX, y: centerY },
      elementAtCenter,
      elementAtCenterTag: elementAtCenter?.tagName,
      elementAtCenterId: elementAtCenter?.id || '(no id)',
      elementAtCenterClass: elementAtCenter?.className || '(no class)',
      isSameElement,
      styles: {
        pointerEvents: computed.pointerEvents,
        zIndex: computed.zIndex,
        position: computed.position,
        display: computed.display,
        visibility: computed.visibility,
        opacity: computed.opacity
      },
      disabled: btn.disabled,
      hasClickListener: typeof getEventListeners === 'function' 
        ? (getEventListeners(btn).click?.length || 0) 
        : 'unavailable (DevTools only)'
    });
  });
  
  console.group('%c[Debug Click Targets] Results', 'color: lime; font-weight: bold');
  results.forEach(r => {
    const status = r.error 
      ? '❌ ERROR' 
      : r.isSameElement 
        ? '✅ CLICKABLE' 
        : '⚠️ BLOCKED';
    
    // Different console group color for errors vs success
    if (r.error || !r.isSameElement) {
        console.group(`%c${status} ${r.label} (#${r.id})`, 'color: red');
    } else {
        console.groupCollapsed(`${status} ${r.label} (#${r.id})`);
    }

    if (r.error) {
      console.error(r.error);
    } else {
      console.log('Button element:', r.button);
      console.log('Center coordinates:', r.center);
      console.log('Element at center:', r.elementAtCenter);
      console.log('Element at center is button?', r.isSameElement);
      if (!r.isSameElement) {
        console.warn('🚨 BLOCKING ELEMENT:', 
          `<${r.elementAtCenterTag}>`, 
          `ID: ${r.elementAtCenterId}`, 
          `Class: ${r.elementAtCenterClass}`
        );
        console.warn('Blocking Element Debug:', r.elementAtCenter);
      }
      console.log('Styles:', r.styles);
      console.log('Disabled?', r.disabled);
      console.log('Click listeners:', r.hasClickListener);
    }
    console.groupEnd();
  });
  console.groupEnd();
  
  // Summary
  const blocked = results.filter(r => !r.error && !r.isSameElement);
  if (blocked.length > 0) {
    console.error('%c🚨 DIAGNOSIS: Some buttons are blocked by overlays!', 'color: red; font-size: 14px; font-weight: bold');
    blocked.forEach(r => {
      console.error(`  - ${r.label}: blocked by <${r.elementAtCenterTag}> ${r.elementAtCenterId} (${r.elementAtCenterClass})`);
    });
    if (visualize) {
        console.log('%c(Visual overlays added to blocking elements for 5 seconds)', 'color: gray; font-style: italic');
    }
  } else {
    console.log('%c✅ All buttons appear clickable (no overlays detected)', 'color: green; font-size: 14px; font-weight: bold');
  }
  
  return results;
};

console.log('%c[Debug Click Targets] Loaded. Run: window.debugClickTargets()', 'color: yellow; font-weight: bold');

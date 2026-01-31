/**
 * Debug utility: Check what element is receiving clicks at button centers
 * 
 * Usage in browser console:
 *   await fetch('/scripts/debug-click-target.js').then(r => r.text()).then(eval);
 *   window.debugClickTargets();
 */

window.debugClickTargets = function() {
  console.log('%c[Debug Click Targets] Starting analysis...', 'color: cyan; font-weight: bold');
  
  const buttons = [
    { id: 'open-diagnostics', label: 'Open Diagnostics' },
    { id: 'close-diagnostics', label: 'Close Diagnostics' }
  ];
  
  const results = [];
  
  buttons.forEach(({ id, label }) => {
    const btn = document.getElementById(id);
    if (!btn) {
      results.push({ id, label, error: 'Button not found in DOM' });
      return;
    }
    
    const rect = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // What element is at the center?
    const elementAtCenter = document.elementFromPoint(centerX, centerY);
    
    // Computed styles
    const computed = window.getComputedStyle(btn);
    
    results.push({
      id,
      label,
      button: btn,
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      center: { x: centerX, y: centerY },
      elementAtCenter,
      elementAtCenterTag: elementAtCenter?.tagName,
      elementAtCenterId: elementAtCenter?.id || '(no id)',
      isSameElement: elementAtCenter === btn,
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
        : 'getEventListeners not available (use DevTools)'
    });
  });
  
  console.group('%c[Debug Click Targets] Results', 'color: lime; font-weight: bold');
  results.forEach(r => {
    const status = r.error 
      ? '❌ ERROR' 
      : r.isSameElement 
        ? '✅ CLICKABLE' 
        : '⚠️ BLOCKED';
    
    console.group(`${status} ${r.label} (#${r.id})`);
    if (r.error) {
      console.error(r.error);
    } else {
      console.log('Button element:', r.button);
      console.log('Center coordinates:', r.center);
      console.log('Element at center:', r.elementAtCenter);
      console.log('Element at center is button?', r.isSameElement);
      if (!r.isSameElement) {
        console.warn('🚨 BLOCKING ELEMENT:', r.elementAtCenterTag, r.elementAtCenterId);
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
      console.error(`  - ${r.label}: blocked by <${r.elementAtCenterTag}> ${r.elementAtCenterId}`);
    });
  } else {
    console.log('%c✅ All buttons appear clickable (no overlays detected)', 'color: green; font-size: 14px; font-weight: bold');
  }
  
  return results;
};

console.log('%c[Debug Click Targets] Loaded. Run: window.debugClickTargets()', 'color: yellow; font-weight: bold');

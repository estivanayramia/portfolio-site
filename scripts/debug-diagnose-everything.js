window.diagnoseEverything = function() {
  console.group("🕵️‍♂️ SAVONIE DIAGNOSTICS CT SCAN");
  const tabs = document.querySelectorAll('.savonie-tab');
  console.log(`Found ${tabs.length} tabs.`);

  if (tabs.length === 0) {
    console.error("❌ No tabs found! passed selector '.savonie-tab'");
    console.groupEnd();
    return;
  }

  tabs.forEach((tab, i) => {
    const rect = tab.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    console.group(`👉 Tab "${tab.textContent.trim()}" (#${i})`);
    console.log("Position:", `x=${Math.round(centerX)}, y=${Math.round(centerY)}`);
    
    // 1. VISUAL HIT TEST
    const topEl = document.elementFromPoint(centerX, centerY);
    const isSelf = topEl === tab || tab.contains(topEl);
    
    if (isSelf) {
      console.log("✅ HIT-TEST PASS: Top element is this tab.");
    } else {
      console.error("❌ HIT-TEST FAIL: Top element is NOT this tab.");
      console.log("🚨 BLOCKED BY:", topEl);
      if (topEl) {
        console.log("   Blocker Class:", topEl.className);
        console.log("   Blocker ID:", topEl.id);
        console.log("   Blocker Z-Index:", window.getComputedStyle(topEl).zIndex);
        
        // Visualize blocker
        topEl.style.outline = "4px solid red";
        topEl.style.boxShadow = "0 0 20px red";
        setTimeout(() => { topEl.style.outline = ""; topEl.style.boxShadow = ""; }, 3000);
      }
    }

    // 2. POINTER EVENTS ANCESTRY
    let el = tab;
    let stuck = false;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const pe = style.pointerEvents;
      if (pe === "none") {
        console.error(`❌ BLOCKER ANCESTOR:`, el);
        console.log(`   Reason: pointer-events: none`);
        stuck = true;
      }
      el = el.parentElement;
    }
    if (!stuck) console.log("✅ Ancestry Check Pass: No 'pointer-events: none' found in tree.");

    // 3. FORCE CLICK (Sanity Check)
    console.log("Attempting programmatic click...");
    try {
      if (tab.onclick) console.log("   Has onclick handler.");
      // We can't see addEventListener handlers easily, but we can fire event.
      tab.click();
      console.log("   Programmatic click fired.");
    } catch(e) {
      console.error("   Click error:", e);
    }
    
    console.groupEnd();
  });
  
  console.groupEnd();
};

console.log("✅ debug-diagnose-everything.js loaded.");
console.log("👉 Run: window.diagnoseEverything()");
if (window.confirm("Run full diagnostics scan now?")) {
    window.diagnoseEverything();
}

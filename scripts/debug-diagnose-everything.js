window.diagnoseEverything = async function() {
  console.clear();
  console.group("🕵️‍♂️ SAVONIE DIAGNOSTICS CT SCAN (v2)");
  
  // 1. CHECK GLOBAL HUD OBJECT
  if (!window.__SavonieHUD) {
    console.error("❌ CRTICAL: window.__SavonieHUD is undefined!");
    console.log("   This means the 'debugger-hud.js' script failed to load or crashed.");
    console.groupEnd();
    return;
  }
  console.log("✅ window.__SavonieHUD exists.");

  // 2. FORCE OPEN
  console.log("🔄 Attempting to force-open HUD...");
  try {
    window.__SavonieHUD.open();
    console.log("   open() function called successfully.");
  } catch (e) {
    console.error("❌ CRITICAL: open() threw an error:", e);
  }

  // 3. WAIT FOR RENDER (Short delay)
  console.log("⏳ Waiting 500ms for DOM update...");
  await new Promise(r => setTimeout(r, 500));

  // 4. CHECK PANEL EXISTENCE
  const panel = document.querySelector('.savonie-panel');
  if (!panel) {
    console.error("❌ CRITICAL: .savonie-panel NOT found in DOM after open()!");
    console.groupEnd();
    return;
  }
  console.log("✅ .savonie-panel found in DOM.");
  console.log("   Panel Z-Index:", window.getComputedStyle(panel).zIndex);
  console.log("   Panel Visibility:", window.getComputedStyle(panel).visibility);
  console.log("   Panel Display:", window.getComputedStyle(panel).display);

  // 5. FIND TABS
  const tabs = document.querySelectorAll('.savonie-tab');
  console.log(`🔎 Found ${tabs.length} tabs.`);

  if (tabs.length === 0) {
    console.error("❌ CRITICAL: Panel exists but NO TABS found. render() might have failed.");
    console.groupEnd();
    return;
  }

  // 6. HIT TEST TABS
  tabs.forEach((tab, i) => {
    const rect = tab.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    console.groupCollapsed(`👉 Tab "${tab.textContent.trim()}" (#${i})`);
    console.log("Position:", `x=${Math.round(centerX)}, y=${Math.round(centerY)}`);
    
    const topEl = document.elementFromPoint(centerX, centerY);
    const isSelf = topEl === tab || tab.contains(topEl);
    
    if (isSelf) {
      console.log("✅ HIT-TEST PASS: Top element is this tab.");
    } else {
      console.error("❌ HIT-TEST FAIL: Top element is NOT this tab.");
      console.log("🚨 BLOCKED BY:", topEl);
      if (topEl) {
        // Highlighting blocker
        topEl.style.outline = "4px solid red";
        setTimeout(() => topEl.style.outline = "", 1000);
      }
    }
    console.groupEnd();
  });
  
  console.groupEnd();
  console.log("✅ Scan Complete.");
};

window.diagnoseEverything();

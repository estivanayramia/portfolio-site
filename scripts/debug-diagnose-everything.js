window.diagnoseEverything = async function() {
  console.clear();
  console.group("🕵️‍♂️ SAVONIE DIAGNOSTICS CT SCAN (v3 - Auto-Load)");
  
  // 1. CHECK IF LOADED
  if (!window.__SavonieHUD) {
    console.warn("⚠️ window.__SavonieHUD is undefined. HUD logic not loaded yet.");
    console.log("🔄 Attempting to find and click '#open-diagnostics' to trigger lazy-load...");
    
    const openBtn = document.getElementById('open-diagnostics');
    if (!openBtn) {
      console.error("❌ CRITICAL: Could not find '#open-diagnostics' button!");
      console.groupEnd();
      return;
    }
    
    console.log("👉 Clicking '#open-diagnostics'...");
    openBtn.click();
    
    // Poll for the global to appear (max 5s)
    console.log("⏳ Waiting for HUD script to load...");
    const loaded = await new Promise(resolve => {
        let attempts = 0;
        const interval = setInterval(() => {
            if (window.__SavonieHUD) {
                clearInterval(interval);
                resolve(true);
            }
            if (attempts++ > 50) { // 50 * 100ms = 5s
                clearInterval(interval);
                resolve(false);
            }
        }, 100);
    });

    if (!loaded) {
        console.error("❌ CRITICAL: Timeout waiting for window.__SavonieHUD to define.");
        console.groupEnd();
        return;
    }
  }
  
  console.log("✅ window.__SavonieHUD is ready.");

  // 2. FORCE OPEN (Idempotent)
  console.log("🔄 Ensuring panel is open...");
  try {
    if (window.__SavonieHUD.open) window.__SavonieHUD.open();
  } catch (e) {
    console.error("❌ Error running open():", e);
  }

  // 3. WAIT FOR RENDER
  console.log("⏳ Waiting 500ms for DOM render...");
  await new Promise(r => setTimeout(r, 500));

  // 4. SCAN DOM
  const panel = document.querySelector('.savonie-panel');
  if (!panel) {
    console.error("❌ CRITICAL: .savonie-panel NOT found in DOM (Render failed).");
    console.groupEnd();
    return;
  }
  
  const computed = window.getComputedStyle(panel);
  console.log(`✅ Panel found. z-index: ${computed.zIndex}, visibility: ${computed.visibility}`);

  // 5. CHECK TABS
  const tabs = document.querySelectorAll('.savonie-tab');
  console.log(`🔎 Found ${tabs.length} tabs.`);

  if (tabs.length === 0) {
    console.error("❌ CRITICAL: Panel is empty (No tabs).");
    console.groupEnd();
    return;
  }

  // 6. HIT TEST
  console.log("🎯 Running Hit-Tests...");
  tabs.forEach((tab, i) => {
    const rect = tab.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(centerX, centerY);
    const isSelf = topEl === tab || tab.contains(topEl);
    
    if (isSelf) {
      console.log(`✅ Tab "${tab.textContent.trim()}": PASS`);
    } else {
      console.error(`❌ Tab "${tab.textContent.trim()}": BLOCKED BY`, topEl);
      if (topEl) {
          topEl.style.outline = "4px solid red"; 
          setTimeout(() => topEl.style.outline = "", 1000);
      }
    }
  });

  console.groupEnd();
  console.log("✅ Scan Complete.");
};

window.diagnoseEverything();

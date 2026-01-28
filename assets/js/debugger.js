// Deprecated shim.
// The HUD is now loaded lazily via assets/js/site.js -> debugger-hud.min.js
// This file must not wrap console/fetch/XHR.
(() => {
  try {
    console.info("[Diagnostics] debugger.js is deprecated. HUD loads lazily when activated.");
  } catch {}
})();


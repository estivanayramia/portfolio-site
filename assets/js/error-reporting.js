// Deprecated shim.
// Consent + telemetry now live in the unified core inside site.js bundle.
// This file must not wrap anything. All instrumentation is in telemetry-core.js.
(() => {
  try {
    console.info("[Diagnostics] error-reporting.js is deprecated. Use the unified telemetry core.");
  } catch {}
})();


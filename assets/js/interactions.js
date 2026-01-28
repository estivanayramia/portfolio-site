/**
 * Deprecated: `interactions.js`
 *
 * This file previously injected the legacy `#error-consent` banner and sent
 * error payloads to `/api/error-report`.
 *
 * The unified diagnostics system now lives in:
 * - `assets/js/telemetry-core.js`
 * - `assets/js/diagnostics-consent.js`
 * - `assets/js/debugger-hud.min.js`
 */
(function () {
  try {
    console.info('[Diagnostics] interactions.js is deprecated and now a no-op.');
  } catch {}
})();

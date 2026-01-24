(() => {
  'use strict';

  // Prefer a meta tag to avoid inline scripts (CSP-friendly).
  // Backwards-compatible with older pages that used a global BUILD_VERSION.
  let buildVersion = null;
  try {
    const meta = document.querySelector('meta[name="build-version"]');
    buildVersion = meta && meta.content ? String(meta.content) : null;
  } catch (e) {}

  if (!buildVersion) {
    try {
      // eslint-disable-next-line no-undef
      buildVersion = typeof BUILD_VERSION === 'string' ? BUILD_VERSION : null;
    } catch (e) {}
  }

  if (!buildVersion) return;

  const storageKey = 'siteVersion';
  const previousVersion = localStorage.getItem(storageKey);

  if (previousVersion === buildVersion) return;

  localStorage.setItem(storageKey, buildVersion);

  // If this is the first time we set the version, don't do anything disruptive.
  if (!previousVersion) return;

  const updateServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    const reloadGuardKey = 'swReloadedOnce';
    const onControllerChange = () => {
      try {
        if (sessionStorage.getItem(reloadGuardKey)) return;
        sessionStorage.setItem(reloadGuardKey, '1');
      } catch (e) {
        // If sessionStorage is unavailable, still avoid reload loops by doing nothing.
        return;
      }
      window.location.reload();
    };

    // If a new SW takes control, reload once to pick up latest JS/CSS.
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });

    const trySkipWaiting = () => {
      const waiting = registration.waiting;
      if (!waiting) return;
      try {
        waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch (e) {
        // Best-effort only
      }
    };

    // Trigger the browser to check for an update.
    await registration.update();
    trySkipWaiting();

    // If an update was found and is installing, wait until it's installed (waiting).
    if (registration.installing) {
      registration.installing.addEventListener('statechange', () => {
        if (registration.waiting) trySkipWaiting();
      });
    }
  };

  (async () => {
    try {
      await updateServiceWorker();
    } catch (_) {
      // Best-effort only
    }
  })();
})();

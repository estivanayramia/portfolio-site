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
    await registration.update();
  };

  (async () => {
    try {
      await updateServiceWorker();
    } catch (_) {
      // Best-effort only
    }
  })();
})();

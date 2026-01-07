(() => {
  'use strict';

  // BUILD_VERSION is injected by the page.
  // eslint-disable-next-line no-undef
  const buildVersion = typeof BUILD_VERSION === 'string' ? BUILD_VERSION : null;
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

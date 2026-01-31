/*
  Debug helper for the Error Dashboard diagnostics panel.

  Usage (DevTools console):
    await fetch('/scripts/debug-diagnostics-panel.js').then(r => r.text()).then(eval);
    await window.debugDiagnosticsPanel();
*/

(() => {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function log(msg, data) {
    try {
      if (typeof data === 'undefined') console.log(msg);
      else console.log(msg, data);
    } catch {}
  }

  function warn(msg, data) {
    try {
      if (typeof data === 'undefined') console.warn(msg);
      else console.warn(msg, data);
    } catch {}
  }

  function safeGetEventListeners(el) {
    const canInspect = (typeof getEventListeners === 'function');
    if (!canInspect) {
      warn('[Diagnostics] WARN: getEventListeners() not available in this context (DevTools-only helper). Skipping listener introspection.');
      return null;
    }
    try {
      return getEventListeners(el);
    } catch (e) {
      warn('[Diagnostics] WARN: getEventListeners() threw; skipping.', e);
      return null;
    }
  }

  function centerPoint(el) {
    try {
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.floor(r.left + r.width / 2)),
        y: Math.max(0, Math.floor(r.top + r.height / 2)),
      };
    } catch {
      return { x: 0, y: 0 };
    }
  }

  function elementAtCenter(el) {
    const pt = centerPoint(el);
    try {
      return document.elementFromPoint(pt.x, pt.y);
    } catch {
      return null;
    }
  }

  async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function ensureHudOpen() {
    const mount = document.getElementById('diagnostics-mount');
    const openBtn = document.getElementById('open-diagnostics');

    if (!mount) {
      warn('[Diagnostics] No #diagnostics-mount found. Are you on /dashboard?');
      return false;
    }

    // If tabs already exist, consider it open.
    if (mount.querySelector('button.savonie-tab')) return true;

    if (openBtn && !openBtn.disabled) {
      try {
        openBtn.click();
      } catch (e) {
        warn('[Diagnostics] Open click threw.', e);
      }
      await sleep(250);
    }

    // If we have the HUD API, try opening directly as a fallback.
    if (window.__SavonieHUD && typeof window.__SavonieHUD.open === 'function' && mount) {
      try {
        window.__SavonieHUD.open({ mount, embedded: true, backdrop: false });
      } catch (e) {
        warn('[Diagnostics] __SavonieHUD.open threw.', e);
      }
      await sleep(250);
    }

    return !!mount.querySelector('button.savonie-tab');
  }

  async function run() {
    log('=== Diagnostics Panel Debugger ===');

    const openBtn = document.getElementById('open-diagnostics');
    const closeBtn = document.getElementById('close-diagnostics');
    const mount = document.getElementById('diagnostics-mount');

    log('1) Elements', {
      openBtn: !!openBtn,
      closeBtn: !!closeBtn,
      mount: !!mount,
    });

    if (openBtn) {
      log('2) Open button state', {
        disabled: !!openBtn.disabled,
        pointerEvents: (() => { try { return getComputedStyle(openBtn).pointerEvents; } catch { return 'unknown'; } })(),
        elementFromPointIsOpenBtn: (() => {
          try {
            const el = elementAtCenter(openBtn);
            return !!el && (el === openBtn || openBtn.contains(el));
          } catch {
            return null;
          }
        })(),
      });
    }

    // 3) Event listeners (best-effort)
    log('3) Event listener introspection (best-effort)');
    if (openBtn) log('openBtn listeners:', safeGetEventListeners(openBtn));
    if (closeBtn) log('closeBtn listeners:', safeGetEventListeners(closeBtn));
    if (mount) log('mount listeners:', safeGetEventListeners(mount));

    // 4) Ensure HUD is present/open
    const hudOpened = await ensureHudOpen();
    log('4) HUD detected in mount:', hudOpened);

    log('window.__SavonieHUD:', window.__SavonieHUD);
    log('window.Savonie:', window.Savonie);

    if (!mount) return;

    const tabs = Array.from(mount.querySelectorAll('button.savonie-tab'));
    log('5) Savonie HUD Tabs found:', tabs.length);

    if (!tabs.length) {
      warn('[Diagnostics] No .savonie-tab buttons found inside #diagnostics-mount.');
      return;
    }

    const firstTab = tabs[0];
    const pe = (() => { try { return getComputedStyle(firstTab).pointerEvents; } catch { return 'unknown'; } })();
    const elAt = elementAtCenter(firstTab);

    log('6) First tab clickability snapshot', {
      text: (firstTab.textContent || '').trim(),
      disabled: !!firstTab.disabled,
      pointerEvents: pe,
      elementFromPointTag: elAt ? elAt.tagName : null,
      elementFromPointClass: elAt ? elAt.className : null,
      elementFromPointIsTab: !!elAt && (elAt === firstTab || firstTab.contains(elAt)),
    });

    // 7) Try clicking the first tab and report selected tab text.
    try {
      firstTab.click();
    } catch (e) {
      warn('[Diagnostics] firstTab.click() threw.', e);
    }

    await sleep(150);

    const selected = mount.querySelector('button.savonie-tab[aria-selected="true"]');
    log('7) Selected tab after click:', selected ? (selected.textContent || '').trim() : null);
  }

  window.debugDiagnosticsPanel = run;
})();

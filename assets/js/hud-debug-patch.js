/*
  HUD Debug Patch
  ---------------
  Purpose: Help diagnose (and optionally neutralize) scripts/extensions that break
  the diagnostics HUD by calling stopPropagation/stopImmediatePropagation on click
  events before they reach the HUD.

  Usage:
    - Add `hud_debug=1` to log who is interfering.
    - Add `hud_patch=1` to also NO-OP stopPropagation/stopImmediatePropagation
      for events that originate inside the HUD.

  This file is safe to ship because it is inert unless the query params are set.
*/

(() => {
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get('hud_debug') === '1' || params.get('hud_patch') === '1';
  const patchEnabled = params.get('hud_patch') === '1';
  if (!debugEnabled) return;

  const MAX_LOGS = 80;
  const logs = [];

  function safeClosest(node, selector) {
    try {
      if (!node || typeof node.closest !== 'function') return null;
      return node.closest(selector);
    } catch {
      return null;
    }
  }

  function isHudEvent(ev) {
    try {
      const target = ev && ev.target;
      if (!target) return false;
      return (
        !!safeClosest(target, '.savonie-panel') ||
        !!safeClosest(target, '#diagnostics-mount')
      );
    } catch {
      return false;
    }
  }

  function pushLog(entry) {
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
  }

  function describeNode(node) {
    try {
      if (!node) return 'null';
      if (node === window) return 'window';
      if (node === document) return 'document';
      if (node.nodeType !== 1) return String(node.nodeName || node);
      const el = node;
      const id = el.id ? `#${el.id}` : '';
      const cls = el.classList && el.classList.length ? `.${Array.from(el.classList).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    } catch {
      return 'unknown';
    }
  }

  function logEvent(tag, ev) {
    try {
      pushLog({
        t: Date.now(),
        tag,
        type: ev && ev.type,
        phase: ev && ev.eventPhase,
        target: describeNode(ev && ev.target),
        currentTarget: describeNode(ev && ev.currentTarget),
        cancelBubble: !!(ev && ev.cancelBubble),
        defaultPrevented: !!(ev && ev.defaultPrevented),
        isHud: isHudEvent(ev)
      });
    } catch {}
  }

  // Expose for easy inspection in console.
  window.__HUD_DEBUG__ = {
    logs,
    dump(last = 25) {
      try {
        return logs.slice(-Math.max(0, last | 0));
      } catch {
        return [];
      }
    },
    enabled: true,
    patchEnabled
  };

  const origStopPropagation = Event.prototype.stopPropagation;
  const origStopImmediatePropagation = Event.prototype.stopImmediatePropagation;

  Event.prototype.stopPropagation = function stopPropagationPatched() {
    const ev = this;
    const hud = isHudEvent(ev);
    const stack = (() => {
      try {
        return new Error('[HUD_DEBUG] stopPropagation stack').stack;
      } catch {
        return null;
      }
    })();

    pushLog({
      t: Date.now(),
      tag: 'stopPropagation',
      type: ev && ev.type,
      target: describeNode(ev && ev.target),
      isHud: hud,
      stack
    });

    if (patchEnabled && hud && ev && ev.type === 'click') {
      // Do NOT stop propagation for HUD clicks.
      return;
    }

    return origStopPropagation.call(ev);
  };

  Event.prototype.stopImmediatePropagation = function stopImmediatePropagationPatched() {
    const ev = this;
    const hud = isHudEvent(ev);
    const stack = (() => {
      try {
        return new Error('[HUD_DEBUG] stopImmediatePropagation stack').stack;
      } catch {
        return null;
      }
    })();

    pushLog({
      t: Date.now(),
      tag: 'stopImmediatePropagation',
      type: ev && ev.type,
      target: describeNode(ev && ev.target),
      isHud: hud,
      stack
    });

    if (patchEnabled && hud && ev && ev.type === 'click') {
      // Do NOT stop immediate propagation for HUD clicks.
      return;
    }

    return origStopImmediatePropagation.call(ev);
  };

  // High-signal event tracing (capture + bubble) for clicks.
  window.addEventListener('click', (e) => logEvent('window:capture', e), true);
  document.addEventListener('click', (e) => logEvent('document:capture', e), true);
  document.addEventListener('click', (e) => logEvent('document:bubble', e), false);

  // Visual confirmation in console.
  // Keep this short; the detailed info is in window.__HUD_DEBUG__.logs
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[HUD_DEBUG] enabled (patch=${patchEnabled}). Use window.__HUD_DEBUG__.dump() to inspect logs.`
    );
  } catch {}
})();

/* assets/js/debugger-hud.js - FIXED VERSION with Event Delegation */
(function () {
  // CLEANUP: Remove any existing panels/styles to prevent duplicates
  document.querySelectorAll('.savonie-panel').forEach(el => el.remove());
  document.querySelectorAll('.savonie-backdrop').forEach(el => el.remove());
  if (window.__SavonieHUD && window.__SavonieHUD.close) {
      try { window.__SavonieHUD.close(); } catch {}
  }

  if (window.__SavonieHUD && window.__SavonieHUD.open) {
    // If re-loaded, just use the new code but don't auto-open unless intended
    // window.__SavonieHUD.open(); <--- Removed auto-open on script load
    // return;
  }

  const tel = window.__SavonieTelemetry;
  if (!tel) {
  // Back-compat / easier console debugging.
  // Some tooling expects `window.Savonie` to exist.
  if (!window.Savonie) window.Savonie = window.__SavonieHUD;
    try { console.error("[Diagnostics] Telemetry core missing."); } catch {}
    return;
  }

  const consent = window.__SavonieDiagnosticsConsent;

  const style = document.createElement("style");
  style.textContent = `
  .savonie-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:999990}
  .savonie-panel{position:fixed;z-index:999991;background:rgba(225,212,194,.98);border:1px solid rgba(54,32,23,.15);
    box-shadow:0 18px 60px rgba(0,0,0,.25);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#212842}
  .savonie-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(54,32,23,.12)}
  .savonie-title{font-weight:800}
  .savonie-btn{min-height:44px;border-radius:10px;border:1px solid rgba(33,40,66,.25);background:#212842;color:#fff;font-weight:700;
    padding:8px 10px;cursor:pointer}
  .savonie-btn.secondary{background:transparent;color:#362017;border:1px solid rgba(54,32,23,.22);font-weight:700}
  .savonie-tabs{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid rgba(54,32,23,.12)}
  .savonie-tab{padding:8px 10px;border-radius:999px;border:1px solid rgba(33,40,66,.18);background:transparent;cursor:pointer;font-weight:700}
  .savonie-tab[aria-selected="true"]{background:#212842;color:#fff;border-color:rgba(33,40,66,.35)}
  .savonie-body{padding:12px;max-height:calc(100vh - 170px);overflow:auto}
  .savonie-kv{display:grid;grid-template-columns:160px 1fr;gap:8px 10px;font-size:13px}
  .savonie-k{opacity:.85}
  .savonie-v{word-break:break-word}
  .savonie-list{display:flex;flex-direction:column;gap:10px}
  .savonie-card{background:rgba(255,255,255,.65);border:1px solid rgba(54,32,23,.12);border-radius:12px;padding:10px}
  .savonie-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;white-space:pre-wrap;word-break:break-word}
  .savonie-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .savonie-pill{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid rgba(33,40,66,.18);background:rgba(33,40,66,.06)}
  .savonie-handle{display:none}
  @media (max-width: 767px){
    .savonie-panel{left:10px;right:10px;bottom:10px;border-radius:16px}
    .savonie-handle{display:block;margin:8px auto 0 auto;width:56px;height:5px;border-radius:999px;background:rgba(33,40,66,.25)}
  }
  @media (min-width: 768px){
    .savonie-panel{right:12px;top:12px;bottom:12px;width:440px;border-radius:16px}
  }
  .savonie-panel.savonie-embedded{position:relative;inset:auto;right:auto;top:auto;bottom:auto;width:100%;max-width:none;
    background:#1a1f2e;color:#e1d4c2;border:1px solid #2a2f3e;box-shadow:none;z-index:2147483647 !important}
  .savonie-panel.savonie-embedded .savonie-header{border-bottom:1px solid #2a2f3e}
  .savonie-panel.savonie-embedded .savonie-tab{border-color:#2a2f3e;color:#e1d4c2}
  .savonie-panel.savonie-embedded .savonie-tab[aria-selected="true"]{background:#4a90e2 !important;color:#fff !important;border-color:#357abd !important}
  .savonie-panel.savonie-embedded .savonie-card{background:#111722;border-color:#2a2f3e}
  .savonie-panel.savonie-embedded .savonie-btn{background:#4a90e2;border-color:#357abd}
  .savonie-panel.savonie-embedded .savonie-btn.secondary{background:transparent;color:#e1d4c2;border-color:#2a2f3e}
  `; 
  
  /* Widget Suppression */
  style.textContent += `
  body.savonie-open #chatbase-bubble-button,
  body.savonie-open #chatbase-bubble-window,
  body.savonie-open iframe[id*="chat"],
  body.savonie-open .chatbase-bubble {
    display: none !important;
    pointer-events: none !important;
  }
  
  /* Force Interactivity */
  .savonie-panel, .savonie-panel * {
    pointer-events: auto !important;
  }
  `;
  document.head.appendChild(style);

  // GLOBAL SNIFFER: Debug why clicks aren't reaching usage
  window.addEventListener('click', (e) => {
    if (e.target.classList?.contains('savonie-tab') || e.target.closest('.savonie-tab')) {
      console.log('[GLOBAL SNIFFER] Click detected on Tab!', {
        target: e.target,
        path: e.composedPath(),
        event: e
      });
    }
  }, true); // Capture phase!

  const backdrop = document.createElement("div");
  backdrop.className = "savonie-backdrop";
  
  const panel = document.createElement("div");
  panel.className = "savonie-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Diagnostics HUD");
  panel.tabIndex = -1;

  const handle = document.createElement("div");
  handle.className = "savonie-handle";
  panel.appendChild(handle);

  const header = document.createElement("div");
  header.className = "savonie-header";

  const title = document.createElement("div");
  title.className = "savonie-title";
  title.textContent = "Diagnostics";

  const headerBtns = document.createElement("div");
  headerBtns.className = "savonie-row";

  const btnClose = document.createElement("button");
  btnClose.className = "savonie-btn secondary";
  btnClose.type = "button";
  btnClose.textContent = "Close";
  btnClose.dataset.action = "close";

  headerBtns.appendChild(btnClose);
  header.appendChild(title);
  header.appendChild(headerBtns);

  const tabs = document.createElement("div");
  tabs.className = "savonie-tabs";

  const body = document.createElement("div");
  body.className = "savonie-body";

  panel.appendChild(header);
  panel.appendChild(tabs);
  panel.appendChild(body);

  const TAB_NAMES = [
    "Summary",
    "Issues",
    "Network",
    "Errors",
    "Performance",
    "Layout",
    "Storage"
  ];

  let activeTab = "Summary";
  let lastActiveEl = null;
  let layoutScanResults = null;
  let mountRoot = document.body;
  let useBackdrop = true;
  let embedded = false;

  // ============================================
  // FIX #1: USE EVENT DELEGATION ON PANEL ROOT
  // ============================================
  panel.addEventListener("click", (e) => {
    // console.log('[HUD] Click intercepted on panel. Target:', e.target);
    const target = e.target.closest("button");
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    // Handle close button
    if (target.dataset.action === "close") {
      close();
      return;
    }

    // Handle tab clicks
    if (target.classList.contains("savonie-tab")) {
      const tabName = target.textContent.trim();
      console.log(`[HUD] Tab clicked: "${tabName}"`, { 
        matches: TAB_NAMES.includes(tabName), 
        current: activeTab 
      });
      
      if (TAB_NAMES.includes(tabName)) {
        activeTab = tabName;
        console.log('[HUD] Setting active tab to:', activeTab);
        render();
      } else {
        console.warn('[HUD] Tab name not in whitelist:', tabName);
      }
      return;
    }

    // Handle action buttons in body
    const action = target.dataset.action;
    if (!action) return;

    const st = tel.getState();
    const c = consent ? consent.get() : { consent: null, upload: false };

    switch (action) {
      case "export":
        try {
          const data = tel.export({ includeAll: false });
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
          showToast("Copied to clipboard");
        } catch (err) {
          console.error("Export failed:", err);
        }
        break;

      case "toggle-upload":
        if (consent) {
          consent.set({ upload: !c.upload });
          const fresh = consent.get();
          if (fresh.consent === "granted") {
            tel.enable({ upload: fresh.upload, mode: "dev" });
          }
          showToast(fresh.upload ? "Automatic reporting enabled" : "Automatic reporting disabled");
          render();
        }
        break;

      case "disable":
        if (consent) consent.revoke();
        render();
        break;

      case "clear":
        if (consent) consent.clearData();
        render();
        break;

      case "copy-issue":
        try {
          const issueIdx = parseInt(target.dataset.issueIndex, 10);
          const issues = st.issues || [];
          if (issueIdx >= 0 && issueIdx < issues.length) {
            const issue = issues[issueIdx];
            const report = { schema: "savonie.issue.v1", issue, ctx: tel.export({ includeAll: false }).ctx };
            navigator.clipboard.writeText(JSON.stringify(report, null, 2));
            showToast("Issue copied");
          }
        } catch (err) {
          console.error("Copy issue failed:", err);
        }
        break;

      case "run-layout-scan":
        layoutScanResults = runLayoutScan();
        render();
        break;
    }
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  function showToast(message) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%);
      background: rgba(33,40,66,0.95);
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      z-index: 999999;
      font-size: 13px;
      pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // ============================================
  // FIX #2: RENDER USES DATA ATTRIBUTES
  // ============================================
  function el(tag, props = {}) {
    const n = document.createElement(tag);
    if (tag === "button" && !("type" in props)) {
      n.type = "button";
    }
    for (const [k, v] of Object.entries(props)) {
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.startsWith("data-")) n.setAttribute(k, v);
      else n.setAttribute(k, v);
    }
    return n;
  }

  function renderTabs() {
    tabs.innerHTML = "";
    for (const name of TAB_NAMES) {
      const b = el("button", {
        class: "savonie-tab",
        type: "button",
        role: "tab",
        "aria-selected": name === activeTab ? "true" : "false",
        text: name
      });
      tabs.appendChild(b);
    }
  }

  function renderSummary(st) {
    const c = consent ? consent.get() : { consent: null, upload: false, storage: "unknown" };

    const wrap = el("div", { class: "savonie-list" });

    const info = el("div", { class: "savonie-card" });
    const kv = el("div", { class: "savonie-kv" });

    const pairs = [
      ["URL", location.href],
      ["Referrer", document.referrer || ""],
      ["Build", st.buildVersion],
      ["Viewport", `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}`],
      ["Consent", String(c.consent || "unset")],
      ["Automatic reporting", c.upload ? "on" : "off"],
      ["Storage", c.storage],
      ["Enabled", st.enabled ? "true" : "false"],
      ["Last upload", st.lastUploadAt ? new Date(st.lastUploadAt).toLocaleString() : "never"],
      ["Issues", String((st.issues || []).length)]
    ];

    for (const [k, v] of pairs) {
      kv.appendChild(el("div", { class: "savonie-k", text: k }));
      kv.appendChild(el("div", { class: "savonie-v", text: String(v) }));
    }

    info.appendChild(kv);

    const actions = el("div", { class: "savonie-card" });
    const row = el("div", { class: "savonie-row" });

    row.appendChild(el("button", {
      class: "savonie-btn",
      type: "button",
      "data-action": "export",
      text: "Copy export JSON"
    }));

    row.appendChild(el("button", {
      class: "savonie-btn secondary",
      type: "button",
      "data-action": "toggle-upload",
      text: c.upload ? "Disable automatic reporting" : "Enable automatic reporting"
    }));

    row.appendChild(el("button", {
      class: "savonie-btn secondary",
      type: "button",
      "data-action": "disable",
      text: "Disable diagnostics"
    }));

    row.appendChild(el("button", {
      class: "savonie-btn secondary",
      type: "button",
      "data-action": "clear",
      text: "Delete diagnostics data"
    }));

    actions.appendChild(row);

    wrap.appendChild(info);
    wrap.appendChild(actions);
    return wrap;
  }

  function renderIssues(st) {
    const wrap = el("div", { class: "savonie-list" });
    const issues = (st.issues || []).slice().reverse();

    if (!issues.length) {
      wrap.appendChild(el("div", { class: "savonie-card", text: "No issues recorded." }));
      return wrap;
    }

    issues.forEach((it, idx) => {
      const card = el("div", { class: "savonie-card" });
      const top = el("div", { class: "savonie-row" });

      top.appendChild(el("div", { class: "savonie-pill", text: it.kind }));
      top.appendChild(el("div", { class: "savonie-pill", text: `count ${it.count}` }));
      top.appendChild(el("div", { class: "savonie-pill", text: new Date(it.lastSeen).toLocaleTimeString() }));

      const msg = el("div", { class: "savonie-mono" });
      msg.textContent = `${it.msg}\n${it.url}\n${it.signature}`;

      const btnRow = el("div", { class: "savonie-row" });
      btnRow.appendChild(el("button", {
        class: "savonie-btn",
        type: "button",
        "data-action": "copy-issue",
        "data-issue-index": String(idx),
        text: "Copy issue report"
      }));

      card.appendChild(top);
      card.appendChild(msg);

      if (it.stack) {
        const stack = el("div", { class: "savonie-mono" });
        stack.textContent = it.stack;
        card.appendChild(stack);
      }

      card.appendChild(btnRow);
      wrap.appendChild(card);
    });

    return wrap;
  }

  function renderNetwork(st) {
    const wrap = el("div", { class: "savonie-list" });
    const events = (st.events || []).filter((e) => e.kind === "network").slice(-80).reverse();

    if (!events.length) {
      wrap.appendChild(el("div", { class: "savonie-card", text: "No network events captured." }));
      return wrap;
    }

    for (const e of events) {
      const card = el("div", { class: "savonie-card" });
      const d = e.data || {};
      card.appendChild(el("div", { class: "savonie-mono", text: `${d.method || ""} ${d.url || ""}\nstatus ${d.status}  dur ${d.dur}ms` }));
      wrap.appendChild(card);
    }

    return wrap;
  }

  function renderErrors(st) {
    const wrap = el("div", { class: "savonie-list" });
    const events = (st.events || []).filter((e) => e.kind === "error" || e.kind === "resource").slice(-80).reverse();

    if (!events.length) {
      wrap.appendChild(el("div", { class: "savonie-card", text: "No errors captured." }));
      return wrap;
    }

    for (const e of events) {
      const card = el("div", { class: "savonie-card" });
      const d = e.data || {};
      const mono = el("div", { class: "savonie-mono" });
      mono.textContent = `${e.msg}\n${d.message || ""}\n${d.filename || ""}:${d.line || ""}:${d.col || ""}\n${d.url || ""}\n${d.stack || ""}`;
      card.appendChild(mono);
      wrap.appendChild(card);
    }

    return wrap;
  }

  function renderPerf(st) {
    const wrap = el("div", { class: "savonie-list" });
    const p = st.perf || {};
    const card = el("div", { class: "savonie-card" });

    const kv = el("div", { class: "savonie-kv" });
    const pairs = [
      ["CLS", p.cls == null ? "n/a" : String(p.cls)],
      ["LCP", p.lcp == null ? "n/a" : `${Math.round(p.lcp)}ms`],
      ["INP", p.inp == null ? "n/a" : `${Math.round(p.inp)}ms`],
      ["Long tasks", String(p.longTasks || 0)]
    ];
    for (const [k, v] of pairs) {
      kv.appendChild(el("div", { class: "savonie-k", text: k }));
      kv.appendChild(el("div", { class: "savonie-v", text: v }));
    }
    card.appendChild(kv);

    wrap.appendChild(card);
    return wrap;
  }

  function renderLayout() {
    const wrap = el("div", { class: "savonie-list" });
    const card = el("div", { class: "savonie-card" });

    card.appendChild(el("div", { text: "On-demand scan only. No continuous DOM scanning." }));
    const row = el("div", { class: "savonie-row" });
    row.appendChild(el("button", {
      class: "savonie-btn",
      type: "button",
      "data-action": "run-layout-scan",
      text: "Run scan"
    }));
    card.appendChild(row);

    wrap.appendChild(card);

    if (layoutScanResults) {
      const resultsCard = el("div", { class: "savonie-card" });
      const pre = el("div", { class: "savonie-mono" });
      pre.textContent = JSON.stringify(layoutScanResults, null, 2);
      resultsCard.appendChild(pre);
      wrap.appendChild(resultsCard);
    }
    return wrap;
  }

  function runLayoutScan() {
    const results = { scannedAt: Date.now(), tinyTargets: [], overflows: [] };

    const interactive = document.querySelectorAll("a,button,[role='button'],input,select,textarea");
    for (const n of interactive) {
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)) {
        results.tinyTargets.push({ tag: n.tagName, w: Math.round(r.width), h: Math.round(r.height) });
        if (results.tinyTargets.length >= 20) break;
      }
    }

    const all = document.querySelectorAll("body *");
    for (let i = 0; i < Math.min(all.length, 1500); i++) {
      const n = all[i];
      const r = n.getBoundingClientRect();
      if (r.right > window.innerWidth + 1) {
        results.overflows.push({ tag: n.tagName, right: Math.round(r.right), vw: window.innerWidth });
        if (results.overflows.length >= 20) break;
      }
    }

    return results;
  }

  function showLayoutResults(results) {
    layoutScanResults = results;
    render();
  }

  function renderStorage() {
    const wrap = el("div", { class: "savonie-list" });
    const card = el("div", { class: "savonie-card" });
    const kv = el("div", { class: "savonie-kv" });

    let lsCount = "n/a";
    let ssCount = "n/a";
    try { lsCount = String(localStorage.length); } catch {}
    try { ssCount = String(sessionStorage.length); } catch {}

    const sw = navigator.serviceWorker;
    const swInfo = {
      controller: !!(sw && sw.controller),
      scope: "n/a"
    };

    kv.appendChild(el("div", { class: "savonie-k", text: "localStorage keys" }));
    kv.appendChild(el("div", { class: "savonie-v", text: lsCount }));
    kv.appendChild(el("div", { class: "savonie-k", text: "sessionStorage keys" }));
    kv.appendChild(el("div", { class: "savonie-v", text: ssCount }));
    kv.appendChild(el("div", { class: "savonie-k", text: "SW controller" }));
    kv.appendChild(el("div", { class: "savonie-v", text: swInfo.controller ? "true" : "false" }));

    card.appendChild(kv);
    wrap.appendChild(card);
    return wrap;
  }

  function render() {
    const st = tel.getState();
    renderTabs();
    body.innerHTML = "";

    let content = null;
    if (activeTab === "Summary") content = renderSummary(st);
    if (activeTab === "Issues") content = renderIssues(st);
    if (activeTab === "Network") content = renderNetwork(st);
    if (activeTab === "Errors") content = renderErrors(st);
    if (activeTab === "Performance") content = renderPerf(st);
    if (activeTab === "Layout") content = renderLayout();
    if (activeTab === "Storage") content = renderStorage();

    body.appendChild(content || el("div", { class: "savonie-card", text: "Not implemented." }));
  }

  function trapFocus(ev) {
    if (ev.key !== "Tab") return;
    const focusable = panel.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])");
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function open(options = {}) {
    const opts = options || {};
    embedded = !!opts.embedded;
    useBackdrop = embedded ? false : (opts.backdrop !== false);
    mountRoot = opts.mount || document.body;

    if (embedded) panel.classList.add("savonie-embedded");
    else panel.classList.remove("savonie-embedded");

    if (panel.isConnected) {
      if (panel.parentElement !== mountRoot) {
        mountRoot.appendChild(panel);
      }
      if (useBackdrop && !backdrop.isConnected) document.body.appendChild(backdrop);
      if (!useBackdrop && backdrop.isConnected) backdrop.remove();
      render();
      panel.focus();
      return;
    }

    lastActiveEl = document.activeElement;
    if (useBackdrop) document.body.appendChild(backdrop);
    mountRoot.appendChild(panel);
    document.body.classList.add("savonie-open"); // Hide widgets

    render();
    panel.focus();

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keydown", trapFocus, true);
  }

  function close() {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("keydown", trapFocus, true);
    document.body.classList.remove("savonie-open"); // Restore widgets

    if (backdrop.isConnected) backdrop.remove();
    if (panel.isConnected) panel.remove();

    if (lastActiveEl && lastActiveEl.focus) {
      try { lastActiveEl.focus(); } catch {}
    }
  }

  function onKey(ev) {
    if (ev.key === "Escape") close();
  }

  let raf = 0;
  tel.subscribe(() => {
    if (!panel.isConnected) return;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  });

  window.__SavonieHUD = { open, close };
  if (window.__SavonieHUD_AUTOOPEN === true) open();
})();

/* assets/js/telemetry-core.js */
(function () {
  if (window.__SavonieTelemetry) return;

  const MAX = {
    events: 1000,
    issues: 200,
    breadcrumbs: 50
  };

  const LIMITS = {
    msg: 200,
    stack: 2000,
    str: 500,
    objBytes: 8000,
    objDepth: 4,
    objKeys: 60
  };

  const SENSITIVE_KEY_RE = /(token|auth|password|secret|session|cookie|credit|card|ssn|cvv|email)/i;

  function now() {
    return Date.now();
  }

  function clampStr(value, maxLen) {
    if (value == null) return "";
    const s = String(value);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  }

  function safeStringify(value, depth = LIMITS.objDepth, seen = new Set()) {
    try {
      if (value == null) return value;
      if (typeof value === "string") return clampStr(value, LIMITS.str);
      if (typeof value === "number" || typeof value === "boolean") return value;

      if (value instanceof Error) {
        return {
          name: clampStr(value.name, 80),
          message: clampStr(value.message, LIMITS.msg),
          stack: clampStr(value.stack || "", LIMITS.stack)
        };
      }

      if (typeof value !== "object") return clampStr(value, LIMITS.str);

      if (seen.has(value)) return "[Circular]";
      seen.add(value);

      if (Array.isArray(value)) {
        if (depth <= 0) return "[Array]";
        return value.slice(0, 50).map((v) => safeStringify(v, depth - 1, seen));
      }

      if (depth <= 0) return "[Object]";

      const out = {};
      const keys = Object.keys(value).slice(0, LIMITS.objKeys);
      for (const k of keys) {
        if (SENSITIVE_KEY_RE.test(k)) {
          out[k] = "[Redacted]";
          continue;
        }
        out[k] = safeStringify(value[k], depth - 1, seen);
      }
      return out;
    } catch {
      return "[Unserializable]";
    }
  }

  function redactHeaders(headersObj) {
    if (!headersObj || typeof headersObj !== "object") return headersObj;
    const out = {};
    for (const [k, v] of Object.entries(headersObj)) {
      if (/authorization/i.test(k)) out[k] = "[Redacted]";
      else if (SENSITIVE_KEY_RE.test(k)) out[k] = "[Redacted]";
      else out[k] = clampStr(v, LIMITS.str);
    }
    return out;
  }

  function normalizeUrl(raw) {
    try {
      const u = new URL(raw, window.location.href);
      u.hash = "";
      // Strip all query params by default. Safe allowlist is empty intentionally.
      u.search = "";
      return u.toString();
    } catch {
      return clampStr(raw, 300);
    }
  }

  function hashStr(s) {
    // djb2-ish
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  function isMobile() {
    try {
      if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") {
        return navigator.userAgentData.mobile;
      }
    } catch {}
    return window.matchMedia && window.matchMedia("(max-width: 767px)").matches;
  }

  function getBuildVersion() {
    const meta = document.querySelector('meta[name="build-version"]');
    const fromMeta = meta && meta.getAttribute("content");
    const fromLS = (() => {
      try {
        return localStorage.getItem("siteVersion");
      } catch {
        return null;
      }
    })();
    return fromMeta || fromLS || "dev";
  }

  function ringPush(arr, item, max) {
    arr.push(item);
    if (arr.length > max) arr.splice(0, arr.length - max);
  }

  const subs = new Set();

  const state = {
    enabled: false,
    upload: false,
    mode: "user", // "user" | "dev"
    sessionOnly: false,
    buildVersion: getBuildVersion(),
    lastUploadAt: null,

    events: [],
    issues: [],
    breadcrumbs: [],

    perf: {
      cls: null,
      lcp: null,
      inp: null,
      longTasks: 0
    },

    installed: {
      console: false,
      fetch: false,
      xhr: false,
      perf: false,
      errors: false,
      breadcrumbs: false
    }
  };

  function getCtx() {
    return safeStringify({
      url: window.location.href,
      referrer: document.referrer || "",
      buildVersion: state.buildVersion,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      dpr: window.devicePixelRatio,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      connection: navigator.connection
        ? {
            effectiveType: navigator.connection.effectiveType,
            rtt: navigator.connection.rtt,
            downlink: navigator.connection.downlink,
            saveData: navigator.connection.saveData
          }
        : null,
      memory: performance && performance.memory
        ? {
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            usedJSHeapSize: performance.memory.usedJSHeapSize
          }
        : null
    });
  }

  function notify(entry) {
    for (const fn of subs) {
      try {
        fn(entry, api.getState());
      } catch {}
    }
  }

  function push(entry) {
    // Enforce schema + caps
    const e = {
      t: typeof entry.t === "number" ? entry.t : now(),
      kind: clampStr(entry.kind || "debug", 40),
      level: entry.level == null ? null : clampStr(entry.level, 10),
      msg: clampStr(entry.msg || "", LIMITS.msg),
      data: safeStringify(entry.data),
      ctx: entry.ctx ? safeStringify(entry.ctx) : getCtx()
    };

    ringPush(state.events, e, MAX.events);

    if (e.kind === "breadcrumb") ringPush(state.breadcrumbs, e, MAX.breadcrumbs);

    notify(e);
    return e;
  }

  function computeIssueSignature(base) {
    const url = base.url ? normalizeUrl(base.url) : normalizeUrl(window.location.href);
    const stack = base.stack ? clampStr(base.stack, LIMITS.stack) : "";
    const stackHash = stack ? hashStr(stack) : "";
    return [
      base.kind || "issue",
      base.msg || "",
      url,
      stackHash
    ].join("|");
  }

  function recordIssue(base) {
    const t = now();
    const signature = computeIssueSignature(base);

    const existing = state.issues.find((i) => i.signature === signature);
    if (existing && t - existing.lastSeen <= 60000) {
      existing.count += 1;
      existing.lastSeen = t;
      notify({ t, kind: "debug", level: "info", msg: "issue.deduped", data: { signature } });
      return existing;
    }

    const crumbs = state.breadcrumbs.slice(-20);

    const issue = {
      signature,
      count: 1,
      firstSeen: t,
      lastSeen: t,
      kind: clampStr(base.kind || "issue", 40),
      msg: clampStr(base.msg || "issue", LIMITS.msg),
      level: base.level == null ? null : clampStr(base.level, 10),
      url: normalizeUrl(base.url || window.location.href),
      data: safeStringify(base.data),
      stack: base.stack ? clampStr(base.stack, LIMITS.stack) : null,
      breadcrumbs: crumbs
    };

    ringPush(state.issues, issue, MAX.issues);
    notify({ t, kind: "debug", level: "warn", msg: "issue.created", data: { signature } });

    // Upload issues only (if enabled).
    scheduleUpload();

    return issue;
  }

  function hydrate() {
    try {
      const raw = sessionStorage.getItem("site_diagnostics_state");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.events)) state.events = parsed.events.slice(-200);
        if (Array.isArray(parsed.issues)) state.issues = parsed.issues.slice(-MAX.issues);
        if (Array.isArray(parsed.breadcrumbs)) state.breadcrumbs = parsed.breadcrumbs.slice(-MAX.breadcrumbs);
        if (parsed.perf) state.perf = Object.assign(state.perf, parsed.perf);
      }
    } catch {}
  }

  function persist() {
    try {
      const snap = {
        events: state.events.slice(-200),
        issues: state.issues.slice(-MAX.issues),
        breadcrumbs: state.breadcrumbs.slice(-MAX.breadcrumbs),
        perf: state.perf
      };
      sessionStorage.setItem("site_diagnostics_state", JSON.stringify(snap));
    } catch {}
  }

  let uploadTimer = null;
  let lastUploadTry = 0;

  function makeUploadPayload() {
    return safeStringify({
      buildVersion: state.buildVersion,
      ctx: getCtx(),
      issues: state.issues.slice(-50).map((i) =>
        safeStringify({
          signature: i.signature,
          count: i.count,
          firstSeen: i.firstSeen,
          lastSeen: i.lastSeen,
          kind: i.kind,
          msg: i.msg,
          level: i.level,
          url: i.url,
          stack: i.stack,
          data: i.data,
          breadcrumbs: i.breadcrumbs
        })
      )
    });
  }

  function scheduleUpload() {
    if (!state.enabled || !state.upload) return;
    const nowMs = now();
    if (nowMs - lastUploadTry < 15000) return;

    if (uploadTimer) return;
    uploadTimer = setTimeout(() => {
      uploadTimer = null;
      void uploadIssues(false);
    }, 3000);
  }

  async function uploadIssues(onUnload) {
    if (!state.enabled || !state.upload) return;
    lastUploadTry = now();

    const payload = makeUploadPayload();
    let json = "";
    try {
      json = JSON.stringify(payload);
    } catch {
      return;
    }

    // Hard cap (client-side) to avoid log abuse.
    if (json.length > 256 * 1024) {
      json = json.slice(0, 256 * 1024);
    }

    const url = "/api/error-report";
    const headers = { "Content-Type": "application/json" };

    try {
      if (onUnload && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(url, new Blob([json], { type: "application/json" }));
        if (ok) state.lastUploadAt = now();
        return;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: json,
        keepalive: !!onUnload
      });

      if (res.ok) state.lastUploadAt = now();
    } catch {}
  }

  function installErrorHooks() {
    if (state.installed.errors) return;
    state.installed.errors = true;

    const isIgnoredResourceUrl = (u) => {
      const s = String(u || "");
      if (!s) return false;
      // Favicon noise (default browser request or icon links)
      if (/(^|\/)(favicon\.ico|favicon-\d+x\d+\.(png|webp))($|\?)/i.test(s)) return true;
      // Known external probe path that can return auth errors unrelated to this site
      if (/\/api\/browser_extension\//i.test(s) || /browser_extension\//i.test(s)) return true;
      return false;
    };

    window.addEventListener("error", (ev) => {
      // Resource errors bubble here when capture is used.
      const target = ev.target;
      const isResource = target && (target.src || target.href) && !(ev instanceof ErrorEvent);

      if (isResource) {
        const url = target.src || target.href;
        if (isIgnoredResourceUrl(url)) return;
        push({
          kind: "resource",
          level: "error",
          msg: "resource.load.error",
          data: { url: normalizeUrl(url), tag: target.tagName }
        });
        recordIssue({
          kind: "resource",
          level: "error",
          msg: "resource.load.error",
          url,
          data: { tag: target.tagName }
        });
        return;
      }

      const err = ev.error;
      const message = ev.message || (err && err.message) || "Script error";
      const stack = err && err.stack ? String(err.stack) : "";
      push({
        kind: "error",
        level: "error",
        msg: "error.window",
        data: { message: clampStr(message, LIMITS.msg), filename: ev.filename, line: ev.lineno, col: ev.colno, stack: clampStr(stack, LIMITS.stack) }
      });
      recordIssue({
        kind: "error",
        level: "error",
        msg: "error.window",
        url: ev.filename || window.location.href,
        stack,
        data: { message, line: ev.lineno, col: ev.colno }
      });
    }, true);

    window.addEventListener("unhandledrejection", (ev) => {
      const reason = ev.reason;
      const asErr = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : "Unhandled rejection");
      push({
        kind: "error",
        level: "error",
        msg: "error.unhandledrejection",
        data: { message: clampStr(asErr.message, LIMITS.msg), stack: clampStr(asErr.stack || "", LIMITS.stack) }
      });
      recordIssue({
        kind: "error",
        level: "error",
        msg: "error.unhandledrejection",
        stack: asErr.stack || "",
        data: { message: asErr.message }
      });
    });
  }

  function installBreadcrumbs() {
    if (state.installed.breadcrumbs) return;
    state.installed.breadcrumbs = true;

    push({ kind: "breadcrumb", level: "info", msg: "nav.load", data: { url: normalizeUrl(window.location.href) } });

    document.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const desc = {
        tag: t.tagName,
        id: t.id ? clampStr(t.id, 80) : "",
        cls: t.className ? clampStr(String(t.className), 120) : ""
      };
      push({ kind: "breadcrumb", level: "info", msg: "ui.click", data: desc });
    }, { capture: true });

    document.addEventListener("focusin", (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      push({ kind: "breadcrumb", level: "info", msg: "ui.focus", data: { tag: t.tagName, id: t.id || "" } });
    });

    document.addEventListener("keydown", (ev) => {
      const key = ev.key;
      // Never store typed content. Only control/navigation keys.
      const allowed = ["Enter", "Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (!allowed.includes(key)) return;
      push({ kind: "breadcrumb", level: "info", msg: "ui.key", data: { key } });
    }, { capture: true });

    document.addEventListener("visibilitychange", () => {
      push({ kind: "breadcrumb", level: "info", msg: "doc.visibility", data: { state: document.visibilityState } });
    });

    let lastScroll = 0;
    window.addEventListener("scroll", () => {
      const t = now();
      if (t - lastScroll < 1000) return;
      lastScroll = t;
      push({ kind: "breadcrumb", level: "info", msg: "ui.scroll", data: { y: window.scrollY } });
    }, { passive: true });
  }

  function installConsoleWrap() {
    if (state.installed.console) return;
    state.installed.console = true;

    const methods = ["log", "info", "warn", "error"];
    for (const m of methods) {
      const orig = console[m];
      if (!orig || orig.__savonieWrapped) continue;

      const wrapped = function (...args) {
        try {
          const level = m === "log" ? "info" : m;
          const text = args.map((a) => (typeof a === "string" ? a : JSON.stringify(safeStringify(a)))).join(" ");
          const shouldCapture = state.mode === "dev" || m === "warn" || m === "error";

          if (state.enabled && shouldCapture) {
            push({
              kind: "breadcrumb",
              level,
              msg: `console.${m}`,
              data: { text: clampStr(text, LIMITS.msg) }
            });
          }
        } catch {}
        return orig.apply(console, args);
      };

      wrapped.__savonieWrapped = true;
      console[m] = wrapped;
    }
  }

  function installFetchWrap() {
    if (state.installed.fetch) return;
    state.installed.fetch = true;

    const orig = window.fetch;
    if (!orig || orig.__savonieWrapped) return;

    const wrapped = async function (input, init) {
      const start = now();
      const method = (init && init.method) || (input && input.method) || "GET";
      const url = typeof input === "string" ? input : (input && input.url) ? input.url : "";

      try {
        const res = await orig(input, init);
        const dur = now() - start;

        const status = res.status;
        const record = {
          method,
          url: normalizeUrl(url),
          status,
          dur
        };

        if (state.enabled) {
          push({ kind: "network", level: status >= 400 ? "error" : "info", msg: "network.fetch", data: record });
        }

        const slowMs = isMobile() ? 3000 : 2000;
        if (state.enabled && (status >= 400 || dur > slowMs)) {
          recordIssue({
            kind: "network",
            level: "error",
            msg: status >= 400 ? "network.http_error" : "network.slow",
            url,
            data: record
          });
        }

        return res;
      } catch (err) {
        const dur = now() - start;
        if (state.enabled) {
          push({ kind: "network", level: "error", msg: "network.fetch.throw", data: { method, url: normalizeUrl(url), dur } });
          recordIssue({
            kind: "network",
            level: "error",
            msg: "network.fetch.throw",
            url,
            stack: err && err.stack ? String(err.stack) : "",
            data: { method, url: normalizeUrl(url), dur }
          });
        }
        throw err;
      }
    };

    wrapped.__savonieWrapped = true;
    window.fetch = wrapped;
  }

  function installXHRWrap() {
    if (state.installed.xhr) return;
    state.installed.xhr = true;

    const XHR = window.XMLHttpRequest;
    if (!XHR) return;

    const open = XHR.prototype.open;
    const send = XHR.prototype.send;

    if (!open.__savonieWrapped) {
      XHR.prototype.open = function (method, url, async, user, pass) {
        this.__savonieMeta = { method: method || "GET", url: url || "", start: 0 };
        return open.apply(this, arguments);
      };
      XHR.prototype.open.__savonieWrapped = true;
    }

    if (!send.__savonieWrapped) {
      XHR.prototype.send = function () {
        const meta = this.__savonieMeta || { method: "GET", url: "" };
        meta.start = now();

        const done = () => {
          try {
            const dur = now() - meta.start;
            const status = this.status || 0;

            if (state.enabled) {
              push({
                kind: "network",
                level: status >= 400 ? "error" : "info",
                msg: "network.xhr",
                data: { method: meta.method, url: normalizeUrl(meta.url), status, dur }
              });
            }

            const slowMs = isMobile() ? 3000 : 2000;
            if (state.enabled && (status >= 400 || dur > slowMs)) {
              recordIssue({
                kind: "network",
                level: "error",
                msg: status >= 400 ? "network.http_error" : "network.slow",
                url: meta.url,
                data: { method: meta.method, url: normalizeUrl(meta.url), status, dur }
              });
            }
          } catch {}
        };

        this.addEventListener("loadend", done);
        return send.apply(this, arguments);
      };
      XHR.prototype.send.__savonieWrapped = true;
    }
  }

  function installPerf() {
    if (state.installed.perf) return;
    state.installed.perf = true;

    // Long Tasks
    if (window.PerformanceObserver) {
      try {
        const longTaskObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!state.enabled) continue;
            state.perf.longTasks += 1;
            if (e.duration > 200) {
              push({ kind: "perf", level: "warn", msg: "perf.longtask", data: { dur: e.duration } });
              recordIssue({ kind: "perf", level: "warn", msg: "perf.longtask", data: { dur: e.duration } });
            }
          }
        });
        longTaskObs.observe({ entryTypes: ["longtask"] });
      } catch {}
    }

    // CLS
    if (window.PerformanceObserver) {
      try {
        let cls = 0;
        const clsObs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (!e.hadRecentInput) cls += e.value;
          }
          state.perf.cls = cls;
          if (state.enabled && cls > 0.1) {
            push({ kind: "perf", level: "warn", msg: "perf.cls", data: { cls } });
            recordIssue({ kind: "perf", level: "warn", msg: "perf.cls", data: { cls } });
          }
        });
        clsObs.observe({ type: "layout-shift", buffered: true });
      } catch {}
    }

    // LCP
    if (window.PerformanceObserver) {
      try {
        let lcp = null;
        const lcpObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (!last) return;
          lcp = last.startTime;
          state.perf.lcp = lcp;
          if (state.enabled && lcp > 2500) {
            push({ kind: "perf", level: "warn", msg: "perf.lcp", data: { lcp } });
            recordIssue({ kind: "perf", level: "warn", msg: "perf.lcp", data: { lcp } });
          }
        });
        lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {}
    }

    // INP best-effort
    if (window.PerformanceObserver) {
      try {
        let inp = null;
        const inpObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const e of entries) {
            if (typeof e.duration === "number") {
              inp = Math.max(inp || 0, e.duration);
            }
          }
          if (inp != null) {
            state.perf.inp = inp;
            if (state.enabled && inp > 200) {
              push({ kind: "perf", level: "warn", msg: "perf.inp", data: { inp } });
              recordIssue({ kind: "perf", level: "warn", msg: "perf.inp", data: { inp } });
            }
          }
        });
        inpObs.observe({ type: "event", buffered: true, durationThreshold: 40 });
      } catch {}
    }
  }

  function enable(opts) {
    if (state.enabled) return;

    state.enabled = true;
    state.upload = !!(opts && opts.upload);
    state.mode = (opts && opts.mode === "dev") ? "dev" : "user";

    installErrorHooks();
    installBreadcrumbs();
    installConsoleWrap();
    installFetchWrap();
    installXHRWrap();
    installPerf();

    persist();

    window.addEventListener("pagehide", () => {
      persist();
      void uploadIssues(true);
    });

    push({ kind: "debug", level: "info", msg: "telemetry.enabled", data: { upload: state.upload, mode: state.mode } });
  }

  function disable() {
    state.enabled = false;
    push({ kind: "debug", level: "info", msg: "telemetry.disabled", data: {} });
    persist();
  }

  function clear() {
    state.events = [];
    state.issues = [];
    state.breadcrumbs = [];
    state.perf = { cls: null, lcp: null, inp: null, longTasks: 0 };
    try {
      sessionStorage.removeItem("site_diagnostics_state");
    } catch {}
    push({ kind: "debug", level: "info", msg: "telemetry.cleared", data: {} });
  }

  function exportJSON(opts) {
    const includeAll = !!(opts && opts.includeAll);
    return safeStringify({
      state: {
        enabled: state.enabled,
        upload: state.upload,
        mode: state.mode,
        buildVersion: state.buildVersion,
        lastUploadAt: state.lastUploadAt
      },
      ctx: getCtx(),
      perf: state.perf,
      issues: state.issues,
      breadcrumbs: state.breadcrumbs,
      events: includeAll ? state.events : state.events.slice(-200)
    });
  }

  function subscribe(fn) {
    subs.add(fn);
  }

  function unsubscribe(fn) {
    subs.delete(fn);
  }

  function getState() {
    return safeStringify(state);
  }

  function setConsentFlags({ sessionOnly }) {
    state.sessionOnly = !!sessionOnly;
  }

  hydrate();

  const api = {
    enable,
    disable,
    push,
    subscribe,
    unsubscribe,
    export: exportJSON,
    clear,
    getState,
    recordIssue,
    setConsentFlags,
    _internal: {
      redactHeaders,
      safeStringify,
      clampStr,
      normalizeUrl,
      recordIssue
    }
  };

  window.__SavonieTelemetry = api;
})();

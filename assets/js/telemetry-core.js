/* assets/js/telemetry-core.js */
(function () {
  if (window.__SavonieTelemetry) return;

  const MAX = {
    events: 1000,
    issues: 200,
    breadcrumbs: 100
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

  function getDomNodeLabel(node) {
    try {
      if (!node || typeof node !== "object") return null;
      const el = node instanceof Element ? node : null;
      if (!el) return null;
      const tag = (el.tagName || "").toLowerCase();
      const id = el.id ? `#${clampStr(el.id, 80)}` : "";
      const cls = el.classList && el.classList.length
        ? `.${Array.from(el.classList).slice(0, 4).map((c) => clampStr(c, 40)).join(".")}`
        : "";
      const out = `${tag}${id}${cls}`;
      return out ? clampStr(out, 180) : null;
    } catch {
      return null;
    }
  }

  // JSON-safe sanitizer intended for breadcrumbs.
  // Goals:
  // - never throw on JSON.stringify
  // - avoid emitting placeholder sentinel strings that look like broken data
  // - reduce DOM/Event objects to small, useful summaries
  function sanitizeForJSON(value, maxDepth = 3, maxKeys = 50, seen = new WeakSet(), depth = 0) {
    try {
      if (value == null) return value;
      const t = typeof value;
      if (t === "string") {
        const s = String(value);
        // Strip debug sentinels from other serializers (they break v12 expectations).
        // Avoid embedding bracketed sentinel literals in source/minified bundles.
        if (s && s.length <= 20 && s[0] === "[" && s[s.length - 1] === "]") {
          const inner = s.slice(1, -1);
          if (inner === "Circular" || inner === "Object" || inner === "Array" || inner === "Unserializable") return undefined;
        }
        return clampStr(s, LIMITS.str);
      }
      if (t === "number" || t === "boolean") return value;
      if (t === "function") return null;

      if (value instanceof Error) {
        return {
          name: clampStr(value.name, 80),
          message: clampStr(value.message, LIMITS.msg),
          stack: clampStr(value.stack || "", LIMITS.stack)
        };
      }

      if (typeof Node !== "undefined" && value instanceof Node) {
        return getDomNodeLabel(value) || (value.nodeName ? String(value.nodeName) : "Node");
      }

      if (typeof Event !== "undefined" && value instanceof Event) {
        return value && typeof value.type === "string" ? `[Event ${clampStr(value.type, 80)}]` : "Event";
      }

      if (t !== "object") return clampStr(value, LIMITS.str);

      if (depth >= maxDepth) return undefined;
      if (seen.has(value)) return undefined;
      seen.add(value);

      if (Array.isArray(value)) {
        const out = [];
        for (let i = 0; i < Math.min(value.length, 50); i++) {
          const cleaned = sanitizeForJSON(value[i], maxDepth, maxKeys, seen, depth + 1);
          if (cleaned !== undefined) out.push(cleaned);
        }
        return out;
      }

      // Try to condense common event-like objects.
      const maybeType = value && typeof value.type === "string" ? clampStr(value.type, 80) : null;
      const maybeTarget = value && value.target ? getDomNodeLabel(value.target) : null;
      const isEventLike = maybeType && ("target" in value || "timeStamp" in value);
      if (isEventLike) {
        return {
          type: maybeType,
          target: maybeTarget || undefined,
          timeStamp: typeof value.timeStamp === "number" ? value.timeStamp : undefined
        };
      }

      const out = {};
      const keys = Object.keys(value).slice(0, maxKeys);
      for (const k of keys) {
        if (SENSITIVE_KEY_RE.test(k)) {
          out[k] = "[Redacted]";
          continue;
        }
        const cleaned = sanitizeForJSON(value[k], maxDepth, maxKeys, seen, depth + 1);
        if (cleaned !== undefined) out[k] = cleaned;
      }
      return out;
    } catch {
      return null;
    }
  }

  function now() {
    return Date.now();
  }

  function clampStr(value, maxLen) {
    if (value == null) return "";
    const s = String(value);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  }

  function safeStringify(value, depth = LIMITS.objDepth) {
    try {
      const cleaned = sanitizeForJSON(value, depth, LIMITS.objKeys);
      return cleaned === undefined ? null : cleaned;
    } catch {
      return null;
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

  function describeElement(el) {
    try {
      if (!(el instanceof Element)) return null;
      const tag = (el.tagName || "").toLowerCase();
      const id = el.id ? `#${clampStr(el.id, 80)}` : "";
      const cls = el.classList && el.classList.length
        ? `.${Array.from(el.classList).slice(0, 4).map((c) => clampStr(c, 40)).join(".")}`
        : "";
      return clampStr(`${tag}${id}${cls}`, 180);
    } catch {
      return null;
    }
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
      longTasks: 0,
      lcpAttribution: null,
      clsAttribution: null,
      inpAttribution: null,
      longTaskMax: null
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
    return sanitizeForJSON(getCtxRaw(), 4);
  }

  function getCtxRaw() {
    return {
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
    };
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
    const rawCtx = entry && entry.ctx ? entry.ctx : getCtxRaw();
    const e = {
      t: typeof entry.t === "number" ? entry.t : now(),
      kind: clampStr(entry.kind || "debug", 40),
      level: entry.level == null ? null : clampStr(entry.level, 10),
      msg: clampStr(entry.msg || "", LIMITS.msg),
      data: (entry && entry.kind === "breadcrumb") ? sanitizeForJSON(entry.data) : safeStringify(entry.data),
      ctx: (entry && entry.kind === "breadcrumb") ? sanitizeForJSON(rawCtx, 4) : safeStringify(rawCtx)
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
      data: sanitizeForJSON(base.data, 4),
      stack: base.stack ? clampStr(base.stack, LIMITS.stack) : null,
      // Store a snapshot of the last N breadcrumbs, sanitized and de-referenced.
      breadcrumbs: crumbs.map((bc) => ({
        t: bc && typeof bc.t === "number" ? bc.t : now(),
        kind: clampStr(bc && bc.kind ? bc.kind : "breadcrumb", 40),
        level: bc && bc.level != null ? clampStr(bc.level, 10) : null,
        msg: clampStr(bc && bc.msg ? bc.msg : "", LIMITS.msg),
        data: sanitizeForJSON(bc ? bc.data : null, 3)
      }))
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
    return sanitizeForJSON({
      buildVersion: state.buildVersion,
      ctx: getCtx(),
      issues: state.issues.slice(-50).map((i) =>
        sanitizeForJSON({
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
        }, 4)
      )
    }, 4);
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

  function mapIssueType(issue) {
    try {
      const k = String(issue && issue.kind ? issue.kind : "").toLowerCase();
      const msg = String(issue && issue.msg ? issue.msg : "").toLowerCase();
      if (msg.includes("unhandledrejection")) return "unhandled_rejection";
      if (k === "network") return "network_error";
      if (k === "resource") return "resource_error";
      if (k === "perf") return "performance_issue";
      return "javascript_error";
    } catch {
      return "javascript_error";
    }
  }

  function breadcrumbToDashboardCrumb(bc) {
    try {
      const msg = String(bc && bc.msg ? bc.msg : "");
      const rawData = bc && bc.data && typeof bc.data === "object" ? bc.data : {};
      const data = sanitizeForJSON(rawData, 3) || {};

      let type = "info";
      if (msg.startsWith("nav.")) type = "navigation";
      else if (msg.startsWith("console.")) type = "console";
      else if (msg.startsWith("network.")) type = "network";
      else if (msg.startsWith("ui.")) type = "user";
      else if (msg.startsWith("doc.")) type = "navigation";

      const selector = data && (data.selector || data.tag || data.id || data.cls)
        ? clampStr(
            data.selector ||
              `${data.tag || ""}${data.id ? `#${data.id}` : ""}${data.cls ? `.${String(data.cls).split(/\s+/).filter(Boolean).slice(0, 4).join(".")}` : ""}`,
            200
          )
        : "";

      const url = data && data.url ? normalizeUrl(String(data.url)) : "";
      const message = clampStr(
        data && data.text ? String(data.text) :
        data && data.key ? `${msg} ${data.key}` :
        msg,
        240
      );

      return {
        type,
        timestamp: typeof bc.t === "number" ? bc.t : now(),
        message,
        selector: selector || undefined,
        url: url || undefined
      };
    } catch {
      return null;
    }
  }

  function makeWorkerErrorReport(issue) {
    const ctx = getCtx();
    const crumbs = (issue && Array.isArray(issue.breadcrumbs) ? issue.breadcrumbs : [])
      .slice(-20)
      .map(breadcrumbToDashboardCrumb)
      .filter(Boolean);

    return {
      type: mapIssueType(issue),
      message: clampStr(issue && issue.msg ? issue.msg : "issue", 1000),
      filename: null,
      line: null,
      col: null,
      stack: issue && issue.stack ? clampStr(issue.stack, LIMITS.stack) : null,
      url: clampStr(issue && issue.url ? issue.url : normalizeUrl(window.location.href), 500),
      viewport: (() => {
        try {
          return JSON.stringify(ctx && ctx.viewport ? ctx.viewport : { w: window.innerWidth, h: window.innerHeight });
        } catch {
          return null;
        }
      })(),
      version: state.buildVersion,
      breadcrumbs: (() => {
        try {
          return JSON.stringify(crumbs);
        } catch {
          return null;
        }
      })()
    };
  }

  let lastUploadedSig = null;
  let lastUploadedSeen = 0;

  function pickIssueToUpload() {
    try {
      if (!state.issues.length) return null;
      const newest = state.issues.slice().sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
      for (const it of newest) {
        if (!it) continue;
        if (typeof it.lastSeen !== "number") continue;
        if (it.lastSeen > lastUploadedSeen) return it;
        if (it.signature && it.signature !== lastUploadedSig && it.lastSeen === lastUploadedSeen) return it;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function uploadIssues(onUnload) {
    if (!state.enabled || !state.upload) return;
    lastUploadTry = now();

    const issue = pickIssueToUpload();
    if (!issue) return;

    const payload = makeWorkerErrorReport(issue);
    let json = "";
    try {
      json = JSON.stringify(payload);
    } catch {
      return;
    }

    // Hard cap (client-side) to avoid log abuse.
    if (json.length > 64 * 1024) {
      json = json.slice(0, 64 * 1024);
    }

    const url = "/api/error-report";
    const headers = { "Content-Type": "application/json" };

    try {
      if (onUnload && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(url, new Blob([json], { type: "application/json" }));
        if (ok) {
          state.lastUploadAt = now();
          lastUploadedSig = issue.signature || null;
          lastUploadedSeen = issue.lastSeen || lastUploadedSeen;
        }
        return;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: json,
        keepalive: !!onUnload
      });

      if (res.ok) {
        state.lastUploadAt = now();
        lastUploadedSig = issue.signature || null;
        lastUploadedSeen = issue.lastSeen || lastUploadedSeen;
      }
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

    // Navigation breadcrumbs (Sentry-style) – minimal, safe.
    try {
      const origPushState = history.pushState;
      const origReplaceState = history.replaceState;

      if (origPushState && !origPushState.__savonieWrapped) {
        history.pushState = function () {
          try {
            const to = (() => {
              try {
                const u = arguments && arguments.length >= 3 ? arguments[2] : null;
                return u == null ? null : normalizeUrl(String(u));
              } catch {
                return null;
              }
            })();
            push({ kind: "breadcrumb", level: "info", msg: "nav.pushState", data: { url: to || normalizeUrl(window.location.href) } });
          } catch {}
          return origPushState.apply(this, arguments);
        };
        history.pushState.__savonieWrapped = true;
      }

      if (origReplaceState && !origReplaceState.__savonieWrapped) {
        history.replaceState = function () {
          try {
            const to = (() => {
              try {
                const u = arguments && arguments.length >= 3 ? arguments[2] : null;
                return u == null ? null : normalizeUrl(String(u));
              } catch {
                return null;
              }
            })();
            push({ kind: "breadcrumb", level: "info", msg: "nav.replaceState", data: { url: to || normalizeUrl(window.location.href) } });
          } catch {}
          return origReplaceState.apply(this, arguments);
        };
        history.replaceState.__savonieWrapped = true;
      }
    } catch {}

    window.addEventListener("popstate", () => {
      push({ kind: "breadcrumb", level: "info", msg: "nav.popstate", data: { url: normalizeUrl(window.location.href) } });
    });

    window.addEventListener("hashchange", () => {
      push({ kind: "breadcrumb", level: "info", msg: "nav.hashchange", data: { url: normalizeUrl(window.location.href) } });
    });

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
          const text = args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(sanitizeForJSON(a, 2))))
            .join(" ");
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
            state.perf.longTaskMax = Math.max(state.perf.longTaskMax || 0, e.duration || 0);
            if (e.duration > 200) {
              const attrib = (() => {
                try {
                  const a = Array.isArray(e.attribution) ? e.attribution[0] : null;
                  if (!a) return null;
                  return safeStringify({
                    containerType: a.containerType,
                    containerName: a.containerName,
                    containerSrc: a.containerSrc,
                    name: a.name,
                    entryType: a.entryType,
                    startTime: a.startTime,
                    duration: a.duration
                  });
                } catch {
                  return null;
                }
              })();
              push({ kind: "perf", level: "warn", msg: "perf.longtask", data: { dur: e.duration, attribution: attrib } });
              recordIssue({ kind: "perf", level: "warn", msg: "perf.longtask", data: { dur: e.duration, attribution: attrib } });
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

            try {
              const src = e.sources && e.sources.length ? e.sources[0] : null;
              const node = src && src.node ? src.node : null;
              if (node) {
                state.perf.clsAttribution = {
                  selector: describeElement(node) || null,
                  value: src.value
                };
              }
            } catch {}
          }
          state.perf.cls = cls;
          if (state.enabled && cls > 0.1) {
            push({ kind: "perf", level: "warn", msg: "perf.cls", data: { cls, attribution: state.perf.clsAttribution } });
            recordIssue({ kind: "perf", level: "warn", msg: "perf.cls", data: { cls, attribution: state.perf.clsAttribution } });
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

          try {
            state.perf.lcpAttribution = {
              selector: describeElement(last.element) || null,
              url: last.url ? normalizeUrl(String(last.url)) : null
            };
          } catch {}

          if (state.enabled && lcp > 2500) {
            push({ kind: "perf", level: "warn", msg: "perf.lcp", data: { lcp, attribution: state.perf.lcpAttribution } });
            recordIssue({ kind: "perf", level: "warn", msg: "perf.lcp", data: { lcp, attribution: state.perf.lcpAttribution } });
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

              try {
                const target = e.target || null;
                state.perf.inpAttribution = {
                  selector: describeElement(target) || null,
                  type: e.name || null
                };
              } catch {}
            }
          }
          if (inp != null) {
            state.perf.inp = inp;
            if (state.enabled && inp > 200) {
              push({ kind: "perf", level: "warn", msg: "perf.inp", data: { inp, attribution: state.perf.inpAttribution } });
              recordIssue({ kind: "perf", level: "warn", msg: "perf.inp", data: { inp, attribution: state.perf.inpAttribution } });
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
    state.perf = { cls: null, lcp: null, inp: null, longTasks: 0, lcpAttribution: null, clsAttribution: null, inpAttribution: null, longTaskMax: null };
    try {
      sessionStorage.removeItem("site_diagnostics_state");
    } catch {}
    push({ kind: "debug", level: "info", msg: "telemetry.cleared", data: {} });
  }

  function exportJSON(opts) {
    const includeAll = !!(opts && opts.includeAll);
    const sanitizeEntry = (e) => {
      try {
        if (!e || typeof e !== "object") return null;
        return {
          t: typeof e.t === "number" ? e.t : null,
          kind: e.kind ? clampStr(e.kind, 40) : null,
          level: e.level == null ? null : clampStr(e.level, 10),
          msg: clampStr(e.msg || "", LIMITS.msg),
          data: sanitizeForJSON(e.data, 3),
          ctx: sanitizeForJSON(e.ctx, 3)
        };
      } catch {
        return null;
      }
    };

    const sanitizeIssue = (i) => {
      try {
        if (!i || typeof i !== "object") return null;
        return {
          signature: i.signature ? clampStr(i.signature, 500) : null,
          count: typeof i.count === "number" ? i.count : 1,
          firstSeen: typeof i.firstSeen === "number" ? i.firstSeen : null,
          lastSeen: typeof i.lastSeen === "number" ? i.lastSeen : null,
          kind: i.kind ? clampStr(i.kind, 40) : null,
          msg: clampStr(i.msg || "issue", LIMITS.msg),
          level: i.level == null ? null : clampStr(i.level, 10),
          url: i.url ? clampStr(i.url, 500) : null,
          data: sanitizeForJSON(i.data, 4),
          stack: i.stack ? clampStr(i.stack, LIMITS.stack) : null,
          breadcrumbs: Array.isArray(i.breadcrumbs) ? i.breadcrumbs.map(sanitizeEntry).filter(Boolean) : []
        };
      } catch {
        return null;
      }
    };

    return {
      state: {
        enabled: !!state.enabled,
        upload: !!state.upload,
        mode: state.mode,
        buildVersion: state.buildVersion,
        lastUploadAt: state.lastUploadAt
      },
      ctx: sanitizeForJSON(getCtxRaw(), 4),
      perf: sanitizeForJSON(state.perf, 4),
      issues: state.issues.map(sanitizeIssue).filter(Boolean),
      breadcrumbs: state.breadcrumbs.map(sanitizeEntry).filter(Boolean),
      events: (includeAll ? state.events : state.events.slice(-200)).map(sanitizeEntry).filter(Boolean)
    };
  }

  function subscribe(fn) {
    subs.add(fn);
  }

  function unsubscribe(fn) {
    subs.delete(fn);
  }

  function getState() {
    return state;
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
    sanitizeForJSON,
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

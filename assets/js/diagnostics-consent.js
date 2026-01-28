/* assets/js/diagnostics-consent.js */
export function initDiagnosticsConsent() {
  const tel = window.__SavonieTelemetry;
  if (!tel) return;

  const KEYS = {
    consent: "site_diagnostics_consent", // "granted" | "denied"
    upload: "site_diagnostics_upload",   // "on" | "off"
    asked: "site_diagnostics_asked"      // "1"
  };

  function canUseLocalStorage() {
    try {
      const k = "__ls_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  function cookieSet(name, value) {
    try {
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
      return true;
    } catch {
      return false;
    }
  }

  function cookieGet(name) {
    try {
      const m = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`));
      return m ? decodeURIComponent(m[1]) : null;
    } catch {
      return null;
    }
  }

  const storage = {
    type: canUseLocalStorage() ? "localStorage" : "cookie",
    set(k, v) {
      if (this.type === "localStorage") {
        localStorage.setItem(k, v);
        return true;
      }
      return cookieSet(k, v);
    },
    get(k) {
      if (this.type === "localStorage") return localStorage.getItem(k);
      return cookieGet(k);
    },
    del(k) {
      if (this.type === "localStorage") {
        localStorage.removeItem(k);
        return;
      }
      cookieSet(k, "");
    }
  };

  function toast(text) {
    const el = document.createElement("div");
    el.setAttribute("role", "status");
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "16px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "12px 14px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(33,40,66,0.95)";
    el.style.color = "white";
    el.style.zIndex = "999999";
    el.style.fontSize = "14px";
    el.style.maxWidth = "92vw";
    el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  function readConsent() {
    return storage.get(KEYS.consent);
  }

  function readUpload() {
    return storage.get(KEYS.upload) === "on";
  }

  function asked() {
    return storage.get(KEYS.asked) === "1";
  }

  function setAsked() {
    storage.set(KEYS.asked, "1");
  }

  function startTelemetryFromState() {
    const consent = readConsent();
    if (consent !== "granted") return;

    const upload = readUpload();
    const mode = (new URLSearchParams(location.search).get("debug") === "1") ? "dev" : "user";
    tel.enable({ upload, mode });
  }

  function hideBanner(banner) {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }

  function showBanner() {
    const banner = document.createElement("div");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Diagnostics consent");
    banner.style.position = "fixed";
    banner.style.left = "12px";
    banner.style.right = "12px";
    banner.style.bottom = "12px";
    banner.style.zIndex = "999998";
    banner.style.background = "rgba(225,212,194,0.98)";
    banner.style.border = "1px solid rgba(54,32,23,0.15)";
    banner.style.borderRadius = "14px";
    banner.style.padding = "14px";
    banner.style.boxShadow = "0 12px 40px rgba(0,0,0,0.20)";
    banner.style.fontFamily = "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.flexWrap = "wrap";
    row.style.alignItems = "center";
    row.style.gap = "10px";

    const text = document.createElement("div");
    text.style.flex = "1 1 240px";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.color = "#212842";
    title.style.marginBottom = "4px";
    title.textContent = "Enable diagnostics?";

    const body = document.createElement("div");
    body.style.fontSize = "13px";
    body.style.color = "rgba(54,32,23,0.85)";
    body.textContent = "Captures errors and performance data while you browse. Data stays local unless you enable uploads in settings.";

    text.appendChild(title);
    text.appendChild(body);

    const controls = document.createElement("div");
    controls.style.display = "flex";
    controls.style.flexWrap = "wrap";
    controls.style.gap = "10px";
    controls.style.alignItems = "center";

    const btnEnable = document.createElement("button");
    btnEnable.type = "button";
    btnEnable.textContent = "Enable diagnostics";
    btnEnable.style.padding = "10px 12px";
    btnEnable.style.borderRadius = "10px";
    btnEnable.style.border = "1px solid rgba(33,40,66,0.25)";
    btnEnable.style.background = "#212842";
    btnEnable.style.color = "white";
    btnEnable.style.fontWeight = "700";
    btnEnable.style.cursor = "pointer";
    btnEnable.style.minHeight = "44px";

    const btnNo = document.createElement("button");
    btnNo.type = "button";
    btnNo.textContent = "No thanks";
    btnNo.style.padding = "10px 12px";
    btnNo.style.borderRadius = "10px";
    btnNo.style.border = "1px solid rgba(54,32,23,0.20)";
    btnNo.style.background = "transparent";
    btnNo.style.color = "#362017";
    btnNo.style.fontWeight = "600";
    btnNo.style.cursor = "pointer";
    btnNo.style.minHeight = "44px";

    btnEnable.addEventListener("click", () => {
      setAsked();
      const ok1 = storage.set(KEYS.consent, "granted");
      const ok2 = storage.set(KEYS.upload, "off"); // Upload OFF by default

      const rb = readConsent();
      const verified = ok1 && ok2 && rb === "granted";

      if (!verified) {
        tel.setConsentFlags({ sessionOnly: true });
        toast("Enabled for this session only");
      } else {
        toast("Diagnostics enabled");
      }

      hideBanner(banner);

      const mode = (new URLSearchParams(location.search).get("debug") === "1") ? "dev" : "user";
      tel.enable({ upload: false, mode });
      tel.push({ kind: "consent", level: "info", msg: "consent.granted", data: { upload: false } });
    });

    btnNo.addEventListener("click", () => {
      setAsked();
      storage.set(KEYS.consent, "denied");
      storage.set(KEYS.upload, "off");
      hideBanner(banner);
      tel.disable();
      tel.push({ kind: "consent", level: "info", msg: "consent.denied", data: {} });
      toast("Diagnostics disabled");
    });

    controls.appendChild(btnEnable);
    controls.appendChild(btnNo);

    row.appendChild(text);
    row.appendChild(controls);
    banner.appendChild(row);

    document.body.appendChild(banner);
    return banner;
  }

  // Public hooks for HUD settings
  window.__SavonieDiagnosticsConsent = {
    get() {
      return {
        consent: readConsent(),
        upload: readUpload(),
        asked: asked(),
        storage: storage.type
      };
    },
    set({ consent, upload }) {
      if (typeof consent === "string") storage.set(KEYS.consent, consent);
      if (typeof upload === "boolean") storage.set(KEYS.upload, upload ? "on" : "off");
      storage.set(KEYS.asked, "1");
    },
    revoke() {
      storage.set(KEYS.consent, "denied");
      storage.set(KEYS.upload, "off");
      storage.set(KEYS.asked, "1");
      tel.disable();
      tel.push({ kind: "consent", level: "info", msg: "consent.revoked", data: {} });
    },
    clearData() {
      tel.clear();
    }
  };

  // Boot behavior
  startTelemetryFromState();
  if (!asked() && !readConsent()) showBanner();
}

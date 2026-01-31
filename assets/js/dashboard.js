/**
 * Error Dashboard JavaScript
 * Handles authentication, error fetching, filtering, and management
 * Build Retry: 2026-01-31 (Force)
 */

// DEMO MODE
// - Enabled for localhost/127.0.0.1
// - Enabled by default on Cloudflare Pages preview builds, unless `?force_real=1`
// - Always enabled when `?demo=1`
const __dashboardParams = new URLSearchParams(location.search);

function isLocalDevHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function isDashboardDemoMode() {
  const forceDemo = __dashboardParams.get('demo') === '1';
  const forceReal = __dashboardParams.get('force_real') === '1';
  const host = String(location.hostname || '').toLowerCase();
  if (forceDemo) return true;
  if (isLocalDevHost(host)) return true;
  if (isPagesPreviewHost(host) && !forceReal) return true;
  return false;
}

let DEMO_MODE = isDashboardDemoMode();

// API routing
const PROD_API_ORIGIN = 'https://www.estivanayramia.com';

function isPagesPreviewHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host.includes('.pages.dev');
}

function getApiOrigin() {
  const host = String(location.hostname || '').toLowerCase();
  if (host === 'estivanayramia.com' || host === 'www.estivanayramia.com') return '';
  if (host === 'localhost' || host === '127.0.0.1') return '';
  if (isPagesPreviewHost(host)) return PROD_API_ORIGIN;
  return '';
}

const API_ORIGIN = getApiOrigin();

function apiUrl(pathname) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${API_ORIGIN}${path}`;
}

async function readJsonOrText(response) {
  const text = await response.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

function setLoginError(message) {
  const errorMsg = document.getElementById('login-error');
  if (!errorMsg) return;
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
}

function setLoginStatus(fields) {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
  };

  if (!fields) return;
  if ('backendHealth' in fields) setText('login-backend-health', fields.backendHealth);
  if ('authConfigured' in fields) setText('login-auth-configured', fields.authConfigured);
  if ('authSource' in fields) setText('login-auth-source', fields.authSource);
  if ('workerVersion' in fields) setText('login-worker-version', fields.workerVersion);
}

function setLoginDisabled(disabled) {
  const btn = document.querySelector('#login-form button[type="submit"]');
  if (btn) btn.disabled = !!disabled;
}

let __preLoginHealth = null;

async function checkBackendHealthForLogin() {
  if (DEMO_MODE) return null;

  setLoginDisabled(true);
  setLoginStatus({
    backendHealth: 'Checking…',
    authConfigured: '—',
    authSource: '—',
    workerVersion: '—'
  });

  try {
    const res = await fetch(apiUrl('/api/health'), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const { json } = await readJsonOrText(res);
    if (!res.ok || !json) {
      __preLoginHealth = { reachable: true, ok: false, authConfigured: null, authSource: null, version: null, httpStatus: res.status };
      setLoginStatus({ backendHealth: `Unhealthy (HTTP ${res.status})` });
      setLoginDisabled(false);
      return __preLoginHealth;
    }

    const authConfigured = typeof json.authConfigured === 'boolean' ? json.authConfigured : null;
    const authSource = typeof json.authSource === 'string' ? json.authSource : (json.authSource === null ? null : null);
    const version = typeof json.version === 'string' ? json.version : null;

    __preLoginHealth = {
      reachable: true,
      ok: !!json.ok,
      authConfigured,
      authSource,
      version,
      httpStatus: res.status
    };

    setLoginStatus({
      backendHealth: json.ok ? 'OK' : 'Unhealthy',
      authConfigured: authConfigured === null ? '—' : (authConfigured ? 'Yes' : 'No'),
      authSource: authSource || '—',
      workerVersion: version || '—'
    });

    if (authConfigured === false) {
      setLoginError('Dashboard backend not configured. Set DASHBOARD_PASSWORD or DASHBOARD_PASSWORD_HASH in the Cloudflare Worker environment (Production + Preview) and redeploy.');
      setLoginDisabled(true);
    } else {
      setLoginDisabled(false);
    }

    return __preLoginHealth;
  } catch {
    __preLoginHealth = { reachable: false, ok: false, authConfigured: null, authSource: null, version: null, httpStatus: null };
    setLoginStatus({ backendHealth: 'Unavailable' });
    setLoginDisabled(false);
    return __preLoginHealth;
  }
}

// Mock error data for demo mode
const MOCK_ERRORS = [
  {
    id: 1,
    type: 'TypeError',
    message: 'Cannot read property "map" of undefined',
    url: 'https://www.estivanayramia.com/projects/',
    filename: 'site.min.js',
    line: 247,
    stack: 'TypeError: Cannot read property "map" of undefined\n  at renderProjects (site.min.js:247)\n  at HTMLDocument.<anonymous> (site.min.js:15)',
    category: 'code_bug',
    status: 'new',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    is_bot: false,
    timestamp: Date.now() - 3600000
  },
  {
    id: 2,
    type: 'ReferenceError',
    message: 'gsap is not defined',
    url: 'https://www.estivanayramia.com/',
    filename: 'site.min.js',
    line: 89,
    stack: 'ReferenceError: gsap is not defined\n  at initAnimations (site.min.js:89)',
    category: 'async_bug',
    status: 'investigating',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Safari/604.1',
    is_bot: false,
    timestamp: Date.now() - 7200000
  },
  {
    id: 3,
    type: 'NetworkError',
    message: 'Failed to fetch /api/chat',
    url: 'https://www.estivanayramia.com/contact',
    filename: null,
    line: null,
    stack: 'Error: Failed to fetch /api/chat\n  at fetch (native)',
    category: 'connectivity',
    status: 'resolved',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    is_bot: false,
    timestamp: Date.now() - 86400000
  }
];

let authToken = null;
let currentPage = 0;
const pageSize = 50;
let currentFilters = { status: '', category: '' };
let currentErrorId = null;

// Unified dashboard tab state
const dashboardTabs = {
  initialized: Object.create(null),
  consoleHooked: false,
  fetchHooked: false
};

const consoleLogs = [];
const networkRequests = [];

// Diagnostics state
const diagnosticsState = {
  loaded: false,
  open: false
};

function setDiagnosticsStatus(text, tone = 'muted') {
  const el = document.getElementById('diagnostics-status');
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function ensureDashboardConsent() {
  if (window.__SavonieDiagnosticsConsent) return;
  const KEYS = {
    consent: 'site_diagnostics_consent',
    upload: 'site_diagnostics_upload',
    asked: 'site_diagnostics_asked'
  };
  const storage = {
    type: (() => {
      try {
        const k = '__ls_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return 'localStorage';
      } catch {
        return 'cookie';
      }
    })(),
    set(k, v) {
      if (this.type === 'localStorage') {
        try { localStorage.setItem(k, v); } catch {}
        return;
      }
      try { document.cookie = `${encodeURIComponent(k)}=${encodeURIComponent(v)}; path=/; SameSite=Lax`; } catch {}
    },
    get(k) {
      if (this.type === 'localStorage') {
        try { return localStorage.getItem(k); } catch { return null; }
      }
      try {
        const m = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(k)}=([^;]*)`));
        return m ? decodeURIComponent(m[1]) : null;
      } catch {
        return null;
      }
    }
  };

  const getState = () => ({
    consent: storage.get(KEYS.consent),
    upload: storage.get(KEYS.upload) === 'on',
    asked: storage.get(KEYS.asked) === '1',
    storage: storage.type
  });

  window.__SavonieDiagnosticsConsent = {
    get: getState,
    set({ consent, upload }) {
      if (typeof consent === 'string') storage.set(KEYS.consent, consent);
      if (typeof upload === 'boolean') storage.set(KEYS.upload, upload ? 'on' : 'off');
      storage.set(KEYS.asked, '1');
    },
    revoke() {
      storage.set(KEYS.consent, 'denied');
      storage.set(KEYS.upload, 'off');
      storage.set(KEYS.asked, '1');
      window.__SavonieTelemetry?.disable?.();
    },
    clearData() {
      window.__SavonieTelemetry?.clear?.();
    }
  };

  // Default to granted for authenticated dashboard usage
  if (!storage.get(KEYS.consent)) {
    storage.set(KEYS.consent, 'granted');
    storage.set(KEYS.upload, 'off');
    storage.set(KEYS.asked, '1');
  }
}

async function loadDiagnosticsAssets() {
  if (diagnosticsState.loaded || window.__SavonieHUD) {
      diagnosticsState.loaded = true;
      return;
  }
  setDiagnosticsStatus('Loading diagnostics…', 'loading');
  await loadScript('/assets/js/telemetry-core.js');
  ensureDashboardConsent();
  window.__SavonieTelemetry?.enable?.({ upload: false, mode: 'dev' });
  await loadScript(`/assets/js/debugger-hud.min.js?v=${Date.now()}`);
  if (!window.__SavonieHUD || typeof window.__SavonieHUD.open !== 'function') {
    throw new Error('Diagnostics HUD failed to initialize (window.__SavonieHUD missing).');
  }
  if (!window.Savonie) window.Savonie = window.__SavonieHUD;
  diagnosticsState.loaded = true;
  setDiagnosticsStatus('Diagnostics loaded. Ready.', 'ready');
}

async function openDiagnosticsPanel() {
  const mount = document.getElementById('diagnostics-mount');
  const openBtn = document.getElementById('open-diagnostics');
  const closeBtn = document.getElementById('close-diagnostics');
  if (!mount) return;

  try {
    if (openBtn) openBtn.disabled = true;
    await loadDiagnosticsAssets();
    try { mount.innerHTML = ''; } catch {}
    window.__SavonieHUD?.open?.({ mount, embedded: true, backdrop: false });
    diagnosticsState.open = true;
    if (closeBtn) closeBtn.disabled = false;
    if (openBtn) openBtn.disabled = true;
    setDiagnosticsStatus('Diagnostics panel open.', 'ready');
  } catch (err) {
    console.error(err);
    setDiagnosticsStatus('Failed to load diagnostics.', 'error');
    if (closeBtn) closeBtn.disabled = true;
    if (openBtn) openBtn.disabled = false;
  }
}

function closeDiagnosticsPanel() {
  const closeBtn = document.getElementById('close-diagnostics');
  const openBtn = document.getElementById('open-diagnostics');
  window.__SavonieHUD?.close?.();
  diagnosticsState.open = false;
  if (closeBtn) closeBtn.disabled = true;
  if (openBtn) openBtn.disabled = false;
  setDiagnosticsStatus('Diagnostics closed.', 'muted');
}

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
  // Demo is fully offline/self-contained: no password prompt, no API calls.
  if (DEMO_MODE) {
    authToken = null;
    showDashboard();
    loadErrors();
    return;
  }

  authToken = localStorage.getItem('dashboard_token');

  if (authToken) {
    showDashboard();
    loadErrors();
    return;
  }

  showLogin();
  checkBackendHealthForLogin();
});

// Show login screen
function showLogin() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

// Show dashboard
function showDashboard() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  initDiagnosticsPanel();
  initDashboardTabs();
}

function getAuthHeaders(extra) {
  const headers = Object.assign({ 'Accept': 'application/json' }, extra || {});
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

function findMockErrorById(errorId) {
  const id = Number(errorId);
  return MOCK_ERRORS.find((e) => Number(e.id) === id) || null;
}

function populateErrorModal(error) {
  if (!error) throw new Error('No error data');

  const detailsDiv = document.getElementById('error-details');
  detailsDiv.textContent = '';

  const createGroup = (label, content, fullWidth = false) => {
    const group = document.createElement('div');
    group.className = fullWidth ? 'detail-group full-width' : 'detail-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    group.appendChild(content);
    return group;
  };

  const span = (text, className = '') => {
    const s = document.createElement('span');
    if (className) s.className = className;
    s.textContent = text;
    return s;
  };

  detailsDiv.appendChild(createGroup('ID', span(error.id)));

  const typeBadge = span(error.type, 'type-badge');
  detailsDiv.appendChild(createGroup('Type', typeBadge));

  const msgBlock = document.createElement('div');
  msgBlock.className = 'code-block';
  msgBlock.textContent = error.message;
  detailsDiv.appendChild(createGroup('Message', msgBlock, true));

  const breadcrumbsHtml = error.breadcrumbs ? renderBreadcrumbs(error.breadcrumbs) : '<p class="no-data">No interaction history available</p>';
  const bcDiv = document.createElement('div');
  bcDiv.className = 'breadcrumbs-container';
  bcDiv.innerHTML = breadcrumbsHtml;
  detailsDiv.appendChild(createGroup('Interaction History', bcDiv, true));

  const locSpan = document.createElement('span');
  const locLink = document.createElement('a');
  locLink.href = error.url;
  locLink.target = '_blank';
  locLink.textContent = truncate(error.url, 50);
  locSpan.appendChild(locLink);
  const subText = span(`${error.filename || ''}:${error.line || '?'}`, 'sub-text');
  const locWrapper = document.createElement('div');
  locWrapper.appendChild(locSpan);
  locWrapper.appendChild(subText);
  detailsDiv.appendChild(createGroup('Location', locWrapper));

  detailsDiv.appendChild(createGroup('User Agent', span(error.user_agent, 'sub-text')));
  detailsDiv.appendChild(createGroup('Time', span(new Date(error.timestamp).toLocaleString())));

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const strong = document.createElement('strong');
  strong.textContent = 'Stack Trace';
  summary.appendChild(strong);
  details.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = error.stack || 'No stack trace';
  details.appendChild(pre);
  detailsDiv.appendChild(details);

  document.getElementById('modal-category').value = error.category;
  document.getElementById('modal-status').value = error.status;
  document.getElementById('error-modal').style.display = 'flex';
}

function initDashboardTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  if (tabs.length === 0 || panels.length === 0) return;

  const activate = (tabName) => {
    tabs.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName));
    panels.forEach((p) => p.classList.toggle('active', p.id === `tab-${tabName}`));
    try { window.location.hash = tabName; } catch {}
    initializeTab(tabName);
  };

  if (!document.documentElement.dataset.dashboardTabsBound) {
    document.documentElement.dataset.dashboardTabsBound = '1';
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        if (!tabName) return;
        activate(tabName);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = (window.location.hash || '').replace(/^#/, '');
      if (!hash) return;
      if (!document.querySelector(`[data-tab="${CSS.escape(hash)}"]`)) return;
      activate(hash);
    });
  }

  const initial = (window.location.hash || '').replace(/^#/, '');
  if (initial && document.querySelector(`[data-tab="${CSS.escape(initial)}"]`)) {
    activate(initial);
  } else {
    activate('errors');
  }
}

function initializeTab(tabName) {
  if (dashboardTabs.initialized[tabName]) return;
  dashboardTabs.initialized[tabName] = true;

  switch (tabName) {
    case 'console':
      initConsoleTab();
      break;
    case 'network':
      initNetworkTab();
      break;
    case 'performance':
      initPerformanceTab();
      break;
    case 'redirects':
      initRedirectsTab();
      break;
    case 'storage':
      initStorageTab();
      break;
    case 'system':
      initSystemTab();
      break;
    default:
      break;
  }
}

// ==================== CONSOLE TAB ====================
function initConsoleTab() {
  if (!dashboardTabs.consoleHooked) {
    dashboardTabs.consoleHooked = true;
    const levels = ['log', 'info', 'warn', 'error'];
    const originals = {};

    levels.forEach((level) => {
      originals[level] = console[level];
      console[level] = function (...args) {
        try { originals[level].apply(console, args); } catch {}

        try {
          const message = args
            .map((arg) => {
              if (typeof arg === 'string') return arg;
              if (arg instanceof Error) return arg.stack || arg.message || String(arg);
              if (typeof arg === 'object') {
                try { return JSON.stringify(arg, null, 2); } catch { return '[object]'; }
              }
              return String(arg);
            })
            .join(' ');

          consoleLogs.push({ level, message, timestamp: Date.now() });
        } catch {}

        renderConsoleLogs();
      };
    });
  }

  const clearBtn = document.getElementById('console-clear');
  const filterEl = document.getElementById('console-filter');
  const levelEl = document.getElementById('console-level');

  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = '1';
    clearBtn.addEventListener('click', () => {
      consoleLogs.length = 0;
      renderConsoleLogs();
    });
  }

  if (filterEl && !filterEl.dataset.bound) {
    filterEl.dataset.bound = '1';
    filterEl.addEventListener('input', () => renderConsoleLogs());
  }

  if (levelEl && !levelEl.dataset.bound) {
    levelEl.dataset.bound = '1';
    levelEl.addEventListener('change', () => renderConsoleLogs());
  }

  renderConsoleLogs();
}

function renderConsoleLogs() {
  const output = document.getElementById('console-output');
  if (!output) return;

  const filter = (document.getElementById('console-filter')?.value || '').toLowerCase();
  const levelFilter = document.getElementById('console-level')?.value || '';

  const filtered = consoleLogs.filter((log) => {
    if (levelFilter && log.level !== levelFilter) return false;
    if (filter && !(log.message || '').toLowerCase().includes(filter)) return false;
    return true;
  });

  output.innerHTML = filtered
    .map((log) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `
        <div class="console-entry ${escapeHtml(log.level)}">
          <span class="console-time">${escapeHtml(time)}</span>
          <span class="console-level">[${escapeHtml(log.level.toUpperCase())}]</span>
          <span class="console-message">${escapeHtml(log.message)}</span>
        </div>
      `.trim();
    })
    .join('');

  const auto = document.getElementById('console-autoscroll');
  if (auto && auto.checked) {
    output.scrollTop = output.scrollHeight;
  }
}

// ==================== NETWORK TAB ====================
function initNetworkTab() {
  if (!dashboardTabs.fetchHooked) {
    dashboardTabs.fetchHooked = true;
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
      const start = Date.now();
      const url = typeof input === 'string' ? input : input?.url || String(input);
      const method = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';

      try {
        const response = await originalFetch(input, init);
        const duration = Date.now() - start;
        let size = '—';
        try {
          const cl = response.headers.get('content-length');
          if (cl) size = cl;
        } catch {}

        networkRequests.push({
          method: String(method).toUpperCase(),
          url,
          status: response.status,
          duration,
          size,
          timestamp: Date.now()
        });
        renderNetworkRequests();
        return response;
      } catch (error) {
        networkRequests.push({
          method: String(method).toUpperCase(),
          url,
          status: 'Failed',
          duration: Date.now() - start,
          size: '—',
          timestamp: Date.now(),
          error: error?.message || String(error)
        });
        renderNetworkRequests();
        throw error;
      }
    };
  }

  const clearBtn = document.getElementById('network-clear');
  const exportBtn = document.getElementById('network-export-har');
  const methodEl = document.getElementById('network-method');
  const statusEl = document.getElementById('network-status');

  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = '1';
    clearBtn.addEventListener('click', () => {
      networkRequests.length = 0;
      renderNetworkRequests();
    });
  }

  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', () => exportNetworkHar());
  }

  if (methodEl && !methodEl.dataset.bound) {
    methodEl.dataset.bound = '1';
    methodEl.addEventListener('change', () => renderNetworkRequests());
  }

  if (statusEl && !statusEl.dataset.bound) {
    statusEl.dataset.bound = '1';
    statusEl.addEventListener('change', () => renderNetworkRequests());
  }

  renderNetworkRequests();
}

function renderNetworkRequests() {
  const tbody = document.getElementById('network-tbody');
  if (!tbody) return;

  const methodFilter = document.getElementById('network-method')?.value || '';
  const statusFilter = document.getElementById('network-status')?.value || '';

  const filtered = networkRequests.filter((req) => {
    if (methodFilter && req.method !== methodFilter) return false;
    if (statusFilter) {
      const statusCode = String(req.status);
      if (statusFilter === '2xx' && !statusCode.startsWith('2')) return false;
      if (statusFilter === '4xx' && !statusCode.startsWith('4')) return false;
      if (statusFilter === '5xx' && !statusCode.startsWith('5')) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-secondary);">No requests captured yet.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .slice(-250)
    .map((req) => {
      const statusKey = String(req.status);
      const statusClass = statusKey === 'Failed' ? 'status-5xx' : `status-${statusKey[0]}xx`;
      return `
        <tr class="${statusClass}">
          <td>${escapeHtml(req.method)}</td>
          <td title="${escapeHtml(req.url)}">${escapeHtml(truncate(req.url, 70))}</td>
          <td>${escapeHtml(String(req.status))}</td>
          <td>${escapeHtml(String(req.duration))}ms</td>
          <td>${escapeHtml(String(req.size))}</td>
          <td>${escapeHtml(formatClockTime(req.timestamp))}</td>
        </tr>
      `.trim();
    })
    .join('');
}

function exportNetworkHar() {
  const har = {
    log: {
      version: '1.2',
      creator: { name: 'portfolio-site dashboard', version: '1.0' },
      entries: networkRequests.map((r) => ({
        startedDateTime: new Date(r.timestamp).toISOString(),
        time: r.duration,
        request: {
          method: r.method,
          url: r.url,
          httpVersion: 'HTTP/1.1',
          headers: [],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: -1
        },
        response: {
          status: typeof r.status === 'number' ? r.status : 0,
          statusText: String(r.status),
          httpVersion: 'HTTP/1.1',
          headers: [],
          cookies: [],
          content: { size: Number(r.size) || -1, mimeType: '', text: '' },
          redirectURL: '',
          headersSize: -1,
          bodySize: -1
        },
        cache: {},
        timings: { send: 0, wait: r.duration, receive: 0 }
      }))
    }
  };

  window.__lastDashboardExport = { type: 'har', at: Date.now() };
  const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `network-${Date.now()}.har.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ==================== PERFORMANCE TAB ====================
function initPerformanceTab() {
  if (!('performance' in window)) return;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
  };

  // Navigation timing (prefer PerformanceNavigationTiming)
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      setText('perf-dcl', `${Math.round(nav.domContentLoadedEventEnd)}ms`);
      setText('perf-load', `${Math.round(nav.loadEventEnd)}ms`);
    } else if (performance.timing) {
      const t = performance.timing;
      const dcl = t.domContentLoadedEventEnd - t.navigationStart;
      const load = t.loadEventEnd - t.navigationStart;
      if (Number.isFinite(dcl) && dcl > 0) setText('perf-dcl', `${dcl}ms`);
      if (Number.isFinite(load) && load > 0) setText('perf-load', `${load}ms`);
    }
  } catch {}

  // Paint timing
  try {
    const paints = performance.getEntriesByType('paint');
    const fp = paints.find((e) => e.name === 'first-paint' || e.name === 'first-contentful-paint');
    if (fp) setText('perf-fp', `${Math.round(fp.startTime)}ms`);
  } catch {}

  if ('PerformanceObserver' in window) {
    try {
      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) setText('perf-lcp', `${Math.round(last.startTime)}ms`);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      // INP proxy via first-input
      new PerformanceObserver((list) => {
        const entry = list.getEntries()[0];
        if (!entry) return;
        const inp = entry.processingStart - entry.startTime;
        if (Number.isFinite(inp)) setText('perf-inp', `${Math.round(inp)}ms`);
      }).observe({ type: 'first-input', buffered: true });
    } catch {}

    try {
      // CLS
      let cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) cls += entry.value;
        }
        setText('perf-cls', cls.toFixed(3));
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      // Long tasks
      let longTasks = 0;
      new PerformanceObserver((list) => {
        longTasks += list.getEntries().length;
        setText('perf-longtasks', String(longTasks));
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
  }

  // Memory (Chromium only)
  if (performance.memory) {
    const tick = () => {
      try {
        const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
        const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(1);
        setText('perf-memory', `${used} / ${total} MB`);
      } catch {}
    };
    tick();
    setInterval(tick, 2000);
  }
}

// ==================== REDIRECTS TAB ====================
function initRedirectsTab() {
  const runBtn = document.getElementById('redirect-run-diagnostics');
  const rootBtn = document.getElementById('redirect-test-root');
  const enBtn = document.getElementById('redirect-test-en');
  const clearBtn = document.getElementById('redirect-clear');
  const testAllBtn = document.getElementById('test-all-features');

  if (runBtn && !runBtn.dataset.bound) {
    runBtn.dataset.bound = '1';
    runBtn.addEventListener('click', () => runRedirectDiagnostics());
  }
  if (rootBtn && !rootBtn.dataset.bound) {
    rootBtn.dataset.bound = '1';
    rootBtn.addEventListener('click', () => testRedirectPath('/'));
  }
  if (enBtn && !enBtn.dataset.bound) {
    enBtn.dataset.bound = '1';
    enBtn.addEventListener('click', () => testRedirectPath('/EN/'));
  }
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = '1';
    clearBtn.addEventListener('click', () => {
      const log = document.getElementById('redirect-log');
      const results = document.getElementById('redirect-results');
      if (log) log.textContent = '';
      if (results) results.textContent = '';
    });
  }

  if (testAllBtn && !testAllBtn.dataset.bound) {
    testAllBtn.dataset.bound = '1';
    testAllBtn.addEventListener('click', async () => {
      await runComprehensiveFeatureTest(testAllBtn);
    });
  }

  logRedirect('Redirect testing initialized', 'success');
}

async function runComprehensiveFeatureTest(buttonEl) {
  const btn = buttonEl;
  const prevText = btn ? btn.textContent : '';
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Running…';
    }

    logRedirect('=== COMPREHENSIVE TEST STARTED ===', 'info');
    logRedirect('This will generate console logs, network calls, perf marks, and storage entries.', 'info');

    // 1) Console logging
    logRedirect('Test 1/10: Console logging', 'info');
    console.log('Test log message');
    console.info('Test info message');
    console.warn('Test warning message');
    console.error('Test error message');
    await sleep(250);

    // 2) Network requests (success + fail)
    logRedirect('Test 2/10: Network requests', 'info');
    try { await fetch('/'); } catch {}
    try { await fetch(apiUrl('/api/health')); } catch {}
    try { await fetch('/nonexistent-endpoint-test-404'); } catch {}
    await sleep(250);

    // 3) Simulated JS error (caught)
    logRedirect('Test 3/10: Simulated JS error (caught)', 'warning');
    try {
      throw new Error('Synthetic dashboard test error');
    } catch (e) {
      console.error('Caught synthetic error:', e);
    }
    await sleep(250);

    // 4) Redirect diagnostics
    logRedirect('Test 4/10: Redirect checks', 'info');
    await testRedirectPath('/');
    await testRedirectPath('/EN/');
    await sleep(250);

    // 5) Performance marks
    logRedirect('Test 5/10: Performance marks', 'info');
    try {
      if ('performance' in window && performance.mark && performance.measure) {
        performance.mark('dashboard-test-start');
        await sleep(30);
        performance.mark('dashboard-test-end');
        performance.measure('dashboard-test-measure', 'dashboard-test-start', 'dashboard-test-end');
      }
    } catch {}
    await sleep(250);

    // 6) Long task simulation
    logRedirect('Test 6/10: Long task simulation (~120ms)', 'warning');
    {
      const start = Date.now();
      while (Date.now() - start < 120) {
        // busy loop
      }
    }
    await sleep(250);

    // 7) Storage ops
    logRedirect('Test 7/10: Storage operations', 'info');
    try { localStorage.setItem('dashboard_test_key', `value_${Date.now()}`); } catch {}
    try { sessionStorage.setItem('dashboard_test_session_key', `value_${Date.now()}`); } catch {}
    try { refreshLocalStorage(); refreshSessionStorage(); } catch {}
    await sleep(250);

    // 8) Rapid logs
    logRedirect('Test 8/10: Rapid console burst', 'info');
    for (let i = 1; i <= 10; i++) {
      console.log(`Rapid log ${i}/10`);
    }
    await sleep(250);

    // 9) Auth endpoint (invalid password)
    logRedirect('Test 9/10: Auth endpoint (invalid password)', 'info');
    try {
      await fetch(apiUrl('/api/auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'invalid-password-for-testing' })
      });
    } catch {}
    await sleep(250);

    // 10) Intentional cross-origin request (expected to fail CORS)
    logRedirect('Test 10/10: Cross-origin request (expect CORS block)', 'warning');
    try { await fetch('https://example.com/'); } catch {}

    logRedirect('=== COMPREHENSIVE TEST COMPLETE ===', 'success');
    logRedirect('Check tabs: Console, Network, Performance, Storage.', 'success');
    try { alert('Comprehensive test complete. Check Console/Network/Performance/Storage tabs.'); } catch {}
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText || 'Test All Features';
    }
  }
}

function logRedirect(message, type = 'info') {
  const logEl = document.getElementById('redirect-log');
  if (!logEl) return;
  const ts = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = `redirect-log-${type}`;
  line.textContent = `[${ts}] ${message}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

async function testRedirectPath(path) {
  logRedirect(`Testing: ${path}`, 'info');
  const start = Date.now();
  try {
    const response = await fetch(path, { method: 'GET', redirect: 'follow' });
    const finalPath = (() => {
      try { return new URL(response.url, window.location.origin).pathname; } catch { return path; }
    })();
    const duration = Date.now() - start;
    logRedirect(`Result: ${path} → ${response.status} (${duration}ms) Final: ${finalPath}`, response.status === 200 ? 'success' : 'warning');
    return { ok: true, status: response.status, finalPath, duration };
  } catch (error) {
    logRedirect(`Error: ${path} → ${error?.message || String(error)}`, 'error');
    return { ok: false, error: error?.message || String(error) };
  }
}

async function runRedirectDiagnostics() {
  const logEl = document.getElementById('redirect-log');
  const resultsEl = document.getElementById('redirect-results');
  if (logEl) logEl.textContent = '';
  if (resultsEl) resultsEl.textContent = '';

  logRedirect('Starting redirect diagnostics…', 'info');
  const tests = [
    { path: '/', expected: 200 },
    { path: '/EN/', expected: 200 },
    { path: '/EN/index.html', expected: 200 },
    { path: '/redirect-debug.html', expected: 200 },
    { path: '/nonexistent-page', expected: 404 }
  ];

  const results = [];
  for (const t of tests) {
    const r = await testRedirectPath(t.path);
    results.push({ test: t, result: r });
    await sleep(100);
  }

  if (resultsEl) {
    results.forEach(({ test, result }) => {
      const card = document.createElement('div');
      const pass = result.ok && result.status === test.expected;
      card.className = `redirect-test ${pass ? 'pass' : 'fail'}`;
      card.innerHTML = `
        <div><strong>${pass ? 'PASS' : 'FAIL'}</strong> ${escapeHtml(test.path)}</div>
        <div>Expected: ${escapeHtml(String(test.expected))}</div>
        <div>Got: ${escapeHtml(result.ok ? String(result.status) : 'Error')}</div>
      `.trim();
      resultsEl.appendChild(card);
    });
  }

  logRedirect('Diagnostics complete', 'success');
}

// ==================== STORAGE TAB ====================
function initStorageTab() {
  const lsBtn = document.getElementById('storage-ls-refresh');
  const ssBtn = document.getElementById('storage-ss-refresh');
  const cBtn = document.getElementById('storage-cookies-refresh');
  const swBtn = document.getElementById('storage-sw-unregister');

  if (lsBtn && !lsBtn.dataset.bound) {
    lsBtn.dataset.bound = '1';
    lsBtn.addEventListener('click', () => refreshLocalStorage());
  }
  if (ssBtn && !ssBtn.dataset.bound) {
    ssBtn.dataset.bound = '1';
    ssBtn.addEventListener('click', () => refreshSessionStorage());
  }
  if (cBtn && !cBtn.dataset.bound) {
    cBtn.dataset.bound = '1';
    cBtn.addEventListener('click', () => refreshCookies());
  }
  if (swBtn && !swBtn.dataset.bound) {
    swBtn.dataset.bound = '1';
    swBtn.addEventListener('click', () => unregisterServiceWorker());
  }

  refreshLocalStorage();
  refreshSessionStorage();
  refreshCookies();
  refreshServiceWorker();
}

function refreshLocalStorage() {
  const table = document.getElementById('storage-ls-table');
  if (!table) return;
  let items = [];
  try { items = Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]); } catch {}
  renderStorageTable(table, items);
}

function refreshSessionStorage() {
  const table = document.getElementById('storage-ss-table');
  if (!table) return;
  let items = [];
  try { items = Object.keys(sessionStorage).sort().map((k) => [k, sessionStorage.getItem(k)]); } catch {}
  renderStorageTable(table, items);
}

function refreshCookies() {
  const table = document.getElementById('storage-cookies-table');
  if (!table) return;
  const cookies = (document.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((cookie) => {
      const [name, ...valueParts] = cookie.split('=');
      return [name, valueParts.join('=')];
    });
  renderStorageTable(table, cookies);
}

function renderStorageTable(table, entries) {
  if (!entries || entries.length === 0) {
    table.innerHTML = '<tr><td colspan="2" style="color: var(--text-secondary); padding: 10px;">No items</td></tr>';
    return;
  }

  table.innerHTML = `
    <thead><tr><th>Key</th><th>Value</th></tr></thead>
    <tbody>
      ${entries
        .map(([k, v]) => {
          const vs = v == null ? '' : String(v);
          return `
            <tr>
              <td>${escapeHtml(String(k))}</td>
              <td title="${escapeHtml(vs)}">${escapeHtml(truncate(vs, 120))}</td>
            </tr>
          `.trim();
        })
        .join('')}
    </tbody>
  `.trim();
}

async function refreshServiceWorker() {
  const statusEl = document.getElementById('storage-sw-status');
  if (!statusEl) return;

  if (!('serviceWorker' in navigator)) {
    statusEl.textContent = 'Service Workers not supported.';
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      statusEl.textContent = 'No service worker registered.';
      return;
    }

    statusEl.textContent = `Active: ${registration.active ? 'Yes' : 'No'} | Scope: ${registration.scope}`;
  } catch {
    statusEl.textContent = 'Unable to query service worker.';
  }
}

async function unregisterServiceWorker() {
  if (!confirm('Unregister service worker? This may clear cached assets.')) return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) await registration.unregister();
    await refreshServiceWorker();
    alert('Service worker unregistered. Refresh the page.');
  } catch (e) {
    alert(`Failed to unregister: ${e?.message || String(e)}`);
  }
}

// ==================== SYSTEM TAB ====================
function initSystemTab() {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  // Backend health (auth configured / version) — helps diagnose Cloudflare preview/prod env issues.
  (async () => {
    if (window.__dashboardBackendHealthLoaded) return;
    window.__dashboardBackendHealthLoaded = true;

    set('sys-backend-health', 'Checking…');
    set('sys-auth-configured', '—');
    set('sys-auth-source', '—');
    set('sys-worker-version', '—');

    try {
      const res = await fetch(apiUrl('/api/health'), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const { json } = await readJsonOrText(res);

      if (!res.ok || !json) {
        set('sys-backend-health', `Unhealthy (HTTP ${res.status})`);
        return;
      }

      set('sys-backend-health', json.ok ? 'OK' : 'Unhealthy');
      if (typeof json.authConfigured === 'boolean') {
        set('sys-auth-configured', json.authConfigured ? 'Yes' : 'No');
      }
      if (typeof json.authSource === 'string' || json.authSource === null) {
        set('sys-auth-source', json.authSource || '—');
      }
      if (typeof json.version === 'string') {
        set('sys-worker-version', json.version);
      }
    } catch {
      set('sys-backend-health', 'Unavailable');
    }
  })();

  set('sys-build', document.querySelector('meta[name="build-version"]')?.content || 'dev');
  set('sys-ua', navigator.userAgent);
  set('sys-viewport', `${window.innerWidth} × ${window.innerHeight}`);
  set('sys-dpr', String(window.devicePixelRatio || 1));
  set('sys-platform', navigator.platform || 'unknown');
  set('sys-lang', navigator.language || 'unknown');
  set('sys-online', navigator.onLine ? 'Online' : 'Offline');

  if (navigator.connection && typeof navigator.connection === 'object') {
    const c = navigator.connection;
    set('sys-connection', `${c.effectiveType || 'unknown'} (${c.downlink || '?'}Mbps)`);
  } else {
    set('sys-connection', 'Unknown');
  }

  if (performance.memory) {
    try {
      const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
      const limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(1);
      set('sys-memory', `${used} / ${limit} MB`);
    } catch {
      set('sys-memory', 'Not available');
    }
  } else {
    set('sys-memory', 'Not available');
  }

  const exportBtn = document.getElementById('sys-export-json');
  const copyBtn = document.getElementById('sys-copy-report');
  const clearBtn = document.getElementById('sys-clear-all');
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', () => exportAllDataJSON());
  }
  if (copyBtn && !copyBtn.dataset.bound) {
    copyBtn.dataset.bound = '1';
    copyBtn.addEventListener('click', () => copyDebugReport());
  }
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.dataset.bound = '1';
    clearBtn.addEventListener('click', () => clearAllData());
  }
}

function exportAllDataJSON() {
  const data = {
    timestamp: Date.now(),
    consoleLogs,
    networkRequests,
    system: {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      platform: navigator.platform,
      language: navigator.language,
      online: navigator.onLine
    }
  };

  window.__lastDashboardExport = { type: 'json', at: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-export-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function copyDebugReport() {
  const report = [
    `Debug Report - ${new Date().toLocaleString()}`,
    '',
    'System Info:',
    `- User Agent: ${navigator.userAgent}`,
    `- Viewport: ${window.innerWidth}×${window.innerHeight}`,
    `- Platform: ${navigator.platform}`,
    `- Language: ${navigator.language}`,
    '',
    'Recent Console Logs (last 10):',
    ...consoleLogs.slice(-10).map((l) => `[${l.level.toUpperCase()}] ${l.message}`),
    '',
    'Recent Network Requests (last 10):',
    ...networkRequests
      .slice(-10)
      .map((r) => `${r.method} ${r.url} - ${r.status} (${r.duration}ms)`) 
  ].join('\n');

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(report);
    } else if (window.__testClipboard) {
      window.__testClipboard.text = report;
    }
    window.__lastDashboardExport = { type: 'clipboard', at: Date.now() };
    alert('Debug report copied to clipboard.');
  } catch {
    alert('Failed to copy debug report.');
  }
}

function clearAllData() {
  if (!confirm('Clear all diagnostic data? This cannot be undone.')) return;
  consoleLogs.length = 0;
  networkRequests.length = 0;
  renderConsoleLogs();
  renderNetworkRequests();
  try { window.__SavonieTelemetry?.clear?.(); } catch {}
  alert('All diagnostic data cleared.');
}

function formatClockTime(ts) {
  try { return new Date(ts).toLocaleTimeString(); } catch { return ''; }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function initDiagnosticsPanel() {
  const openBtn = document.getElementById('open-diagnostics');
  const closeBtn = document.getElementById('close-diagnostics');
  const mount = document.getElementById('diagnostics-mount');
  if (!openBtn || !closeBtn || !mount) return;
  setDiagnosticsStatus('Diagnostics not loaded.', 'muted');

  // Avoid duplicate bindings if showDashboard() runs multiple times.
  if (mount.dataset.diagnosticsBound === '1') return;
  mount.dataset.diagnosticsBound = '1';

  // Ensure a clean mount. HUD renders its own DOM.
  try { mount.innerHTML = ''; } catch {}
  closeBtn.disabled = true;
  openBtn.disabled = false;

  // FORCE button clickability with inline styles (nuclear option for desktop overlay issues)
  openBtn.style.pointerEvents = 'auto';
  openBtn.style.cursor = 'pointer';
  openBtn.style.position = 'relative';
  openBtn.style.zIndex = '9999';
  closeBtn.style.pointerEvents = 'auto';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.position = 'relative';
  closeBtn.style.zIndex = '9999';

  console.log('[Dashboard] Diagnostics panel initialized. Open button:', openBtn, 'Close button:', closeBtn);

  openBtn.addEventListener('click', async (e) => {
    console.log('[Dashboard] Open diagnostics clicked!', e);
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {}
    await openDiagnosticsPanel();
  }, { capture: true });

  closeBtn.addEventListener('click', (e) => {
    console.log('[Dashboard] Close diagnostics clicked!', e);
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {}
    closeDiagnosticsPanel();
  }, { capture: true });
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const password = document.getElementById('password-input').value;
  const errorMsg = document.getElementById('login-error');
  
  if (DEMO_MODE) {
    showDashboard();
    loadErrors();
    return;
  }

  // Enforce pre-login health check before accepting credentials.
  if (!__preLoginHealth) await checkBackendHealthForLogin();
  if (__preLoginHealth && __preLoginHealth.reachable === false) {
    setLoginError('Backend unreachable. Check Worker routing and try again.');
    return;
  }
  if (__preLoginHealth && __preLoginHealth.authConfigured === false) {
    setLoginError('Dashboard backend not configured. Set DASHBOARD_PASSWORD or DASHBOARD_PASSWORD_HASH in the Cloudflare Worker environment (Production + Preview) and redeploy.');
    return;
  }
  
  try {
    const response = await fetch(apiUrl('/api/auth'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const { json, text } = await readJsonOrText(response);

    if (response.ok && json && json.token) {
      authToken = json.token;
      localStorage.setItem('dashboard_token', authToken);
      showDashboard();
      loadErrors();
    } else {
      if (!json) {
        if (response.status === 404 && isPagesPreviewHost(location.hostname)) {
          setLoginError('Backend not available for this preview build.');
        } else {
          const snippet = String(text || '').replace(/\s+/g, ' ').slice(0, 140);
          setLoginError(`Login failed (HTTP ${response.status}). ${snippet ? `Response: ${snippet}` : ''}`.trim());
        }
      } else {
        const errCode = String(json.error || '').toLowerCase();

        if (response.status === 500 && errCode === 'server_not_configured') {
          setLoginError('Dashboard backend not configured. Set DASHBOARD_PASSWORD or DASHBOARD_PASSWORD_HASH in the Cloudflare Worker environment (Production + Preview) and redeploy.');
        } else if (response.status === 401) {
          errorMsg.textContent = 'Invalid password';
          errorMsg.style.display = 'block';
        } else {
          const snippet = String(json.message || json.error || '').replace(/\s+/g, ' ').slice(0, 140);
          setLoginError(`Login failed (HTTP ${response.status}). ${snippet ? `Response: ${snippet}` : ''}`.trim());
        }
      }
    }
  } catch (error) {
    errorMsg.textContent = 'Connection error';
    errorMsg.style.display = 'block';
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  authToken = null;
  localStorage.removeItem('dashboard_token');
  closeDiagnosticsPanel();
  showLogin();
});

// Load errors from API
async function loadErrors() {
  if (DEMO_MODE) {
    // Demo mode - use mock data
    const filtered = MOCK_ERRORS.filter(error => {
      if (currentFilters.status && error.status !== currentFilters.status) return false;
      if (currentFilters.category && error.category !== currentFilters.category) return false;
      return true;
    });
    
    const start = currentPage * pageSize;
    const pageErrors = filtered.slice(start, start + pageSize);
    
    renderErrors(pageErrors);
    updateStats(pageErrors, filtered.length);
    updatePagination(filtered.length);
    return;
  }
  
  try {
    const params = new URLSearchParams({
      limit: pageSize,
      offset: currentPage * pageSize,
      ...currentFilters
    });
    
    const response = await fetch(apiUrl(`/api/errors?${params}`), {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired
        authToken = null;
        localStorage.removeItem('dashboard_token');
        showLogin();
        return;
      }
      throw new Error('Failed to fetch errors');
    }
    
    const { json } = await readJsonOrText(response);
    const data = json;
    if (!data) throw new Error('Non-JSON API response');
    renderErrors(data.errors);
    updateStats(data.errors, data.total);
    updatePagination(data.total);
    
  } catch (error) {
    console.error('Error loading errors:', error);
    alert('Failed to load errors');
  }
}

// Render errors in table
function renderErrors(errors) {
  const tbody = document.getElementById('error-tbody');
  
  if (errors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 40px;">No errors found</td></tr>';
    return;
  }
  
  tbody.textContent = '';
  errors.forEach(error => {
    const tr = document.createElement('tr');
    tr.dataset.errorId = error.id;

    const createCell = (content) => { const td = document.createElement('td'); td.textContent = content; return td; };
    
    tr.appendChild(createCell(error.id));
    
    const typeTd = document.createElement('td');
    const typeBadge = document.createElement('span');
    typeBadge.className = 'type-badge';
    typeBadge.textContent = error.type;
    typeTd.appendChild(typeBadge);
    tr.appendChild(typeTd);
    
    const msgTd = document.createElement('td');
    msgTd.className = 'message-col';
    msgTd.title = error.message;
    msgTd.textContent = truncate(error.message, 50);
    tr.appendChild(msgTd);
    
    const urlTd = document.createElement('td');
    urlTd.className = 'url-col';
    urlTd.title = error.url;
    urlTd.textContent = truncate(error.url, 30);
    tr.appendChild(urlTd);
    
    const catTd = document.createElement('td');
    const catBadge = document.createElement('span');
    catBadge.className = `category-badge ${error.category}`;
    catBadge.textContent = error.category;
    catTd.appendChild(catBadge);
    tr.appendChild(catTd);
    
    const stTd = document.createElement('td');
    const stBadge = document.createElement('span');
    stBadge.className = `status-badge ${error.status}`;
    stBadge.textContent = error.status;
    stTd.appendChild(stBadge);
    tr.appendChild(stTd);
    
    tr.appendChild(createCell(error.is_bot ? '🤖' : '👤'));
    tr.appendChild(createCell(formatTime(error.timestamp)));
    
    const actTd = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.className = 'view-btn';
    viewBtn.textContent = 'View';
    viewBtn.onclick = () => viewError(error.id);
    actTd.appendChild(viewBtn);
    tr.appendChild(actTd);
    
    tbody.appendChild(tr);
  });
}

// Update stats
function updateStats(currentPageErrors, total) {
  document.getElementById('total-errors').textContent = total;
  
  // Count by status (current page only - approximation)
  const newCount = currentPageErrors.filter(e => e.status === 'new').length;
  const invCount = currentPageErrors.filter(e => e.status === 'investigating').length;
  
  document.getElementById('new-errors').textContent = newCount;
  document.getElementById('investigating-errors').textContent = invCount;
}

// Update pagination
function updatePagination(total) {
  const totalPages = Math.ceil(total / pageSize);
  const currentPageNum = currentPage + 1;
  
  document.getElementById('page-info').textContent = `Page ${currentPageNum} of ${totalPages}`;
  document.getElementById('prev-page').disabled = currentPage === 0;
  document.getElementById('next-page').disabled = currentPageNum >= totalPages;
}

// View error details
window.viewError = async function(errorId) {
  currentErrorId = errorId;
  
  try {
    if (DEMO_MODE) {
      const error = findMockErrorById(errorId);
      populateErrorModal(error);
      return;
    }

    // Fetch by ID directly to avoid offset bugs
    const response = await fetch(apiUrl(`/api/errors/${errorId}`), {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch error details');
    const { json } = await readJsonOrText(response);
    populateErrorModal(json?.error);
    
  } catch (error) {
    console.error('Error loading error details:', error);
    alert('Failed to load error details');
  }
};

function renderBreadcrumbs(jsonString) {
  try {
    const crumbs = JSON.parse(jsonString);
    if (!crumbs || !crumbs.length) return '';
    
    return crumbs.map(c => `
      <div class="breadcrumb-item ${c.type}">
        <span class="time">${new Date(c.timestamp).toLocaleTimeString()}</span>
        <span class="badg">${c.type}</span>
        <span class="desc">${escapeHtml(c.message || c.selector || c.url)}</span>
      </div>
    `).join('');
  } catch (e) {
    return 'Invalid breadcrumb data';
  }
}

// Save error changes
document.getElementById('save-error').addEventListener('click', async () => {
  const category = document.getElementById('modal-category').value;
  const status = document.getElementById('modal-status').value;

  if (DEMO_MODE) {
    const existing = findMockErrorById(currentErrorId);
    if (existing) {
      existing.category = category;
      existing.status = status;
    }

    document.getElementById('error-modal').style.display = 'none';
    loadErrors();
    return;
  }
  
  try {
    const response = await fetch(apiUrl(`/api/errors/${currentErrorId}`), {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders({ 'Content-Type': 'application/json' })
      },
      body: JSON.stringify({ category, status })
    });
    
    if (!response.ok) throw new Error('Update failed');
    
    document.getElementById('error-modal').style.display = 'none';
    loadErrors(); // Refresh list
    
  } catch (error) {
    console.error('Error updating error:', error);
    alert('Failed to update error');
  }
});

// Delete error
document.getElementById('delete-error').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete this error?')) return;

  if (DEMO_MODE) {
    const idx = MOCK_ERRORS.findIndex((e) => Number(e.id) === Number(currentErrorId));
    if (idx >= 0) MOCK_ERRORS.splice(idx, 1);

    document.getElementById('error-modal').style.display = 'none';
    loadErrors();
    return;
  }
  
  try {
    const response = await fetch(apiUrl(`/api/errors/${currentErrorId}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) throw new Error('Delete failed');
    
    document.getElementById('error-modal').style.display = 'none';
    loadErrors(); // Refresh list
    
  } catch (error) {
    console.error('Error deleting error:', error);
    alert('Failed to delete error');
  }
});

// Close modal
document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('error-modal').style.display = 'none';
});

// Filters
document.getElementById('status-filter').addEventListener('change', (e) => {
  currentFilters.status = e.target.value;
  currentPage = 0;
  loadErrors();
});

document.getElementById('category-filter').addEventListener('change', (e) => {
  currentFilters.category = e.target.value;
  currentPage = 0;
  loadErrors();
});

document.getElementById('clear-filters').addEventListener('click', () => {
  currentFilters = { status: '', category: '' };
  document.getElementById('status-filter').value = '';
  document.getElementById('category-filter').value = '';
  currentPage = 0;
  loadErrors();
});

// Pagination
document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    loadErrors();
  }
});

document.getElementById('next-page').addEventListener('click', () => {
  currentPage++;
  loadErrors();
});

// Refresh
document.getElementById('refresh-btn').addEventListener('click', async () => {
  const btn = document.getElementById('refresh-btn');
  btn.style.transition = 'transform 0.5s';
  btn.style.transform = 'rotate(360deg)';
  btn.title = "Refreshing...";
  
  await loadErrors();
  
  setTimeout(() => {
    btn.style.transform = 'none';
    btn.title = "Refresh";
  }, 500);
});

// Export CSV
document.getElementById('export-btn').addEventListener('click', async () => {
  try {
    const btn = document.getElementById('export-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Exporting...';
    btn.disabled = true;

    if (DEMO_MODE) {
      const filtered = MOCK_ERRORS.filter(error => {
        if (currentFilters.status && error.status !== currentFilters.status) return false;
        if (currentFilters.category && error.category !== currentFilters.category) return false;
        return true;
      });
      const csv = errorsToCSV(filtered);
      downloadCSV(csv, `errors-${Date.now()}.csv`);
      btn.textContent = originalText;
      btn.disabled = false;
      return;
    }

    // Fetch all errors for export
    const response = await fetch(apiUrl('/api/errors?limit=1000'), {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) throw new Error('Export fetch failed');
    
    const { json } = await readJsonOrText(response);
    const csv = errorsToCSV(json?.errors || []);
    downloadCSV(csv, `errors-${Date.now()}.csv`);
    
    btn.textContent = originalText;
    btn.disabled = false;
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export errors');
    document.getElementById('export-btn').textContent = 'Export CSV';
    document.getElementById('export-btn').disabled = false;
  }
});

// Helper functions (kept as is)
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(str, length) {
  if (!str) return 'N/A';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function errorsToCSV(errors) {
  if (!errors || !Array.isArray(errors)) return '';
  const headers = ['ID', 'Type', 'Message', 'URL', 'Category', 'Status', 'Bot', 'Timestamp'];
  const rows = errors.map(e => [
    e.id,
    e.type,
    (e.message || '').replace(/"/g, '""'),
    e.url,
    e.category,
    e.status,
    e.is_bot ? 'Yes' : 'No',
    new Date(e.timestamp).toISOString()
  ]);
  
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

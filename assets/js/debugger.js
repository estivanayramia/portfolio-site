/**
 * Debugger HUD - Cross-Device In-Page Debugger
 * 
 * Full-featured debugger overlay with:
 * - Console, Network, Performance, Layout, Storage/PWA tabs
 * - Mobile gestures (3-finger long-press, triple-tap logo)
 * - Desktop hotkeys (Ctrl+Shift+D)
 * - Export/Download/Share functionality
 * 
 * Loaded dynamically when ?debug=1 or localStorage.site_debugger_enabled = "1"
 */

(function() {
  'use strict';

  // Ring buffer for events
  const MAX_EVENTS = 1000;
  const eventBuffer = [];
  
  // Get logs from existing collector if available
  const existingLogs = window.__collectedLogs || [];
  
  // Debugger state
  let isExpanded = false;
  let currentTab = 'summary';
  let analyticsFilter = true;
  
  // Add event to buffer
  function addEvent(type, data) {
    const event = {
      timestamp: Date.now(),
      type,
      data
    };
    eventBuffer.push(event);
    if (eventBuffer.length > MAX_EVENTS) {
      eventBuffer.shift();
    }
    updateUI();
  }
  
  // Create UI
  function createUI() {
    const container = document.createElement('div');
    container.id = 'debugger-hud';
    container.innerHTML = `
      <style>
        #debugger-hud {
          --dbg-bg: rgba(33, 40, 66, 0.98);
          --dbg-text: #e1d4c2;
          --dbg-border: rgba(225, 212, 194, 0.1);
          --dbg-accent: #4a90e2;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          font-size: 13px;
          color: var(--dbg-text);
          position: fixed;
          z-index: 999999;
          isolation: isolate;
        }
        
        #debugger-hud.collapsed {
          bottom: 20px;
          right: 20px;
          bottom: calc(20px + env(safe-area-inset-bottom, 0px));
          right: calc(20px + env(safe-area-inset-right, 0px));
        }
        
        #debugger-hud.expanded {
          bottom: 0;
          right: 0;
          top: auto;
          left: 0;
          display: flex;
          flex-direction: column;
        }
        
        @media (min-width: 768px) {
          #debugger-hud.expanded {
            left: auto;
            width: 400px;
            top: 0;
            bottom: 0;
          }
        }
        
        .dbg-pill {
          background: var(--dbg-bg);
          backdrop-filter: blur(10px);
          border: 1px solid var(--dbg-border);
          border-radius: 24px;
          padding: 12px 20px;
          cursor: pointer;
          user-select: none;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 44px;
          min-height: 44px;
          touch-action: manipulation;
        }
        
        .dbg-pill:active {
          transform: scale(0.98);
        }
        
        .dbg-panel {
          background: var(--dbg-bg);
          backdrop-filter: blur(10px);
          border: 1px solid var(--dbg-border);
          border-radius: 16px 16px 0 0;
          display: flex;
          flex-direction: column;
          height: 60vh;
          max-height: calc(100vh - 60px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          box-shadow: 0 -4px 30px rgba(0,0,0,0.4);
        }
        
        @media (min-width: 768px) {
          .dbg-panel {
            border-radius: 0;
            height: 100%;
            max-height: 100vh;
          }
        }
        
        .dbg-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--dbg-border);
          cursor: move;
          user-select: none;
        }
        
        .dbg-title {
          font-weight: 600;
          font-size: 14px;
        }
        
        .dbg-close {
          background: none;
          border: none;
          color: var(--dbg-text);
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .dbg-tabs {
          display: flex;
          gap: 4px;
          padding: 8px;
          border-bottom: 1px solid var(--dbg-border);
          overflow-x: auto;
          scrollbar-width: thin;
        }
        
        .dbg-tab {
          background: transparent;
          border: none;
          color: var(--dbg-text);
          opacity: 0.6;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          font-size: 12px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .dbg-tab.active {
          opacity: 1;
          background: rgba(74, 144, 226, 0.2);
          color: var(--dbg-accent);
        }
        
        .dbg-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }
        
        .dbg-actions {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid var(--dbg-border);
          flex-wrap: wrap;
        }
        
        .dbg-btn {
          background: var(--dbg-accent);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 12px;
          min-width: 44px;
          min-height: 44px;
        }
        
        .dbg-btn:active {
          transform: scale(0.98);
        }
        
        .dbg-log-entry {
          padding: 8px;
          border-bottom: 1px solid var(--dbg-border);
          font-family: 'Courier New', monospace;
          font-size: 11px;
        }
        
        .dbg-log-entry.error {
          background: rgba(244, 67, 54, 0.1);
        }
        
        .dbg-log-entry.warn {
          background: rgba(255, 152, 0, 0.1);
        }
        
        .dbg-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        
        .dbg-table th {
          background: rgba(255,255,255,0.05);
          padding: 8px 4px;
          text-align: left;
          border-bottom: 1px solid var(--dbg-border);
        }
        
        .dbg-table td {
          padding: 6px 4px;
          border-bottom: 1px solid rgba(225,212,194,0.05);
        }
        
        .dbg-stat {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(225,212,194,0.05);
        }
        
        .dbg-stat-label {
          opacity: 0.7;
        }
        
        .dbg-stat-value {
          font-weight: 600;
        }
      </style>
      
      <div class="dbg-pill">
        <span>🐛</span>
        <span>DBG</span>
      </div>
      
      <div class="dbg-panel" style="display:none;">
        <div class="dbg-header">
          <div class="dbg-title">Debugger</div>
          <button class="dbg-close" aria-label="Close debugger">&times;</button>
        </div>
        
        <div class="dbg-tabs">
          <button class="dbg-tab active" data-tab="summary">Summary</button>
          <button class="dbg-tab" data-tab="console">Console</button>
          <button class="dbg-tab" data-tab="network">Network</button>
          <button class="dbg-tab" data-tab="performance">Performance</button>
          <button class="dbg-tab" data-tab="layout">Layout</button>
          <button class="dbg-tab" data-tab="storage">Storage/PWA</button>
        </div>
        
        <div class="dbg-content"></div>
        
        <div class="dbg-actions">
          <button class="dbg-btn" id="dbg-export">Export JSON</button>
          <button class="dbg-btn" id="dbg-copy">Copy</button>
          <button class="dbg-btn" id="dbg-clear">Clear</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(container);
    attachEventListeners();
    updateUI();
  }
  
  // Attach event listeners
  function attachEventListeners() {
    const pill = document.querySelector('.dbg-pill');
    const panel = document.querySelector('.dbg-panel');
    const closeBtn = document.querySelector('.dbg-close');
    const tabs = document.querySelectorAll('.dbg-tab');
    
    pill.addEventListener('click', toggleExpanded);
    closeBtn.addEventListener('click', toggleExpanded);
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        currentTab = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        updateUI();
      });
    });
    
    document.getElementById('dbg-export').addEventListener('click', exportData);
    document.getElementById('dbg-copy').addEventListener('click', copyData);
    document.getElementById('dbg-clear').addEventListener('click', clearData);
  }
  
  // Toggle expanded state
  function toggleExpanded() {
    isExpanded = !isExpanded;
    const hud = document.getElementById('debugger-hud');
    const pill = document.querySelector('.dbg-pill');
    const panel = document.querySelector('.dbg-panel');
    
    if (isExpanded) {
      hud.classList.add('expanded');
      hud.classList.remove('collapsed');
      pill.style.display = 'none';
      panel.style.display = 'flex';
    } else {
      hud.classList.remove('expanded');
      hud.classList.add('collapsed');
      pill.style.display = 'flex';
      panel.style.display = 'none';
    }
    
    updateUI();
  }
  
  // Update UI with current tab content
  function updateUI() {
    const content = document.querySelector('.dbg-content');
    if (!content) return;
    
    const allLogs = [...existingLogs, ...eventBuffer];
    
    switch(currentTab) {
      case 'summary':
        content.innerHTML = renderSummary(allLogs);
        break;
      case 'console':
        content.innerHTML = renderConsole(allLogs);
        break;
      case 'network':
        content.innerHTML = renderNetwork(allLogs);
        break;
      case 'performance':
        content.innerHTML = renderPerformance(allLogs);
        break;
      case 'layout':
        content.innerHTML = renderLayout();
        break;
      case 'storage':
        content.innerHTML = renderStorage(allLogs);
        break;
    }
  }
  
  // Render functions
  function renderSummary(logs) {
    const errors = logs.filter(l => l.msg && l.msg.includes('error')).length;
    const networkErrors = logs.filter(l => l.msg && l.msg.includes('fetch.error')).length;
    
    return `
      <div class="dbg-stat"><span class="dbg-stat-label">URL</span><span class="dbg-stat-value">${location.href}</span></div>
      <div class="dbg-stat"><span class="dbg-stat-label">Viewport</span><span class="dbg-stat-value">${window.innerWidth}x${window.innerHeight}</span></div>
      <div class="dbg-stat"><span class="dbg-stat-label">DPR</span><span class="dbg-stat-value">${window.devicePixelRatio}</span></div>
      <div class="dbg-stat"><span class="dbg-stat-label">User Agent</span><span class="dbg-stat-value">${navigator.userAgent.slice(0, 80)}...</span></div>
      <div class="dbg-stat"><span class="dbg-stat-label">Errors</span><span class="dbg-stat-value">${errors}</span></div>
      <div class="dbg-stat"><span class="dbg-stat-label">Network Errors</span><span class="dbg-stat-value">${networkErrors}</span></div>
      <div class="dbg-stat"><span class="dbg-stat-label">Events Logged</span><span class="dbg-stat-value">${logs.length}</span></div>
    `;
  }
  
  function renderConsole(logs) {
    const consoleLogs = logs.filter(l => l.msg && l.msg.startsWith('console.'));
    if (!consoleLogs.length) return '<p>No console logs</p>';
    
    return consoleLogs.map(log => {
      const level = log.msg.split('.')[1] || 'log';
      const args = log.data && log.data.args ? log.data.args.join(' ') : '';
      return `<div class="dbg-log-entry ${level}">[${new Date(log.t).toLocaleTimeString()}] ${args}</div>`;
    }).join('');
  }
  
  function renderNetwork(logs) {
    const networkLogs = logs.filter(l => l.msg && (l.msg.includes('fetch') || l.msg.includes('xhr')));
    if (!networkLogs.length) return '<p>No network activity</p>';
    
    return `<table class="dbg-table">
      <thead><tr><th>Time</th><th>Method</th><th>URL</th><th>Status</th></tr></thead>
      <tbody>${networkLogs.map(log => {
        const url = log.data && log.data.url ? log.data.url : '';
        const method = log.data && log.data.method ? log.data.method : 'GET';
        const status = log.data && log.data.status ? log.data.status : '-';
        return `<tr><td>${new Date(log.t).toLocaleTimeString()}</td><td>${method}</td><td>${url.slice(0, 50)}</td><td>${status}</td></tr>`;
      }).join('')}</tbody>
    </table>`;
  }
  
  function renderPerformance(logs) {
    const perfLogs = logs.filter(l => l.msg && l.msg.startsWith('perf.'));
    return `<p>Performance entries: ${perfLogs.length}</p>` + perfLogs.slice(0, 20).map(log => 
      `<div class="dbg-log-entry">${log.msg}: ${JSON.stringify(log.data)}</div>`
    ).join('');
  }
  
  function renderLayout() {
    // Run scans
    const issues = [];
    
    // 1. Image Check
    document.querySelectorAll('img').forEach(img => {
      if (!img.alt) issues.push({ type: 'error', msg: 'Missing ALT text', el: img });
      if (img.loading !== 'lazy' && checkInViewport(img)) { /* ok */ }
      else if (img.loading !== 'lazy') issues.push({ type: 'warn', msg: 'Missing loading="lazy"', el: img });
    });
    
    // 2. Link Check
    document.querySelectorAll('a').forEach(a => {
      if (!a.href || a.href === '#' || a.getAttribute('href').startsWith('javascript')) {
        issues.push({ type: 'warn', msg: 'Empty/Invalid Link', el: a });
      }
      const rect = a.getBoundingClientRect();
      if (rect.width > 0 && (rect.width < 44 || rect.height < 44)) {
        issues.push({ type: 'warn', msg: 'Small Touch Target (<44px)', el: a });
      }
    });

    // 3. Overflow Check
    const docWidth = document.documentElement.clientWidth;
    document.querySelectorAll('*').forEach(el => {
      if (el.offsetWidth > docWidth) {
        issues.push({ type: 'error', msg: 'Horizontal Overflow', el: el });
      }
    });
    
    // 4. Heading Hierarchy
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let lastLevel = 0;
    headings.forEach(h => {
      const level = parseInt(h.tagName[1]);
      if (level > lastLevel + 1) {
        issues.push({ type: 'warn', msg: `Skipped heading level (H${lastLevel} -> H${level})`, el: h });
      }
      lastLevel = level;
    });

    if (issues.length === 0) return '<p>✅ No layout issues found!</p>';

    // Render Table
    window.dbgHighlight = (index) => {
        const issue = window.dbgIssues[index];
        if (issue && issue.el) {
            issue.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const originalOutline = issue.el.style.outline;
            issue.el.style.outline = '4px solid #ff00ff';
            issue.el.style.zIndex = 999999;
            setTimeout(() => issue.el.style.outline = originalOutline, 2000);
        }
    };
    window.dbgIssues = issues;

    return `
      <div class="dbg-stat"><span class="dbg-stat-label">Issues Found</span><span class="dbg-stat-value">${issues.length}</span></div>
      <table class="dbg-table">
        <thead><tr><th>Type</th><th>Issue</th><th>Element</th><th>Action</th></tr></thead>
        <tbody>
          ${issues.map((issue, i) => `
            <tr>
              <td><span style="color:${issue.type==='error'?'#ff5555':'#ffaa00'}">●</span> ${issue.type}</td>
              <td>${issue.msg}</td>
              <td>${issue.el.tagName.toLowerCase()}${issue.el.id ? '#'+issue.el.id : ''}.${Array.from(issue.el.classList).slice(0,1).join('.')}</td>
              <td><button class="dbg-btn" style="padding:2px 8px;min-height:24px;" onclick="window.dbgHighlight(${i})">Find</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function checkInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom >= 0;
  }
  
  function renderStorage(logs) {
    const storageLogs = logs.filter(l => l.msg && (l.msg.includes('Storage') || l.msg.includes('sw.')));
    return storageLogs.map(log => 
      `<div class="dbg-log-entry">${log.msg}: ${JSON.stringify(log.data)}</div>`
    ).join('') || '<p>No storage activity</p>';
  }
  
  // Export/Copy/Clear functions
  function exportData() {
    const data = {
      version: '1.0.0',
      timestamp: Date.now(),
      url: location.href,
      logs: [...existingLogs, ...eventBuffer]
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debugger-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  function copyData() {
    const data = JSON.stringify([...existingLogs, ...eventBuffer], null, 2);
    navigator.clipboard.writeText(data).then(() => {
      alert('Copied to clipboard');
    }).catch(() => {
      alert('Copy failed');
    });
  }
  
  function clearData() {
    eventBuffer.length = 0;
    updateUI();
  }
  
  // Gesture activation
  let touchStartTimes = [];
  let logoTapCount = 0;
  let logoTapTimer = null;
  
  // 3-finger long-press
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 3) {
      const time = Date.now();
      touchStartTimes.push(time);
      setTimeout(() => {
        if (touchStartTimes.length >= 3 && Date.now() - touchStartTimes[0] >= 600) {
          toggleExpanded();
          touchStartTimes = [];
        }
      }, 600);
    }
  });
  
  document.addEventListener('touchend', () => {
    touchStartTimes = [];
  });
  
  // Triple-tap logo
  const logo = document.querySelector('a[href="/"]');
  if (logo) {
    logo.addEventListener('click', (e) => {
      logoTapCount++;
      if (logoTapTimer) clearTimeout(logoTapTimer);
      logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 500);
      if (logoTapCount === 3) {
        e.preventDefault();
        toggleExpanded();
        logoTapCount = 0;
      }
    });
  }
  
  // Desktop hotkey (Alt+Shift+D)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggleExpanded();
    }
  });
  
  
  // Initialize (wait for body to exist)
  function init() {
    console.log('[Debugger] Initializing HUD...');
    createUI();
    document.getElementById('debugger-hud').classList.add('collapsed');
    console.log('[Debugger] HUD ready. Press Alt+Shift+D to toggle.');
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

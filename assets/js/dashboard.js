/**
 * Error Dashboard JavaScript
 * Handles authentication, error fetching, filtering, and management
 */

// DEMO MODE - set to false when API backend is deployed
const DEMO_MODE = false;
const DEMO_PASSWORD = 'savonie21';

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

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
  authToken = localStorage.getItem('dashboard_token');
  
  if (authToken) {
    showDashboard();
    loadErrors();
  } else {
    showLogin();
  }
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
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const password = document.getElementById('password-input').value;
  const errorMsg = document.getElementById('login-error');
  
  if (DEMO_MODE) {
    // Demo mode - check password locally
    if (password === DEMO_PASSWORD) {
      authToken = 'demo-token-' + Date.now();
      localStorage.setItem('dashboard_token', authToken);
      showDashboard();
      loadErrors();
    } else {
      errorMsg.textContent = 'Invalid password (hint: savonie21)';
      errorMsg.style.display = 'block';
    }
    return;
  }
  
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.token) {
      authToken = data.token;
      localStorage.setItem('dashboard_token', authToken);
      showDashboard();
      loadErrors();
    } else {
      errorMsg.textContent = 'Invalid password';
      errorMsg.style.display = 'block';
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
    
    const response = await fetch(`/api/errors?${params}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
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
    
    const data = await response.json();
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
    // NEW: Fetch by ID directly to avoid offset bugs
    const response = await fetch(`/api/errors/${errorId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch error details');
    const data = await response.json();
    const error = data.error; // API returns { error: object }
    
    // Populate modal using DOM APIs
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
  
  try {
    const response = await fetch(`/api/errors/${currentErrorId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
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
  
  try {
    const response = await fetch(`/api/errors/${currentErrorId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
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

    // Fetch all errors for export
    const response = await fetch('/api/errors?limit=1000', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!response.ok) throw new Error('Export fetch failed');
    
    const data = await response.json();
    const csv = errorsToCSV(data.errors);
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

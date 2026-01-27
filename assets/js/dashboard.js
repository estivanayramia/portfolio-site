/**
 * Error Dashboard JavaScript
 * Handles authentication, error fetching, filtering, and management
 */

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
  
  tbody.innerHTML = errors.map(error => `
    <tr data-error-id="${error.id}">
      <td>${error.id}</td>
      <td><span class="type-badge">${error.type}</span></td>
      <td class="message-col" title="${escapeHtml(error.message)}">${truncate(error.message, 50)}</td>
      <td class="url-col" title="${escapeHtml(error.url)}">${truncate(error.url, 30)}</td>
      <td><span class="category-badge ${error.category}">${error.category}</span></td>
      <td><span class="status-badge ${error.status}">${error.status}</span></td>
      <td>${error.is_bot ? '🤖' : '👤'}</td>
      <td>${formatTime(error.timestamp)}</td>
      <td>
        <button class="view-btn" onclick="viewError(${error.id})">View</button>
      </td>
    </tr>
  `).join('');
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
    const response = await fetch(`/api/errors?limit=1&offset=${errorId - 1}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const data = await response.json();
    const error = data.errors.find(e => e.id === errorId);
    
    if (!error) throw new Error('Error not found');
    
    // Populate modal
    document.getElementById('error-details').innerHTML = `
      <p><strong>ID:</strong> ${error.id}</p>
      <p><strong>Type:</strong> ${error.type}</p>
      <p><strong>Message:</strong> ${escapeHtml(error.message)}</p>
      <p><strong>File:</strong> ${escapeHtml(error.filename || 'N/A')} (Line ${error.line || 'N/A'})</p>
      <p><strong>URL:</strong> <a href="${error.url}" target="_blank">${escapeHtml(error.url)}</a></p>
      <p><strong>User Agent:</strong> ${escapeHtml(error.user_agent)}</p>
      <p><strong>Timestamp:</strong> ${new Date(error.timestamp).toLocaleString()}</p>
      <p><strong>Bot:</strong> ${error.is_bot ? 'Yes 🤖' : 'No 👤'}</p>
      <details>
        <summary><strong>Stack Trace</strong></summary>
        <pre>${escapeHtml(error.stack || 'No stack trace')}</pre>
      </details>
    `;
    
    document.getElementById('modal-category').value = error.category;
    document.getElementById('modal-status').value = error.status;
    document.getElementById('error-modal').style.display = 'flex';
    
  } catch (error) {
    console.error('Error loading error details:', error);
    alert('Failed to load error details');
  }
};

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
document.getElementById('refresh-btn').addEventListener('click', () => {
  loadErrors();
});

// Export CSV
document.getElementById('export-btn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/errors?limit=1000', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const data = await response.json();
    const csv = errorsToCSV(data.errors);
    downloadCSV(csv, `errors-${Date.now()}.csv`);
    
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export errors');
  }
});

// Helper functions
function escapeHtml(text) {
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
  const headers = ['ID', 'Type', 'Message', 'URL', 'Category', 'Status', 'Bot', 'Timestamp'];
  const rows = errors.map(e => [
    e.id,
    e.type,
    e.message.replace(/"/g, '""'),
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

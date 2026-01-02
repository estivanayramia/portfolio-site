import { Achievements } from './achievements.js';

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCardProgress() {
  for (const game of Achievements.games) {
    const el = document.getElementById(`${game}-progress`);
    if (!el) continue;
    const { unlocked, total } = Achievements.getProgressByGame(game);
    // Keep copy simple and stable
    el.textContent = `🏆 ${unlocked}/${total} unlocked`;
  }
}

function renderTotalProgress() {
  const textEl = document.getElementById('arcade-total-progress-text');
  const countEl = document.getElementById('arcade-total-progress-count');
  const barEl = document.getElementById('arcade-total-progress-bar');
  if (!textEl || !countEl || !barEl) return;

  const { unlocked, total } = Achievements.getTotals();
  textEl.textContent = 'Overall progress';
  countEl.textContent = `${unlocked} unlocked / ${total} total`;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  barEl.style.width = `${pct}%`;
}

function isDevHost() {
  const host = (location && location.hostname) ? location.hostname : '';
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function ensureHubDrawer() {
  const toggle = $('#arcade-achievements-toggle');
  const panel = $('#arcade-achievements-panel');
  if (!toggle || !panel) return;

  const setExpanded = (expanded) => {
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    panel.classList.toggle('hidden', !expanded);
    toggle.querySelector('[data-chev]')?.setAttribute('data-state', expanded ? 'open' : 'closed');
  };

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    setExpanded(!expanded);
  });

  // Tabs
  const tablist = $('#arcade-achievements-tabs');
  const allTab = $('#arcade-tab-all');
  const unlockedTab = $('#arcade-tab-unlocked');
  const lockedTab = $('#arcade-tab-locked');
  const list = $('#arcade-achievements-list');
  if (!tablist || !allTab || !unlockedTab || !lockedTab || !list) return;

  const tabs = [allTab, lockedTab, unlockedTab];

  const renderItems = (items, view) => {
    const arcade = [];
    const site = [];
    items.forEach((a) => {
      const cat = a.category || (a.game === 'site' ? 'site' : 'arcade');
      (cat === 'site' ? site : arcade).push(a);
    });

    const renderRow = (a) => {
      const unlocked = Achievements.isUnlocked(a.id);
      const status = unlocked ? 'Unlocked' : 'Locked';
      const title = escapeHtml(a.title || 'Achievement');
      const goal = escapeHtml(a.goalText || a.description || '');
      const icon = escapeHtml((unlocked ? (a.icon || '🏆') : '🔒'));
      const gameLabel = escapeHtml(Achievements.labels[a.game] || a.game || '');

      return `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:12px;background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:20px;line-height:1;">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;gap:10px;">
              <div style="font-weight:800;">${title}</div>
              <div style="opacity:0.75;font-size:12px;white-space:nowrap;">${escapeHtml(status)}</div>
            </div>
            ${goal ? `<div style="opacity:0.8;font-size:12px;margin-top:2px;">${goal}</div>` : ''}
            ${view !== 'siteOnly' ? `<div style="opacity:0.65;font-size:11px;margin-top:2px;">${gameLabel}</div>` : ''}
          </div>
        </div>
      `;
    };

    const chunks = [];
    if (arcade.length) {
      chunks.push(`<div class="arcade-ach-section">Arcade</div>`);
      chunks.push(arcade.map(renderRow).join(''));
    }
    if (site.length) {
      chunks.push(`<div class="arcade-ach-section">Site</div>`);
      chunks.push(site.map(renderRow).join(''));
    }

    return chunks.join('') || '<div style="opacity:0.75;">Nothing here yet.</div>';
  };

  const setTab = (which) => {
    const isAll = which === 'all';
    const isLocked = which === 'locked';
    const isUnlocked = which === 'unlocked';

    allTab.setAttribute('aria-selected', isAll ? 'true' : 'false');
    lockedTab.setAttribute('aria-selected', isLocked ? 'true' : 'false');
    unlockedTab.setAttribute('aria-selected', isUnlocked ? 'true' : 'false');

    allTab.tabIndex = isAll ? 0 : -1;
    lockedTab.tabIndex = isLocked ? 0 : -1;
    unlockedTab.tabIndex = isUnlocked ? 0 : -1;

    const items = isAll ? Achievements.listAll() : (isUnlocked ? Achievements.listUnlocked() : Achievements.listLocked());
    list.innerHTML = renderItems(items);
  };

  const onTabClick = (e) => {
    const t = e.target.closest('[role="tab"]');
    if (!t) return;
    if (t.id === 'arcade-tab-unlocked') setTab('unlocked');
    else if (t.id === 'arcade-tab-locked') setTab('locked');
    else setTab('all');
  };

  tablist.addEventListener('click', onTabClick);
  tablist.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const active = document.activeElement;
    const idx = Math.max(0, tabs.indexOf(active));
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(idx + dir + tabs.length) % tabs.length];
    next.focus();
    if (next === unlockedTab) setTab('unlocked');
    else if (next === lockedTab) setTab('locked');
    else setTab('all');
  });

  // Escape closes drawer (non-modal)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (!expanded) return;
    setExpanded(false);
    try { toggle.focus({ preventScroll: true }); } catch (err) { try { toggle.focus(); } catch (_) {} }
  });

  // Initial
  setExpanded(false);
  setTab('all');

  const updateToggleLabel = () => {
    const { unlocked, total } = Achievements.getTotals();
    const label = toggle.querySelector('[data-label]');
    if (label) label.textContent = `Progress (${unlocked}/${total})`;
  };

  updateToggleLabel();
  window.addEventListener('ea:achievementUnlocked', () => {
    renderCardProgress();
    renderTotalProgress();
    updateToggleLabel();
    // Keep list in sync if drawer is open
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      const selectedAll = allTab.getAttribute('aria-selected') === 'true';
      const selectedUnlocked = unlockedTab.getAttribute('aria-selected') === 'true';
      setTab(selectedAll ? 'all' : (selectedUnlocked ? 'unlocked' : 'locked'));
    }
  });
}

function init() {
  if (isDevHost()) {
    const links = document.querySelectorAll('.game-card a.arcade-card-link[href]');
    console.log(`[Arcade Hub] game links found: ${links.length}`);
    if (!links.length) console.error('[Arcade Hub] No game links found. Cards will not be clickable.');
  }

  renderCardProgress();
  renderTotalProgress();
  ensureHubDrawer();

  // Hide CTA when footer is visible (prevents overlap at bottom)
  try {
    const cta = document.getElementById('arcade-cta');
    const footer = document.querySelector('footer');
    if (cta && footer && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        const any = entries && entries.some(e => e.isIntersecting);
        cta.classList.toggle('is-hidden', !!any);
      }, { threshold: 0.01 });
      obs.observe(footer);
    }
  } catch (e) {}

  window.addEventListener('ea:achievementUnlocked', () => {
    renderCardProgress();
    renderTotalProgress();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

import { ACHIEVEMENTS, GAME_ORDER, GAME_LABELS, buildAchievementIndex } from './achievements-defs.js';

// ACHIEVEMENTS is authored as an id-keyed object for the Arcade hub.
// Game helper utilities below expect an array, so normalize once.
const DEFS_LIST = Array.isArray(ACHIEVEMENTS) ? ACHIEVEMENTS : Object.values(ACHIEVEMENTS);

const STORAGE_KEY = 'ea.arcade.achievements.v1';
const byId = buildAchievementIndex();

function nowIso() {
  return new Date().toISOString();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { unlocked: {}, perGameStats: {}, lastShownToastAt: null, version: 1 };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { unlocked: {}, perGameStats: {}, lastShownToastAt: null, version: 1 };
    }
    return {
      unlocked: parsed.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {},
      perGameStats: parsed.perGameStats && typeof parsed.perGameStats === 'object' ? parsed.perGameStats : {},
      lastShownToastAt: typeof parsed.lastShownToastAt === 'string' ? parsed.lastShownToastAt : null,
      version: 1
    };
  } catch (e) {
    return { unlocked: {}, perGameStats: {}, lastShownToastAt: null, version: 1 };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Ignore quota errors.
  }
}

function safeText(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

function getDefinition(id) {
  return byId[id] || null;
}

function ensureToastContainer() {
  let el = document.getElementById('ea-achievement-toasts');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'ea-achievement-toasts';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.style.cssText = [
    'position:fixed',
    'right:16px',
    'top:calc(16px + env(safe-area-inset-top, 0px))',
    'z-index:10000',
    'display:flex',
    'flex-direction:column',
    'gap:10px',
    'max-width:min(360px, calc(100vw - 32px))',
    'pointer-events:none'
  ].join(';');

  document.body.appendChild(el);
  return el;
}

function showToast(achievement) {
  const container = ensureToastContainer();

  const title = safeText(achievement.title, 'Achievement unlocked');
  const icon = safeText(achievement.icon, '🏆');
  const secondary = safeText(achievement.goalText || achievement.description, '');

  const toast = document.createElement('div');
  toast.style.cssText = [
    'pointer-events:none',
    'background:rgba(33, 40, 66, 0.98)',
    'color:#fff',
    'border:1px solid rgba(225, 212, 194, 0.25)',
    'border-radius:14px',
    'box-shadow:0 12px 48px rgba(0,0,0,0.45)',
    'padding:12px 14px',
    'backdrop-filter:blur(10px)',
    'display:flex',
    'gap:10px',
    'align-items:flex-start'
  ].join(';');

  toast.innerHTML = `
    <div style="font-size:22px;line-height:1;">${icon}</div>
    <div style="min-width:0;">
      <div style="font-weight:800;">Achievement unlocked: ${escapeHtml(title)}</div>
      ${secondary ? `<div style="opacity:0.85;">${escapeHtml(secondary)}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  const timeoutMs = 3500;
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    toast.style.transition = 'opacity 220ms ease, transform 220ms ease';
    window.setTimeout(() => toast.remove(), 240);
  }, timeoutMs);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const Achievements = {
  STORAGE_KEY,
  defs: DEFS_LIST,
  games: GAME_ORDER,
  labels: GAME_LABELS,

  getState() {
    return loadState();
  },

  isUnlocked(id) {
    const st = loadState();
    return !!(st.unlocked && st.unlocked[id]);
  },

  unlock(id, meta) {
    const def = getDefinition(id);
    // Defensive: never allow undefined title/description in toasts.
    const safeDef = def || {
      id,
      game: 'unknown',
      title: 'Achievement unlocked',
      description: 'Keep exploring to unlock more.',
      icon: '🏆',
      goalText: 'Keep exploring.'
    };

    const st = loadState();
    if (st.unlocked && st.unlocked[id]) return null;

    st.unlocked[id] = {
      unlockedAt: nowIso(),
      meta: meta && typeof meta === 'object' ? meta : undefined
    };
    st.lastShownToastAt = nowIso();
    saveState(st);

    const unlockedAt = st.unlocked[id].unlockedAt;
    const achievement = {
      ...safeDef,
      title: safeText(safeDef.title, 'Achievement unlocked'),
      description: safeText(safeDef.description, 'Keep exploring.'),
      icon: safeText(safeDef.icon, '🏆'),
      goalText: safeText(safeDef.goalText, safeText(safeDef.description, 'Keep exploring.')),
      unlockedAt
    };

    try {
      window.dispatchEvent(new CustomEvent('ea:achievementUnlocked', { detail: achievement }));
    } catch (e) {}

    // Don’t steal focus; do not scroll.
    try {
      showToast(achievement);
    } catch (e) {}

    return achievement;
  },

  getTotals(filter) {
    const st = loadState();
    const defs = Achievements._filterDefs(filter);
    const unlocked = defs.reduce((acc, a) => acc + (st.unlocked && st.unlocked[a.id] ? 1 : 0), 0);
    return { unlocked, total: defs.length };
  },

  getProgressByGame(game) {
    const defs = DEFS_LIST.filter(a => a.game === game);
    const st = loadState();
    const unlockedCount = defs.reduce((acc, a) => acc + (st.unlocked && st.unlocked[a.id] ? 1 : 0), 0);
    return { unlocked: unlockedCount, total: defs.length };
  },

  listByGame(game) {
    return DEFS_LIST.filter(a => a.game === game);
  },

  listUnlocked(gameOrFilter) {
    const st = loadState();
    const defs = Achievements._filterDefs(gameOrFilter);
    return defs.filter(a => st.unlocked && st.unlocked[a.id]).map(a => ({
      ...a,
      unlockedAt: st.unlocked[a.id].unlockedAt
    }));
  },

  listLocked(gameOrFilter) {
    const st = loadState();
    const defs = Achievements._filterDefs(gameOrFilter);
    return defs.filter(a => !(st.unlocked && st.unlocked[a.id]));
  },

  listAll(filter) {
    return Achievements._filterDefs(filter);
  },

  _filterDefs(gameOrFilter) {
    // Back-compat: listUnlocked('snake') still works.
    if (typeof gameOrFilter === 'string') {
      return DEFS_LIST.filter(a => a.game === gameOrFilter);
    }

    if (!gameOrFilter || typeof gameOrFilter !== 'object') {
      return DEFS_LIST;
    }

    const { game, category } = gameOrFilter;
    return DEFS_LIST.filter(a => {
      if (game && a.game !== game) return false;
      if (category && a.category !== category) return false;
      return true;
    });
  }
};

// Dev sanity check (kept small and safe)
try {
  for (const a of DEFS_LIST) {
    console.assert(!!(a && a.title), '[Arcade] achievement missing title', a);
    console.assert(!!(a && a.description), '[Arcade] achievement missing description', a);
  }
} catch (e) {}

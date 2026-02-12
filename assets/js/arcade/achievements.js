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
  // Primary lookup
  let def = byId[id];
  
  // Fallback: Try mapping colon -> underscore (e.g. "snake:first_food" -> "snake_first_food")
  if (!def && typeof id === 'string' && id.includes(':')) {
    const underscoreId = id.replace(/:/g, '_');
    def = byId[underscoreId];
    if (def) {
       // console.log(`[Achievements] Mapped colon ID "${id}" to underscore definition "${underscoreId}"`);
    }
  }

  // Fallback: Try mapping underscore -> colon (just in case)
  if (!def && typeof id === 'string' && id.includes('_')) {
     const colonId = id.replace(/_/, ':'); // Only first underscore typically
     def = byId[colonId];
  }

  return def || null;
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
    'bottom:calc(16px + env(safe-area-inset-bottom, 0px))',
    'z-index:10000',
    'display:flex',
    'flex-direction:column-reverse', // Stack upward from bottom
    'gap:8px',
    'max-width:min(280px, calc(100vw - 32px))',
    'pointer-events:none'
  ].join(';');

  document.body.appendChild(el);
  return el;
}

function showToast(achievement) {
  const container = ensureToastContainer();

  const title = safeText(achievement.title, 'Achievement');
  const icon = safeText(achievement.icon, '🏆');
  const description = safeText(achievement.goalText || achievement.description, '');

  // 🔊 Play celebration sound (respects mute)
  try {
    if (localStorage.getItem('gameSoundsEnabled') !== 'false' &&
        localStorage.getItem('arcadeMuted') !== '1') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.15);
          osc.start(ctx.currentTime + i * 0.08);
          osc.stop(ctx.currentTime + i * 0.08 + 0.15);
        });
      }
    }
  } catch (e) {}

  const toast = document.createElement('div');
  // Match arcade-core.js style EXACTLY
  toast.style.cssText = `
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    background: #212842;
    color: #e1d4c2;
    padding: 12px 16px;
    border-radius: 10px;
    border: 2px solid rgba(225, 212, 194, 0.1);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    min-width: 240px;
    max-width: min(280px, calc(100vw - 50px));
    overflow: hidden;
    transform: translateX(120%);
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    margin-bottom: 8px;
    pointer-events: auto;
  `;

  toast.innerHTML = `
    <div class="achievement-icon" style="font-size: 2rem;">${icon}</div>
    <div class="achievement-content" style="flex: 1; min-width: 0;">
        <div class="achievement-title" style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin-bottom: 2px;">Achievement Unlocked!</div>
        <div class="achievement-name" style="font-weight: 700; font-size: 1rem; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(title)}</div>
        <div class="achievement-desc" style="font-size: 0.8rem; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(description)}</div>
    </div>
    <button class="achievement-close" style="background: transparent; border: none; color: inherit; font-size: 1.3rem; cursor: pointer; opacity: 0.5; padding: 0 4px; line-height: 1;">×</button>
  `;

  container.appendChild(toast);

  // Close button functionality
  const closeBtn = toast.querySelector('.achievement-close');
  if (closeBtn) {
      closeBtn.onclick = () => {
          toast.style.transform = 'translateX(120%)';
          setTimeout(() => toast.remove(), 400);
      };
  }

  // 🎊 Confetti particles (keep enhancement)
  try {
    spawnConfetti(toast);
  } catch (e) {}

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });

  // Auto remove after 4s (same as arcade-core.js)
  const timeoutMs = 4000;
  window.setTimeout(() => {
    if (document.body.contains(toast)) { // Check if not already closed
        toast.style.transform = 'translateX(120%)';
        window.setTimeout(() => toast.remove(), 400);
    }
  }, timeoutMs);
}

function spawnConfetti(parentEl) {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 80;
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
  parentEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colors = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const particles = [];
  for (let i = 0; i < 30; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -5 - Math.random() * 20,
      w: 4 + Math.random() * 4,
      h: 3 + Math.random() * 3,
      dx: (Math.random() - 0.5) * 3,
      dy: 1.5 + Math.random() * 2,
      rot: Math.random() * 360,
      drot: (Math.random() - 0.5) * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    });
  }

  let frame = 0;
  const maxFrames = 72; // ~1.2s at 60fps
  function animate() {
    frame++;
    if (frame > maxFrames) { canvas.remove(); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.dx;
      p.y += p.dy;
      p.rot += p.drot;
      p.life -= 1 / maxFrames;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(animate);
  }
  animate();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Export singleton
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

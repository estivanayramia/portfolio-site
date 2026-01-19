import { ACHIEVEMENTS } from './achievements-defs.js';

// Global Sound System
window.ArcadeSound = {
    muted: false,
    muteAll() {
        this.muted = true;
        localStorage.setItem('arcadeMuted', '1');
        this.updateIcon();
        this.applyToGames();
    },
    unmuteAll() {
        this.muted = false;
        localStorage.removeItem('arcadeMuted');
        this.updateIcon();
        this.applyToGames();
    },
    isMuted() {
        return this.muted || localStorage.getItem('arcadeMuted') === '1';
    },
    toggle() {
        if (this.isMuted()) this.unmuteAll();
        else this.muteAll();
    },
    updateIcon() {
        const btn = document.getElementById('sound-toggle');
        if (btn) btn.textContent = this.isMuted() ? '🔇' : '🔊';
        // Also update per-game buttons if they exist
        document.querySelectorAll('[id^="sound-toggle-"]').forEach(b => {
            b.textContent = this.isMuted() ? '🔇' : '🔊';
        });
    },
    applyToGames() {
        window.dispatchEvent(new CustomEvent('arcade-sound-change', { detail: { muted: this.isMuted() } }));
    },
    init() {
        this.muted = this.isMuted();
        this.updateIcon();

        // Bind click listeners to sound toggles
        document.addEventListener('click', (e) => {
            if (e.target.closest('#sound-toggle') || e.target.closest('[id^="sound-toggle-"]')) {
                this.toggle();
            }
            if (e.target.closest('#back-to-about')) {
                this.muteAll();
            }
        });

        // Initial UI update
        if (window.ArcadeAchievements) window.ArcadeAchievements.updateUI();
    }
};

// Universal Pause
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
        // Find active game and toggle pause
        if (typeof window.togglePause === 'function' && window.currentGame) {
            window.togglePause(window.currentGame);
        }
    }
});

// Achievements System
window.ArcadeAchievements = {
    _filter: 'all',
    setFilter(filter) {
        this._filter = filter || 'all';
    },
    getFilter() {
        return this._filter || 'all';
    },
    unlock(id) {
        const def = ACHIEVEMENTS[id];
        if (!def) return;

        const unlocked = this.getUnlocked();
        if (unlocked.includes(id)) return; // Already unlocked

        unlocked.push(id);
        localStorage.setItem('arcade_achievements', JSON.stringify(unlocked));

        this.showToast(def);
        this.updateUI();
    },
    getUnlocked() {
        try {
            return JSON.parse(localStorage.getItem('arcade_achievements') || '[]');
        } catch { return []; }
    },
    showToast(def) {
        const icon = (def && def.icon) || '🏆';
        const title = (def && (def.title || def.name)) || 'Achievement';
        const description = (def && (def.description || def.desc)) || '';
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-[#212842] text-white p-4 rounded-xl shadow-2xl z-[9999] flex items-center gap-4 transition-all duration-500 transform translate-y-10 opacity-0';
        toast.innerHTML = `
            <div class="text-3xl">${icon}</div>
            <div>
                <div class="font-bold text-xs text-yellow-400 uppercase tracking-wider">Achievement Unlocked!</div>
                <div class="font-bold text-sm">${title}</div>
                <div class="text-xs opacity-80">${description}</div>
            </div>
        `;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },
    updateUI() {
        window.dispatchEvent(new CustomEvent('arcade-achievements-update'));

        const list = document.getElementById('achievements-list');
        if (!list) return;

        const unlocked = this.getUnlocked();
        const defs = this.getDefinitions();
        const filter = this.getFilter();

        const formatGameTitle = (gameKey) => {
            const gameTitles = {
                snake: 'Snake',
                breaker: 'Block Breaker',
                merge: '2048',
                invaders: 'Space Invaders',
                site: 'Website'
            };
            if (gameTitles[gameKey]) return gameTitles[gameKey];
            if (typeof gameKey === 'string' && gameKey.startsWith('mini_')) {
                const raw = gameKey.replace(/^mini_/, '').replace(/_/g, ' ');
                return raw.replace(/\b\w/g, (c) => c.toUpperCase());
            }
            return String(gameKey || 'Unknown');
        };

        const difficultyOrder = ['Easy', 'Medium', 'Hard', 'Legendary'];
        const getDifficultyLabel = (def) => {
            const d = (def && def.difficulty) ? String(def.difficulty).trim() : '';
            return difficultyOrder.includes(d) ? d : 'Easy';
        };
        const getDifficultyRank = (def) => difficultyOrder.indexOf(getDifficultyLabel(def));

        // Group by game
        const groups = {};
        Object.values(defs).forEach(def => {
            if (filter !== 'all' && def.game !== filter) return;
            if (!groups[def.game]) groups[def.game] = [];
            groups[def.game].push(def);
        });

        list.innerHTML = Object.entries(groups).map(([game, achievements]) => {
            const title = formatGameTitle(game);
            const sorted = achievements
                .slice()
                .sort((a, b) => {
                    const byDifficulty = getDifficultyRank(a) - getDifficultyRank(b);
                    if (byDifficulty !== 0) return byDifficulty;
                    const at = (a && (a.title || a.name) ? String(a.title || a.name) : '').toLowerCase();
                    const bt = (b && (b.title || b.name) ? String(b.title || b.name) : '').toLowerCase();
                    return at.localeCompare(bt);
                });

            const buckets = {};
            difficultyOrder.forEach((d) => { buckets[d] = []; });
            sorted.forEach((def) => {
                const d = getDifficultyLabel(def);
                if (!buckets[d]) buckets[d] = [];
                buckets[d].push(def);
            });

            const difficultySections = difficultyOrder
                .filter((d) => buckets[d] && buckets[d].length)
                .map((d, idx) => {
                    const items = buckets[d].map(def => {
                        const isUnlocked = unlocked.includes(def.id);
                        const icon = isUnlocked ? (def.icon || '🏆') : '🔒';
                        const itemTitle = def.title || def.name || 'Achievement';
                        const itemDesc = def.description || def.desc || '';
                        return `
                            <div class="flex items-center gap-4 p-3 rounded-lg ${isUnlocked ? 'bg-indigodeep/5 dark:bg-white/5' : 'opacity-40 grayscale'}">
                                <div class="text-2xl">${icon}</div>
                                <div>
                                    <div class="font-bold text-sm">${itemTitle}</div>
                                    <div class="text-xs opacity-70">${itemDesc}</div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div class="${idx === 0 ? '' : 'mt-4'}">
                            <div class="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">${d}</div>
                            <div class="grid grid-cols-1 gap-2">${items}</div>
                        </div>
                    `;
                }).join('');

            return `
                <div class="mb-8 last:mb-0">
                    <h3 class="font-bold text-lg mb-3 sticky top-0 bg-indigodeep text-beige dark:bg-[#212842] py-2 z-10 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
                        ${title}
                        <span class="text-xs font-normal opacity-50 bg-white/10 dark:bg-white/10 px-2 py-0.5 rounded-full">${achievements.filter(a => unlocked.includes(a.id)).length}/${achievements.length}</span>
                    </h3>
                    ${difficultySections}
                </div>
            `;
        }).join('');
    },
    getDefinitions() {
        return ACHIEVEMENTS;
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.ArcadeSound.init());
} else {
    window.ArcadeSound.init();
}

import { ACHIEVEMENTS } from './achievements-defs.js';

// Global Sound System (Enhanced: Site-wide mute + M key + iframe broadcast)
window.ArcadeSound = {
    muted: false,
    muteAll() {
        this.muted = true;
        localStorage.setItem('arcadeMuted', '1');
        this.updateIcon();
        this.applyToGames();
        this.broadcastToIframes();
    },
    unmuteAll() {
        this.muted = false;
        localStorage.removeItem('arcadeMuted');
        this.updateIcon();
        this.applyToGames();
        this.broadcastToIframes();
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
    broadcastToIframes() {
        // Broadcast mute state to ALL iframes (third-party games)
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                iframe.contentWindow.postMessage({ 
                    type: 'arcade-mute', 
                    muted: this.isMuted() 
                }, '*');
            } catch(e) {
                // Cross-origin iframe: silently fail (expected for third-party games)
            }
        });
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

        // Add 'M' key global mute toggle
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // Ignore if typing in input/textarea
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }
                this.toggle();
            }
        });

        // Broadcast mute state to iframes on load (for third-party games)
        window.addEventListener('load', () => {
            setTimeout(() => this.broadcastToIframes(), 500);
        });

        // Initial UI update
        if (window.ArcadeAchievements) window.ArcadeAchievements.updateUI();
    }
};

// Universal Pause (P key)
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p') {
        // Find active game and toggle pause
        if (typeof window.togglePause === 'function' && window.currentGame) {
            window.togglePause(window.currentGame);
        }
    }
});

// Achievements System (Enhanced: Strict validation + better error handling)
window.ArcadeAchievements = {
    _filter: 'all',
    setFilter(filter) {
        this._filter = filter || 'all';
    },
    getFilter() {
        return this._filter || 'all';
    },
    unlock(id) {
        // STRICT VALIDATION: Fail loudly on invalid IDs
        if (!id || typeof id !== 'string') {
            console.error('[ArcadeAchievements] Invalid ID:', id);
            return;
        }

        const def = ACHIEVEMENTS[id];
        if (!def) {
            console.error(`[ArcadeAchievements] Achievement not found: "${id}". Check achievements-defs.js for valid IDs.`);
            return;
        }

        const unlocked = this.getUnlocked();
        if (unlocked.includes(id)) {
            // Already unlocked, silently return
            return;
        }

        unlocked.push(id);
        localStorage.setItem('arcade_achievements', JSON.stringify(unlocked));

        this.showToast(def);
        this.updateUI();
    },
    getUnlocked() {
        try {
            const raw = localStorage.getItem('arcade_achievements');
            return JSON.parse(raw || '[]');
        } catch { 
            return []; 
        }
    },
    showToast(def) {
        const icon = (def && def.icon) || '🏆';
        const title = (def && (def.title || def.name)) || 'Achievement';
        const description = (def && (def.description || def.desc)) || '';
        
        const toast = document.createElement('div');
        toast.className = 'achievement-notification show';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            background: #212842;
            color: #e1d4c2;
            padding: 16px 20px;
            border-radius: 12px;
            border: 2px solid rgba(225, 212, 194, 0.1);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            z-index: 99999;
            min-width: 300px;
            transform: translateX(120%);
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;
        
        toast.innerHTML = `
            <div class="achievement-icon" style="font-size: 2.5rem;">${icon}</div>
            <div class="achievement-content" style="flex: 1;">
                <div class="achievement-title" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin-bottom: 2px;">Achievement Unlocked!</div>
                <div class="achievement-name" style="font-weight: 700; font-size: 1.1rem; margin-bottom: 2px;">${title}</div>
                <div class="achievement-desc" style="font-size: 0.85rem; opacity: 0.8;">${description}</div>
            </div>
            <button class="achievement-close" style="background: transparent; border: none; color: inherit; font-size: 1.5rem; cursor: pointer; opacity: 0.5; padding: 0 5px;">×</button>
        `;
        
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });

        // Close button
        const closeBtn = toast.querySelector('.achievement-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                toast.style.transform = 'translateX(120%)';
                setTimeout(() => toast.remove(), 400);
            };
        }

        // Auto remove after 4s
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.style.transform = 'translateX(120%)';
                setTimeout(() => toast.remove(), 400);
            }
        }, 4000);
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
                    <h3 class="font-bold text-lg mb-3 sticky top-0 bg-indigodeep text-beige py-2 z-10 border-b border-white/10 dark:border-white/5 flex items-center gap-2">
                        ${title}
                        <span class="text-xs font-normal text-beige/90 bg-white/10 px-2 py-0.5 rounded-full">${achievements.filter(a => unlocked.includes(a.id)).length}/${achievements.length}</span>
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

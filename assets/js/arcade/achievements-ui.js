// Achievements UI (shared across Arcade pages)
// - Provides window.toggleAchievements(show, filter)
// - Ensures drawer is scrollable and only closes via the X button
// - Optionally auto-unlocks lightweight "visit" achievements for mini-game wrapper pages

function ensureModalExists() {
    const existing = document.getElementById('achievements-modal');
    if (existing) {
        // If a page already shipped its own achievements modal markup (older drawer version),
        // replace it with the compact scrollable panel so the UX is consistent.
        if (!(existing.dataset && existing.dataset.arcadeAchievementsUi === '1')) {
            existing.id = 'achievements-modal';
            existing.className = 'relative z-[9999] hidden';
            existing.setAttribute('aria-labelledby', 'slide-over-title');
            existing.setAttribute('role', 'dialog');
            existing.setAttribute('aria-modal', 'true');
            existing.dataset.arcadeAchievementsUi = '1';

            existing.innerHTML = `
                <div id="achievements-panel" class="fixed z-[10000] pointer-events-auto" style="right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);height:70vh;max-height:70vh;opacity:0;transform:translateY(10px);transition:opacity 200ms ease, transform 200ms ease;">
                    <div class="flex flex-col bg-beige dark:bg-indigodeep shadow-2xl border border-chocolate/10 dark:border-beige/10 rounded-2xl overflow-hidden h-full" style="-webkit-overflow-scrolling: touch; touch-action: pan-y;">
                        <div class="p-4 border-b border-chocolate/10 dark:border-beige/10 bg-beige dark:bg-indigodeep">
                            <div class="flex items-center justify-between">
                                <h2 class="text-base font-bold text-chocolate dark:text-beige" id="slide-over-title">🏆 Achievements</h2>
                                <button type="button" id="achievements-close" class="rounded-md text-chocolate/60 hover:text-chocolate dark:text-beige/60 dark:hover:text-beige focus:outline-none flex items-center gap-1">
                                    <span class="sr-only">Close panel</span>
                                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="p-4 flex-1 overflow-y-auto overscroll-contain custom-scrollbar" id="achievements-list-container" style="min-height:0;">
                            <div id="achievements-list" class="space-y-6"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        return;
    }

    const modal = document.createElement('div');
    modal.id = 'achievements-modal';
    modal.className = 'relative z-[9999] hidden';
    modal.setAttribute('aria-labelledby', 'slide-over-title');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.dataset.arcadeAchievementsUi = '1';

    modal.innerHTML = `
        <div id="achievements-panel" class="fixed z-[10000] pointer-events-auto" style="right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);height:70vh;max-height:70vh;opacity:0;transform:translateY(10px);transition:opacity 200ms ease, transform 200ms ease;">
            <div class="flex flex-col bg-beige dark:bg-indigodeep shadow-2xl border border-chocolate/10 dark:border-beige/10 rounded-2xl overflow-hidden h-full" style="-webkit-overflow-scrolling: touch; touch-action: pan-y;">
                <div class="p-4 border-b border-chocolate/10 dark:border-beige/10 bg-beige dark:bg-indigodeep">
                    <div class="flex items-center justify-between">
                        <h2 class="text-base font-bold text-chocolate dark:text-beige" id="slide-over-title">🏆 Achievements</h2>
                        <button type="button" id="achievements-close" class="rounded-md text-chocolate/60 hover:text-chocolate dark:text-beige/60 dark:hover:text-beige focus:outline-none flex items-center gap-1">
                            <span class="sr-only">Close panel</span>
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="p-4 flex-1 overflow-y-auto overscroll-contain custom-scrollbar" id="achievements-list-container" style="min-height:0;">
                    <div id="achievements-list" class="space-y-6"></div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function getFilterFromPageOrArg(filter) {
    if (filter) return filter;
    const fromPage = document.body && document.body.dataset ? document.body.dataset.arcadeAchievementsFilter : '';
    return fromPage || 'all';
}

function setFilter(filter) {
    if (!window.ArcadeAchievements) return;
    if (typeof window.ArcadeAchievements.setFilter === 'function') {
        window.ArcadeAchievements.setFilter(filter);
    }
}

function openAchievements(filter) {
    ensureModalExists();

    const modal = document.getElementById('achievements-modal');
    const panel = document.getElementById('achievements-panel');

    if (!modal || !panel) return;

    const resolvedFilter = getFilterFromPageOrArg(filter);
    setFilter(resolvedFilter);

    if (window.ArcadeAchievements && typeof window.ArcadeAchievements.updateUI === 'function') {
        window.ArcadeAchievements.updateUI();
    }

    modal.classList.remove('hidden');

    requestAnimationFrame(() => {
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
    });
}

function closeAchievements() {
    const modal = document.getElementById('achievements-modal');
    const panel = document.getElementById('achievements-panel');

    if (!modal || !panel) return;

    panel.style.opacity = '0';
    panel.style.transform = 'translateY(10px)';

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function bindHandlers() {
    ensureModalExists();

    const closeBtn = document.getElementById('achievements-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeAchievements();
        });
    }

    // Do NOT close on backdrop click (per request)
    // No backdrop for the compact panel.

    // Live refresh if unlocked while drawer is open
    window.addEventListener('arcade-achievements-update', () => {
        const modal = document.getElementById('achievements-modal');
        if (!modal || modal.classList.contains('hidden')) return;
        if (window.ArcadeAchievements && typeof window.ArcadeAchievements.updateUI === 'function') {
            window.ArcadeAchievements.updateUI();
        }
    });
}

function autoUnlockMiniGameVisitAchievements() {
    const filter = (document.body && document.body.dataset && document.body.dataset.arcadeAchievementsFilter) || '';
    if (!filter || !filter.startsWith('mini_')) return;

    // Lightweight wrapper-page achievements that don't touch the embedded third-party code.
    // Definitions live in achievements-defs.js
    if (window.ArcadeAchievements && typeof window.ArcadeAchievements.unlock === 'function') {
        window.ArcadeAchievements.unlock(`${filter}_visit`);
        window.setTimeout(() => window.ArcadeAchievements.unlock(`${filter}_stay_60`), 60_000);
        window.setTimeout(() => window.ArcadeAchievements.unlock(`${filter}_stay_180`), 180_000);
        window.setTimeout(() => window.ArcadeAchievements.unlock(`${filter}_stay_300`), 300_000);
    }
}

function syncFromSiteAchievementsStore() {
    // Migrate previously-earned website achievements into the shared arcade store.
    // site.js stores an object in 'portfolio_achievements' keyed by achievement id.
    try {
        const siteRaw = localStorage.getItem('portfolio_achievements');
        if (!siteRaw) return;
        const siteObj = JSON.parse(siteRaw);
        if (!siteObj || typeof siteObj !== 'object') return;

        const key = 'arcade_achievements';
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const unlocked = Array.isArray(list) ? list : [];

        Object.keys(siteObj).forEach((id) => {
            if (!unlocked.includes(id)) unlocked.push(id);
        });

        localStorage.setItem(key, JSON.stringify(unlocked));
        if (window.ArcadeAchievements && typeof window.ArcadeAchievements.updateUI === 'function') {
            window.ArcadeAchievements.updateUI();
        }
    } catch {}
}

window.toggleAchievements = (show, filter) => {
    if (show) openAchievements(filter);
    else closeAchievements();
};

// Initialize after DOM is ready (Arcade core is a module and will also be deferred).
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bindHandlers();
        syncFromSiteAchievementsStore();
        autoUnlockMiniGameVisitAchievements();
    });
} else {
    bindHandlers();
    syncFromSiteAchievementsStore();
    autoUnlockMiniGameVisitAchievements();
}

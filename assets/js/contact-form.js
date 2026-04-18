/**
 * Contact Success Modal + Bubble Game
 *
 * IMPORTANT: This file is intentionally submission-passive.
 * Canonical contact submission ownership lives in assets/js/site.js.
 *
 * This script only reacts to success state from #contact-status,
 * then opens a modal and runs the mini-game.
 */

(function() {
    const form = document.getElementById('contact-form');
    const modal = document.getElementById('contact-success-modal');
    const statusArea = document.getElementById('contact-status');
    const clearBtn = document.getElementById('clear-form-btn');
    const closeBtn = document.getElementById('close-success-modal');
    const restartBtn = document.getElementById('restart-success-game');
    const canvas = document.getElementById('success-game-canvas');
    const scoreDisplay = document.getElementById('score-display');

    if (!form || !modal || !closeBtn || !canvas) return;

    const isModalOpen = () => !modal.classList.contains('hidden');

    let successStateObserved = false;
    let scrollY = 0;
    let gameActive = false;
    let gameOver = false;
    let animationFrameId = null;
    let bubbles = [];
    let score = 0;
    let misses = 0;
    let wave = 1;
    let waveTotal = 0;
    let waveSpawned = 0;
    let waveRemaining = 0;
    let waveBannerUntil = 0;
    let lastFrameAt = 0;
    let spawnAccumulatorMs = 0;
    let slowUntil = 0;
    let ctx = null;

    const MAX_MISSES = 10;
    const BASE_WAVE_BALLOONS = 18;
    const BASE_SPAWN_INTERVAL_MS = 520;
    const MIN_SPAWN_INTERVAL_MS = 220;
    const WAVE_BANNER_MS = 1200;
    const BETWEEN_WAVE_PAUSE_MS = 800;
    const SLOW_EFFECT_MS = 4500;

    const showToast = (kind, message) => {
        if (!message) return;
        try {
            const toast = document.createElement('div');
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.textContent = message;

            toast.style.position = 'fixed';
            toast.style.left = '50%';
            toast.style.top = '16px';
            toast.style.transform = 'translateX(-50%)';
            toast.style.zIndex = '99999';
            toast.style.maxWidth = '520px';
            toast.style.width = 'min(92vw, 520px)';
            toast.style.padding = '10px 14px';
            toast.style.borderRadius = '999px';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '600';
            toast.style.border = '1px solid transparent';

            const rootStyle = getComputedStyle(document.documentElement);
            const primary = rootStyle.getPropertyValue('--color-primary').trim();
            const bg = rootStyle.getPropertyValue('--color-bg').trim();
            const text = rootStyle.getPropertyValue('--color-text').trim();

            if (kind === 'error') {
                toast.style.background = bg || '#ffffff';
                toast.style.color = text || '#111827';
            } else {
                toast.style.background = primary || '#212842';
                toast.style.color = bg || '#ffffff';
            }

            document.body.appendChild(toast);
            window.setTimeout(() => {
                try { toast.remove(); } catch (_) {}
            }, 2200);
        } catch (_) {}
    };

    const syncSuccessModalToStatus = () => {
        const nextState = statusArea
            ? String(statusArea.getAttribute('data-status') || '').toLowerCase()
            : '';

        if (nextState === 'success') {
            if (!successStateObserved) {
                successStateObserved = true;
                openModal();
            }
            return;
        }

        successStateObserved = false;
    };

    if (statusArea) {
        syncSuccessModalToStatus();
        const observer = new MutationObserver(syncSuccessModalToStatus);
        observer.observe(statusArea, {
            attributes: true,
            attributeFilter: ['data-status'],
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            successStateObserved = false;
            if (isModalOpen()) closeModal();
        });
    }

    closeBtn.addEventListener('click', closeModal);
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (!isModalOpen()) return;
            initGame();
            try { canvas.focus({ preventScroll: true }); } catch (_) {}
            showToast('success', 'Restarted');
        });
    }

    modal.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || !isModalOpen()) return;
        const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
            return;
        }

        if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (gameActive && animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            return;
        }

        if (gameActive && isModalOpen() && !animationFrameId) {
            loop();
        }
    });

    function openModal() {
        if (window.__eaScrollLock && typeof window.__eaScrollLock.lock === 'function') {
            window.__eaScrollLock.lock('contact-modal');
        } else {
            scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
        }

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        closeBtn.focus();
        initGame();
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');

        if (window.__eaScrollLock && typeof window.__eaScrollLock.unlock === 'function') {
            window.__eaScrollLock.unlock('contact-modal');
        } else {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, scrollY);
        }

        stopGame();
    }

    function initGame() {
        if (gameActive) stopGame();
        gameActive = true;
        gameOver = false;
        score = 0;
        misses = 0;
        bubbles = [];
        wave = 1;
        startWave(wave);

        ctx = canvas.getContext('2d');
        resizeCanvas();

        window.addEventListener('resize', resizeCanvas);
        canvas.addEventListener('pointerdown', handleInput);

        showTutorial();
        lastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        spawnAccumulatorMs = 0;
        loop();
    }

    function stopGame() {
        gameActive = false;
        gameOver = false;

        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        slowUntil = 0;

        window.removeEventListener('resize', resizeCanvas);
        canvas.removeEventListener('pointerdown', handleInput);
    }

    function endGame() {
        gameOver = true;
        gameActive = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        window.removeEventListener('resize', resizeCanvas);
        canvas.removeEventListener('pointerdown', handleInput);
        drawGameOver();
    }

    function drawGameOver() {
        try {
            if (!ctx) ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            ctx.clearRect(0, 0, w, h);
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '24px Inter, sans-serif';
            ctx.fillText('Game over', w / 2, h / 2 - 18);
            ctx.font = '16px Inter, sans-serif';
            ctx.fillText(`Score: ${score}`, w / 2, h / 2 + 10);
            ctx.fillText('Press Restart to play again', w / 2, h / 2 + 34);
            ctx.restore();
        } catch (_) {}
    }

    function showTutorial() {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);

        ctx.fillStyle = '#fff';
        ctx.font = '20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const msg = 'Tap bubbles to pop';
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        ctx.fillText(msg, w / 2, h / 2);
        ctx.restore();
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function updateHud() {
        if (!scoreDisplay) return;
        const remaining = Math.max(0, waveRemaining);
        scoreDisplay.innerText = `Score: ${score} | Wave: ${wave} | Remaining: ${remaining} | Misses: ${misses}/${MAX_MISSES}`;
    }

    function handleInput(e) {
        e.preventDefault();
        if (gameOver || !gameActive) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        bubbles.forEach((bubble) => {
            if (bubble.popped) return;
            const dx = x - bubble.x;
            const dy = y - bubble.y;
            if ((dx * dx) + (dy * dy) < (bubble.radius + 15) ** 2) {
                bubble.popped = true;
                applyBalloonEffect(bubble);
            }
        });
    }

    function startWave(nextWave) {
        wave = nextWave;
        waveTotal = BASE_WAVE_BALLOONS + ((wave - 1) * 6);
        waveSpawned = 0;
        waveRemaining = waveTotal;
        waveBannerUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + WAVE_BANNER_MS;
        spawnAccumulatorMs = 0;
        slowUntil = 0;
        updateHud();
    }

    function scheduleNextWave() {
        const tokenWave = wave;
        gameActive = false;
        updateHud();

        setTimeout(() => {
            if (gameOver || !isModalOpen() || wave !== tokenWave) return;
            gameActive = true;
            startWave(wave + 1);
            lastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            loop();
        }, BETWEEN_WAVE_PAUSE_MS);
    }

    function pickBalloonType() {
        const r = Math.random();
        if (r < 0.8) return 'normal';
        if (r < 0.88) return 'gold';
        if (r < 0.93) return 'heart';
        if (r < 0.97) return 'slow';
        return 'bomb';
    }

    function balloonStyle(type) {
        switch (type) {
            case 'gold': return { color: '#f2c94c', label: '*' };
            case 'heart': return { color: '#eb5757', label: '+' };
            case 'slow': return { color: '#56ccf2', label: 'S' };
            case 'bomb': return { color: '#333333', label: '!' };
            default: return { color: `hsl(${Math.random() * 360}, 70%, 60%)`, label: '' };
        }
    }

    function applyBalloonEffect(bubble) {
        waveRemaining = Math.max(0, waveRemaining - 1);

        if (bubble.type === 'gold') score += 50;
        else if (bubble.type === 'heart') {
            misses = Math.max(0, misses - 2);
            score += 15;
        } else if (bubble.type === 'slow') {
            slowUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + SLOW_EFFECT_MS;
            score += 10;
        } else if (bubble.type === 'bomb') score = Math.max(0, score - 50);
        else score += 10;

        updateHud();

        if (waveRemaining <= 0) scheduleNextWave();
    }

    function spawnBubble() {
        const rect = canvas.getBoundingClientRect();
        const radius = 15 + (Math.random() * 25);
        const type = pickBalloonType();
        const style = balloonStyle(type);

        bubbles.push({
            x: Math.random() * rect.width,
            y: rect.height + radius,
            radius,
            speed: (1 + (Math.random() * 3)) * (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1),
            color: style.color,
            label: style.label,
            type,
            popped: false
        });
    }

    function loop() {
        if (gameOver) {
            drawGameOver();
            return;
        }
        if (!gameActive) return;

        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.min(64, Math.max(0, now - lastFrameAt));
        lastFrameAt = now;

        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        ctx.clearRect(0, 0, width, height);

        const spawnInterval = Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - ((wave - 1) * 35));
        spawnAccumulatorMs += dt;
        while (spawnAccumulatorMs >= spawnInterval && waveSpawned < waveTotal) {
            spawnAccumulatorMs -= spawnInterval;
            spawnBubble();
            waveSpawned += 1;
        }

        for (let i = bubbles.length - 1; i >= 0; i -= 1) {
            const bubble = bubbles[i];

            if (!bubble.popped) {
                const slowFactor = now < slowUntil ? 0.45 : 1;
                bubble.y -= (bubble.speed * slowFactor);

                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
                ctx.fillStyle = bubble.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.stroke();
                ctx.closePath();

                if (bubble.label) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    ctx.font = `${Math.max(12, Math.round(bubble.radius * 0.9))}px Inter, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(bubble.label, bubble.x, bubble.y);
                    ctx.restore();
                }

                if (bubble.y + bubble.radius < 0) {
                    bubbles.splice(i, 1);
                    misses += 1;
                    waveRemaining = Math.max(0, waveRemaining - 1);
                    updateHud();

                    if (misses >= MAX_MISSES) {
                        endGame();
                        return;
                    }

                    if (waveRemaining <= 0) {
                        scheduleNextWave();
                        return;
                    }
                }
            } else {
                bubble.radius *= 0.9;
                bubble.y -= bubble.speed * 0.5;

                ctx.beginPath();
                ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
                ctx.fillStyle = bubble.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.closePath();

                if (bubble.radius < 2) bubbles.splice(i, 1);
            }
        }

        if (now < waveBannerUntil) {
            const remainingMs = waveBannerUntil - now;
            const t = 1 - Math.min(1, remainingMs / WAVE_BANNER_MS);
            const alpha = (t < 0.25)
                ? (t / 0.25)
                : (t > 0.85 ? (1 - ((t - 0.85) / 0.15)) : 1);

            ctx.save();
            ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * alpha})`;
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '28px Inter, sans-serif';
            ctx.fillText(`Wave ${wave}`, width / 2, height / 2);
            ctx.font = '14px Inter, sans-serif';
            ctx.fillText(`Balloons: ${waveTotal}`, width / 2, (height / 2) + 28);
            ctx.restore();
        }

        animationFrameId = requestAnimationFrame(loop);
    }
})();

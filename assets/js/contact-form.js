/**
 * Contact Form Handler & Success Game
 * Handles AJAX submission to Formspree and runs a lightweight canvas game on success.
 */

(function() {
    const form = document.getElementById('contact-form');
    const modal = document.getElementById('contact-success-modal');
    const closeBtn = document.getElementById('close-success-modal');
    const canvas = document.getElementById('success-game-canvas');
    const scoreDisplay = document.getElementById('score-display');
    
    // New UI Elements
    const statusArea = document.getElementById('contact-status');
    const fileHelp = document.getElementById('contact-file-help');
    const maxFileMbEl = document.getElementById('contact-max-file-mb');
    const clearBtn = document.getElementById('clear-form-btn');
    const copyEmailBtns = Array.from(document.querySelectorAll('[data-copy-email]'));
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!form || !modal) return;

    const isModalOpen = () => !modal.classList.contains('hidden');

    // State
    let scrollY = 0;
    let gameActive = false;
    let animationFrameId;
    let bubbles = [];
    let score = 0;
    let misses = 0;
    let gameOver = false;
    let wave = 1;
    let waveTotal = 0;
    let waveSpawned = 0;
    let waveRemaining = 0;
    let waveBannerUntil = 0;
    let lastFrameAt = 0;
    let spawnAccumulatorMs = 0;
    let slowUntil = 0;
    let ctx;
    let inFlight = false;
    let pageLoadTime = Date.now();
    let fileValid = true;
    
    // Constants
    const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
    const MIN_SUBMIT_TIME = 2500; // 2.5 seconds
    const COOLDOWN_TIME = 15000; // 15 seconds
    const STORAGE_KEY = 'contact_form_draft';
    const COOLDOWN_KEY = 'contact_form_cooldown';
    const EMAIL_TO_COPY = 'hello@estivanayramia.com';

    // Game tuning
    const MAX_MISSES = 10;
    const BASE_WAVE_BALLOONS = 18;
    const BASE_SPAWN_INTERVAL_MS = 520;
    const MIN_SPAWN_INTERVAL_MS = 220;
    const WAVE_BANNER_MS = 1200;
    const BETWEEN_WAVE_PAUSE_MS = 800;
    const SLOW_EFFECT_MS = 4500;

    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    // Restore draft
    try {
        const draft = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        if (draft) {
            Object.keys(draft).forEach(key => {
                const input = form.elements[key];
                if (input && input.type !== 'file' && input.type !== 'hidden') {
                    input.value = draft[key];
                }
            });
        }
    } catch (e) { /* ignore */ }

    // Check cooldown
    checkCooldown();

    // Sync file help text to MAX_FILE_BYTES
    try {
        const mb = Math.round((MAX_FILE_BYTES / (1024 * 1024)) * 10) / 10;
        if (maxFileMbEl) maxFileMbEl.textContent = String(mb);
        if (fileHelp && !fileHelp.textContent.includes('max')) {
            // no-op; keep existing copy
        }
    } catch (e) {}

    // Anti-bot timer starts at page load per spec

    // ==========================================
    // FORM HELPERS
    // ==========================================

    function setStatus(type, message) {
        if (!statusArea) return;
        statusArea.setAttribute('data-status', type);
        const hasMessage = typeof message === 'string' && message.trim().length > 0;
        statusArea.textContent = hasMessage ? message : '\u00A0';
    }

    function showToast(kind, message) {
        try {
            const toast = document.createElement('div');
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.textContent = message;

            // Use existing theme primitives via CSS variables (no new hard-coded colors)
            const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'transparent';
            const fg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || 'inherit';
            const border = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || 'transparent';

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
            toast.style.background = bg;
            toast.style.color = fg;
            toast.style.border = `1px solid ${border}`;

            if (kind === 'error') {
                // Keep within palette by swapping bg/fg
                toast.style.background = fg;
                toast.style.color = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || 'inherit';
            }

            document.body.appendChild(toast);
            window.setTimeout(() => {
                try { toast.remove(); } catch (e) {}
            }, 2600);
        } catch (e) {}
    }

    function isElementInViewport(el) {
        try {
            const r = el.getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            return r.top >= 0 && r.bottom <= vh;
        } catch (e) {
            return true;
        }
    }

    function focusFirstInvalid() {
        try { form.reportValidity(); } catch (e) {}
        const invalid = form.querySelector(':invalid');
        if (!invalid) return;
        try {
            invalid.focus({ preventScroll: true });
        } catch (e) {
            try { invalid.focus(); } catch (e2) {}
        }
        if (!isElementInViewport(invalid)) {
            try { invalid.scrollIntoView({ block: 'center' }); } catch (e) {}
        }
    }

    function checkCooldown() {
        const lastSubmit = localStorage.getItem(COOLDOWN_KEY);
        if (lastSubmit) {
            const elapsed = Date.now() - parseInt(lastSubmit, 10);
            if (elapsed < COOLDOWN_TIME) {
                disableSubmit(true);
                const remaining = Math.ceil((COOLDOWN_TIME - elapsed) / 1000);
                setStatus('neutral', `Please wait ${remaining}s before sending again.`);
                setTimeout(checkCooldown, 1000);
            } else {
                disableSubmit(false);
                if (statusArea.textContent.includes('Please wait')) {
                    setStatus('idle', '');
                }
            }
        }
    }

    function disableSubmit(disabled) {
        if (submitBtn) {
            submitBtn.disabled = disabled;
            submitBtn.style.opacity = disabled ? '0.7' : '1';
            submitBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        }
    }

    // Save draft on input
    form.addEventListener('input', debounce((e) => {
        if (e.target.type === 'file' || e.target.type === 'hidden') return;
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            if (typeof value === 'string') data[key] = value;
        });
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 500));

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Clear form
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            form.reset();
            sessionStorage.removeItem(STORAGE_KEY);
            setStatus('idle', '');
            fileValid = true;
            disableSubmit(false);
        });
    }

    // Copy Email (supports multiple buttons; iOS-safe fallback)
    copyEmailBtns.forEach((btn) => {
        btn.addEventListener('click', async () => {
            const originalText = btn.innerText;
            const markCopied = () => {
                btn.innerText = 'Copied';
                showToast('success', 'Email copied');
                window.setTimeout(() => { btn.innerText = originalText; }, 1800);
            };

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(EMAIL_TO_COPY);
                    markCopied();
                    return;
                }
            } catch (e) {}

            try {
                const ta = document.createElement('textarea');
                ta.value = EMAIL_TO_COPY;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.top = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                markCopied();
            } catch (e) {
                showToast('error', 'Copy failed');
            }
        });
    });

    // File validation (size + type) and submit disabling
    const fileInput = form.querySelector('#attachment');
    const acceptList = (fileInput && fileInput.getAttribute('accept'))
        ? fileInput.getAttribute('accept').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : [];

    const validateFile = () => {
        fileValid = true;
        const inCooldown = !!localStorage.getItem(COOLDOWN_KEY);
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            if (!inCooldown) {
                setStatus('idle', '');
                disableSubmit(false);
            }
            return;
        }

        const f = fileInput.files[0];
        const name = (f && f.name ? f.name : '').toLowerCase();
        const ext = name.includes('.') ? name.split('.').pop() : '';

        if (f.size > MAX_FILE_BYTES) {
            fileValid = false;
            disableSubmit(true);
            setStatus('error', `File is too large. Max size is ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB.`);
            return;
        }

        // If accept list is specified, validate extension loosely
        if (acceptList.length > 0) {
            const allowedExts = acceptList
                .filter(a => a.startsWith('.'))
                .map(a => a.replace('.', ''));
            if (allowedExts.length > 0 && ext && !allowedExts.includes(ext)) {
                fileValid = false;
                disableSubmit(true);
                setStatus('error', 'Unsupported file type. Please choose an allowed format.');
                return;
            }
        }

        if (!inCooldown) {
            setStatus('idle', '');
            disableSubmit(false);
        }
    };

    if (fileInput) {
        fileInput.addEventListener('change', validateFile);
    }

    // ==========================================
    // FORM SUBMISSION
    // ==========================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (inFlight) return;

        // Anti-bot: Time to submit
        if (Date.now() - pageLoadTime < MIN_SUBMIT_TIME) {
            setStatus('error', 'Failed. Copy the email and send manually. Try again later.');
            showToast('error', 'Failed — copy email and try again later');
            return;
        }

        // File validation guard
        validateFile();
        if (!fileValid) {
            showToast('error', 'Fix the attachment and try again');
            return;
        }

        // Trim inputs
        const inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="url"], textarea');
        inputs.forEach(input => { input.value = input.value.trim(); });

        if (!form.checkValidity()) {
            focusFirstInvalid();
            return;
        }

        inFlight = true;
        const originalText = submitBtn.innerText;
        disableSubmit(true);
        submitBtn.innerText = 'Sending…';
        setStatus('neutral', 'Sending…');
        
        try {
            const endpoint = form.getAttribute('data-form-endpoint');
            const formData = new FormData(form);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
                redirect: 'manual',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                form.reset();
                sessionStorage.removeItem(STORAGE_KEY);
                localStorage.setItem(COOLDOWN_KEY, Date.now().toString());

                setStatus('success', 'Sent. If you do not hear back within 24 hours, copy the email and send manually.');
                showToast('success', 'Message sent');
                openModal();
                
                // Start cooldown
                checkCooldown();
            } else {
                // Cooldown after any attempt (success or failure)
                localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
                let msg = 'Failed. Copy the email and send manually. Try again later.';
                try {
                    const data = await response.json();
                    if (data && Object.hasOwn(data, 'errors')) {
                        msg = data.errors.map(error => error.message).join(', ');
                        msg += ' If this keeps failing, copy the email and send manually.';
                    }
                } catch (e) {}
                setStatus('error', msg);
                showToast('error', 'Failed — copy email and try again later');
                checkCooldown();
            }
        } catch (error) {
            // Cooldown after any attempt (success or failure)
            localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
            setStatus('error', 'Failed. Copy the email and send manually. Try again later.');
            showToast('error', 'Failed — copy email and try again later');
            checkCooldown();
        } finally {
            inFlight = false;
            // Restore button label; cooldown handler will manage disabling + countdown text
            submitBtn.innerText = originalText;
            if (!localStorage.getItem(COOLDOWN_KEY)) {
                disableSubmit(false);
            }
        }
    });

    // ==========================================
    // MODAL & SCROLL LOCK
    // ==========================================
    function openModal() {
        // Capture scroll position + lock body (prefer shared lock from site.js)
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
        
        // Focus management
        closeBtn.focus();
        
        initGame();
    }

    function closeModal() {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');

        // Unlock body
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

    const restartBtn = document.getElementById('restart-success-game');

    closeBtn.addEventListener('click', closeModal);
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (!isModalOpen()) return;
            initGame();
            try { canvas.focus({ preventScroll: true }); } catch (e) {}
            showToast('success', 'Restarted');
        });
    }
    
    // Removed ESC key to close modal - only close button now closes it

    const getModalPanel = () => modal.querySelector('[data-contact-modal-panel]');

    // Removed click-outside to close modal - only close button now closes it

    // Trap focus
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && isModalOpen()) {
            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }
    });

    // ==========================================
    // SUCCESS GAME (Bubble Popper)
    // ==========================================
    function initGame() {
        if (gameActive) stopGame(); // Ensure clean start
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
        
        // Show tutorial
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
        } catch (e) {}
    }

    function showTutorial() {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
        
        ctx.fillStyle = '#fff';
        ctx.font = '20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const msg = 'Tap bubbles to pop!';
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        
        ctx.fillText(msg, w / 2, h / 2);
        ctx.restore();
        
        // Fade out tutorial after 2s (simulated by just letting the loop overwrite it)
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        
        // Reset transform to avoid accumulation
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function updateHud() {
        if (!scoreDisplay) return;
        const remaining = Math.max(0, waveRemaining);
        scoreDisplay.innerText = `Score: ${score} • Wave: ${wave} • Remaining: ${remaining} • Misses: ${misses}/${MAX_MISSES}`;
    }

    function handleInput(e) {
        e.preventDefault(); // Prevent default touch actions
        if (gameOver) return;
        if (!gameActive) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        bubbles.forEach(b => {
            if (b.popped) return;
            const dx = x - b.x;
            const dy = y - b.y;
            if (dx*dx + dy*dy < (b.radius + 15)**2) { // +15 for easier touch
                b.popped = true;
                applyBalloonEffect(b);
            }
        });
    }

    function startWave(w) {
        wave = w;
        waveTotal = BASE_WAVE_BALLOONS + (w - 1) * 6;
        waveSpawned = 0;
        waveRemaining = waveTotal;
        waveBannerUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + WAVE_BANNER_MS;
        spawnAccumulatorMs = 0;
        slowUntil = 0;
        updateHud();
    }

    function scheduleNextWave() {
        // Pause briefly, then start next wave
        const tokenWave = wave;
        gameActive = false;
        updateHud();
        setTimeout(() => {
            if (gameOver) return;
            if (!isModalOpen()) return;
            if (wave !== tokenWave) return;
            gameActive = true;
            startWave(wave + 1);
            lastFrameAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            loop();
        }, BETWEEN_WAVE_PAUSE_MS);
    }

    function pickBalloonType() {
        // Weighted random: normal most common; specials add variety.
        const r = Math.random();
        if (r < 0.80) return 'normal';
        if (r < 0.88) return 'gold';
        if (r < 0.93) return 'heart';
        if (r < 0.97) return 'slow';
        return 'bomb';
    }

    function balloonStyle(type) {
        switch (type) {
            case 'gold': return { color: '#f2c94c', label: '★' };
            case 'heart': return { color: '#eb5757', label: '❤' };
            case 'slow': return { color: '#56ccf2', label: '⏱' };
            case 'bomb': return { color: '#333333', label: '!' };
            default: return { color: `hsl(${Math.random() * 360}, 70%, 60%)`, label: '' };
        }
    }

    function applyBalloonEffect(b) {
        // Popping always reduces remaining for the wave.
        waveRemaining = Math.max(0, waveRemaining - 1);

        if (b.type === 'gold') {
            score += 50;
        } else if (b.type === 'heart') {
            misses = Math.max(0, misses - 2);
            score += 15;
        } else if (b.type === 'slow') {
            slowUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + SLOW_EFFECT_MS;
            score += 10;
        } else if (b.type === 'bomb') {
            score = Math.max(0, score - 50);
        } else {
            score += 10;
        }

        updateHud();

        if (waveRemaining <= 0) {
            scheduleNextWave();
        }
    }

    function spawnBubble() {
        const rect = canvas.getBoundingClientRect();
        const radius = 15 + Math.random() * 25;
        const type = pickBalloonType();
        const style = balloonStyle(type);
        bubbles.push({
            x: Math.random() * rect.width,
            y: rect.height + radius,
            radius: radius,
            speed: (1 + Math.random() * 3) * (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1),
            color: style.color,
            label: style.label,
            type: type,
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

        // Spawn logic (wave-based)
        const spawnInterval = Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - (wave - 1) * 35);
        spawnAccumulatorMs += dt;
        while (spawnAccumulatorMs >= spawnInterval && waveSpawned < waveTotal) {
            spawnAccumulatorMs -= spawnInterval;
            spawnBubble();
            waveSpawned += 1;
        }
        
        // Update & Draw
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            
            if (!b.popped) {
                const slowFactor = (now < slowUntil) ? 0.45 : 1;
                b.y -= (b.speed * slowFactor);
                
                // Draw bubble
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.stroke();
                ctx.closePath();

                if (b.label) {
                    try {
                        ctx.save();
                        ctx.fillStyle = 'rgba(255,255,255,0.95)';
                        ctx.font = `${Math.max(12, Math.round(b.radius * 0.9))}px Inter, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(b.label, b.x, b.y);
                        ctx.restore();
                    } catch (e) {}
                }
                
                // Remove if off screen
                if (b.y + b.radius < 0) {
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
                // Pop animation (simple fade/shrink)
                b.radius *= 0.9;
                b.y -= b.speed * 0.5;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.closePath();
                
                if (b.radius < 2) {
                    bubbles.splice(i, 1);
                }
            }
        }

        // Wave banner animation
        if (now < waveBannerUntil) {
            const remainingMs = waveBannerUntil - now;
            const t = 1 - Math.min(1, remainingMs / WAVE_BANNER_MS);
            const alpha = (t < 0.25) ? (t / 0.25) : (t > 0.85 ? (1 - (t - 0.85) / 0.15) : 1);
            try {
                ctx.save();
                ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * alpha})`;
                ctx.fillRect(0, 0, width, height);
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '28px Inter, sans-serif';
                ctx.fillText(`Wave ${wave}`, width / 2, height / 2);
                ctx.font = '14px Inter, sans-serif';
                ctx.fillText(`Balloons: ${waveTotal}`, width / 2, height / 2 + 28);
                ctx.restore();
            } catch (e) {}
        }
        
        animationFrameId = requestAnimationFrame(loop);
    }

    // Pause on background
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (gameActive) {
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        } else {
            if (gameActive && isModalOpen() && !animationFrameId) {
                loop();
            }
        }
    });

})();

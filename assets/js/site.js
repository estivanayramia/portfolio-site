/**
 * Portfolio Site Logic
 * Handles interactions, animations, and performance
 */

// ==========================================================================
// Dark Mode Toggle
// ==========================================================================

const initDarkMode = () => {
    const toggleButton = document.getElementById('theme-toggle');
    if (!toggleButton) return;

    // Check for saved theme preference or default to light mode
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    // Toggle theme function
    const toggleTheme = () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update ARIA label
        toggleButton.setAttribute('aria-label', `Switch to ${theme} mode`);
    };

    // Add event listeners for both click and touch
    toggleButton.addEventListener('click', toggleTheme);
    toggleButton.addEventListener('touchstart', toggleTheme);
};

// ==========================================================================
// Mobile Menu Interaction
// ==========================================================================

const initMobileMenu = () => {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (!menuToggle || !mobileMenu) return;

    // Handler function for menu toggle
    const toggleMenu = () => {
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

        // Toggle menu visibility
        mobileMenu.classList.toggle('hidden');

        // Update ARIA attribute
        menuToggle.setAttribute('aria-expanded', !isExpanded);

        // Animate icon (optional enhancement)
        const icon = menuToggle.querySelector('svg');
        if (icon) {
            icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
        }
    };

    // Add both click and touchstart for iOS compatibility
    menuToggle.addEventListener('click', toggleMenu);
    menuToggle.addEventListener('touchstart', toggleMenu);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
            mobileMenu.classList.add('hidden');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Close menu when clicking a link
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            menuToggle.setAttribute('aria-expanded', 'false');
        });
    });
};

// ==========================================================================
// GSAP Animations
// ==========================================================================

const initAnimations = () => {
    // Always unhide elements first to avoid blank screens
    const allAnimated = document.querySelectorAll('[data-gsap]');
    allAnimated.forEach(el => {
        el.classList.remove('opacity-0', 'translate-y-8');
        el.style.opacity = '1';
        el.style.transform = 'none';
    });

    // If GSAP unavailable, keep content visible and exit
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        console.warn('GSAP or ScrollTrigger not loaded; revealing content without animations.');
        return;
    }

    // Register ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // Fade Up Animations
    const fadeElements = document.querySelectorAll('[data-gsap="fade-up"]');
    
    fadeElements.forEach(element => {
        const delay = element.getAttribute('data-gsap-delay') || 0;
        
        gsap.from(element, {
            opacity: 0,
            y: 30,
            duration: 0.8,
            delay: parseFloat(delay),
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 85%',
                toggleActions: 'play none none none'
            }
        });
    });

    // Parallax effect for hero section (if exists)
    const heroSection = document.querySelector('section:first-of-type');
    if (heroSection) {
        gsap.to(heroSection, {
            yPercent: 20,
            ease: 'none',
            scrollTrigger: {
                trigger: heroSection,
                start: 'top top',
                end: 'bottom top',
                scrub: true
            }
        });
    }

    // Card hover animations
    const cards = document.querySelectorAll('.card-hover');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            gsap.to(card, { y: -8, duration: 0.3, ease: 'power2.out' });
        });
        card.addEventListener('mouseleave', () => {
            gsap.to(card, { y: 0, duration: 0.3, ease: 'power2.out' });
        });
    });
};

// ==========================================================================
// Smooth Scroll for Anchor Links
// ==========================================================================

const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            // Don't prevent default for # only
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                
                const headerOffset = 100;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
};

// ==========================================================================
// Form Validation
// ==========================================================================

const initFormValidation = () => {
    const form = document.querySelector('form[action*="formspree.io"]');
    if (!form) return;

    const inputs = form.querySelectorAll('input, textarea, select');
    const fileInput = form.querySelector('input[type="file"][name="file"]');
    const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
    const ACCEPT_EXT = ['csv','doc','docx','pdf','txt','xls','xlsx','jpg','jpeg','png','gif','svg','webp'];
    const linkInput = form.querySelector('input[name="link"]');

    const isSafeUrl = (val) => {
        if (!val) return true;
        const trimmed = val.trim();
        if (trimmed.length > 2048) return false;
        let u;
        try {
            u = new URL(trimmed);
        } catch (_) {
            return false;
        }
        if (!['https:', 'http:'].includes(u.protocol)) return false;
        const banned = ['javascript:', 'data:', 'file:', 'blob:', 'chrome:', 'chrome-extension:'];
        if (banned.includes(u.protocol)) return false;
        return true;
    };

    // Add blur event listeners for real-time validation
    inputs.forEach(input => {
        input.addEventListener('blur', () => {
            if (!input.checkValidity()) {
                input.classList.add('border-red-500');
            } else {
                input.classList.remove('border-red-500');
            }
        });

        input.addEventListener('input', () => {
            if (input.classList.contains('border-red-500')) {
                input.classList.remove('border-red-500');
            }
        });
    });

    // Ensure a status container exists
    let status = form.querySelector('#form-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'form-status';
        status.className = 'text-sm mt-3';
        form.appendChild(status);
    }

    const setSubmitting = (submitting) => {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = submitting;
            btn.classList.toggle('loading', submitting);
        }
    };

    const submitForm = async () => {
        setSubmitting(true);
        status.textContent = '';
        try {
            const formData = new FormData(form);
            // Validate file if present
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const f = fileInput.files[0];
                const ext = (f.name.split('.').pop() || '').toLowerCase();
                if (!ACCEPT_EXT.includes(ext)) {
                    status.className = 'text-sm mt-3 text-red-700';
                    status.textContent = 'Unsupported file type. Please upload one of: CSV, DOC, DOCX, PDF, TXT, XLS, XLSX, JPG, JPEG, PNG, GIF, SVG, WEBP.';
                    setSubmitting(false);
                    return;
                }
                if (f.size > MAX_FILE_BYTES) {
                    status.className = 'text-sm mt-3 text-red-700';
                    status.textContent = 'File too large (max 5MB). Please upload a smaller file.';
                    setSubmitting(false);
                    return;
                }
            }
            // Validate link if present
            if (linkInput && linkInput.value && !isSafeUrl(linkInput.value)) {
                status.className = 'text-sm mt-3 text-red-700';
                status.textContent = 'Please enter a valid link starting with https:// or http://';
                setSubmitting(false);
                return;
            }
            const res = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' },
                mode: 'cors',
                credentials: 'omit',
                redirect: 'follow'
            });
            if (res.ok) {
                form.reset();
                // Replace form with mini-game easter egg
                const card = form.parentElement;
                if (card) {
                    card.innerHTML = `
                        <h2 class="text-2xl font-bold text-indigodeep mb-2">Thanks — message sent!</h2>
                        <p class="text-sm text-chocolate mb-4">Enjoy a quick game while you’re here.</p>
                        <div id="mini-game-root" class="w-full bg-white border border-chocolate/10 rounded-xl p-4"></div>
                    `;
                    initMiniGame('mini-game-root');
                }
            } else {
                status.className = 'text-sm mt-3 text-red-700';
                status.textContent = 'Sorry, something went wrong. Trying fallback...';
                // Fallback to normal submission (opens in new tab)
                try {
                    form.setAttribute('target', '_blank');
                    form.submit();
                } catch (_) {
                    // keep error visible
                    status.textContent = 'Sorry, something went wrong. Please try again or email hello@estivanayramia.com.';
                }
            }
        } catch (err) {
            status.className = 'text-sm mt-3 text-red-700';
            status.textContent = 'Network error detected. Opening fallback submit...';
            // Fallback to normal submission (opens in new tab)
            try {
                form.setAttribute('target', '_blank');
                form.submit();
            } catch (_) {
                status.textContent = 'Network error. Please check your connection or email hello@estivanayramia.com.';
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Form submission handling
    form.addEventListener('submit', (e) => {
        let isValid = true;
        
        inputs.forEach(input => {
            if (!input.checkValidity()) {
                isValid = false;
                input.classList.add('border-red-500');
            }
        });

        e.preventDefault();
        if (!isValid) {
            // Focus on first invalid field
            const firstInvalid = form.querySelector('.border-red-500');
            if (firstInvalid) firstInvalid.focus();
            status.className = 'text-sm mt-3 text-red-700';
            status.textContent = 'Please complete required fields highlighted in red.';
            return;
        }
        submitForm();
    });
};

// ==========================================================================
// Mini Game: Catch the Orbs
// ==========================================================================

const initMiniGame = (rootId) => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const highKey = 'mgHighScore';
    const lbKey = 'mgLeaderboard';
    const highScore = parseInt(localStorage.getItem(highKey) || '0', 10);
    const loadLeaderboard = () => {
        try {
            const raw = localStorage.getItem(lbKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(r => typeof r.name === 'string' && typeof r.score === 'number').slice(0, 25);
        } catch (_) { return []; }
    };
    const saveLeaderboard = (list) => {
        try { localStorage.setItem(lbKey, JSON.stringify(list.slice(0,25))); } catch (_) {}
    };
    let leaderboard = loadLeaderboard();

    root.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-medium text-indigodeep">Score: <span id="mg-score">0</span> <span id="mg-mult" class="ml-2 text-ink/60">x1</span></div>
            <div class="text-xs text-ink/60">Best: <span id="mg-best">${highScore}</span></div>
        </div>
        <div class="flex items-center justify-between mb-2">
            <div class="text-xs text-ink/60">Lives: <span id="mg-lives">❤❤❤</span></div>
            <button id="mg-start" class="text-xs bg-indigodeep text-white px-3 py-1 rounded-full">Start</button>
        </div>
        <canvas id="mg-canvas" class="w-full rounded border border-chocolate/10" style="touch-action: none; height: 320px;"></canvas>
        <p class="text-xs text-ink/60 mt-2">Catch the orbs. Golden orbs are bonus. Tap/drag on mobile, or use ◀ ▶.</p>
    `;

    const canvas = root.querySelector('#mg-canvas');
    const scoreEl = root.querySelector('#mg-score');
    const multEl = root.querySelector('#mg-mult');
    const bestEl = root.querySelector('#mg-best');
    const livesEl = root.querySelector('#mg-lives');
    const startBtn = root.querySelector('#mg-start');
    const ctx = canvas.getContext('2d');

    const DPR = window.devicePixelRatio || 1;
    const PADDLE_W = 90;
    const PADDLE_H = 12;

    const state = {
        running: false,
        score: 0,
        best: highScore,
        w: 0,
        h: 0,
        paddle: { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H },
        orbs: [],
        particles: [],
        lastSpawn: 0,
        orbInterval: 900,
        baseSpeed: 2.2,
        lives: 3,
        combo: 0,
        comboTimer: 0,
        shake: 0,
        t: 0
    };

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width * DPR);
        canvas.height = Math.floor(320 * DPR);
        state.w = canvas.width;
        state.h = canvas.height;
        state.paddle.y = state.h - 30 * DPR;
        if (state.paddle.x === 0) state.paddle.x = state.w / 2 - (state.paddle.w * DPR) / 2;
        draw();
    };

    const heartStr = (n) => '❤❤❤'.slice(0, n);
    const vibrate = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

    const addParticles = (x, y, color = '#212842', count = 10) => {
        for (let i = 0; i < count; i++) {
            state.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 3 * DPR,
                vy: (-Math.random()) * 3 * DPR,
                life: 600,
                color,
                r: 2 * DPR
            });
        }
    };

    const spawnOrb = () => {
        const r = (8 + Math.random() * 2) * DPR;
        const x = r + Math.random() * (state.w - 2*r);
        // 15% chance to be gold bonus orb
        const isGold = Math.random() < 0.15;
        const color = isGold ? '#eab308' : '#362017';
        const vy = (state.baseSpeed + Math.random()*1.5 + state.score*0.01) * DPR;
        state.orbs.push({ x, y: r+2, r, vy, color, type: isGold ? 'gold' : 'normal' });
    };

    const drawBackground = () => {
        const grad = ctx.createLinearGradient(0, 0, state.w, state.h);
        const h = (Math.sin(state.t*0.001) + 1) / 2; // 0..1
        grad.addColorStop(0, `rgba(${210 + 20*h | 0}, ${200 + 10*h | 0}, 180, 0.6)`);
        grad.addColorStop(1, `rgba(${200}, ${190}, ${170}, 0.6)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, state.w, state.h);
    };

    const draw = () => {
        const shakeX = state.shake ? (Math.random()*state.shake - state.shake/2) : 0;
        const shakeY = state.shake ? (Math.random()*state.shake - state.shake/2) : 0;
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0,0,state.w,state.h);
        ctx.translate(shakeX, shakeY);
        drawBackground();

        // paddle (glow if combo)
        const glow = Math.min(state.combo, 6);
        ctx.shadowColor = 'rgba(33,40,66,0.6)';
        ctx.shadowBlur = glow * 2 * DPR;
        ctx.fillStyle = '#212842';
        ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.w*DPR, state.paddle.h*DPR);
        ctx.shadowBlur = 0;

        // particles
        state.particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life/600);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        });

        // orbs
        state.orbs.forEach(o => {
            ctx.beginPath();
            ctx.fillStyle = o.color;
            ctx.shadowColor = o.type === 'gold' ? 'rgba(234,179,8,0.6)' : 'rgba(54,32,23,0.3)';
            ctx.shadowBlur = o.type === 'gold' ? 8*DPR : 4*DPR;
            ctx.arc(o.x, o.y, o.r, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });
    };

    const step = (ts) => {
        if (!state.running) return;
        if (!state.last) state.last = ts;
        const dt = ts - state.last;
        state.t += dt;
        state.last = ts;
        state.comboTimer += dt;
        if (state.comboTimer > 1600 && state.combo > 0) {
            state.combo = 0;
            multEl.textContent = 'x1';
        }
        if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.5*DPR);

        // spawn
        if (ts - state.lastSpawn > state.orbInterval) {
            spawnOrb();
            state.lastSpawn = ts;
            if (state.orbInterval > 420) state.orbInterval -= 8; // ramp difficulty
        }

        // update orbs
        const pw = state.paddle.w * DPR;
        const ph = state.paddle.h * DPR;
        const px = state.paddle.x;
        const py = state.paddle.y;
        state.orbs.forEach(o => { o.y += o.vy; });

        // particles update
        for (let i = state.particles.length-1; i>=0; i--) {
            const p = state.particles[i];
            p.x += p.vx; p.y += p.vy; p.vy += 0.04*DPR; p.life -= dt;
            if (p.life <= 0) state.particles.splice(i,1);
        }

        // collisions and misses
        for (let i = state.orbs.length - 1; i >= 0; i--) {
            const o = state.orbs[i];
            if (o.y + o.r >= py && o.x >= px && o.x <= px + pw) {
                // caught
                const bonus = o.type === 'gold' ? 5 : 1;
                state.combo = Math.min(state.combo + 1, 9);
                state.comboTimer = 0;
                const mult = 1 + Math.floor(state.combo/3); // x1..x4
                state.score += bonus * mult;
                scoreEl.textContent = state.score;
                multEl.textContent = 'x' + mult;
                addParticles(o.x, py, o.color, o.type === 'gold' ? 18 : 10);
                state.shake = Math.min(6*DPR, state.shake + (o.type==='gold'?4:2));
                vibrate(o.type==='gold'?25:12);
                state.orbs.splice(i,1);
                // confetti on milestones
                if (state.score % 10 === 0) addParticles(o.x, o.y, '#e1d4c2', 24);
            } else if (o.y - o.r > state.h) {
                // missed
                state.orbs.splice(i,1);
                state.lives -= 1;
                livesEl.textContent = heartStr(state.lives);
                state.combo = 0; multEl.textContent = 'x1';
                state.shake = 10*DPR; vibrate(60);
                if (state.lives <= 0) { endGame(); return; }
            }
        }

        draw();
        requestAnimationFrame(step);
    };

    const endGame = () => {
        state.running = false;
        if (state.score > state.best) {
            state.best = state.score; localStorage.setItem(highKey, String(state.best));
            bestEl.textContent = state.best;
        }
        startBtn.textContent = 'Restart';
        const endMsg = document.createElement('div');
        endMsg.className = 'mt-3 text-sm text-indigodeep mg-end';
        endMsg.innerHTML = `
            <div class="mb-1 font-medium">Game over! Final score: ${state.score}</div>
            <p class="text-ink/80 mb-2">Hope you enjoyed this little easter egg — I’ll be in touch soon.</p>
            <p class="text-ink/60">Want more surprises? Explore a few corners of the site:</p>
            <div class="mt-2 flex flex-wrap gap-2">
                <a href="overview.html" class="text-xs px-3 py-1 rounded-full border border-chocolate/20 text-indigodeep hover:bg-beige transition-colors">Overview</a>
                <a href="deep-dive.html" class="text-xs px-3 py-1 rounded-full border border-chocolate/20 text-indigodeep hover:bg-beige transition-colors">Deep Dive</a>
                <a href="projects.html" class="text-xs px-3 py-1 rounded-full border border-chocolate/20 text-indigodeep hover:bg-beige transition-colors">Projects</a>
            </div>
            ${state.score > 0 ? `<div class='mt-4 border-t border-chocolate/10 pt-3'>
                <p class='text-ink/70 mb-2'>Submit your score to the local leaderboard (device-only) or view current rankings.</p>
                <div class='flex flex-col sm:flex-row gap-2 sm:items-center'>
                    <input id='mg-name' maxlength='16' placeholder='Username (3-16 chars)' class='flex-1 px-3 py-2 text-sm border border-chocolate/20 rounded focus:outline-none focus:ring-2 focus:ring-indigodeep'/>
                    <button id='mg-save' class='text-xs bg-indigodeep text-white px-4 py-2 rounded-full'>Save Score</button>
                    <button id='mg-view' class='text-xs bg-chocolate text-white px-4 py-2 rounded-full'>View Leaderboard</button>
                </div>
                <div id='mg-name-error' class='mt-2 text-xs text-red-600 hidden'></div>
                <div id='mg-leaderboard' class='mt-3 hidden'></div>
            </div>`: ''}
        `;
        root.appendChild(endMsg);

        // Leaderboard logic
        const nameInput = endMsg.querySelector('#mg-name');
        const saveBtn = endMsg.querySelector('#mg-save');
        const viewBtn = endMsg.querySelector('#mg-view');
        const errorBox = endMsg.querySelector('#mg-name-error');
        const lbBox = endMsg.querySelector('#mg-leaderboard');

        if (!saveBtn || !viewBtn) return; // score == 0 case

        const banned = [
            'fuck','shit','bitch','cunt','dick','piss','cock','asshole','retard','fag','faggot','nigger','nigga','spic','chink','whore','slut','bastard','twat','rape','cum','penis','vagina'
        ];

        const normalize = (s) => s.toLowerCase()
            .replace(/[@]/g,'a').replace(/[$]/g,'s').replace(/0/g,'o').replace(/1/g,'i').replace(/3/g,'e').replace(/4/g,'a').replace(/5/g,'s').replace(/7/g,'t');

        const isClean = (s) => {
            const norm = normalize(s).replace(/[_-]/g,'');
            return !banned.some(b => norm.includes(b));
        };

        const validPattern = /^[A-Za-z0-9_-]{3,16}$/;

        const renderLeaderboard = () => {
            if (!lbBox) return;
            let html = `<table class='w-full text-xs'><thead><tr class='text-indigodeep'><th class='text-left pb-1'>#</th><th class='text-left pb-1'>User</th><th class='text-right pb-1'>Score</th></tr></thead><tbody>`;
            leaderboard.slice(0,10).forEach((r,i) => {
                html += `<tr class='border-t border-chocolate/10'><td class='py-1 pr-2'>${i+1}</td><td class='py-1 pr-2'>${r.name}</td><td class='py-1 text-right'>${r.score}</td></tr>`;
            });
            if (leaderboard.length === 0) html += `<tr><td colspan='3' class='py-2 text-ink/60'>No scores yet.</td></tr>`;
            html += `</tbody></table>`;
            lbBox.innerHTML = html;
        };

        viewBtn.addEventListener('click', () => {
            lbBox.classList.toggle('hidden');
            if (!lbBox.classList.contains('hidden')) {
                renderLeaderboard();
                viewBtn.textContent = 'Hide Leaderboard';
            } else {
                viewBtn.textContent = 'View Leaderboard';
            }
        });

        saveBtn.addEventListener('click', () => {
            const name = (nameInput.value || '').trim();
            if (!validPattern.test(name)) {
                errorBox.textContent = 'Username must be 3-16 chars: letters, numbers, _ or - only.';
                errorBox.classList.remove('hidden');
                return;
            }
            if (!isClean(name)) {
                errorBox.textContent = 'Please choose a different name (profanity not allowed).';
                errorBox.classList.remove('hidden');
                return;
            }
            errorBox.classList.add('hidden');
            leaderboard.push({ name, score: state.score, ts: Date.now() });
            leaderboard.sort((a,b) => b.score - a.score || a.ts - b.ts);
            leaderboard = leaderboard.slice(0,25);
            saveLeaderboard(leaderboard);
            renderLeaderboard();
            lbBox.classList.remove('hidden');
            viewBtn.textContent = 'Hide Leaderboard';
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saved';
        });
    };

    const start = () => {
        // reset
        state.running = true;
        state.score = 0; scoreEl.textContent = '0';
        state.orbs = []; state.particles = [];
        state.lastSpawn = 0; state.orbInterval = 900; state.baseSpeed = 2.2;
        state.lives = 3; livesEl.textContent = heartStr(3);
        state.combo = 0; multEl.textContent = 'x1';
        state.t = 0; state.shake = 0;
        [...root.querySelectorAll('.mg-end')].forEach(n => n.remove());
        requestAnimationFrame(step);
    };

    // Controls
    const moveTo = (clientX) => {
        const rect = canvas.getBoundingClientRect();
        let x = (clientX - rect.left) * DPR - (state.paddle.w * DPR)/2;
        x = Math.max(0, Math.min(x, state.w - state.paddle.w*DPR));
        state.paddle.x = x;
    };
    canvas.addEventListener('mousemove', (e) => moveTo(e.clientX));
    canvas.addEventListener('touchstart', (e) => { if (e.touches[0]) moveTo(e.touches[0].clientX); }, {passive:true});
    canvas.addEventListener('touchmove', (e) => { if (e.touches[0]) moveTo(e.touches[0].clientX); }, {passive:true});
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') moveTo((canvas.getBoundingClientRect().left + (state.paddle.x/DPR)) - 24);
        if (e.key === 'ArrowRight') moveTo((canvas.getBoundingClientRect().left + (state.paddle.x/DPR)) + 24);
    });

    startBtn.addEventListener('click', () => {
        startBtn.textContent = 'Playing...';
        start();
    });

    window.addEventListener('resize', resize);
    resize();
    draw();
};

// ==========================================================================
// Lazy Loading
// ==========================================================================

const initLazyLoading = () => {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    } else {
        // Fallback for older browsers
        images.forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
};

// ==========================================================================
// Chatbot Bubble Customization
// ==========================================================================

const initChatbotBubble = () => {
    const bubbleId = 'chatbase-bubble-button';
    const attachLogic = () => {
        const bubble = document.getElementById(bubbleId) || document.querySelector('#' + bubbleId);
        if (!bubble) return;

        // Helper: compute perceived brightness of a rgb(a) color
        const brightness = (rgbString) => {
            if (!rgbString) return 255;
            const m = rgbString.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
            if (!m) return 255;
            const r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
            // standard luminance approximation
            return 0.299*r + 0.587*g + 0.114*b;
        };

        const evaluateBackground = () => {
            // sample point where bubble sits (slightly inward)
            const x = window.innerWidth - 40;
            const y = window.innerHeight - 40;
            const el = document.elementFromPoint(x, y);
            if (!el) return;
            const bg = getComputedStyle(el).backgroundColor;
            const b = brightness(bg);
            // toggle invert if background is dark
            if (b < 100) {
                bubble.classList.add('chatbot-invert');
            } else {
                bubble.classList.remove('chatbot-invert');
            }
        };

        // Throttle scroll/resize
        let ticking = false;
        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    evaluateBackground();
                    ticking = false;
                });
                ticking = true;
            }
        };

        ['scroll','resize'].forEach(evt => window.addEventListener(evt, onScroll, { passive: true }));
        evaluateBackground();

        // Observe chatbot widget open/close state
        const observeChatState = () => {
            let minOverlay = null;
            
            const findChatWidget = () => {
                // Look for the chatbase window div first, then iframe
                return document.getElementById('chatbase-bubble-window') ||
                       document.querySelector('iframe[src*="chatbase"]') || 
                       document.querySelector('iframe[id*="chatbase"]') ||
                       document.querySelector('iframe[title*="chatbase"]') ||
                       document.querySelector('iframe[class*="chatbase"]') ||
                       Array.from(document.querySelectorAll('iframe')).find(f => {
                           try { return f.src && f.src.includes('chatbase'); } catch(e) { return false; }
                       });
            };

            const alignMinButton = (chatWidget) => {
                if (!minOverlay || !chatWidget) return;
                const rect = chatWidget.getBoundingClientRect();
                // Fine-tuned alignment constants for symmetry with ellipsis button
                const topOffset = 14; // vertical tweak
                const ellipsisGap = 14; // space from right edge to ellipsis button
                const dashWidth = 36; // size of our minimize button
                const gapBetween = 6; // gap between dash and ellipsis
                const rightOffset = ellipsisGap + dashWidth + gapBetween;
                minOverlay.style.top = `${rect.top + topOffset}px`;
                minOverlay.style.right = `${window.innerWidth - rect.right + rightOffset}px`;
                minOverlay.style.display = 'block';
            };

            const checkState = () => {
                const chatWidget = findChatWidget();
                let isOpen = false;
                if (chatWidget) {
                    const style = getComputedStyle(chatWidget);
                    const rect = chatWidget.getBoundingClientRect();
                    isOpen = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
                }
                if (isOpen) {
                    bubble.classList.add('chatbot-open');
                    alignMinButton(chatWidget);
                } else {
                    bubble.classList.remove('chatbot-open');
                    if (minOverlay) minOverlay.style.display = 'none';
                }
                return chatWidget;
            };

            // Inject minimize button overlay
            const createMinimizeButton = () => {
                if (minOverlay) return;
                
                minOverlay = document.createElement('button');
                minOverlay.className = 'chatbase-minimize-overlay';
                minOverlay.innerHTML = '—';
                minOverlay.title = 'Minimize chat';
                minOverlay.style.cssText = `
                    position: fixed;
                    background: transparent;
                    border: none;
                    font-size: 18px;
                    font-weight: 500;
                    line-height: 1;
                    cursor: pointer;
                    padding: 0;
                    margin: 0;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255,255,255,0.85);
                    z-index: 2147483647;
                    transition: color 0.15s ease, background 0.15s ease;
                    pointer-events: auto;
                    text-align: center;
                    border-radius: 4px;
                    backdrop-filter: blur(2px);
                    -webkit-backdrop-filter: blur(2px);
                    display: none;
                `;
                
                minOverlay.onmouseover = () => { minOverlay.style.background = 'rgba(255,255,255,0.12)'; };
                minOverlay.onmouseout = () => { minOverlay.style.background = 'transparent'; };
                minOverlay.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    bubble.click();
                };
                
                document.body.appendChild(minOverlay);
            };

            // Run checks periodically
            setInterval(checkState, 250);
            window.addEventListener('resize', () => { const cw = findChatWidget(); if (cw) alignMinButton(cw); });
            
            createMinimizeButton();
            checkState();
            
            // Edge / corner hover & drag resize (no visible handles)
            const setupCustomResize = () => {
                const chatWindow = document.getElementById('chatbase-bubble-window');
                if (!chatWindow || chatWindow.dataset.edgeResizeSetup) return;
                chatWindow.dataset.edgeResizeSetup = 'true';

                // Load saved size
                const savedWidth = localStorage.getItem('chatbaseWidth');
                const savedHeight = localStorage.getItem('chatbaseHeight');
                if (savedWidth) chatWindow.style.width = savedWidth;
                if (savedHeight) chatWindow.style.height = savedHeight;

                // Enlarged interactive edge thickness for easier grab
                const EDGE_THRESHOLD = 28;
                let isResizing = false;
                let mode = null; // left,right,top,bottom,top-left,...
                let startX, startY, startW, startH;

                const getMode = (e) => {
                    const rect = chatWindow.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const nearLeft = x <= EDGE_THRESHOLD;
                    const nearRight = x >= rect.width - EDGE_THRESHOLD;
                    const nearTop = y <= EDGE_THRESHOLD;
                    const nearBottom = y >= rect.height - EDGE_THRESHOLD;
                    if (nearLeft && nearTop) return 'top-left';
                    if (nearRight && nearTop) return 'top-right';
                    if (nearLeft && nearBottom) return 'bottom-left';
                    if (nearRight && nearBottom) return 'bottom-right';
                    if (nearLeft) return 'left';
                    if (nearRight) return 'right';
                    if (nearTop) return 'top';
                    if (nearBottom) return 'bottom';
                    return null;
                };

                const cursorMap = {
                    left:'ew-resize', right:'ew-resize', top:'ns-resize', bottom:'ns-resize',
                    'top-left':'nwse-resize','bottom-right':'nwse-resize','top-right':'nesw-resize','bottom-left':'nesw-resize'
                };

                chatWindow.addEventListener('mousemove', (e) => {
                    if (isResizing) return;
                    mode = getMode(e);
                    if (mode) {
                        chatWindow.classList.add(mode.includes('-') ? 'resize-hover-corner' : 'resize-hover-edge');
                    } else {
                        chatWindow.classList.remove('resize-hover-edge','resize-hover-corner');
                    }
                });

                chatWindow.addEventListener('mouseleave', () => {
                    if (isResizing) return;
                    mode = null;
                    chatWindow.style.cursor = 'default';
                    chatWindow.classList.remove('resize-hover-edge','resize-hover-corner');
                });

                const startResize = (e) => {
                    if (!mode) return;
                    e.preventDefault();
                    isResizing = true;
                    startX = e.clientX; startY = e.clientY;
                    startW = parseInt(getComputedStyle(chatWindow).width,10);
                    startH = parseInt(getComputedStyle(chatWindow).height,10);
                    document.body.style.userSelect = 'none';
                    document.addEventListener('mousemove', performResize);
                    document.addEventListener('mouseup', endResize);
                };

                const performResize = (e) => {
                    if (!isResizing) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    let w = startW;
                    let h = startH;
                    if (['right','top-right','bottom-right'].includes(mode)) w = startW + dx;
                    if (['left','top-left','bottom-left'].includes(mode)) w = startW - dx;
                    if (['bottom','bottom-left','bottom-right'].includes(mode)) h = startH + dy;
                    if (['top','top-left','top-right'].includes(mode)) h = startH - dy;
                    // Constraints (kept same)
                    w = Math.max(320, Math.min(600, w));
                    h = Math.max(400, Math.min(700, h));
                    chatWindow.style.width = w + 'px';
                    chatWindow.style.height = h + 'px';
                };

                const endResize = () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', performResize);
                    document.removeEventListener('mouseup', endResize);
                    document.body.style.userSelect = '';
                    chatWindow.style.cursor = 'default';
                    chatWindow.classList.remove('resize-hover-edge','resize-hover-corner');
                    localStorage.setItem('chatbaseWidth', chatWindow.style.width);
                    localStorage.setItem('chatbaseHeight', chatWindow.style.height);
                    mode = null;
                };

                chatWindow.addEventListener('mousedown', startResize);

                // Inject explicit overlay handles to improve hit area above iframe
                const addHandles = () => {
                    const existing = chatWindow.querySelector('.chatbase-edge-handle');
                    if (existing) return; // already added
                    const edgeClasses = ['top','right','bottom','left'];
                    const cornerClasses = ['tl','tr','bl','br'];
                    edgeClasses.forEach(c => {
                        const h = document.createElement('div');
                        h.className = 'chatbase-edge-handle ' + c;
                        h.addEventListener('mousedown', (e) => { mode = c; startResize(e); });
                        chatWindow.appendChild(h);
                    });
                    cornerClasses.forEach(c => {
                        const h = document.createElement('div');
                        h.className = 'chatbase-corner-handle ' + c;
                        h.addEventListener('mousedown', (e) => { mode = cornerMap[c]; startResize(e); });
                        chatWindow.appendChild(h);
                    });
                };

                const cornerMap = { tl:'top-left', tr:'top-right', bl:'bottom-left', br:'bottom-right' };
                addHandles();
            };
            
            // Try to setup resize after chat appears
            setTimeout(setupCustomResize, 500);
            setInterval(setupCustomResize, 1000);
        };

        observeChatState();
    };

    // Chatbase script loads bubble asynchronously; poll briefly until present
    let attempts = 0;
    const poll = () => {
        if (document.getElementById(bubbleId)) {
            attachLogic();
        } else if (attempts < 40) { // ~4s max at 100ms interval
            attempts++;
            setTimeout(poll, 100);
        }
    };
    poll();
};

// ==========================================================================
// Initialization
// ==========================================================================

const init = () => {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initDarkMode();
            initMobileMenu();
            initAnimations();
            initSmoothScroll();
            initFormValidation();
            initLazyLoading();
            initDraggableResizableChat();
        });
    } else {
        // DOM already loaded
        initDarkMode();
        initMobileMenu();
        initAnimations();
        initSmoothScroll();
        initFormValidation();
        initLazyLoading();
        initDraggableResizableChat();
    }
};

// Start the site
init();

// ==========================================================================
// Draggable + Proportional Resizable Chat Component
// Replaces previous Chatbase bubble logic with unified bubble + panel behavior
// ==========================================================================

function initDraggableResizableChat() {
    // Prevent duplicate initialization
    if (window.__chatPanelInit) return; window.__chatPanelInit = true;

    const SAVONIE_IMG = "assets/img/savonie-icon.jpg"; // path used in CSS background
    const STORAGE_KEYS = {
        open: 'chatPanelOpen',
        left: 'chatPanelLeft',
        top: 'chatPanelTop',
        width: 'chatPanelWidth',
        height: 'chatPanelHeight'
    };

    const ratioClamp = (w, h) => {
        // Limits from CSS
        const MIN_W = 320, MAX_W = 600, MIN_H = 400, MAX_H = 700;
        w = Math.max(MIN_W, Math.min(MAX_W, w));
        h = Math.max(MIN_H, Math.min(MAX_H, h));
        return [w, h];
    };

    // Bubble button
    let bubble = document.getElementById('custom-chat-bubble');
    if (!bubble) {
        bubble = document.createElement('button');
        bubble.id = 'custom-chat-bubble';
        bubble.type = 'button';
        bubble.setAttribute('aria-label','Open chat');
        document.body.appendChild(bubble);
    }

    // Panel container
    let panel = document.getElementById('custom-chat-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'custom-chat-panel';
        panel.className = 'draggable-chat-panel';
        panel.innerHTML = `
            <div class="draggable-chat-header" role="toolbar" aria-label="Chat window header">
                <span class="draggable-chat-title">Savonie</span>
                <div class="draggable-chat-actions">
                    <button type="button" class="chat-minimize" aria-label="Minimize">—</button>
                </div>
            </div>
            <div class="draggable-chat-content">
                <iframe title="Savonie" data-chat-iframe src="https://www.chatbase.co/chatbot-iframe/fe5slOh95Jd3FwQHUxFDP?theme=dark"></iframe>
                <div class="chat-corner-handle tl" data-corner="tl">◤</div>
                <div class="chat-corner-handle tr" data-corner="tr">◥</div>
                <div class="chat-corner-handle bl" data-corner="bl">◣</div>
                <div class="chat-corner-handle br" data-corner="br">◢</div>
            </div>`;
        document.body.appendChild(panel);
    }

    // Dynamic theme for iframe
    const setIframeTheme = () => {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const iframe = panel.querySelector('iframe[data-chat-iframe]');
        if (iframe) {
            const base = 'https://www.chatbase.co/chatbot-iframe/fe5slOh95Jd3FwQHUxFDP';
            iframe.src = `${base}?theme=${theme === 'dark' ? 'dark' : 'light'}`;
        }
    };
    setIframeTheme();
    const mo = new MutationObserver(setIframeTheme);
    mo.observe(document.documentElement,{ attributes:true, attributeFilter:['data-theme'] });

    // State restoration
    const restoreState = () => {
        const open = localStorage.getItem(STORAGE_KEYS.open) === 'true';
        const savedLeft = localStorage.getItem(STORAGE_KEYS.left);
        const savedTop = localStorage.getItem(STORAGE_KEYS.top);
        const savedW = localStorage.getItem(STORAGE_KEYS.width);
        const savedH = localStorage.getItem(STORAGE_KEYS.height);
        if (savedW && savedH) {
            panel.style.width = savedW + 'px';
            panel.style.height = savedH + 'px';
        }
        if (savedLeft && savedTop) {
            panel.style.left = savedLeft + 'px';
            panel.style.top = savedTop + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }
        if (open) openPanel();
    };

    // Open/close panel helpers
    const openPanel = () => {
        panel.classList.add('open');
        bubble.classList.add('chat-open-hide-bubble');
        localStorage.setItem(STORAGE_KEYS.open, 'true');
    };
    const closePanel = () => {
        panel.classList.remove('open');
        bubble.classList.remove('chat-open-hide-bubble');
        localStorage.setItem(STORAGE_KEYS.open, 'false');
    };

    bubble.addEventListener('click', () => {
        panel.classList.contains('open') ? closePanel() : openPanel();
    });

    // Header actions
    const minimizeBtn = panel.querySelector('.chat-minimize');
    minimizeBtn.addEventListener('click', () => closePanel());

    // Drag logic (header only) - using Pointer Events API
    const header = panel.querySelector('.draggable-chat-header');
    let dragging = false; let dragOffsetX = 0; let dragOffsetY = 0; let activePointerId = null;
    
    const onDragMove = (e) => {
        if (!dragging || e.pointerId !== activePointerId) return;
        e.preventDefault();
        let x = e.clientX - dragOffsetX;
        let y = e.clientY - dragOffsetY;
        // Constrain within viewport
        const pw = panel.offsetWidth; const ph = panel.offsetHeight;
        x = Math.max(0, Math.min(x, window.innerWidth - pw));
        y = Math.max(0, Math.min(y, window.innerHeight - ph));
        panel.style.left = x + 'px'; panel.style.top = y + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
    };
    
    const endDrag = (e) => {
        if (!dragging || e.pointerId !== activePointerId) return;
        e.preventDefault();
        dragging = false;
        activePointerId = null;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        panel.classList.remove('dragging');
        localStorage.setItem(STORAGE_KEYS.left, parseInt(panel.style.left,10));
        localStorage.setItem(STORAGE_KEYS.top, parseInt(panel.style.top,10));
        header.releasePointerCapture(e.pointerId);
        header.removeEventListener('pointermove', onDragMove);
        header.removeEventListener('pointerup', endDrag);
        header.removeEventListener('pointercancel', endDrag);
    };
    
    const startDrag = (e) => {
        if (e.target.closest('.draggable-chat-actions')) return; // don't drag from buttons
        e.preventDefault();
        dragging = true;
        activePointerId = e.pointerId;
        panel.classList.add('dragging');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'move';
        const rect = panel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        header.setPointerCapture(e.pointerId);
        header.addEventListener('pointermove', onDragMove, {passive: false});
        header.addEventListener('pointerup', endDrag, {passive: false});
        header.addEventListener('pointercancel', endDrag, {passive: false});
    };
    
    header.addEventListener('pointerdown', startDrag);

    // Proportional resize via corner handles - using Pointer Events API
    let resizing = false; let startW=0, startH=0, startX=0, startY=0, corner=''; let aspect = 420/560; let activeResizePointerId = null; let activeHandle = null;
    aspect = panel.offsetWidth / panel.offsetHeight || aspect;

    const onResizeMove = (e) => {
        if (!resizing || !corner || e.pointerId !== activeResizePointerId) return;
        e.preventDefault();
        e.stopPropagation();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        // Decide scale factor based on corner
        let scaleDelta = 0;
        if (corner === 'tl') scaleDelta = (-dx - dy) / 2;
        if (corner === 'tr') scaleDelta = (dx - dy) / 2;
        if (corner === 'bl') scaleDelta = (-dx + dy) / 2;
        if (corner === 'br') scaleDelta = (dx + dy) / 2;
        let newW = startW + scaleDelta;
        let newH = newW / aspect;
        [newW, newH] = ratioClamp(newW, newH);
        panel.style.width = newW + 'px'; panel.style.height = newH + 'px';
        panel.classList.add('resizing');
    };
    const endResize = (e) => {
        if (!resizing || e.pointerId !== activeResizePointerId) return;
        e.preventDefault();
        resizing = false;
        corner = '';
        activeResizePointerId = null;
        panel.classList.remove('resizing');
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        localStorage.setItem(STORAGE_KEYS.width, parseInt(panel.style.width,10));
        localStorage.setItem(STORAGE_KEYS.height, parseInt(panel.style.height,10));
        if (activeHandle) {
            activeHandle.releasePointerCapture(e.pointerId);
            activeHandle.removeEventListener('pointermove', onResizeMove);
            activeHandle.removeEventListener('pointerup', endResize);
            activeHandle.removeEventListener('pointercancel', endResize);
            activeHandle = null;
        }
    };
    const startResize = (e, c, handle) => {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        corner = c;
        activeResizePointerId = e.pointerId;
        activeHandle = handle;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'nwse-resize';
        startW = panel.offsetWidth;
        startH = panel.offsetHeight;
        startX = e.clientX;
        startY = e.clientY;
        aspect = startW / startH;
        handle.setPointerCapture(e.pointerId);
        handle.addEventListener('pointermove', onResizeMove, {passive: false});
        handle.addEventListener('pointerup', endResize, {passive: false});
        handle.addEventListener('pointercancel', endResize, {passive: false});
    };
    panel.querySelectorAll('.chat-corner-handle').forEach(h => {
        h.addEventListener('pointerdown', (e) => startResize(e, h.dataset.corner, h));
    });

    // Keep panel inside viewport on resize of window
    window.addEventListener('resize', () => {
        if (!panel.classList.contains('open')) return;
        const rect = panel.getBoundingClientRect();
        let left = rect.left; let top = rect.top; let w = rect.width; let h = rect.height;
        if (left + w > window.innerWidth) left = window.innerWidth - w;
        if (top + h > window.innerHeight) top = window.innerHeight - h;
        left = Math.max(0,left); top = Math.max(0,top);
        panel.style.left = left + 'px'; panel.style.top = top + 'px';
        localStorage.setItem(STORAGE_KEYS.left, left);
        localStorage.setItem(STORAGE_KEYS.top, top);
    });

    restoreState();
}

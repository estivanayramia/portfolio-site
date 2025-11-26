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
        
        // Track analytics
        if (typeof clarity === 'function') {
            clarity('event', 'theme_toggle', { theme: newTheme });
        }
        
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

    // Add click event for menu toggle
    menuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        toggleMenu();
    });

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
            // Reset icon rotation
            const icon = menuToggle.querySelector('svg');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
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
        let trimmed = val.trim();

        // Automatically prepend https:// if missing
        if (!/^https?:\/\//i.test(trimmed)) {
            trimmed = `https://${trimmed}`;
        }

        let u;
        try {
            u = new URL(trimmed);
        } catch (_) {
            return false;
        }
        const banned = ['javascript:', 'data:', 'file:', 'blob:', 'chrome:', 'chrome-extension:'];
        if (banned.includes(u.protocol)) return false;
        return true;
    };

    // Update linkInput value on blur
    if (linkInput) {
        linkInput.addEventListener('blur', () => {
            if (linkInput.value && !/^https?:\/\//i.test(linkInput.value)) {
                linkInput.value = `https://${linkInput.value.trim()}`;
            }
        });
    }

    // Helper to show inline error
    const showError = (input, message) => {
        input.classList.add('border-red-500');
        let errorEl = input.parentElement.querySelector('.inline-error');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.className = 'inline-error text-xs text-red-600 mt-1';
            input.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
    };

    // Helper to clear inline error
    const clearError = (input) => {
        input.classList.remove('border-red-500');
        const errorEl = input.parentElement.querySelector('.inline-error');
        if (errorEl) errorEl.remove();
    };

    // Real-time validation for each input
    inputs.forEach(input => {
        // Validate on blur
        input.addEventListener('blur', () => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                showError(input, 'This field is required');
            } else if (input.type === 'email' && input.value && !input.checkValidity()) {
                showError(input, 'Please enter a valid email address');
            } else if (input.type === 'url' && input.value && !isSafeUrl(input.value)) {
                showError(input, 'Please enter a valid URL');
            } else if (!input.checkValidity()) {
                showError(input, input.validationMessage || 'Invalid input');
            } else {
                clearError(input);
            }
        });

        // Clear error as user types
        input.addEventListener('input', () => {
            if (input.classList.contains('border-red-500')) {
                // Re-validate on input to clear error when fixed
                if (input.checkValidity() && input.value.trim()) {
                    clearError(input);
                }
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
                        <p class="text-sm text-chocolate mb-4">Enjoy a quick game while you're here.</p>
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
            <p class="text-ink/80 mb-2">Hope you enjoyed this little easter egg — I'll be in touch soon.</p>
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
// Scroll to Top Button
// ==========================================================================

const initScrollToTop = () => {
    const scrollBtn = document.getElementById('scroll-to-top');
    console.log('Scroll button element:', scrollBtn);
    if (!scrollBtn) {
        console.error('Scroll-to-top button not found!');
        return;
    }

    // Show/hide button based on scroll position (25% of page height)
    const toggleButton = () => {
        const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollThreshold = pageHeight * 0.25;
        const currentScroll = window.scrollY;
        
        console.log('Scroll check:', { currentScroll, scrollThreshold, pageHeight });
        
        if (currentScroll > scrollThreshold) {
            scrollBtn.classList.add('show');
            console.log('Button shown');
        } else {
            scrollBtn.classList.remove('show');
            console.log('Button hidden');
        }
    };

    // Scroll to top smoothly
    const scrollToTop = () => {
        console.log('Scrolling to top');
        
        // Track analytics
        if (typeof clarity === 'function') {
            clarity('event', 'scroll_to_top_clicked');
        }
        
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    // Event listeners
    window.addEventListener('scroll', toggleButton);
    scrollBtn.addEventListener('click', scrollToTop);
    
    // Check initial position
    toggleButton();
};

// ==========================================================================
// Achievement System
// ==========================================================================

const initAchievements = () => {
    const STORAGE_KEY = 'portfolio_achievements';
    
    // Achievement definitions
    const achievements = {
        explorer: { id: 'explorer', name: 'Explorer', description: 'Visited all main pages', icon: '🗺️' },
        reader: { id: 'reader', name: 'Deep Diver', description: 'Read the full Deep Dive', icon: '📖' },
        gamer: { id: 'gamer', name: 'Game Master', description: 'Played the contact form game', icon: '🎮' },
        chatter: { id: 'chatter', name: 'Conversationalist', description: 'Opened the chat', icon: '💬' },
        nightOwl: { id: 'nightOwl', name: 'Night Owl', description: 'Toggled dark mode', icon: '🌙' },
        konami: { id: 'konami', name: 'Secret Discoverer', description: 'Found the Konami code', icon: '🎯' },
        networker: { id: 'networker', name: 'Networker', description: 'Visited social profiles', icon: '🔗' },
        formFiller: { id: 'formFiller', name: 'Messenger', description: 'Submitted the contact form', icon: '✉️' }
    };

    // Get achievements from storage
    const getAchievements = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    };

    // Save achievements to storage
    const saveAchievements = (unlocked) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
        } catch {}
    };

    // Unlock achievement
    const unlock = (achievementId) => {
        const unlocked = getAchievements();
        if (unlocked[achievementId]) return; // Already unlocked
        
        unlocked[achievementId] = {
            unlockedAt: new Date().toISOString(),
            ...achievements[achievementId]
        };
        saveAchievements(unlocked);
        showAchievementNotification(achievements[achievementId]);
    };

    // Show achievement notification
    const showAchievementNotification = (achievement) => {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-content">
                <div class="achievement-title">Achievement Unlocked!</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-desc">${achievement.description}</div>
            </div>
        `;
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    };

    // Track page visits
    const trackPageVisit = () => {
        const visitedKey = 'portfolio_visited_pages';
        try {
            const visited = JSON.parse(localStorage.getItem(visitedKey) || '[]');
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            if (!visited.includes(currentPage)) {
                visited.push(currentPage);
                localStorage.setItem(visitedKey, JSON.stringify(visited));
            }

            // Check if all main pages visited
            const mainPages = ['index.html', 'overview.html', 'deep-dive.html', 'about.html', 'projects.html', 'contact.html'];
            const visitedAll = mainPages.every(page => visited.includes(page));
            if (visitedAll) unlock('explorer');

            // Check specific pages
            if (currentPage === 'deep-dive.html') unlock('reader');
        } catch {}
    };

    // Track dark mode toggle
    const trackDarkMode = () => {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => unlock('nightOwl'));
        }
    };

    // Track external links (social profiles)
    const trackExternalLinks = () => {
        document.querySelectorAll('a[href*="linkedin.com"], a[href*="github.com"]').forEach(link => {
            link.addEventListener('click', () => unlock('networker'));
        });
    };

    // Initialize tracking
    trackPageVisit();
    trackDarkMode();
    trackExternalLinks();

    // Expose unlock function globally for form submission
    window.unlockAchievement = unlock;
};

// ==========================================================================
// Konami Code Easter Egg
// ==========================================================================

const initKonamiCode = () => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    const triggerEasterEgg = () => {
        // Dispatch custom event for analytics tracking
        window.dispatchEvent(new Event('konami-activated'));
        
        // Unlock achievement
        if (window.unlockAchievement) {
            window.unlockAchievement('konami');
        }

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'konami-modal';
        modal.innerHTML = `
            <div class="konami-content">
                <div class="konami-header">
                    <h2>🎮 You found the secret!</h2>
                    <button class="konami-close" aria-label="Close">&times;</button>
                </div>
                <div class="konami-body">
                    <p class="konami-message">Congratulations! You've unlocked the Konami code.</p>
                    <div class="konami-gift">
                        <div class="gift-emoji">🎁</div>
                        <p class="gift-text">Here's a little something:</p>
                        <code class="gift-code">RELIABILITY + EXECUTION = SUCCESS</code>
                        <p class="gift-subtext">The formula that drives everything on this site.</p>
                    </div>
                    <div class="konami-stats">
                        <p>You're one of the <strong>${Math.floor(Math.random() * 10) + 1}%</strong> who found this!</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => modal.classList.add('show'), 100);

        // Close handlers
        const close = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };
        modal.querySelector('.konami-close').addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    };

    // Listen for Konami code
    document.addEventListener('keydown', (e) => {
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                konamiIndex = 0;
                triggerEasterEgg();
            }
        } else {
            konamiIndex = 0;
        }
    });
};

// ==========================================================================
// PWA Service Worker Registration
// ==========================================================================

const initPWA = () => {
    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration.scope);

                    // Periodically check for updates
                    setInterval(() => {
                        registration.update();
                    }, 60000);

                    // If there's an update waiting, skip waiting and reload
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    // Listen for new service worker controlling the page
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        console.log('Service Worker controller changed. Reloading to apply latest.');
                        window.location.reload();
                    });

                    // Detect updates found
                    registration.addEventListener('updatefound', () => {
                        const newSW = registration.installing;
                        if (newSW) {
                            newSW.addEventListener('statechange', () => {
                                if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New content is available; activate immediately
                                    newSW.postMessage({ type: 'SKIP_WAITING' });
                                }
                            });
                        }
                    });
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        });
    }

    // Prompt to install PWA
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Optionally show install button (you can add this to your UI)
        console.log('PWA install prompt available');
    });
};

// ==========================================================================
// Analytics Tracking (Microsoft Clarity)
// ==========================================================================

const initAnalytics = () => {
    // Track button clicks
    const trackClick = (element, label) => {
        if (typeof clarity === 'function') {
            clarity('event', `button_click_${label}`);
        }
    };

    // Track all CTA buttons
    document.querySelectorAll('a[href*="contact"], button[type="submit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const label = btn.textContent.trim().replace(/\s+/g, '_').toLowerCase();
            trackClick(btn, label);
        });
    });

    // Track navigation clicks
    document.querySelectorAll('nav a').forEach((link) => {
        link.addEventListener('click', () => {
            const page = link.getAttribute('href') || 'unknown';
            if (typeof clarity === 'function') {
                clarity('event', 'navigation_click', { page });
            }
        });
    });

    // Track social media clicks
    document.querySelectorAll('a[href*="linkedin.com"], a[href*="github.com"]').forEach((link) => {
        link.addEventListener('click', () => {
            const platform = link.href.includes('linkedin') ? 'linkedin' : 'github';
            if (typeof clarity === 'function') {
                clarity('event', 'social_click', { platform });
            }
        });
    });

    // Track form submissions
    const form = document.querySelector('form[action*="formspree.io"]');
    if (form) {
        form.addEventListener('submit', () => {
            if (typeof clarity === 'function') {
                clarity('event', 'form_submission');
            }
        });
    }

    // Track scroll depth
    let maxScrollDepth = 0;
    window.addEventListener('scroll', () => {
        const scrollDepth = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
        if (scrollDepth > maxScrollDepth) {
            maxScrollDepth = scrollDepth;
            if (maxScrollDepth >= 25 && maxScrollDepth < 50 && typeof clarity === 'function') {
                clarity('event', 'scroll_25_percent');
            } else if (maxScrollDepth >= 50 && maxScrollDepth < 75 && typeof clarity === 'function') {
                clarity('event', 'scroll_50_percent');
            } else if (maxScrollDepth >= 75 && maxScrollDepth < 100 && typeof clarity === 'function') {
                clarity('event', 'scroll_75_percent');
            } else if (maxScrollDepth >= 100 && typeof clarity === 'function') {
                clarity('event', 'scroll_100_percent');
            }
        }
    });

    // Track Konami code usage
    window.addEventListener('konami-activated', () => {
        if (typeof clarity === 'function') {
            clarity('event', 'konami_code_activated');
        }
    });

    // Track achievement unlocks
    const originalUnlock = window.unlockAchievement;
    if (originalUnlock) {
        window.unlockAchievement = (achievementId) => {
            if (typeof clarity === 'function') {
                clarity('event', 'achievement_unlocked', { achievement: achievementId });
            }
            originalUnlock(achievementId);
        };
    }
};

// ==========================================================================
// Performance Monitoring (LCP)
// ==========================================================================

const initPerformanceMonitoring = () => {
    // Monitor Largest Contentful Paint
    if ('PerformanceObserver' in window) {
        try {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                
                console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
                
                // Send to Clarity
                if (typeof clarity === 'function') {
                    clarity('set', 'lcp', Math.round(lastEntry.renderTime || lastEntry.loadTime));
                }
                
                // Warn if LCP is poor (> 2.5s)
                const lcp = lastEntry.renderTime || lastEntry.loadTime;
                if (lcp > 2500) {
                    console.warn('Poor LCP detected:', lcp, 'ms');
                }
            });
            
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
            console.log('Performance monitoring not supported');
        }
    }

    // Monitor Core Web Vitals
    if ('web-vital' in window) {
        // First Input Delay (FID)
        try {
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry) => {
                    const fid = entry.processingStart - entry.startTime;
                    console.log('FID:', fid);
                    if (typeof clarity === 'function') {
                        clarity('set', 'fid', Math.round(fid));
                    }
                });
            });
            fidObserver.observe({ type: 'first-input', buffered: true });
        } catch (e) {}

        // Cumulative Layout Shift (CLS)
        try {
            let clsScore = 0;
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsScore += entry.value;
                    }
                }
                console.log('CLS:', clsScore);
                if (typeof clarity === 'function') {
                    clarity('set', 'cls', clsScore.toFixed(4));
                }
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {}
    }
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
            initScrollToTop();
            initAchievements();
            initKonamiCode();
            initPWA();
            initAnalytics();
            initPerformanceMonitoring();
        });
    } else {
        // DOM already loaded
        initDarkMode();
        initMobileMenu();
        initAnimations();
        initSmoothScroll();
        initFormValidation();
        initLazyLoading();
        initScrollToTop();
        initAchievements();
        initKonamiCode();
        initPWA();
        initAnalytics();
        initPerformanceMonitoring();
    }
};

// Start the site
init();

// ==========================================================================
// Savonie AI Chatbot with Smart Signals
// ==========================================================================

// --- Savonie AI Chatbot ---
document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const WORKER_URL = 'https://portfolio-chat.eayramia.workers.dev';
    const WELCOME_DELAY = 2500;

    // Project Data Mapping
    const projectData = {
        logistics: {
            title: "Logistics System",
            img: "assets/img/project-logistics.jpg",
            link: "/deep-dive.html#logistics"
        },
        conflict: {
            title: "Conflict Playbook",
            img: "assets/img/project-conflict.jpg",
            link: "/deep-dive.html#conflict"
        },
        discipline: {
            title: "Discipline Routine",
            img: "assets/img/project-discipline.jpg",
            link: "/deep-dive.html#discipline"
        },
        website: {
            title: "Portfolio Website",
            img: "assets/img/og-image.png",
            link: "/"
        }
    };

    // Elements
    const els = {
        widget: document.getElementById('chat-widget'),
        window: document.getElementById('chat-window'),
        header: document.getElementById('chat-header'),
        messages: document.getElementById('chat-messages'),
        input: document.getElementById('chat-input'),
        sendBtn: document.getElementById('send-btn'),
        toggleBtn: document.getElementById('chat-toggle'),
        closeBtn: document.getElementById('close-chat'),
        bubble: document.getElementById('welcome-bubble'),
        chipsContainer: document.getElementById('chat-chips')
    };

    // State
    let chatHistory = [];
    let isInitialized = false;
    
    // 1. Initialize - restore history from session
    try { 
        const saved = sessionStorage.getItem('savonie_history');
        if (saved) {
            chatHistory = JSON.parse(saved);
            chatHistory.forEach(msg => {
                const div = document.createElement('div');
                const userClass = 'bg-[#212842] text-white rounded-tr-none self-end ml-auto';
                const botClass = 'bg-white text-[#362017] rounded-tl-none border border-[#362017]/5 self-start';
                div.className = `p-3 rounded-lg shadow-sm max-w-[85%] mb-3 text-sm leading-relaxed ${msg.sender === 'user' ? userClass : botClass}`;
                if (typeof marked !== 'undefined' && msg.sender === 'bot') {
                    div.innerHTML = marked.parse(msg.text);
                } else {
                    div.textContent = msg.text;
                }
                els.messages?.appendChild(div);
            });
            // Scroll to bottom after loading history (with delay to ensure DOM is ready)
            setTimeout(() => {
                if (els.messages) {
                    els.messages.scrollTop = els.messages.scrollHeight;
                }
            }, 100);
        }
    } catch(e) {}
    
    // Add welcome message only if no history
    if (chatHistory.length === 0) {
        addMessageToUI("Hello! I am Savonie. Ask me anything about Estivan.", 'bot', false);
    }
    
    isInitialized = true;

    // 2. Welcome Bubble Timer
    setTimeout(() => {
        if (els.window?.classList.contains('hidden') && chatHistory.length === 0) {
            els.bubble?.classList.remove('opacity-0', 'translate-y-4');
            els.bubble?.classList.add('opacity-100', 'translate-y-0');
        }
    }, WELCOME_DELAY);

    // 3. Event Listeners
    els.toggleBtn?.addEventListener('click', toggleChat);
    els.closeBtn?.addEventListener('click', toggleChat);
    els.sendBtn?.addEventListener('click', handleSend);
    els.input?.addEventListener('keypress', (e) => e.key === 'Enter' && handleSend());

    // 4. Functions
    function toggleChat() {
        els.window?.classList.toggle('hidden');
        if (!els.window?.classList.contains('hidden')) {
            if(els.bubble) els.bubble.style.display = 'none';
            setTimeout(() => {
                els.input?.focus();
                // Scroll to bottom when opening chat
                if (els.messages) {
                    els.messages.scrollTop = els.messages.scrollHeight;
                }
            }, 100);
        }
    }

    async function handleSend() {
        const text = els.input.value.trim();
        if (!text) return;

        // Google Analytics event tracking
        if(typeof gtag === 'function') {
            gtag('event', 'chat_question', {
                'event_category': 'Chatbot',
                'event_label': 'User Asked Question'
            });
        }

        // Detect user language
        const language = document.documentElement.lang || 'en';

        addMessageToUI(text, 'user');
        els.input.value = '';
        const loadingId = addMessageToUI('Thinking...', 'bot', true);

        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: text,
                    language: language,
                    pageContent: document.body.innerText.substring(0, 2000) 
                })
            });
            const data = await response.json();
            removeMessage(loadingId);

            // Handle Smart Signals response
            if (data.reply) {
                addMessageToUI(data.reply, 'bot');
            }

            // Handle chips (suggestion buttons)
            if (data.chips && Array.isArray(data.chips) && els.chipsContainer) {
                els.chipsContainer.innerHTML = '';
                data.chips.forEach(chipText => {
                    const btn = document.createElement('button');
                    btn.className = 'chip-btn text-xs bg-white border border-[#212842]/20 text-[#212842] px-3 py-1 rounded-full hover:bg-[#212842] hover:text-white transition-colors';
                    btn.textContent = chipText;
                    btn.addEventListener('click', () => {
                        if (els.input) {
                            els.input.value = chipText;
                            handleSend();
                        }
                    });
                    els.chipsContainer.appendChild(btn);
                });
            }

            // Handle actions
            if (data.action) {
                if (data.action === 'download_resume') {
                    const link = document.createElement('a');
                    link.href = '/assets/resume.pdf';
                    link.download = 'Estivan_Ayramia_Resume.pdf';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else if (data.action === 'email_link') {
                    window.location.href = 'mailto:hello@estivanayramia.com';
                }
            }

            // Handle card
            if (data.card) {
                addCardToUI(data.card);
            }

        } catch (e) {
            removeMessage(loadingId);
            addMessageToUI("Offline mode. Please try again.", 'bot');
        }
    }

    function addMessageToUI(text, sender, isLoading = false) {
        if (!els.messages) return;
        const div = document.createElement('div');
        div.id = isLoading ? 'loading-msg' : '';
        const userClass = 'bg-[#212842] text-white rounded-tr-none self-end ml-auto';
        const botClass = 'bg-white text-[#362017] rounded-tl-none border border-[#362017]/5 self-start';
        
        div.className = `p-3 rounded-lg shadow-sm max-w-[85%] mb-3 text-sm leading-relaxed ${sender === 'user' ? userClass : botClass}`;
        
        els.messages.appendChild(div);
        
        // Typewriter effect for bot messages (but not loading messages)
        if (sender === 'bot' && !isLoading) {
            let charIndex = 0;
            div.textContent = '';
            
            const typeInterval = setInterval(() => {
                if (charIndex < text.length) {
                    div.textContent += text[charIndex];
                    charIndex++;
                    els.messages.scrollTop = els.messages.scrollHeight;
                } else {
                    clearInterval(typeInterval);
                    // Convert to markdown after typing is complete
                    if (typeof marked !== 'undefined') {
                        div.innerHTML = marked.parse(text);
                    }
                    els.messages.scrollTop = els.messages.scrollHeight;
                }
            }, 30);
        } else {
            div.textContent = text;
        }

        if (!isLoading && isInitialized) {
            chatHistory.push({ text, sender });
            sessionStorage.setItem('savonie_history', JSON.stringify(chatHistory));
        }
        
        els.messages.scrollTop = els.messages.scrollHeight;
        return div.id;
    }

    function addCardToUI(cardId) {
        if (!els.messages || !projectData[cardId]) return;
        
        const project = projectData[cardId];
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden border border-[#362017]/10 mb-3 max-w-[85%] self-start';
        
        card.innerHTML = `
            <img src="${project.img}" alt="${project.title}" class="w-full h-32 object-cover" onerror="this.src='assets/img/og-image.png'">
            <div class="p-3">
                <h4 class="font-semibold text-[#212842] mb-2">${project.title}</h4>
                <a href="${project.link}" class="inline-block bg-[#212842] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#362017] transition-colors">
                    View Project
                </a>
            </div>
        `;
        
        els.messages.appendChild(card);
        els.messages.scrollTop = els.messages.scrollHeight;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // 5. Draggable Header Logic with Viewport Constraints
    console.log('Draggable setup - header:', els.header, 'window:', els.window);
    if (els.header && els.window) {
        console.log('Setting up draggable functionality');
        let isDragging = false, startX, startY, initialLeft, initialBottom;
        
        // Restore saved position
        const savedLeft = localStorage.getItem('chatWindowLeft');
        const savedBottom = localStorage.getItem('chatWindowBottom');
        if (savedLeft && savedBottom) {
            els.window.style.left = savedLeft;
            els.window.style.bottom = savedBottom;
            els.window.style.right = 'auto';
        }
        
        // Set initial cursor
        els.header.style.cursor = 'move';
        console.log('Header cursor set to move');
        
        els.header.addEventListener('mousedown', (e) => {
            console.log('Mousedown on header', e.target);
            if (e.target.closest('#close-chat')) return; // Don't drag when clicking close
            console.log('Starting drag');
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = els.window.getBoundingClientRect();
            initialLeft = rect.left;
            initialBottom = window.innerHeight - rect.bottom;
            els.header.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const dx = e.clientX - startX;
            const dy = startY - e.clientY; // Inverted for bottom positioning
            
            let newLeft = initialLeft + dx;
            let newBottom = initialBottom + dy;
            
            // Viewport constraints (with padding)
            const windowWidth = els.window.offsetWidth;
            const windowHeight = els.window.offsetHeight;
            const padding = 10;
            
            newLeft = Math.max(padding, Math.min(newLeft, window.innerWidth - windowWidth - padding));
            newBottom = Math.max(padding, Math.min(newBottom, window.innerHeight - windowHeight - padding));
            
            els.window.style.left = `${newLeft}px`;
            els.window.style.bottom = `${newBottom}px`;
            els.window.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            els.header.style.cursor = 'move';
            document.body.style.userSelect = '';
            
            // Save position
            localStorage.setItem('chatWindowLeft', els.window.style.left);
            localStorage.setItem('chatWindowBottom', els.window.style.bottom);
        });
    }

    // 6. Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close chat
        if (e.key === 'Escape' && !els.window?.classList.contains('hidden')) {
            toggleChat();
        }
        // Ctrl/Cmd + K to toggle chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            toggleChat();
        }
    });
});

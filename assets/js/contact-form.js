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
    const statusArea = document.getElementById('form-status');
    const clearBtn = document.getElementById('clear-form-btn');
    const copyEmailBtn = document.getElementById('copy-email-btn');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    if (!form || !modal) return;

    // State
    let scrollY = 0;
    let gameActive = false;
    let animationFrameId;
    let bubbles = [];
    let score = 0;
    let ctx;
    let inFlight = false;
    let pageLoadTime = Date.now();
    
    // Constants
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const MIN_SUBMIT_TIME = 2500; // 2.5 seconds
    const COOLDOWN_TIME = 15000; // 15 seconds
    const STORAGE_KEY = 'contact_form_draft';
    const COOLDOWN_KEY = 'contact_form_cooldown';

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

    // ==========================================
    // FORM HELPERS
    // ==========================================

    function setStatus(type, message) {
        if (!statusArea) return;
        statusArea.className = `min-h-[1.5rem] text-sm font-medium mt-2 ${
            type === 'error' ? 'text-red-600 dark:text-red-400' : 
            type === 'success' ? 'text-green-600 dark:text-green-400' : 
            'text-indigodeep dark:text-beige'
        }`;
        statusArea.textContent = message;
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
            disableSubmit(false);
        });
    }

    // Copy Email
    if (copyEmailBtn) {
        copyEmailBtn.addEventListener('click', async () => {
            const email = "hello@estivanayramia.com";
            try {
                await navigator.clipboard.writeText(email);
                const originalText = copyEmailBtn.innerText;
                copyEmailBtn.innerText = "Copied!";
                setTimeout(() => copyEmailBtn.innerText = originalText, 2000);
            } catch (err) {
                // Fallback
                const textArea = document.createElement("textarea");
                textArea.value = email;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
                const originalText = copyEmailBtn.innerText;
                copyEmailBtn.innerText = "Copied!";
                setTimeout(() => copyEmailBtn.innerText = originalText, 2000);
            }
        });
    }

    // ==========================================
    // FORM SUBMISSION
    // ==========================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (inFlight) return;

        // Anti-bot: Time to submit
        if (Date.now() - pageLoadTime < MIN_SUBMIT_TIME) {
            setStatus('error', "Unable to send. Please try again in a few seconds.");
            return;
        }

        // File size check
        const fileInput = form.querySelector('input[type="file"]');
        if (fileInput && fileInput.files.length > 0) {
            if (fileInput.files[0].size > MAX_FILE_SIZE) {
                setStatus('error', "File is too large. Max size is 5MB.");
                fileInput.focus();
                return;
            }
        }

        // Trim inputs
        const inputs = form.querySelectorAll('input[type="text"], input[type="email"], textarea');
        inputs.forEach(input => {
            input.value = input.value.trim();
        });

        if (!form.checkValidity()) {
            // Focus first invalid
            const invalid = form.querySelector(':invalid');
            if (invalid) {
                invalid.focus({ preventScroll: true });
                invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        inFlight = true;
        const originalText = submitBtn.innerText;
        disableSubmit(true);
        submitBtn.innerText = 'Sending...';
        setStatus('neutral', 'Sending message...');
        
        try {
            const endpoint = form.getAttribute('data-form-endpoint');
            const formData = new FormData(form);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                form.reset();
                sessionStorage.removeItem(STORAGE_KEY);
                localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
                
                setStatus('success', 'Message sent successfully!');
                openModal();
                
                // Start cooldown
                checkCooldown();
            } else {
                const data = await response.json();
                if (Object.hasOwn(data, 'errors')) {
                    setStatus('error', data["errors"].map(error => error["message"]).join(", "));
                } else {
                    setStatus('error', "Oops! There was a problem submitting your form. If this keeps failing, copy my email and send manually.");
                }
            }
        } catch (error) {
            setStatus('error', "Network error. If this keeps failing, copy my email and send manually.");
        } finally {
            inFlight = false;
            if (!localStorage.getItem(COOLDOWN_KEY)) {
                disableSubmit(false);
            }
            submitBtn.innerText = originalText;
        }
    });

    // ==========================================
    // MODAL & SCROLL LOCK
    // ==========================================
    function openModal() {
        // Capture scroll position
        scrollY = window.scrollY;
        
        // Lock body
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        
        // Focus management
        closeBtn.focus();
        
        initGame();
    }

    function closeModal() {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        
        // Unlock body
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
        
        stopGame();
    }

    closeBtn.addEventListener('click', closeModal);
    
    // Close on ESC and Click Outside
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Trap focus
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !modal.hidden) {
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
        score = 0;
        bubbles = [];
        updateScore();
        
        ctx = canvas.getContext('2d');
        resizeCanvas();
        
        window.addEventListener('resize', resizeCanvas);
        canvas.addEventListener('pointerdown', handleInput);
        
        // Show tutorial
        showTutorial();

        loop();
    }

    function stopGame() {
        gameActive = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
        canvas.removeEventListener('pointerdown', handleInput);
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

    function spawnBubble() {
        const rect = canvas.getBoundingClientRect();
        const radius = 15 + Math.random() * 25;
        bubbles.push({
            x: Math.random() * rect.width,
            y: rect.height + radius,
            radius: radius,
            speed: (1 + Math.random() * 3) * (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1),
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            popped: false
        });
    }

    function updateScore() {
        scoreDisplay.innerText = `Score: ${score}`;
    }

    function handleInput(e) {
        e.preventDefault(); // Prevent default touch actions
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        bubbles.forEach(b => {
            if (b.popped) return;
            const dx = x - b.x;
            const dy = y - b.y;
            if (dx*dx + dy*dy < (b.radius + 15)**2) { // +15 for easier touch
                b.popped = true;
                score += 10;
                updateScore();
            }
        });
    }

    function loop() {
        if (!gameActive) return;
        
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Spawn logic
        if (Math.random() < 0.05) spawnBubble();
        
        // Update & Draw
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            
            if (!b.popped) {
                b.y -= b.speed;
                
                // Draw bubble
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = b.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.stroke();
                ctx.closePath();
                
                // Remove if off screen
                if (b.y + b.radius < 0) {
                    bubbles.splice(i, 1);
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
        
        animationFrameId = requestAnimationFrame(loop);
    }

    // Pause on background
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (gameActive) {
                cancelAnimationFrame(animationFrameId);
            }
        } else {
            if (gameActive && !modal.hidden) {
                loop();
            }
        }
    });

})();

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
    
    if (!form || !modal) return;

    let scrollY = 0;
    let gameActive = false;
    let animationFrameId;
    let bubbles = [];
    let score = 0;
    let ctx;

    // ==========================================
    // FORM SUBMISSION
    // ==========================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        
        // Lock UI
        submitBtn.disabled = true;
        submitBtn.innerText = 'Sending...';
        
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
                openModal();
            } else {
                const data = await response.json();
                if (Object.hasOwn(data, 'errors')) {
                    alert(data["errors"].map(error => error["message"]).join(", "));
                } else {
                    alert("Oops! There was a problem submitting your form");
                }
            }
        } catch (error) {
            alert("Network error. Please try again later.");
        } finally {
            submitBtn.disabled = false;
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
    
    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });

    // ==========================================
    // SUCCESS GAME (Bubble Popper)
    // ==========================================
    function initGame() {
        if (gameActive) return;
        gameActive = true;
        score = 0;
        bubbles = [];
        updateScore();
        
        ctx = canvas.getContext('2d');
        resizeCanvas();
        
        window.addEventListener('resize', resizeCanvas);
        canvas.addEventListener('pointerdown', handleInput);
        
        loop();
    }

    function stopGame() {
        gameActive = false;
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
        canvas.removeEventListener('pointerdown', handleInput);
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
    }

    function spawnBubble() {
        const rect = canvas.getBoundingClientRect();
        const radius = 15 + Math.random() * 25;
        bubbles.push({
            x: Math.random() * rect.width,
            y: rect.height + radius,
            radius: radius,
            speed: 1 + Math.random() * 3,
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
            if (dx*dx + dy*dy < (b.radius + 10)**2) { // +10 for easier touch
                b.popped = true;
                score += 10;
                updateScore();
                // Pop effect could go here
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
            
            if (b.popped) {
                // Simple pop animation (shrink)
                b.radius *= 0.8;
                if (b.radius < 1) {
                    bubbles.splice(i, 1);
                    continue;
                }
            } else {
                b.y -= b.speed;
                // Remove if off screen
                if (b.y < -b.radius) {
                    bubbles.splice(i, 1);
                    continue;
                }
            }
            
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Shine
            ctx.beginPath();
            ctx.arc(b.x - b.radius*0.3, b.y - b.radius*0.3, b.radius*0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fill();
        }
        
        animationFrameId = requestAnimationFrame(loop);
    }

})();

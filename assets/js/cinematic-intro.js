/**
 * ============================================================================
 * CINEMATIC FIRST-VISIT INTRO — CONTROLLER
 * ============================================================================
 *
 * Orchestrates a premium motion-driven intro for first-time visitors.
 * Uses GSAP (already bundled in site.min.js) for timeline animation.
 * Uses cinematic-audio.js for procedural Web Audio synthesis.
 *
 * Features:
 * - First-visit only (localStorage persistence)
 * - Skippable at any point
 * - Reduced-motion aware (instant fade fallback)
 * - Keyboard accessible (Escape / Enter / Space to skip)
 * - Clean body scroll lock/unlock
 * - Seamless reveal transition into live homepage
 * - Replay affordance via footer link
 * - Integrated audio with mute toggle
 * - Autoplay-safe: audio starts on first user interaction
 *
 * Storage key: 'ea_intro_seen' (value: '1')
 *
 * @version 2.0.0
 */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────
  var STORAGE_KEY = 'ea_intro_seen';
  var INTRO_ID = 'cinematic-intro';
  var CURTAIN_CLASS = 'intro-curtain';

  // ── State ──────────────────────────────────────────────────────────────
  var timeline = null;
  var isSkipping = false;
  var isComplete = false;
  var introEl = null;
  var curtainEl = null;
  var skipBtn = null;
  var soundBtn = null;
  var startTime = 0;       // Performance.now() when intro began
  var audioAttempted = false;

  // ── Audio handle (loaded from cinematic-audio.js) ─────────────────────
  function audio() {
    return window.__introAudio || null;
  }

  // ── Utility ────────────────────────────────────────────────────────────

  function hasSeenIntro() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markIntroSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {}
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  function isHomepage() {
    var path = window.location.pathname;
    return path === '/' ||
           path === '/EN/' ||
           path === '/EN/index.html' ||
           path === '/index.html' ||
           path === '';
  }

  function getElapsedSeconds() {
    return startTime ? (performance.now() - startTime) / 1000 : 0;
  }

  // ── Audio Initialization (on user gesture) ────────────────────────────

  function tryStartAudio() {
    if (audioAttempted || isComplete || isSkipping) return;
    var a = audio();
    if (!a || !a.isAvailable()) return;
    audioAttempted = true;
    var elapsed = getElapsedSeconds();
    a.start(elapsed).then(function (ok) {
      if (ok && soundBtn) {
        updateSoundButtonState();
      }
    });
  }

  function updateSoundButtonState() {
    if (!soundBtn) return;
    var a = audio();
    var muted = a && a.isMuted();
    var icon = soundBtn.querySelector('.sound-icon');
    if (icon) {
      icon.innerHTML = muted ? ICON_MUTED : ICON_UNMUTED;
    }
    soundBtn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  }

  // SVG icons for sound toggle
  var ICON_UNMUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';

  var ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';

  // ── DOM Construction ──────────────────────────────────────────────────

  function buildIntroDOM() {
    // Main overlay
    introEl = document.createElement('div');
    introEl.id = INTRO_ID;
    introEl.setAttribute('role', 'dialog');
    introEl.setAttribute('aria-modal', 'true');
    introEl.setAttribute('aria-label', 'Welcome intro sequence');

    // Scene container
    var scene = document.createElement('div');
    scene.className = 'intro-scene';

    // Horizon line
    var line = document.createElement('div');
    line.className = 'intro-line';
    line.setAttribute('aria-hidden', 'true');

    // Grid structure (background motif)
    var grid = document.createElement('div');
    grid.className = 'intro-grid';
    grid.setAttribute('aria-hidden', 'true');
    var gridPositions = [20, 35, 50, 65, 80];
    gridPositions.forEach(function (pos) {
      var hLine = document.createElement('div');
      hLine.className = 'intro-grid-line h';
      hLine.style.top = pos + '%';
      grid.appendChild(hLine);
      var vLine = document.createElement('div');
      vLine.className = 'intro-grid-line v';
      vLine.style.left = pos + '%';
      grid.appendChild(vLine);
    });

    // Thematic text fragments
    var fragments = [
      { text: 'curiosity', x: '-8vw', y: '-6vh' },
      { text: 'structure', x: '6vw', y: '2vh' },
      { text: 'execution', x: '-3vw', y: '8vh' }
    ];
    var fragmentEls = fragments.map(function (f) {
      var el = document.createElement('span');
      el.className = 'intro-fragment';
      el.textContent = f.text;
      el.style.left = 'calc(50% + ' + f.x + ')';
      el.style.top = 'calc(50% + ' + f.y + ')';
      el.style.transform = 'translate(-50%, -50%)';
      el.setAttribute('aria-hidden', 'true');
      return el;
    });

    // Logo mark
    var logo = document.createElement('img');
    logo.className = 'intro-logo';
    logo.src = '/assets/img/logo-ea-monogram.webp';
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    logo.width = 64;
    logo.height = 62;

    // Name
    var name = document.createElement('div');
    name.className = 'intro-name';
    name.textContent = 'Estivan Ayramia';

    // Tagline
    var tagline = document.createElement('div');
    tagline.className = 'intro-tagline';
    tagline.textContent = 'Built to show what a resume can\u2019t.';

    // Assemble scene
    scene.appendChild(logo);
    scene.appendChild(name);
    scene.appendChild(tagline);

    // Assemble overlay
    introEl.appendChild(grid);
    introEl.appendChild(line);
    fragmentEls.forEach(function (el) { introEl.appendChild(el); });
    introEl.appendChild(scene);

    // ── Controls container (bottom row: sound + skip) ────────────────
    var controls = document.createElement('div');
    controls.className = 'intro-controls';

    // Sound toggle button (only if Web Audio is available)
    var a = audio();
    if (a && a.isAvailable()) {
      soundBtn = document.createElement('button');
      soundBtn.className = 'intro-sound-toggle';
      soundBtn.setAttribute('type', 'button');
      soundBtn.setAttribute('aria-label', 'Turn sound on');
      soundBtn.innerHTML = '<span class="sound-icon">' + ICON_MUTED + '</span><span class="sound-label">Sound</span>';
      controls.appendChild(soundBtn);
    }

    // Skip button
    skipBtn = document.createElement('button');
    skipBtn.className = 'intro-skip';
    skipBtn.setAttribute('type', 'button');
    skipBtn.setAttribute('aria-label', 'Skip intro');
    skipBtn.innerHTML = 'Skip <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 4 15 12 5 20"></polyline><line x1="19" y1="4" x2="19" y2="20"></line></svg>';
    controls.appendChild(skipBtn);

    // Curtain (for reveal transition)
    curtainEl = document.createElement('div');
    curtainEl.className = CURTAIN_CLASS;

    // Insert into DOM
    document.body.insertBefore(curtainEl, document.body.firstChild);
    document.body.insertBefore(introEl, document.body.firstChild);
    document.body.appendChild(controls);

    return {
      scene: scene,
      line: line,
      grid: grid,
      fragments: fragmentEls,
      logo: logo,
      name: name,
      tagline: tagline,
      controls: controls
    };
  }

  // ── Animation Timeline ────────────────────────────────────────────────

  function createTimeline(els) {
    if (typeof gsap === 'undefined') {
      completeIntro();
      return null;
    }

    var tl = gsap.timeline({
      paused: true,
      onComplete: function () {
        completeIntro();
      }
    });

    // ── Phase 0: Brief darkness (builds anticipation) ── [0s → 0.6s]
    tl.set(els.line, { width: 0 });
    tl.to({}, { duration: 0.6 });

    // ── Phase 1: Horizon line draws across ── [0.6s → 2.2s]
    tl.to(els.line, {
      width: 'min(80vw, 600px)',
      duration: 1.6,
      ease: 'power2.inOut'
    });

    // ── Phase 1.5: Show controls ── [1.2s]
    tl.to(els.controls, {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out'
    }, 1.2);

    // ── Phase 2: Text fragments appear ── [2.2s → 5.0s]
    els.fragments.forEach(function (frag, i) {
      var fragStart = 2.2 + (i * 0.8);
      tl.to(frag, {
        opacity: 1,
        duration: 0.8,
        ease: 'power2.out'
      }, fragStart);
      tl.to(frag, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.in'
      }, fragStart + 1.6);
    });

    // ── Phase 3: Grid structure fades in ── [3.8s → 5.5s]
    tl.to(els.grid, {
      opacity: 1,
      duration: 1.7,
      ease: 'power1.inOut'
    }, 3.8);

    // ── Phase 4: Line fades, grid fades ── [5.5s → 7.0s]
    tl.to(els.line, {
      opacity: 0,
      duration: 1.0,
      ease: 'power2.in'
    }, 5.5);
    tl.to(els.grid, {
      opacity: 0,
      duration: 1.0,
      ease: 'power2.in'
    }, 6.0);

    // ── Phase 5: Logo appears ── [6.8s → 7.8s]
    tl.fromTo(els.logo, {
      opacity: 0,
      y: 12,
      scale: 0.9
    }, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.0,
      ease: 'power3.out'
    }, 6.8);

    // ── Phase 6: Name reveals ── [7.8s → 9.0s]
    tl.fromTo(els.name, {
      opacity: 0,
      y: 20
    }, {
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: 'power3.out'
    }, 7.8);

    // ── Phase 7: Tagline reveals ── [9.0s → 10.2s]
    tl.fromTo(els.tagline, {
      opacity: 0,
      y: 14
    }, {
      opacity: 1,
      y: 0,
      duration: 1.0,
      ease: 'power3.out'
    }, 9.0);

    // ── Phase 8: Hold final composition ── [10.2s → 12.5s]
    tl.to({}, { duration: 2.3 });

    // ── Phase 9: Everything fades, reveal ── [12.5s → 14.0s]
    tl.to([els.logo, els.name, els.tagline], {
      opacity: 0,
      y: -10,
      duration: 0.8,
      ease: 'power2.in',
      stagger: 0.1
    }, 12.5);

    // Fade overlay
    tl.to(introEl, {
      opacity: 0,
      duration: 1.0,
      ease: 'power2.inOut'
    }, 13.0);

    // Fade controls
    tl.to(els.controls, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.in'
    }, 12.5);

    return tl;
  }

  // ── Complete / Exit ───────────────────────────────────────────────────

  function completeIntro() {
    if (isComplete) return;
    isComplete = true;
    markIntroSeen();

    // Stop audio gracefully
    var a = audio();
    if (a && a.isActive()) {
      a.fadeOut(0.8);
    } else if (a) {
      a.destroy();
    }

    // Unlock body
    document.documentElement.classList.remove('intro-active');

    // Make site visible
    var mainContent = document.getElementById('main-content');
    var header = document.querySelector('header');
    var footer = document.querySelector('footer');
    var chatWidget = document.getElementById('chat-widget');
    var scrollTop = document.getElementById('scroll-to-top');
    var scrollProgress = document.querySelector('.scroll-progress');

    [mainContent, header, footer, chatWidget, scrollTop, scrollProgress].forEach(function (el) {
      if (el) el.style.visibility = '';
    });

    // Animate site elements in
    if (typeof gsap !== 'undefined') {
      if (header) {
        gsap.fromTo(header, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.1 });
      }
      if (mainContent) {
        gsap.fromTo(mainContent, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.15 });
      }
    }

    // Clean up DOM
    requestAnimationFrame(function () {
      setTimeout(function () {
        if (introEl && introEl.parentNode) {
          introEl.setAttribute('data-state', 'done');
          introEl.parentNode.removeChild(introEl);
        }
        if (curtainEl && curtainEl.parentNode) {
          curtainEl.setAttribute('data-state', 'done');
          curtainEl.parentNode.removeChild(curtainEl);
        }
        // Remove controls container
        var controls = document.querySelector('.intro-controls');
        if (controls && controls.parentNode) {
          controls.parentNode.removeChild(controls);
        }
        skipBtn = null;
        soundBtn = null;
        if (timeline) {
          timeline.kill();
          timeline = null;
        }
      }, 500);
    });

    // Re-trigger ScrollTrigger refresh
    if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
      setTimeout(function () { ScrollTrigger.refresh(); }, 600);
    }

    addReplayLink();
  }

  function skipIntro() {
    if (isSkipping || isComplete) return;
    isSkipping = true;

    // Fade audio quickly
    var a = audio();
    if (a && a.isActive()) {
      a.fadeOut(0.4);
    }

    if (timeline) {
      timeline.pause();
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(introEl, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: completeIntro
      });
      var controls = document.querySelector('.intro-controls');
      if (controls) {
        gsap.to(controls, {
          opacity: 0,
          duration: 0.3,
          ease: 'power2.in'
        });
      }
    } else {
      if (introEl) introEl.style.opacity = '0';
      setTimeout(completeIntro, 400);
    }
  }

  // ── Replay affordance ─────────────────────────────────────────────────

  function addReplayLink() {
    var footer = document.querySelector('footer .border-t');
    if (!footer || footer.querySelector('.intro-replay-link')) return;

    var link = document.createElement('button');
    link.type = 'button';
    link.className = 'intro-replay-link';
    link.style.cssText = 'display:block;margin:1rem auto 0;font-size:0.75rem;color:inherit;background:none;border:none;font-family:inherit;padding:0.25rem 0.5rem;';
    link.textContent = 'Replay intro';
    link.setAttribute('aria-label', 'Replay the site intro sequence');
    link.addEventListener('click', function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      window.location.reload();
    });
    footer.appendChild(link);
  }

  // ── Reduced-motion path ───────────────────────────────────────────────

  function runReducedMotion() {
    introEl = document.createElement('div');
    introEl.id = INTRO_ID;
    introEl.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0a0b10;display:flex;align-items:center;justify-content:center;flex-direction:column;';

    var name = document.createElement('div');
    name.style.cssText = 'font-family:Inter,Helvetica,Arial,sans-serif;font-weight:600;font-size:clamp(1.5rem,4vw,2.5rem);color:#fff;letter-spacing:-0.02em;text-align:center;padding:2rem;';
    name.textContent = 'Estivan Ayramia';
    introEl.appendChild(name);

    document.body.insertBefore(introEl, document.body.firstChild);
    document.documentElement.classList.add('intro-active');

    setTimeout(function () {
      introEl.style.transition = 'opacity 0.4s ease';
      introEl.style.opacity = '0';
      setTimeout(function () {
        completeIntro();
      }, 450);
    }, 1500);
  }

  // ── Event Bindings ────────────────────────────────────────────────────

  function bindEvents() {
    // Skip button
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        tryStartAudio(); // User gesture — try audio
        skipIntro();
      });
    }

    // Sound toggle
    if (soundBtn) {
      soundBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var a = audio();
        if (!a) return;
        // First click: start audio if not started
        if (!audioAttempted) {
          tryStartAudio();
          // Don't toggle mute on first click — first click unmutes
          return;
        }
        a.toggleMute();
        updateSoundButtonState();
      });
    }

    // Click anywhere on overlay = try to start audio (user gesture)
    introEl.addEventListener('click', function () {
      tryStartAudio();
    });

    // Keyboard: Escape, Enter, or Space to skip
    function onKeyDown(e) {
      if (isComplete) {
        document.removeEventListener('keydown', onKeyDown);
        return;
      }
      // Any keypress counts as user gesture for audio
      tryStartAudio();
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        skipIntro();
      }
    }
    document.addEventListener('keydown', onKeyDown);
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    // Gate: only show on homepage
    if (!isHomepage()) {
      addReplayLink();
      return;
    }

    // Gate: already seen
    if (hasSeenIntro()) {
      addReplayLink();
      return;
    }

    // Reduced motion path (no audio)
    if (prefersReducedMotion()) {
      markIntroSeen();
      runReducedMotion();
      return;
    }

    // Lock the body
    document.documentElement.classList.add('intro-active');

    // Record start time
    startTime = performance.now();

    // Build DOM
    var els = buildIntroDOM();

    // Bind events
    bindEvents();

    // Wait for GSAP, then start (load from CDN if mobile deferred it)
    var gsapRetries = 0;
    var MAX_GSAP_RETRIES = 40; // ~2s of polling

    function loadGsapCDN(cb) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js';
      s.onload = function () { cb(); };
      s.onerror = function () { completeIntro(); }; // Can't load GSAP — reveal site
      document.head.appendChild(s);
    }

    function tryStart() {
      if (typeof gsap !== 'undefined') {
        timeline = createTimeline(els);
        if (timeline) {
          timeline.play();
        }
      } else {
        gsapRetries++;
        if (gsapRetries < MAX_GSAP_RETRIES) {
          setTimeout(tryStart, 50);
        } else {
          // GSAP not loaded (mobile deferred load) — load from CDN
          loadGsapCDN(function () {
            if (typeof gsap !== 'undefined') {
              timeline = createTimeline(els);
              if (timeline) {
                // Adjust start position to account for wait time
                var waited = gsapRetries * 0.05;
                timeline.play();
                timeline.time(Math.min(waited, 0.6)); // Skip past darkness phase
              }
            } else {
              completeIntro(); // Fallback: reveal site
            }
          });
        }
      }
    }

    requestAnimationFrame(function () {
      setTimeout(tryStart, 80);
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.__replayIntro = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    window.location.reload();
  };

})();

/**
 * ============================================================================
 * CINEMATIC FIRST-VISIT INTRO — CONTROLLER V2
 * ============================================================================
 *
 * 84-second scene-based cinematic intro with voiceover, captions, and score.
 *
 * Audio strategy for universal device support:
 * - Voiceover plays via an <audio> element (MP3)
 * - Score plays via Web Audio API (cinematic-audio.js)
 * - On load: attempt silent autoplay probe to detect policy
 * - If autoplay succeeds: play voiceover + score immediately
 * - If autoplay is blocked: show a tasteful "Tap for sound" prompt
 *   overlay that, on first interaction, resumes both audio systems
 * - The visual intro always starts immediately regardless of audio state
 * - Mute toggle controls both voiceover and score
 * - Skip fades both to silence then destroys
 *
 * Storage key: 'ea_intro_seen' (value: '1')
 * @version 3.0.0
 */
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────
  var STORAGE_KEY = 'ea_intro_seen';
  var INTRO_ID = 'cinematic-intro';
  var VO_SRC = '/assets/audio/intro-voiceover.mp3';
  var CAPTIONS_SRC = '/assets/js/intro-captions.json';
  var TOTAL_DURATION = 84; // seconds

  // ── State ──────────────────────────────────────────────────────────────
  var timeline = null;
  var isSkipping = false;
  var isComplete = false;
  var introEl = null;
  var curtainEl = null;
  var skipBtn = null;
  var soundBtn = null;
  var captionEl = null;
  var captionTextEl = null;
  var soundPromptEl = null;
  var voiceoverEl = null;       // <audio> element for voiceover
  var captions = [];            // loaded caption data
  var currentCaptionIdx = -1;
  var isMuted = false;
  var audioUnlocked = false;    // true once we've successfully started audio
  var startTime = 0;

  // ── Audio engine handle (Web Audio score from cinematic-audio.js) ─────
  function score() {
    return window.__introAudio || null;
  }

  // ── Utility ────────────────────────────────────────────────────────────

  function hasSeenIntro() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function markIntroSeen() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }
  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }
  function isHomepage() {
    var p = window.location.pathname;
    return p === '/' || p === '/EN/' || p === '/EN/index.html' || p === '/index.html' || p === '';
  }
  function getElapsed() {
    return startTime ? (performance.now() - startTime) / 1000 : 0;
  }

  // ── SVG Icons ─────────────────────────────────────────────────────────
  var ICON_UNMUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
  var ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';

  // ── Voiceover Audio Element ───────────────────────────────────────────

  function createVoiceover() {
    voiceoverEl = document.createElement('audio');
    voiceoverEl.preload = 'auto';
    voiceoverEl.volume = 1.0;
    // iOS requires playsinline
    voiceoverEl.setAttribute('playsinline', '');
    voiceoverEl.setAttribute('webkit-playsinline', '');
    // Keep it in the DOM and visible enough for iOS (some iOS versions
    // refuse to play audio elements that are display:none or 0x0)
    voiceoverEl.style.cssText = 'position:fixed;bottom:-100px;left:-100px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
    // Set source via <source> for better codec negotiation
    var source = document.createElement('source');
    source.src = VO_SRC;
    source.type = 'audio/mpeg';
    voiceoverEl.appendChild(source);
    document.body.appendChild(voiceoverEl);
    // Force load the audio buffer
    try { voiceoverEl.load(); } catch (e) {}
  }

  /**
   * Probe whether autoplay is allowed.
   * Creates a tiny silent audio context and checks if it's running.
   * Also tries to play the voiceover — if it works, audio is unlocked.
   * Returns a Promise<boolean>.
   */
  function probeAutoplay() {
    return new Promise(function (resolve) {
      if (!voiceoverEl) { resolve(false); return; }
      // Try to play the voiceover immediately
      var playPromise = voiceoverEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          // Autoplay succeeded — audio is unlocked
          resolve(true);
        }).catch(function () {
          // Autoplay was blocked
          voiceoverEl.pause();
          voiceoverEl.currentTime = 0;
          resolve(false);
        });
      } else {
        // Old browser, no promise from play()
        resolve(false);
      }
    });
  }

  /**
   * Attempt to unlock and start ALL audio (voiceover + score).
   * Must be called from a user gesture handler.
   */
  function unlockAudio() {
    if (audioUnlocked || isComplete || isSkipping) return;
    audioUnlocked = true;

    // Start voiceover from current intro position
    if (voiceoverEl) {
      var elapsed = getElapsed();
      voiceoverEl.currentTime = Math.min(elapsed, TOTAL_DURATION - 1);
      voiceoverEl.volume = isMuted ? 0 : 1.0;
      // Use a try/catch + promise chain for maximum device compat
      try {
        var p = voiceoverEl.play();
        if (p && typeof p.then === 'function') {
          p.then(function () {
            // Voiceover started successfully
          }).catch(function (err) {
            // Play failed even with user gesture — try again after a microtask
            setTimeout(function () {
              if (voiceoverEl && !isComplete && !isSkipping) {
                try {
                  voiceoverEl.play().catch(function () {});
                } catch (e) {}
              }
            }, 100);
          });
        }
      } catch (e) {
        // Synchronous error — very old browser
      }
    }

    // Start Web Audio score
    var s = score();
    if (s && s.isAvailable() && !s.isActive()) {
      var elapsed2 = getElapsed();
      s.start(elapsed2).catch(function () {});
    }

    // Remove sound prompt if visible
    if (soundPromptEl && soundPromptEl.parentNode) {
      soundPromptEl.style.opacity = '0';
      setTimeout(function () {
        if (soundPromptEl && soundPromptEl.parentNode) {
          soundPromptEl.parentNode.removeChild(soundPromptEl);
        }
        soundPromptEl = null;
      }, 300);
    }

    updateSoundButton();
  }

  function updateSoundButton() {
    if (!soundBtn) return;
    var icon = soundBtn.querySelector('.sound-icon');
    if (icon) {
      icon.innerHTML = isMuted ? ICON_MUTED : ICON_UNMUTED;
    }
    soundBtn.setAttribute('aria-label', isMuted ? 'Turn sound on' : 'Turn sound off');
  }

  function setMuted(muted) {
    isMuted = muted;
    // Voiceover
    if (voiceoverEl) {
      voiceoverEl.volume = muted ? 0 : 1.0;
    }
    // Score
    var s = score();
    if (s && s.isActive()) {
      if (muted && !s.isMuted()) s.toggleMute();
      else if (!muted && s.isMuted()) s.toggleMute();
    }
    updateSoundButton();
  }

  // ── Captions ──────────────────────────────────────────────────────────

  function loadCaptions(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', CAPTIONS_SRC, true);
    xhr.responseType = 'json';
    xhr.onload = function () {
      if (xhr.status === 200 && xhr.response) {
        captions = xhr.response;
      }
      cb();
    };
    xhr.onerror = function () { cb(); };
    xhr.send();
  }

  function updateCaptions(currentTime) {
    if (!captionTextEl || captions.length === 0) return;
    var found = -1;
    for (var i = 0; i < captions.length; i++) {
      if (currentTime >= captions[i].start && currentTime <= captions[i].end + 0.3) {
        found = i;
        break;
      }
    }
    if (found !== currentCaptionIdx) {
      currentCaptionIdx = found;
      if (found >= 0) {
        captionTextEl.textContent = captions[found].text;
        captionTextEl.classList.add('active');
      } else {
        captionTextEl.classList.remove('active');
      }
    }
  }

  // ── DOM Construction ──────────────────────────────────────────────────

  function buildIntroDOM() {
    introEl = document.createElement('div');
    introEl.id = INTRO_ID;
    introEl.setAttribute('role', 'dialog');
    introEl.setAttribute('aria-modal', 'true');
    introEl.setAttribute('aria-label', 'Welcome intro');

    // Scene container
    var scene = document.createElement('div');
    scene.className = 'intro-scene';

    // Horizon line
    var line = document.createElement('div');
    line.className = 'intro-line';
    line.setAttribute('aria-hidden', 'true');

    // Grid
    var grid = document.createElement('div');
    grid.className = 'intro-grid';
    grid.setAttribute('aria-hidden', 'true');
    [20, 35, 50, 65, 80].forEach(function (pos) {
      var h = document.createElement('div');
      h.className = 'intro-grid-line h';
      h.style.top = pos + '%';
      grid.appendChild(h);
      var v = document.createElement('div');
      v.className = 'intro-grid-line v';
      v.style.left = pos + '%';
      grid.appendChild(v);
    });

    // Fragments
    var fragData = [
      { text: 'curiosity', x: '-8vw', y: '-6vh' },
      { text: 'structure', x: '6vw', y: '2vh' },
      { text: 'execution', x: '-3vw', y: '8vh' }
    ];
    var frags = fragData.map(function (f) {
      var el = document.createElement('span');
      el.className = 'intro-fragment';
      el.textContent = f.text;
      el.style.left = 'calc(50% + ' + f.x + ')';
      el.style.top = 'calc(50% + ' + f.y + ')';
      el.style.transform = 'translate(-50%,-50%)';
      el.setAttribute('aria-hidden', 'true');
      return el;
    });

    // Logo
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

    scene.appendChild(logo);
    scene.appendChild(name);
    scene.appendChild(tagline);

    introEl.appendChild(grid);
    introEl.appendChild(line);
    frags.forEach(function (el) { introEl.appendChild(el); });
    introEl.appendChild(scene);

    // Captions container
    captionEl = document.createElement('div');
    captionEl.className = 'intro-captions';
    captionEl.setAttribute('aria-live', 'polite');
    captionTextEl = document.createElement('span');
    captionTextEl.className = 'intro-caption-text';
    captionEl.appendChild(captionTextEl);

    // Controls
    var controls = document.createElement('div');
    controls.className = 'intro-controls';

    // Sound toggle — always show it
    soundBtn = document.createElement('button');
    soundBtn.className = 'intro-sound-toggle';
    soundBtn.setAttribute('type', 'button');
    soundBtn.setAttribute('aria-label', 'Turn sound on');
    soundBtn.innerHTML = '<span class="sound-icon">' + ICON_MUTED + '</span><span class="sound-label">Sound</span>';
    controls.appendChild(soundBtn);

    // Skip
    skipBtn = document.createElement('button');
    skipBtn.className = 'intro-skip';
    skipBtn.setAttribute('type', 'button');
    skipBtn.setAttribute('aria-label', 'Skip intro');
    skipBtn.innerHTML = 'Skip <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 4 15 12 5 20"></polyline><line x1="19" y1="4" x2="19" y2="20"></line></svg>';
    controls.appendChild(skipBtn);

    // Curtain
    curtainEl = document.createElement('div');
    curtainEl.className = 'intro-curtain';

    // Insert
    document.body.insertBefore(curtainEl, document.body.firstChild);
    document.body.insertBefore(introEl, document.body.firstChild);
    document.body.appendChild(captionEl);
    document.body.appendChild(controls);

    return {
      scene: scene, line: line, grid: grid, fragments: frags,
      logo: logo, name: name, tagline: tagline, controls: controls
    };
  }

  /**
   * Build a tasteful sound prompt overlay.
   * This appears when autoplay is blocked, inviting the user to tap.
   */
  function buildSoundPrompt() {
    soundPromptEl = document.createElement('div');
    soundPromptEl.style.cssText = 'position:fixed;inset:0;z-index:100004;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    soundPromptEl.setAttribute('role', 'button');
    soundPromptEl.setAttribute('aria-label', 'Tap to enable sound');

    var pill = document.createElement('div');
    pill.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.75rem 1.5rem;border-radius:9999px;background:rgba(255,255,255,0.08);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(225,212,194,0.15);color:rgba(225,212,194,0.8);font-family:Inter,Helvetica,Arial,sans-serif;font-size:0.875rem;font-weight:400;letter-spacing:0.02em;transition:opacity 0.3s ease,transform 0.3s ease;';

    pill.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> Tap for sound';

    soundPromptEl.appendChild(pill);

    // Subtle pulse animation
    var pulse = true;
    var pulseInterval = setInterval(function () {
      if (!soundPromptEl || !soundPromptEl.parentNode) {
        clearInterval(pulseInterval);
        return;
      }
      pill.style.transform = pulse ? 'scale(1.03)' : 'scale(1)';
      pulse = !pulse;
    }, 1200);

    soundPromptEl.addEventListener('click', function () {
      clearInterval(pulseInterval);
      unlockAudio();
    });
    soundPromptEl.addEventListener('touchend', function (e) {
      e.preventDefault();
      clearInterval(pulseInterval);
      unlockAudio();
    });

    document.body.appendChild(soundPromptEl);
  }

  // ── Timeline ──────────────────────────────────────────────────────────

  function createTimeline(els) {
    if (typeof gsap === 'undefined') {
      completeIntro();
      return null;
    }

    var tl = gsap.timeline({
      paused: true,
      onUpdate: function () {
        // Sync captions to timeline progress
        var t = tl.time();
        updateCaptions(t);

        // If voiceover is playing, sync timeline to audio time (drift correction)
        if (voiceoverEl && !voiceoverEl.paused && audioUnlocked && !isMuted) {
          var audioTime = voiceoverEl.currentTime;
          var drift = Math.abs(t - audioTime);
          if (drift > 0.25) {
            tl.time(audioTime);
          }
        }
      },
      onComplete: function () {
        completeIntro();
      }
    });

    // Phase 0: Darkness [0–0.6s]
    tl.set(els.line, { width: 0 });
    tl.to({}, { duration: 0.6 });

    // Phase 1: Horizon line [0.6–2.2s]
    tl.to(els.line, { width: 'min(80vw, 600px)', duration: 1.6, ease: 'power2.inOut' });

    // Phase 1.5: Controls appear [1.2s]
    tl.to(els.controls, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 1.2);

    // Phase 2: Fragments [2.2–5.0s]
    els.fragments.forEach(function (frag, i) {
      var s = 2.2 + i * 0.8;
      tl.to(frag, { opacity: 1, duration: 0.8, ease: 'power2.out' }, s);
      tl.to(frag, { opacity: 0, duration: 0.6, ease: 'power2.in' }, s + 1.6);
    });

    // Phase 3: Grid [3.8–5.5s]
    tl.to(els.grid, { opacity: 1, duration: 1.7, ease: 'power1.inOut' }, 3.8);

    // Phase 4: Dissolve [5.5–7.0s]
    tl.to(els.line, { opacity: 0, duration: 1.0, ease: 'power2.in' }, 5.5);
    tl.to(els.grid, { opacity: 0, duration: 1.0, ease: 'power2.in' }, 6.0);

    // Phase 5: Logo [6.8–7.8s]
    tl.fromTo(els.logo,
      { opacity: 0, y: 12, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 1.0, ease: 'power3.out' }, 6.8);

    // Phase 6: Name [7.8–9.0s]
    tl.fromTo(els.name,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, 7.8);

    // Phase 7: Tagline [9.0–10.2s]
    tl.fromTo(els.tagline,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, 9.0);

    // Phase 8: Hold composition while voiceover continues [10.2–80.0s]
    // The visual sequence is done, but the voiceover + captions keep playing.
    // Hold the name/tagline visible during the voiceover.
    tl.to({}, { duration: TOTAL_DURATION - 14 - 10.2 }); // ~60s hold

    // Phase 9: Fade out and reveal [80.0–84.0s]
    var revealStart = TOTAL_DURATION - 4;
    tl.to([els.logo, els.name, els.tagline], {
      opacity: 0, y: -10, duration: 0.8, ease: 'power2.in', stagger: 0.1
    }, revealStart);
    tl.to(els.controls, { opacity: 0, duration: 0.4, ease: 'power2.in' }, revealStart);
    tl.to(introEl, { opacity: 0, duration: 1.5, ease: 'power2.inOut' }, revealStart + 0.5);

    return tl;
  }

  // ── Complete / Exit ───────────────────────────────────────────────────

  function completeIntro() {
    if (isComplete) return;
    isComplete = true;
    markIntroSeen();

    // Stop voiceover
    if (voiceoverEl) {
      try {
        voiceoverEl.pause();
        voiceoverEl.currentTime = 0;
      } catch (e) {}
    }

    // Stop score
    var s = score();
    if (s && s.isActive()) {
      s.fadeOut(0.8);
    } else if (s) {
      s.destroy();
    }

    // Remove sound prompt if still there
    if (soundPromptEl && soundPromptEl.parentNode) {
      soundPromptEl.parentNode.removeChild(soundPromptEl);
      soundPromptEl = null;
    }

    // Remove captions
    if (captionEl && captionEl.parentNode) {
      captionEl.parentNode.removeChild(captionEl);
    }

    // Unlock body
    document.documentElement.classList.remove('intro-active');

    // Reveal site
    var mainContent = document.getElementById('main-content');
    var header = document.querySelector('header');
    var footer = document.querySelector('footer');
    var chatWidget = document.getElementById('chat-widget');
    var scrollTop = document.getElementById('scroll-to-top');
    var scrollProgress = document.querySelector('.scroll-progress');
    [mainContent, header, footer, chatWidget, scrollTop, scrollProgress].forEach(function (el) {
      if (el) el.style.visibility = '';
    });

    if (typeof gsap !== 'undefined') {
      if (header) gsap.fromTo(header, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.1 });
      if (mainContent) gsap.fromTo(mainContent, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.15 });
    }

    // Cleanup DOM
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
        var ctrls = document.querySelector('.intro-controls');
        if (ctrls && ctrls.parentNode) ctrls.parentNode.removeChild(ctrls);
        if (voiceoverEl && voiceoverEl.parentNode) voiceoverEl.parentNode.removeChild(voiceoverEl);
        voiceoverEl = null;
        skipBtn = null;
        soundBtn = null;
        if (timeline) { timeline.kill(); timeline = null; }
      }, 500);
    });

    if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
      setTimeout(function () { ScrollTrigger.refresh(); }, 600);
    }

    addReplayLink();
  }

  function skipIntro() {
    if (isSkipping || isComplete) return;
    isSkipping = true;

    // Fade voiceover
    if (voiceoverEl && !voiceoverEl.paused) {
      var fadeSteps = 10;
      var fadeTime = 400;
      var origVol = voiceoverEl.volume;
      var step = 0;
      var fadeInterval = setInterval(function () {
        step++;
        if (step >= fadeSteps) {
          clearInterval(fadeInterval);
          voiceoverEl.pause();
          return;
        }
        voiceoverEl.volume = Math.max(0, origVol * (1 - step / fadeSteps));
      }, fadeTime / fadeSteps);
    }

    // Fade score
    var s = score();
    if (s && s.isActive()) s.fadeOut(0.4);

    if (timeline) timeline.pause();

    if (typeof gsap !== 'undefined') {
      gsap.to(introEl, { opacity: 0, duration: 0.6, ease: 'power2.inOut', onComplete: completeIntro });
      var ctrls = document.querySelector('.intro-controls');
      if (ctrls) gsap.to(ctrls, { opacity: 0, duration: 0.3, ease: 'power2.in' });
      if (captionEl) gsap.to(captionEl, { opacity: 0, duration: 0.3, ease: 'power2.in' });
    } else {
      if (introEl) introEl.style.opacity = '0';
      setTimeout(completeIntro, 400);
    }
  }

  // ── Replay ────────────────────────────────────────────────────────────

  function addReplayLink() {
    var footer = document.querySelector('footer .border-t');
    if (!footer || footer.querySelector('.intro-replay-link')) return;
    var link = document.createElement('button');
    link.type = 'button';
    link.className = 'intro-replay-link';
    link.style.cssText = 'display:block;margin:1rem auto 0;font-size:0.75rem;color:inherit;background:none;border:none;font-family:inherit;padding:0.25rem 0.5rem;';
    link.textContent = 'Replay intro';
    link.setAttribute('aria-label', 'Replay the site intro');
    link.addEventListener('click', function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      window.location.reload();
    });
    footer.appendChild(link);
  }

  // ── Reduced Motion ────────────────────────────────────────────────────

  function runReducedMotion() {
    introEl = document.createElement('div');
    introEl.id = INTRO_ID;
    introEl.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0a0b10;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    var nm = document.createElement('div');
    nm.style.cssText = 'font-family:Inter,Helvetica,Arial,sans-serif;font-weight:600;font-size:clamp(1.5rem,4vw,2.5rem);color:#fff;letter-spacing:-0.02em;text-align:center;padding:2rem;';
    nm.textContent = 'Estivan Ayramia';
    introEl.appendChild(nm);
    document.body.insertBefore(introEl, document.body.firstChild);
    document.documentElement.classList.add('intro-active');
    setTimeout(function () {
      introEl.style.transition = 'opacity 0.4s ease';
      introEl.style.opacity = '0';
      setTimeout(completeIntro, 450);
    }, 1500);
  }

  // ── Events ────────────────────────────────────────────────────────────

  function bindEvents() {
    // Skip
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        if (!audioUnlocked) unlockAudio();
        skipIntro();
      });
    }

    // Sound toggle
    if (soundBtn) {
      soundBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!audioUnlocked) {
          unlockAudio();
          isMuted = false;
          setMuted(false);
          return;
        }
        setMuted(!isMuted);
      });
    }

    // Click anywhere = unlock audio
    introEl.addEventListener('click', function () {
      if (!audioUnlocked) unlockAudio();
    });

    // Touch events for mobile
    introEl.addEventListener('touchend', function () {
      if (!audioUnlocked) unlockAudio();
    });

    // Keyboard
    function onKey(e) {
      if (isComplete) { document.removeEventListener('keydown', onKey); return; }
      if (!audioUnlocked) unlockAudio();
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        skipIntro();
      }
    }
    document.addEventListener('keydown', onKey);
  }

  // ── Init ──────────────────────────────────────────────────────────────

  function init() {
    if (!isHomepage()) { addReplayLink(); return; }
    if (hasSeenIntro()) { addReplayLink(); return; }
    if (prefersReducedMotion()) { markIntroSeen(); runReducedMotion(); return; }

    document.documentElement.classList.add('intro-active');
    startTime = performance.now();

    // Create voiceover element
    createVoiceover();

    // Load captions
    loadCaptions(function () {
      // Captions loaded (or failed silently)
    });

    // Build DOM
    var els = buildIntroDOM();
    bindEvents();

    // GSAP loading
    var retries = 0;
    var MAX_RETRIES = 40;

    function loadGsapCDN(cb) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js';
      s.onload = function () { cb(); };
      s.onerror = function () { completeIntro(); };
      document.head.appendChild(s);
    }

    function startIntro() {
      timeline = createTimeline(els);
      if (!timeline) return;
      timeline.play();

      // Probe autoplay
      probeAutoplay().then(function (canAutoplay) {
        if (canAutoplay) {
          // Autoplay works — start everything
          audioUnlocked = true;
          isMuted = false;
          // Start score
          var s = score();
          if (s && s.isAvailable()) {
            s.start(getElapsed()).catch(function () {});
          }
          updateSoundButton();
        } else {
          // Autoplay blocked — show prompt
          buildSoundPrompt();
        }
      });
    }

    function tryStart() {
      if (typeof gsap !== 'undefined') {
        startIntro();
      } else {
        retries++;
        if (retries < MAX_RETRIES) {
          setTimeout(tryStart, 50);
        } else {
          loadGsapCDN(function () {
            if (typeof gsap !== 'undefined') {
              startIntro();
            } else {
              completeIntro();
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

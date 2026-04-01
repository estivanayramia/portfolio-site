/**
 * CINEMATIC SITE TRAILER V4 — Video-Based Controller
 * Real captured site footage with voiceover, captions, and premium player controls.
 * The video element is the primary visual driver. No screenshot scene maps.
 * @version 5.0.0
 */
(function () {
  'use strict';
  var STORAGE_KEY = 'ea_intro_seen';
  var VIDEO_SRC = '/assets/video/site-trailer.mp4';
  var CAPTIONS_SRC = '/assets/js/intro-captions.json';

  // State
  var videoEl = null, overlayEl = null, curtainEl = null, playerEl = null;
  var captionWrap = null, captionText = null, promptEl = null;
  var captions = [], capIdx = -1;
  var isSkipping = false, isComplete = false, captionsVisible = true;
  var isMuted = false, audioUnlocked = false;

  function hasSeen() { try { return localStorage.getItem(STORAGE_KEY)==='1'; } catch(e) { return false; } }
  function markSeen() { try { localStorage.setItem(STORAGE_KEY,'1'); } catch(e) {} }
  function reducedMotion() { try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch(e) { return false; } }
  function isHome() { var p=location.pathname; return p==='/'||p==='/EN/'||p==='/EN/index.html'||p==='/index.html'||p===''; }
  function fmt(s) { if(isNaN(s)||s<0) s=0; var m=Math.floor(s/60); var sec=Math.floor(s%60); return m+':'+(sec<10?'0':'')+sec; }

  // Icons
  var IC = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>',
    rw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="16" fill="currentColor" stroke="none" font-size="8" text-anchor="middle" font-family="sans-serif">10</text></svg>',
    fw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="16" fill="currentColor" stroke="none" font-size="8" text-anchor="middle" font-family="sans-serif">10</text></svg>',
    volOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" fill="currentColor"/><path d="M19 4.9a10 10 0 0 1 0 14.1"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    volOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><text x="12" y="15" fill="currentColor" stroke="none" font-size="9" font-weight="bold" text-anchor="middle" font-family="sans-serif">CC</text></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };

  // ── Video Element ─────────────────────────────────────────────────────
  function createVideo() {
    videoEl = document.createElement('video');
    videoEl.preload = 'auto';
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline','');
    videoEl.setAttribute('webkit-playsinline','');
    videoEl.muted = true; // Start muted for autoplay compliance
    videoEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
    var src = document.createElement('source');
    src.src = VIDEO_SRC;
    src.type = 'video/mp4';
    videoEl.appendChild(src);
    try { videoEl.load(); } catch(e) {}

    // Time update: drive captions + player
    videoEl.addEventListener('timeupdate', function() {
      var t = videoEl.currentTime;
      updateCaptions(t);
      updatePlayer(t);
    });

    videoEl.addEventListener('ended', function() {
      completeTrailer();
    });
  }

  function probeAutoplay() {
    return new Promise(function(res) {
      if (!videoEl) { res(false); return; }
      // Try autoplay muted (should work everywhere)
      videoEl.muted = true;
      var p = videoEl.play();
      if (p && typeof p.then === 'function') {
        p.then(function() { res(true); }).catch(function() { res(false); });
      } else { res(false); }
    });
  }

  function unlockAudio() {
    if (audioUnlocked || isComplete || isSkipping) return;
    audioUnlocked = true;
    isMuted = false;
    if (videoEl) {
      videoEl.muted = false;
      videoEl.volume = 1.0;
      // If video isn't playing yet, play it
      if (videoEl.paused) {
        try { videoEl.play().catch(function(){}); } catch(e) {}
      }
    }
    removePrompt();
    updateMuteBtn();
  }

  function removePrompt() {
    if (promptEl && promptEl.parentNode) {
      promptEl.style.opacity = '0';
      setTimeout(function() { if(promptEl&&promptEl.parentNode) promptEl.parentNode.removeChild(promptEl); promptEl=null; }, 300);
    }
  }

  function setMuted(m) {
    isMuted = m;
    if (videoEl) { videoEl.muted = m; if(!m) videoEl.volume = 1.0; }
    updateMuteBtn();
  }

  // ── Captions ──────────────────────────────────────────────────────────
  function loadCaptions(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', CAPTIONS_SRC, true); xhr.responseType = 'json';
    xhr.onload = function() { if(xhr.status===200&&xhr.response) captions=xhr.response; cb(); };
    xhr.onerror = function() { cb(); };
    xhr.send();
  }
  function updateCaptions(t) {
    if (!captionText || !captions.length || !captionsVisible) return;
    var found = -1;
    for (var i=0;i<captions.length;i++) {
      if (t >= captions[i].start && t <= captions[i].end + 0.3) { found=i; break; }
    }
    if (found !== capIdx) {
      capIdx = found;
      if (found>=0) { captionText.textContent=captions[found].text; captionText.classList.add('visible'); }
      else { captionText.classList.remove('visible'); }
    }
  }

  // ── Build DOM ─────────────────────────────────────────────────────────
  function buildDOM() {
    overlayEl = document.createElement('div');
    overlayEl.id = 'cinematic-intro';
    overlayEl.setAttribute('role','dialog');
    overlayEl.setAttribute('aria-modal','true');
    overlayEl.setAttribute('aria-label','Site trailer');
    overlayEl.appendChild(videoEl);

    // Captions
    captionWrap = document.createElement('div');
    captionWrap.className = 'trailer-captions';
    captionWrap.setAttribute('aria-live','polite');
    captionText = document.createElement('span');
    captionText.className = 'trailer-caption-text';
    captionWrap.appendChild(captionText);

    // Player
    playerEl = buildPlayer();

    // Curtain
    curtainEl = document.createElement('div');
    curtainEl.className = 'intro-curtain';

    document.body.insertBefore(curtainEl, document.body.firstChild);
    document.body.insertBefore(overlayEl, document.body.firstChild);
    document.body.appendChild(captionWrap);
    document.body.appendChild(playerEl);
  }

  // ── Player Bar ────────────────────────────────────────────────────────
  var progressFill, progressDot, timeDisplay, playBtn, muteBtn, ccBtn;

  function buildPlayer() {
    var bar = document.createElement('div');
    bar.className = 'trailer-player';

    var rw = mkBtn('trailer-btn-rw', IC.rw, 'Rewind 10s');
    rw.addEventListener('click', function() { seekBy(-10); });

    playBtn = mkBtn('trailer-btn-pp', IC.pause, 'Pause');
    playBtn.addEventListener('click', function() { togglePlay(); });

    var fw = mkBtn('trailer-btn-fw', IC.fw, 'Forward 10s');
    fw.addEventListener('click', function() { seekBy(10); });

    var progWrap = document.createElement('div');
    progWrap.className = 'trailer-progress-wrap';
    var track = document.createElement('div');
    track.className = 'trailer-progress-track';
    progressFill = document.createElement('div');
    progressFill.className = 'trailer-progress-fill';
    progressDot = document.createElement('div');
    progressDot.className = 'trailer-progress-dot';
    progressFill.appendChild(progressDot);
    track.appendChild(progressFill);
    progWrap.appendChild(track);
    progWrap.addEventListener('click', function(e) {
      var rect = progWrap.getBoundingClientRect();
      var pct = Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
      seekTo(pct * (videoEl ? videoEl.duration || 75 : 75));
    });

    timeDisplay = document.createElement('span');
    timeDisplay.className = 'trailer-time';
    timeDisplay.textContent = '0:00 / 0:00';

    ccBtn = mkBtn('trailer-btn-cc', IC.cc, 'Toggle captions');
    ccBtn.classList.add('active');
    ccBtn.addEventListener('click', function() {
      captionsVisible = !captionsVisible;
      ccBtn.classList.toggle('active', captionsVisible);
      captionWrap.classList.toggle('hidden', !captionsVisible);
    });

    muteBtn = mkBtn('trailer-btn-mute', IC.volOff, 'Unmute');
    muteBtn.addEventListener('click', function() {
      if (!audioUnlocked) { unlockAudio(); return; }
      setMuted(!isMuted);
    });

    var closeBtn = mkBtn('trailer-btn-close', IC.close, 'Close trailer');
    closeBtn.addEventListener('click', function() { skipTrailer(); });

    bar.appendChild(rw); bar.appendChild(playBtn); bar.appendChild(fw);
    bar.appendChild(progWrap); bar.appendChild(timeDisplay);
    bar.appendChild(ccBtn); bar.appendChild(muteBtn); bar.appendChild(closeBtn);
    return bar;
  }

  function mkBtn(cls, svg, label) {
    var b = document.createElement('button');
    b.className = cls; b.innerHTML = svg;
    b.setAttribute('type','button');
    b.setAttribute('aria-label', label);
    return b;
  }

  function updateMuteBtn() {
    if (!muteBtn) return;
    muteBtn.innerHTML = isMuted ? IC.volOff : IC.volOn;
    muteBtn.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
  }

  function updatePlayer(t) {
    if (!progressFill||!timeDisplay||!videoEl) return;
    var dur = videoEl.duration || 75;
    var pct = Math.min(100,(t/dur)*100);
    progressFill.style.width = pct+'%';
    timeDisplay.textContent = fmt(t)+' / '+fmt(dur);
  }

  function togglePlay() {
    if (isComplete||isSkipping||!videoEl) return;
    if (videoEl.paused) {
      try { videoEl.play().catch(function(){}); } catch(e) {}
      playBtn.innerHTML = IC.pause;
      playBtn.setAttribute('aria-label','Pause');
    } else {
      videoEl.pause();
      playBtn.innerHTML = IC.play;
      playBtn.setAttribute('aria-label','Play');
    }
  }

  function seekTo(t) {
    if (!videoEl) return;
    var dur = videoEl.duration || 75;
    t = Math.max(0, Math.min(dur-0.5, t));
    videoEl.currentTime = t;
    updatePlayer(t);
    updateCaptions(t);
  }

  function seekBy(delta) {
    seekTo((videoEl ? videoEl.currentTime : 0) + delta);
  }

  // ── Sound Prompt ──────────────────────────────────────────────────────
  function buildPrompt() {
    promptEl = document.createElement('div');
    promptEl.className = 'trailer-sound-prompt';
    promptEl.setAttribute('role','button');
    promptEl.setAttribute('aria-label','Tap for sound');
    var pill = document.createElement('div');
    pill.className = 'trailer-sound-pill';
    pill.innerHTML = IC.volOn + ' Tap for sound';
    promptEl.appendChild(pill);
    promptEl.addEventListener('click', function() { unlockAudio(); });
    promptEl.addEventListener('touchend', function(e) { e.preventDefault(); unlockAudio(); });
    document.body.appendChild(promptEl);
  }

  // ── Complete / Skip ───────────────────────────────────────────────────
  function completeTrailer() {
    if (isComplete) return;
    isComplete = true;
    markSeen();
    if (videoEl) { try { videoEl.pause(); } catch(e) {} }
    removePrompt();
    if (captionWrap&&captionWrap.parentNode) captionWrap.parentNode.removeChild(captionWrap);
    if (playerEl&&playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
    document.documentElement.classList.remove('intro-active');
    ['#main-content','header','footer','#chat-widget','#scroll-to-top','.scroll-progress'].forEach(function(sel) {
      var el = document.querySelector(sel); if(el) el.style.visibility='';
    });
    // Fade overlay
    if (overlayEl) {
      overlayEl.style.transition = 'opacity 0.8s ease';
      overlayEl.style.opacity = '0';
    }
    setTimeout(function() {
      if(overlayEl&&overlayEl.parentNode) { overlayEl.setAttribute('data-state','done'); overlayEl.parentNode.removeChild(overlayEl); }
      if(curtainEl&&curtainEl.parentNode) { curtainEl.setAttribute('data-state','done'); curtainEl.parentNode.removeChild(curtainEl); }
      videoEl = null;
    }, 900);
    if(typeof ScrollTrigger!=='undefined'&&ScrollTrigger.refresh) setTimeout(function(){ScrollTrigger.refresh();},1000);
    addReplayLink();
    showWatchBtn();
  }

  function skipTrailer() {
    if (isSkipping||isComplete) return;
    isSkipping = true;
    // Fade video volume
    if (videoEl && !videoEl.muted) {
      var step=0, steps=8, orig=videoEl.volume;
      var iv = setInterval(function() { step++; if(step>=steps){clearInterval(iv);return;} videoEl.volume=Math.max(0,orig*(1-step/steps)); }, 50);
    }
    if (videoEl) setTimeout(function() { try{videoEl.pause();}catch(e){} }, 400);
    if (overlayEl) {
      overlayEl.style.transition = 'opacity 0.6s ease';
      overlayEl.style.opacity = '0';
    }
    if (playerEl) { playerEl.style.transition='opacity 0.3s ease'; playerEl.style.opacity='0'; }
    if (captionWrap) { captionWrap.style.transition='opacity 0.3s ease'; captionWrap.style.opacity='0'; }
    setTimeout(completeTrailer, 700);
  }

  // ── Replay ────────────────────────────────────────────────────────────
  function addReplayLink() {
    var footer = document.querySelector('footer .border-t');
    if (!footer||footer.querySelector('.intro-replay-link')) return;
    var link = document.createElement('button');
    link.type='button'; link.className='intro-replay-link';
    link.style.cssText='display:block;margin:1rem auto 0;font-size:0.75rem;color:inherit;background:none;border:none;font-family:inherit;padding:0.25rem 0.5rem;';
    link.textContent='Replay trailer';
    link.addEventListener('click', function() { try{localStorage.removeItem(STORAGE_KEY);}catch(e){} location.reload(); });
    footer.appendChild(link);
  }
  function showWatchBtn() {
    document.querySelectorAll('.watch-trailer-btn').forEach(function(b) {
      b.style.display='';
      b.addEventListener('click', function() { try{localStorage.removeItem(STORAGE_KEY);}catch(e){} location.reload(); });
    });
  }

  // ── Reduced Motion ────────────────────────────────────────────────────
  function runReduced() {
    overlayEl = document.createElement('div');
    overlayEl.id='cinematic-intro';
    overlayEl.style.cssText='position:fixed;inset:0;z-index:100000;background:#0a0b10;display:flex;align-items:center;justify-content:center;';
    var nm = document.createElement('div');
    nm.style.cssText='font-family:Inter,sans-serif;font-weight:600;font-size:clamp(1.5rem,4vw,2.5rem);color:#fff;letter-spacing:-0.02em;text-align:center;padding:2rem;';
    nm.textContent='Estivan Ayramia';
    overlayEl.appendChild(nm);
    document.body.insertBefore(overlayEl, document.body.firstChild);
    document.documentElement.classList.add('intro-active');
    setTimeout(function() { overlayEl.style.transition='opacity 0.4s ease'; overlayEl.style.opacity='0'; setTimeout(completeTrailer, 450); }, 1500);
  }

  // ── Events ────────────────────────────────────────────────────────────
  function bindEvents() {
    overlayEl.addEventListener('click', function() { if(!audioUnlocked) unlockAudio(); });
    overlayEl.addEventListener('touchend', function() { if(!audioUnlocked) unlockAudio(); });
    function onKey(e) {
      if(isComplete) { document.removeEventListener('keydown',onKey); return; }
      if(!audioUnlocked) unlockAudio();
      if(e.key==='Escape') { e.preventDefault(); skipTrailer(); }
      else if(e.key===' ') { e.preventDefault(); togglePlay(); }
      else if(e.key==='ArrowLeft') { e.preventDefault(); seekBy(-5); }
      else if(e.key==='ArrowRight') { e.preventDefault(); seekBy(5); }
      else if(e.key==='m'||e.key==='M') { if(audioUnlocked) setMuted(!isMuted); }
      else if(e.key==='c'||e.key==='C') { ccBtn&&ccBtn.click(); }
    }
    document.addEventListener('keydown', onKey);
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    if (!isHome()) { addReplayLink(); showWatchBtn(); return; }
    if (hasSeen()) { addReplayLink(); showWatchBtn(); return; }
    if (reducedMotion()) { markSeen(); runReduced(); return; }

    document.documentElement.classList.add('intro-active');
    document.querySelectorAll('.watch-trailer-btn').forEach(function(b){b.style.display='none';});

    createVideo();
    loadCaptions(function(){});
    buildDOM();
    bindEvents();

    // Show player
    setTimeout(function() { playerEl.classList.add('visible'); }, 500);

    // Try autoplay (muted for compliance)
    probeAutoplay().then(function(ok) {
      if (ok) {
        // Video autoplaying muted. Show prompt for sound.
        buildPrompt();
      } else {
        // Can't autoplay at all. Show prompt.
        buildPrompt();
      }
    });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();

  window.__replayIntro = function() { try{localStorage.removeItem(STORAGE_KEY);}catch(e){} location.reload(); };
})();

/**
 * CINEMATIC SITE TRAILER V3 — Controller
 * 76s scene-based trailer with voiceover, dynamic site visuals, player controls, captions
 * @version 4.0.0
 */
(function () {
  'use strict';
  var STORAGE_KEY = 'ea_intro_seen';
  var VO_SRC = '/assets/audio/intro-voiceover.mp3';
  var CAPTIONS_SRC = '/assets/js/intro-captions.json';
  var DURATION = 76;
  var SCREENSHOTS = '/assets/img/trailer/';

  // State
  var tl = null, introEl = null, curtainEl = null, playerEl = null;
  var captionWrap = null, captionText = null, promptEl = null;
  var voEl = null; // voiceover <audio>
  var captions = [], capIdx = -1;
  var isSkipping = false, isComplete = false, isPaused = false;
  var isMuted = false, audioUnlocked = false, captionsVisible = true;
  var startTime = 0, scenes = [], bgLayers = [];

  function score() { return window.__introAudio || null; }
  function hasSeen() { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch(e) { return false; } }
  function markSeen() { try { localStorage.setItem(STORAGE_KEY, '1'); } catch(e) {} }
  function reducedMotion() { try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch(e) { return false; } }
  function isHome() { var p = location.pathname; return p==='/'||p==='/EN/'||p==='/EN/index.html'||p==='/index.html'||p===''; }
  function elapsed() { return startTime ? (performance.now()-startTime)/1000 : 0; }
  function fmt(s) { var m=Math.floor(s/60); var sec=Math.floor(s%60); return m+':'+(sec<10?'0':'')+sec; }

  // SVG icons
  var IC = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>',
    rw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="16" fill="currentColor" stroke="none" font-size="8" text-anchor="middle" font-family="Inter,sans-serif">10</text></svg>',
    fw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="16" fill="currentColor" stroke="none" font-size="8" text-anchor="middle" font-family="Inter,sans-serif">10</text></svg>',
    volOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" fill="currentColor"/><path d="M19 4.9a10 10 0 0 1 0 14.1"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    volOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><text x="8" y="15" fill="currentColor" stroke="none" font-size="8" font-weight="bold" font-family="Inter,sans-serif">CC</text></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    playSmall: '<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><polygon points="3,1 13,8 3,15"/></svg>'
  };

  // ── Voiceover ─────────────────────────────────────────────────────────
  function createVO() {
    voEl = document.createElement('audio');
    voEl.preload = 'auto';
    voEl.setAttribute('playsinline','');
    voEl.setAttribute('webkit-playsinline','');
    voEl.style.cssText = 'position:fixed;bottom:-100px;left:-100px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
    var src = document.createElement('source');
    src.src = VO_SRC; src.type = 'audio/mpeg';
    voEl.appendChild(src);
    document.body.appendChild(voEl);
    try { voEl.load(); } catch(e) {}
  }

  function probeAutoplay() {
    return new Promise(function(res) {
      if (!voEl) { res(false); return; }
      var p = voEl.play();
      if (p && typeof p.then === 'function') {
        p.then(function(){ res(true); }).catch(function(){ voEl.pause(); voEl.currentTime=0; res(false); });
      } else { res(false); }
    });
  }

  function unlockAudio() {
    if (audioUnlocked||isComplete||isSkipping) return;
    audioUnlocked = true;
    if (voEl) {
      voEl.currentTime = tl ? tl.time() : Math.min(elapsed(), DURATION-1);
      voEl.volume = isMuted ? 0 : 1;
      try { var p = voEl.play(); if(p&&p.catch) p.catch(function(){ setTimeout(function(){ if(voEl&&!isComplete) try{voEl.play().catch(function(){});}catch(e){} },100); }); } catch(e) {}
    }
    var s = score();
    if (s&&s.isAvailable()&&!s.isActive()) { s.start(elapsed()).catch(function(){}); }
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
    if (voEl) voEl.volume = m ? 0 : 1;
    var s = score();
    if (s) { if (s.setMuted) s.setMuted(m); else if (m && !s.isMuted()) s.toggleMute(); else if (!m && s.isMuted()) s.toggleMute(); }
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
    if (!captionText||!captions.length||!captionsVisible) return;
    var found = -1;
    for (var i=0;i<captions.length;i++) { if(t>=captions[i].start&&t<=captions[i].end+0.3) { found=i; break; } }
    if (found !== capIdx) {
      capIdx = found;
      if (found>=0) { captionText.textContent=captions[found].text; captionText.classList.add('visible'); }
      else { captionText.classList.remove('visible'); }
    }
  }

  // ── Scene backgrounds (screenshots) ───────────────────────────────────
  var SCENE_MAP = [
    // {start, end, bg (screenshot path or null for solid), solid (CSS bg)}
    {s:0,e:10,bg:null,solid:'#0a0b10'},
    {s:10,e:15,bg:null,solid:'#0a0b10'}, // identity: dark + text
    {s:15,e:17,bg:'homepage.jpg',solid:null},
    {s:17,e:20,bg:null,solid:'#0a0b10'},
    {s:20,e:24,bg:'background.jpg',solid:null},
    {s:24,e:29,bg:'about.jpg',solid:null},
    {s:29,e:33,bg:null,solid:'#e1d4c2'}, // system words on beige
    {s:33,e:36,bg:'overview.jpg',solid:null},
    {s:36,e:39,bg:'deep-dive.jpg',solid:null},
    {s:39,e:42,bg:'projects.jpg',solid:null},
    {s:42,e:44,bg:'project-portfolio.jpg',solid:null},
    {s:44,e:46,bg:'project-loreal.jpg',solid:null},
    {s:46,e:50,bg:'dashboard.jpg',solid:null},
    {s:50,e:57,bg:'games.jpg',solid:null},
    {s:57,e:63,bg:null,solid:'#0a0b10'}, // savonie
    {s:63,e:66,bg:'contact.jpg',solid:null},
    {s:66,e:72,bg:null,solid:'#0a0b10'}, // values
    {s:72,e:76,bg:null,solid:'#e1d4c2'} // reveal
  ];

  function buildBGs() {
    SCENE_MAP.forEach(function(sc, i) {
      var div = document.createElement('div');
      div.className = 'trailer-bg';
      div.setAttribute('aria-hidden','true');
      if (sc.bg) {
        div.style.backgroundImage = 'url('+SCREENSHOTS+sc.bg+')';
      } else if (sc.solid) {
        div.style.background = sc.solid;
      }
      introEl.appendChild(div);
      bgLayers.push(div);
    });
  }

  // ── Build DOM ─────────────────────────────────────────────────────────
  function buildDOM() {
    introEl = document.createElement('div');
    introEl.id = 'cinematic-intro';
    introEl.setAttribute('role','dialog');
    introEl.setAttribute('aria-modal','true');
    introEl.setAttribute('aria-label','Site trailer');

    buildBGs();

    // Scene 1: resume fragments
    var s1 = mkScene();
    var fragTexts = ['Experience','Skills','Education','References available','Objective','Proficiency','Team player'];
    fragTexts.forEach(function(t, i) {
      var el = document.createElement('span');
      el.className = 'trailer-frag';
      el.textContent = t;
      el.style.fontSize = (0.7+Math.random()*0.8)+'rem';
      el.style.left = (15+Math.random()*70)+'%';
      el.style.top = (15+Math.random()*70)+'%';
      el.style.transform = 'rotate('+(Math.random()*10-5)+'deg)';
      s1.appendChild(el);
    });
    scenes.push({el:s1, frags: s1.querySelectorAll('.trailer-frag')});

    // Scene 2: identity
    var s2 = mkScene();
    var mono = document.createElement('img');
    mono.className = 'trailer-monogram'; mono.src = '/assets/img/logo-ea-monogram.webp'; mono.alt = '';
    mono.width = 64; mono.height = 62;
    var nm = document.createElement('div');
    nm.className = 'trailer-name'; nm.textContent = 'Estivan Ayramia';
    var orig = document.createElement('div');
    orig.className = 'trailer-origin'; orig.textContent = 'Baghdad \u2192 El Cajon, California';
    s2.appendChild(mono); s2.appendChild(nm); s2.appendChild(orig);
    scenes.push({el:s2, mono:mono, name:nm, origin:orig});

    // Scene 4: system words
    var s4 = mkScene();
    var words = ['SYSTEM','STRUCTURE','PROOF'];
    var wordEls = words.map(function(w) {
      var el = document.createElement('div');
      el.className = 'trailer-word on-dark'; el.textContent = w;
      s4.appendChild(el); return el;
    });
    var sub = document.createElement('div');
    sub.className = 'trailer-subtitle'; sub.textContent = 'Real work you can check.';
    s4.appendChild(sub);
    scenes.push({el:s4, words:wordEls, sub:sub});

    // Scene 6: arcade
    var s6 = mkScene();
    var icons = document.createElement('div');
    icons.className = 'trailer-arcade-icons';
    ['🐍','🧱','🚀','🏎️','🎮'].forEach(function(e) {
      var span = document.createElement('span');
      span.className = 'trailer-arcade-icon'; span.textContent = e;
      icons.appendChild(span);
    });
    var arcLbl = document.createElement('div');
    arcLbl.className = 'trailer-arcade-label'; arcLbl.textContent = 'ARCADE GAMES';
    s6.appendChild(icons); s6.appendChild(arcLbl);
    scenes.push({el:s6, icons:icons.children, label:arcLbl});

    // Scene 7: savonie
    var s7 = mkScene();
    var sav = document.createElement('img');
    sav.className = 'trailer-savonie-avatar'; sav.src = '/assets/img/savonie-thumb.webp'; sav.alt = 'Savonie';
    var bub = document.createElement('div');
    bub.className = 'trailer-savonie-bubble'; bub.textContent = 'Hi, maybe I can help? 👋';
    var sn = document.createElement('div');
    sn.className = 'trailer-savonie-name'; sn.textContent = 'SAVONIE';
    s7.appendChild(sav); s7.appendChild(bub); s7.appendChild(sn);
    scenes.push({el:s7, avatar:sav, bubble:bub, savName:sn});

    // Scene 8: values
    var s8 = mkScene();
    var vr = document.createElement('div');
    vr.className = 'trailer-values-row';
    var vals = ['PEOPLE','PROCESS','WORK'];
    var valEls = [];
    vals.forEach(function(v, i) {
      if (i>0) { var dot = document.createElement('span'); dot.className = 'trailer-value-dot'; vr.appendChild(dot); valEls.push(dot); }
      var ve = document.createElement('span'); ve.className = 'trailer-value'; ve.textContent = v; vr.appendChild(ve); valEls.push(ve);
    });
    s8.appendChild(vr);
    scenes.push({el:s8, vals:valEls});

    // Captions
    captionWrap = document.createElement('div');
    captionWrap.className = 'trailer-captions';
    captionWrap.setAttribute('aria-live','polite');
    captionText = document.createElement('span');
    captionText.className = 'trailer-caption-text';
    captionWrap.appendChild(captionText);

    // Player bar
    playerEl = buildPlayer();

    // Curtain
    curtainEl = document.createElement('div');
    curtainEl.className = 'intro-curtain';

    // Insert
    document.body.insertBefore(curtainEl, document.body.firstChild);
    document.body.insertBefore(introEl, document.body.firstChild);
    document.body.appendChild(captionWrap);
    document.body.appendChild(playerEl);
  }

  function mkScene() {
    var d = document.createElement('div');
    d.className = 'trailer-scene'; d.setAttribute('aria-hidden','true');
    introEl.appendChild(d);
    return d;
  }

  // ── Player Bar ────────────────────────────────────────────────────────
  var progressFill, progressDot, timeDisplay, playBtn, muteBtn, ccBtn;

  function buildPlayer() {
    var bar = document.createElement('div');
    bar.className = 'trailer-player';

    // Rewind
    var rw = mkBtn('trailer-btn-rw', IC.rw, 'Rewind 10 seconds');
    rw.addEventListener('click', function() { seekBy(-10); });

    // Play/Pause
    playBtn = mkBtn('trailer-btn-pp', IC.pause, 'Pause');
    playBtn.addEventListener('click', function() { togglePlay(); });

    // Forward
    var fw = mkBtn('trailer-btn-fw', IC.fw, 'Forward 10 seconds');
    fw.addEventListener('click', function() { seekBy(10); });

    // Progress
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
      var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(pct * DURATION);
    });

    // Time
    timeDisplay = document.createElement('span');
    timeDisplay.className = 'trailer-time';
    timeDisplay.textContent = '0:00 / ' + fmt(DURATION);

    // CC toggle
    ccBtn = mkBtn('trailer-btn-cc', IC.cc, 'Toggle captions');
    ccBtn.classList.add('active');
    ccBtn.addEventListener('click', function() {
      captionsVisible = !captionsVisible;
      ccBtn.classList.toggle('active', captionsVisible);
      captionWrap.classList.toggle('hidden', !captionsVisible);
    });

    // Mute
    muteBtn = mkBtn('trailer-btn-mute', IC.volOff, 'Unmute');
    muteBtn.addEventListener('click', function() {
      if (!audioUnlocked) { unlockAudio(); isMuted = false; setMuted(false); return; }
      setMuted(!isMuted);
    });

    // Close
    var closeBtn = mkBtn('trailer-btn-close', IC.close, 'Close trailer');
    closeBtn.addEventListener('click', function() { skipTrailer(); });

    bar.appendChild(rw);
    bar.appendChild(playBtn);
    bar.appendChild(fw);
    bar.appendChild(progWrap);
    bar.appendChild(timeDisplay);
    bar.appendChild(ccBtn);
    bar.appendChild(muteBtn);
    bar.appendChild(closeBtn);

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
    if (!progressFill||!timeDisplay) return;
    var pct = Math.min(100, (t/DURATION)*100);
    progressFill.style.width = pct+'%';
    timeDisplay.textContent = fmt(t)+' / '+fmt(DURATION);
  }

  function togglePlay() {
    if (isComplete||isSkipping) return;
    if (isPaused) {
      isPaused = false;
      if (tl) tl.play();
      if (voEl && audioUnlocked) try { voEl.play().catch(function(){}); } catch(e) {}
      var s = score(); if(s&&s.isActive()&&s.resume) s.resume();
      playBtn.innerHTML = IC.pause;
      playBtn.setAttribute('aria-label','Pause');
    } else {
      isPaused = true;
      if (tl) tl.pause();
      if (voEl) try { voEl.pause(); } catch(e) {}
      var s2 = score(); if(s2&&s2.isActive()&&s2.suspend) s2.suspend();
      playBtn.innerHTML = IC.play;
      playBtn.setAttribute('aria-label','Play');
    }
  }

  function seekTo(t) {
    t = Math.max(0, Math.min(DURATION-0.5, t));
    if (tl) tl.time(t);
    if (voEl && audioUnlocked) {
      voEl.currentTime = t;
      if (isPaused) {} else { try { voEl.play().catch(function(){}); } catch(e) {} }
    }
    updatePlayer(t);
    updateCaptions(t);
  }

  function seekBy(delta) {
    var cur = tl ? tl.time() : 0;
    seekTo(cur + delta);
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

  // ── GSAP Timeline ─────────────────────────────────────────────────────
  function createTimeline() {
    if (typeof gsap === 'undefined') { completeTrailer(); return null; }
    var t = gsap.timeline({
      paused: true,
      onUpdate: function() {
        var ct = t.time();
        updateCaptions(ct);
        updatePlayer(ct);
        updateBGs(ct);
        // Drift correction with voiceover
        if (voEl && !voEl.paused && audioUnlocked && !isMuted && !isPaused) {
          var drift = Math.abs(ct - voEl.currentTime);
          if (drift > 0.3) t.time(voEl.currentTime);
        }
      },
      onComplete: function() { completeTrailer(); }
    });

    // Scene 1: fragments [0-9s]
    var s1 = scenes[0];
    t.to(s1.el, {opacity:1, duration:0.5}, 0);
    Array.from(s1.frags).forEach(function(f,i) {
      t.to(f, {opacity:0.4+Math.random()*0.3, duration:1.5, ease:'power2.out'}, 0.3+i*0.3);
    });
    // Scatter at "different" ~9s
    t.to(s1.el, {opacity:0, duration:0.5, ease:'power2.in'}, 9);

    // Show player at 1.5s
    t.add(function() { playerEl.classList.add('visible'); }, 1.5);

    // Scene 2: identity [10-19s]
    var s2 = scenes[1];
    t.to(s2.el, {opacity:1, duration:0.6}, 10);
    t.fromTo(s2.mono, {opacity:0,y:10}, {opacity:1,y:0, duration:0.8, ease:'power3.out'}, 10.5);
    t.fromTo(s2.name, {opacity:0,y:20}, {opacity:1,y:0, duration:1, ease:'power3.out'}, 11);
    t.fromTo(s2.origin, {opacity:0}, {opacity:1, duration:0.8}, 14.5);
    t.to(s2.el, {opacity:0, duration:0.6}, 19);

    // Scene 4: system words [29-38s]
    var s4 = scenes[2];
    t.to(s4.el, {opacity:1, duration:0.5}, 29);
    s4.words.forEach(function(w,i) {
      t.fromTo(w, {opacity:0,y:15}, {opacity:1,y:0, duration:0.5, ease:'power3.out'}, 30+i*1.2);
    });
    t.fromTo(s4.sub, {opacity:0}, {opacity:1, duration:0.6}, 35);
    t.to(s4.el, {opacity:0, duration:0.5}, 38);

    // Scene 6: arcade [50-57s]
    var s6 = scenes[3];
    t.to(s6.el, {opacity:1, duration:0.5}, 50);
    Array.from(s6.icons).forEach(function(ic,i) {
      t.fromTo(ic, {opacity:0,scale:0.5}, {opacity:1,scale:1, duration:0.4, ease:'back.out(2)'}, 51+i*0.3);
    });
    t.fromTo(s6.label, {opacity:0}, {opacity:1, duration:0.5}, 53);
    t.to(s6.el, {opacity:0, duration:0.5}, 56.5);

    // Scene 7: savonie [57-65s]
    var s7 = scenes[4];
    t.to(s7.el, {opacity:1, duration:0.5}, 57.5);
    t.fromTo(s7.avatar, {opacity:0,scale:0.8}, {opacity:1,scale:1, duration:0.8, ease:'power3.out'}, 58);
    t.fromTo(s7.bubble, {opacity:0,y:10}, {opacity:1,y:0, duration:0.6}, 59.5);
    t.fromTo(s7.savName, {opacity:0}, {opacity:1, duration:0.5}, 60.5);
    t.to(s7.el, {opacity:0, duration:0.5}, 64.5);

    // Scene 8: values [66-73s]
    var s8 = scenes[5];
    t.to(s8.el, {opacity:1, duration:0.5}, 66.5);
    s8.vals.forEach(function(v,i) {
      t.fromTo(v, {opacity:0,y:8}, {opacity:1,y:0, duration:0.5, ease:'power2.out'}, 67+i*0.4);
    });
    t.to(s8.el, {opacity:0, duration:0.8}, 72);

    // Final fade [73-76s]
    t.to(introEl, {opacity:0, duration:1.5, ease:'power2.inOut'}, 74);
    t.add(function() { if(playerEl) playerEl.classList.remove('visible'); }, 73.5);

    // Total duration pad
    t.to({}, {duration:0.1}, DURATION);

    return t;
  }

  // Background cross-fade
  function updateBGs(t) {
    for (var i=0;i<SCENE_MAP.length;i++) {
      var sc = SCENE_MAP[i];
      var layer = bgLayers[i];
      if (!layer) continue;
      // Active if within range, with 0.5s fade margins
      var fadeIn = 0.5, fadeOut = 0.5;
      var targetOp = 0;
      if (t >= sc.s && t < sc.e) {
        if (t < sc.s + fadeIn) targetOp = (t - sc.s) / fadeIn;
        else if (t > sc.e - fadeOut) targetOp = (sc.e - t) / fadeOut;
        else targetOp = 1;
      }
      layer.style.opacity = Math.max(0, Math.min(1, targetOp));
    }
  }

  // ── Complete / Skip ───────────────────────────────────────────────────
  function completeTrailer() {
    if (isComplete) return;
    isComplete = true;
    markSeen();
    if (voEl) { try { voEl.pause(); voEl.currentTime=0; } catch(e) {} }
    var s = score();
    if (s&&s.isActive()) s.fadeOut(0.8); else if (s) s.destroy();
    removePrompt();
    if (captionWrap&&captionWrap.parentNode) captionWrap.parentNode.removeChild(captionWrap);
    if (playerEl&&playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
    document.documentElement.classList.remove('intro-active');
    // Reveal site
    ['#main-content','header','footer','#chat-widget','#scroll-to-top','.scroll-progress'].forEach(function(sel) {
      var el = document.querySelector(sel);
      if (el) el.style.visibility = '';
    });
    if (typeof gsap !== 'undefined') {
      var h = document.querySelector('header');
      var mc = document.getElementById('main-content');
      if (h) gsap.fromTo(h, {opacity:0,y:-10}, {opacity:1,y:0,duration:0.6,ease:'power2.out',delay:0.1});
      if (mc) gsap.fromTo(mc, {opacity:0}, {opacity:1,duration:0.8,ease:'power2.out',delay:0.15});
    }
    requestAnimationFrame(function() {
      setTimeout(function() {
        if(introEl&&introEl.parentNode) { introEl.setAttribute('data-state','done'); introEl.parentNode.removeChild(introEl); }
        if(curtainEl&&curtainEl.parentNode) { curtainEl.setAttribute('data-state','done'); curtainEl.parentNode.removeChild(curtainEl); }
        if(voEl&&voEl.parentNode) voEl.parentNode.removeChild(voEl);
        voEl=null;
        if(tl) { tl.kill(); tl=null; }
      }, 500);
    });
    if(typeof ScrollTrigger!=='undefined'&&ScrollTrigger.refresh) setTimeout(function(){ScrollTrigger.refresh();},600);
    addReplayLink();
    showWatchBtn();
  }

  function skipTrailer() {
    if (isSkipping||isComplete) return;
    isSkipping = true;
    if (voEl&&!voEl.paused) {
      var orig = voEl.volume, step = 0, steps = 10;
      var iv = setInterval(function() { step++; if(step>=steps){clearInterval(iv);voEl.pause();return;} voEl.volume=Math.max(0,orig*(1-step/steps)); }, 40);
    }
    var s = score(); if(s&&s.isActive()) s.fadeOut(0.4);
    if(tl) tl.pause();
    if(typeof gsap!=='undefined') {
      gsap.to(introEl, {opacity:0,duration:0.6,ease:'power2.inOut',onComplete:completeTrailer});
      if(playerEl) gsap.to(playerEl, {opacity:0,duration:0.3});
      if(captionWrap) gsap.to(captionWrap, {opacity:0,duration:0.3});
    } else {
      if(introEl) introEl.style.opacity='0';
      setTimeout(completeTrailer, 400);
    }
  }

  // ── Replay / Watch Trailer ────────────────────────────────────────────
  function addReplayLink() {
    var footer = document.querySelector('footer .border-t');
    if (!footer || footer.querySelector('.intro-replay-link')) return;
    var link = document.createElement('button');
    link.type = 'button'; link.className = 'intro-replay-link';
    link.style.cssText = 'display:block;margin:1rem auto 0;font-size:0.75rem;color:inherit;background:none;border:none;font-family:inherit;padding:0.25rem 0.5rem;';
    link.textContent = 'Replay trailer';
    link.addEventListener('click', function() { try{localStorage.removeItem(STORAGE_KEY);}catch(e){} location.reload(); });
    footer.appendChild(link);
  }

  function showWatchBtn() {
    var btns = document.querySelectorAll('.watch-trailer-btn');
    btns.forEach(function(b) {
      b.style.display = '';
      b.addEventListener('click', function() {
        try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
        location.reload();
      });
    });
  }

  // ── Reduced Motion ────────────────────────────────────────────────────
  function runReduced() {
    introEl = document.createElement('div');
    introEl.id = 'cinematic-intro';
    introEl.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0a0b10;display:flex;align-items:center;justify-content:center;';
    var nm = document.createElement('div');
    nm.style.cssText = 'font-family:Inter,sans-serif;font-weight:600;font-size:clamp(1.5rem,4vw,2.5rem);color:#fff;letter-spacing:-0.02em;text-align:center;padding:2rem;';
    nm.textContent = 'Estivan Ayramia';
    introEl.appendChild(nm);
    document.body.insertBefore(introEl, document.body.firstChild);
    document.documentElement.classList.add('intro-active');
    setTimeout(function() { introEl.style.transition='opacity 0.4s ease'; introEl.style.opacity='0'; setTimeout(completeTrailer, 450); }, 1500);
  }

  // ── Events ────────────────────────────────────────────────────────────
  function bindEvents() {
    introEl.addEventListener('click', function() { if(!audioUnlocked) unlockAudio(); });
    introEl.addEventListener('touchend', function() { if(!audioUnlocked) unlockAudio(); });
    function onKey(e) {
      if(isComplete) { document.removeEventListener('keydown',onKey); return; }
      if(!audioUnlocked) unlockAudio();
      if(e.key==='Escape') { e.preventDefault(); skipTrailer(); }
      else if(e.key===' ') { e.preventDefault(); togglePlay(); }
      else if(e.key==='ArrowLeft') { e.preventDefault(); seekBy(-5); }
      else if(e.key==='ArrowRight') { e.preventDefault(); seekBy(5); }
      else if(e.key==='m'||e.key==='M') { if(audioUnlocked) setMuted(!isMuted); }
      else if(e.key==='c'||e.key==='C') { ccBtn && ccBtn.click(); }
    }
    document.addEventListener('keydown', onKey);
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    if (!isHome()) { addReplayLink(); showWatchBtn(); return; }
    if (hasSeen()) { addReplayLink(); showWatchBtn(); return; }
    if (reducedMotion()) { markSeen(); runReduced(); return; }

    document.documentElement.classList.add('intro-active');
    startTime = performance.now();
    createVO();
    loadCaptions(function() {});
    buildDOM();
    bindEvents();

    // Hide watch-trailer buttons during trailer
    document.querySelectorAll('.watch-trailer-btn').forEach(function(b) { b.style.display='none'; });

    var retries = 0;
    function loadGsap(cb) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js';
      s.onload = cb; s.onerror = function() { completeTrailer(); };
      document.head.appendChild(s);
    }
    function tryStart() {
      if (typeof gsap !== 'undefined') {
        tl = createTimeline();
        if (tl) tl.play();
        probeAutoplay().then(function(ok) {
          if (ok) { audioUnlocked=true; var s=score(); if(s&&s.isAvailable()) s.start(elapsed()).catch(function(){}); updateMuteBtn(); }
          else { buildPrompt(); }
        });
      } else {
        retries++;
        if (retries<40) setTimeout(tryStart, 50);
        else loadGsap(function() { if(typeof gsap!=='undefined') { tl=createTimeline(); if(tl) tl.play(); probeAutoplay().then(function(ok){ if(ok){audioUnlocked=true;var s=score();if(s&&s.isAvailable())s.start(elapsed()).catch(function(){});updateMuteBtn();}else{buildPrompt();} }); } else completeTrailer(); });
      }
    }
    requestAnimationFrame(function() { setTimeout(tryStart, 80); });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();

  window.__replayIntro = function() { try{localStorage.removeItem(STORAGE_KEY);}catch(e){} location.reload(); };
})();

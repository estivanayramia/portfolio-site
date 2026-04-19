/**
 * ============================================================================
 * CINEMATIC INTRO — AUDIO ENGINE
 * ============================================================================
 *
 * Procedural Web Audio API synthesis for the intro sequence.
 * Zero external audio files. Perfect sync. Graceful degradation.
 *
 * Architecture:
 * - Creates an AudioContext on first user interaction (autoplay-safe)
 * - Exposes a scheduling API that the intro controller calls at each phase
 * - All sounds are mathematically generated: oscillators, filtered noise,
 *   envelopes, and harmonic layering
 * - Master gain controls overall volume and enables smooth fade-outs
 * - Mute toggle provided for UI integration
 *
 * Audio UX Strategy:
 * - Intro starts visually immediately (no audio dependency)
 * - A tasteful "sound on" toggle appears alongside Skip
 * - First user click anywhere (skip, sound toggle, or overlay) attempts
 *   to resume the AudioContext and begin audio from current timeline position
 * - If AudioContext can't resume, everything still works silently
 * - Skip: master gain fades to 0 over 400ms, then context suspends
 * - Completion: master gain fades naturally with the visual sequence
 *
 * @version 1.0.0
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  var ctx = null;           // AudioContext
  var masterGain = null;    // Master gain node
  var isMuted = false;
  var isStarted = false;
  var isDestroyed = false;
  var scheduledNodes = [];  // Track all active nodes for cleanup
  var targetVolume = 0.35;  // Master volume (0–1), tuned for tasteful presence

  // ── AudioContext Creation ──────────────────────────────────────────────

  function getOrCreateContext() {
    if (ctx && ctx.state !== 'closed') return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = isMuted ? 0 : targetVolume;
      masterGain.connect(ctx.destination);
      return ctx;
    } catch (e) {
      return null;
    }
  }

  function resumeContext() {
    if (!ctx) getOrCreateContext();
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === 'suspended') {
      return ctx.resume().then(function () { return true; }).catch(function () { return false; });
    }
    return Promise.resolve(ctx.state === 'running');
  }

  // ── Utility: track nodes for cleanup ──────────────────────────────────

  function trackNode(node) {
    scheduledNodes.push(node);
    return node;
  }

  function cleanupNodes() {
    scheduledNodes.forEach(function (n) {
      try {
        if (n.stop) n.stop(0);
        if (n.disconnect) n.disconnect();
      } catch (e) {}
    });
    scheduledNodes = [];
  }

  // ── Sound Primitives ──────────────────────────────────────────────────

  /**
   * Creates a sine oscillator with an ADSR-like envelope
   * @param {number} freq - Frequency in Hz
   * @param {number} startTime - When to start (ctx.currentTime-relative)
   * @param {number} attack - Attack time in seconds
   * @param {number} sustain - Sustain time in seconds
   * @param {number} release - Release time in seconds
   * @param {number} peakGain - Peak amplitude (0–1)
   * @param {string} type - Oscillator type
   */
  function playTone(freq, startTime, attack, sustain, release, peakGain, type) {
    if (!ctx || isDestroyed) return;
    type = type || 'sine';
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.setValueAtTime(peakGain, startTime + attack + sustain);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + sustain + release);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + attack + sustain + release + 0.1);
    trackNode(osc);
    trackNode(gain);
    return { osc: osc, gain: gain };
  }

  /**
   * Filtered noise burst — for texture and transitions
   */
  function playNoise(startTime, duration, filterFreq, filterQ, peakGain) {
    if (!ctx || isDestroyed) return;
    var bufferSize = ctx.sampleRate * Math.min(duration + 1, 4);
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    var source = ctx.createBufferSource();
    source.buffer = buffer;

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq || 2000;
    filter.Q.value = filterQ || 2;

    var gain = ctx.createGain();
    var attack = Math.min(duration * 0.2, 0.3);
    var release = Math.min(duration * 0.4, 1.0);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain || 0.02, startTime + attack);
    gain.gain.setValueAtTime(peakGain || 0.02, startTime + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(startTime);
    source.stop(startTime + duration + 0.1);
    trackNode(source);
    trackNode(filter);
    trackNode(gain);
  }

  /**
   * Harmonic chord — multiple sines at harmonic intervals
   */
  function playChord(freqs, startTime, attack, sustain, release, peakGain) {
    if (!ctx || isDestroyed) return;
    var gainPerVoice = (peakGain || 0.08) / freqs.length;
    freqs.forEach(function (f) {
      playTone(f, startTime, attack, sustain, release, gainPerVoice, 'sine');
    });
  }

  /**
   * Sub-bass presence — very low sine with slow envelope
   */
  function playSubBass(freq, startTime, duration, peakGain) {
    if (!ctx || isDestroyed) return;
    playTone(freq || 40, startTime, duration * 0.3, duration * 0.4, duration * 0.3, peakGain || 0.06, 'sine');
  }

  /**
   * Crystalline ping — high-frequency harmonic with fast decay
   */
  function playPing(freq, startTime, peakGain) {
    if (!ctx || isDestroyed) return;
    playTone(freq, startTime, 0.01, 0.05, 0.8, peakGain || 0.04, 'sine');
    // Add a quiet harmonic overtone
    playTone(freq * 2.01, startTime + 0.01, 0.01, 0.03, 0.6, (peakGain || 0.04) * 0.3, 'sine');
  }

  /**
   * Warm pad swell — layered detuned sines for richness
   */
  function playPadSwell(baseFreq, startTime, attack, sustain, release, peakGain) {
    if (!ctx || isDestroyed) return;
    var detune = [0, 3, -3, 7, -7]; // cents
    detune.forEach(function (d) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = baseFreq;
      osc.detune.value = d;
      var totalDuration = attack + sustain + release;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime((peakGain || 0.03) / detune.length, startTime + attack);
      gain.gain.setValueAtTime((peakGain || 0.03) / detune.length, startTime + attack + sustain);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + totalDuration);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + totalDuration + 0.1);
      trackNode(osc);
      trackNode(gain);
    });
  }

  // ── Score: The Full Sonic Sequence ────────────────────────────────────

  /**
   * Schedules the entire intro soundscape.
   * Called once when audio is ready + intro is running.
   * @param {number} elapsed - How many seconds into the intro we already are
   */
  function scheduleScore(elapsed) {
    if (!ctx || isDestroyed) return;
    elapsed = elapsed || 0;
    var now = ctx.currentTime;
    var t = function (introTime) {
      return Math.max(0, now + introTime - elapsed);
    };

    // ── Phase 0: Sub-bass presence during darkness [0.0–0.6s]
    if (elapsed < 2.0) {
      playSubBass(38, t(0.0), 3.0, 0.05);
    }

    // ── Phase 1: Horizon line tone [0.6–2.2s]
    // A warm sine that rises subtly — system powering on
    if (elapsed < 2.5) {
      var lineOsc = ctx.createOscillator();
      var lineGain = ctx.createGain();
      lineOsc.type = 'sine';
      lineOsc.frequency.setValueAtTime(80, t(0.6));
      lineOsc.frequency.exponentialRampToValueAtTime(220, t(2.2));
      lineGain.gain.setValueAtTime(0, t(0.6));
      lineGain.gain.linearRampToValueAtTime(0.04, t(1.2));
      lineGain.gain.setValueAtTime(0.04, t(1.8));
      lineGain.gain.exponentialRampToValueAtTime(0.0001, t(2.8));
      lineOsc.connect(lineGain);
      lineGain.connect(masterGain);
      lineOsc.start(t(0.6));
      lineOsc.stop(t(3.0));
      trackNode(lineOsc);
      trackNode(lineGain);
    }

    // ── Phase 2: Fragment crystallization pings [2.2–5.0s]
    // Each word gets a delicate harmonic ping
    if (elapsed < 3.2) playPing(3520, t(2.3), 0.03);   // curiosity — high A7
    if (elapsed < 4.0) playPing(2960, t(3.1), 0.025);   // structure — F#7
    if (elapsed < 4.8) playPing(3960, t(3.9), 0.03);    // execution — B7

    // Filtered noise texture bed during fragments
    if (elapsed < 5.2) {
      playNoise(t(2.0), 3.5, 3000, 1.5, 0.012);
    }

    // ── Phase 3: Structural pulse during grid [3.8–5.5s]
    if (elapsed < 5.8) {
      playSubBass(55, t(3.8), 2.0, 0.04);
      // A quiet low tone adds weight
      playTone(110, t(4.0), 0.5, 0.8, 0.7, 0.02, 'sine');
    }

    // ── Phase 4: Transition tonal shift [5.5–7.0s]
    // Dissolve: noise tail + rising tone
    if (elapsed < 7.0) {
      playNoise(t(5.5), 2.0, 1500, 0.8, 0.008);
      // Rising anticipation tone
      var riseOsc = ctx.createOscillator();
      var riseGain = ctx.createGain();
      riseOsc.type = 'sine';
      riseOsc.frequency.setValueAtTime(165, t(5.5));
      riseOsc.frequency.exponentialRampToValueAtTime(330, t(7.0));
      riseGain.gain.setValueAtTime(0, t(5.5));
      riseGain.gain.linearRampToValueAtTime(0.025, t(6.2));
      riseGain.gain.exponentialRampToValueAtTime(0.0001, t(7.2));
      riseOsc.connect(riseGain);
      riseGain.connect(masterGain);
      riseOsc.start(t(5.5));
      riseOsc.stop(t(7.5));
      trackNode(riseOsc);
      trackNode(riseGain);
    }

    // ── Phase 5: Identity reveal — warm chord [6.8–9.0s]
    // Logo: soft accent
    if (elapsed < 8.0) {
      playPing(1760, t(6.9), 0.035);  // A6 ping for logo
    }

    // Name reveal: confident warm chord (A major voicing)
    // A2, E3, A3, C#4, E4
    if (elapsed < 10.0) {
      playChord(
        [110, 164.81, 220, 277.18, 329.63],
        t(7.9), 1.0, 1.5, 2.0, 0.10
      );
      // Warm pad swell underneath
      playPadSwell(110, t(7.8), 1.2, 2.0, 2.5, 0.04);
    }

    // ── Phase 6: Tagline warmth [9.0–10.2s]
    if (elapsed < 10.5) {
      // Subtle harmonic addition
      playTone(220, t(9.1), 0.5, 0.8, 1.5, 0.02, 'sine');
      playTone(329.63, t(9.2), 0.4, 0.6, 1.2, 0.015, 'sine');
    }

    // ── Phase 7: Hold — breathing decay [10.2–12.5s]
    if (elapsed < 12.0) {
      // Very quiet sustained low tone to keep presence
      playTone(110, t(10.2), 0.3, 1.0, 1.5, 0.012, 'sine');
      // Gentle filtered noise for air
      playNoise(t(10.5), 2.5, 2500, 0.5, 0.005);
    }

    // ── Phase 8: Final reveal resolution [12.5–14.0s]
    // Everything fades — a final warm resolution chord
    if (elapsed < 14.0) {
      // Resolving chord: A major, bright and warm, fading
      playChord(
        [110, 164.81, 220, 277.18, 440],
        t(12.5), 0.3, 0.5, 1.5, 0.06
      );
      // Sub-bass resolution
      playSubBass(55, t(12.5), 2.0, 0.03);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  var API = {
    /**
     * Attempt to initialize and start audio.
     * Should be called on user interaction.
     * @param {number} elapsed - Seconds already elapsed in intro
     * @returns {Promise<boolean>} - Whether audio started successfully
     */
    start: function (elapsed) {
      if (isDestroyed) return Promise.resolve(false);
      if (isStarted) {
        if (masterGain && ctx && ctx.state === 'running') {
          try {
            var now = ctx.currentTime;
            masterGain.gain.cancelScheduledValues(now);
            masterGain.gain.setValueAtTime(masterGain.gain.value, now);
            masterGain.gain.linearRampToValueAtTime(isMuted ? 0.0001 : targetVolume, now + 0.05);
          } catch (e) {}
        }
        return Promise.resolve(true);
      }
      return resumeContext().then(function (running) {
        if (!running) return false;
        isStarted = true;
        masterGain.gain.value = isMuted ? 0 : targetVolume;
        scheduleScore(elapsed || 0);
        return true;
      });
    },

    /**
     * Fade out and stop all audio (for skip)
     * @param {number} fadeDuration - Fade duration in seconds
     */
    fadeOut: function (fadeDuration) {
      if (!ctx || !masterGain || isDestroyed) return;
      fadeDuration = fadeDuration || 0.4;
      try {
        var now = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
      } catch (e) {}
      // Clean up after fade
      setTimeout(function () {
        API.destroy();
      }, (fadeDuration + 0.2) * 1000);
    },

    /**
     * Cleanly destroy all audio resources
     */
    destroy: function () {
      if (isDestroyed) return;
      isDestroyed = true;
      cleanupNodes();
      if (ctx && ctx.state !== 'closed') {
        try { ctx.close(); } catch (e) {}
      }
      ctx = null;
      masterGain = null;
    },

    /**
     * Toggle mute state
     * @returns {boolean} New mute state
     */
    toggleMute: function () {
      isMuted = !isMuted;
      if (masterGain && ctx && ctx.state === 'running') {
        try {
          var now = ctx.currentTime;
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setValueAtTime(masterGain.gain.value, now);
          if (isMuted) {
            masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
          } else {
            masterGain.gain.linearRampToValueAtTime(targetVolume, now + 0.15);
          }
        } catch (e) {}
      }
      return isMuted;
    },

    /**
     * Get current mute state
     */
    isMuted: function () {
      return isMuted;
    },

    /**
     * Check if audio engine is available (browser supports Web Audio)
     */
    isAvailable: function () {
      return !!(window.AudioContext || window.webkitAudioContext);
    },

    /**
     * Check if audio has been started
     */
    isActive: function () {
      return isStarted && !isDestroyed;
    }
  };

  // Export to global scope for intro controller
  window.__introAudio = API;

})();

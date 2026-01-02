import { Achievements } from "../achievements.js";

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function isMobileDevice() {
  return MOBILE_UA.test(navigator.userAgent) || window.innerWidth <= 768;
}

export function initSoundToggle(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  const stored = localStorage.getItem("gameSoundsEnabled");
  const enabled = stored === null ? !isMobileDevice() : stored !== "false";
  localStorage.setItem("gameSoundsEnabled", enabled ? "true" : "false");

  const update = () => {
    const nowEnabled = localStorage.getItem("gameSoundsEnabled") !== "false";
    btn.textContent = nowEnabled ? "🔊" : "🔇";
    btn.setAttribute("aria-pressed", nowEnabled ? "true" : "false");
  };

  btn.addEventListener("click", () => {
    const nowEnabled = localStorage.getItem("gameSoundsEnabled") !== "false";
    localStorage.setItem("gameSoundsEnabled", (!nowEnabled).toString());
    update();
  });

  update();
}

let audioContext = null;

function ensureAudioContext() {
  if (audioContext) return audioContext;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    audioContext = null;
  }
  return audioContext;
}

function ensureAudioRunning() {
  const ctx = ensureAudioContext();
  if (!ctx) return null;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {}
  return ctx;
}

export function playBeep(freq, duration, type = "sine", volume = 0.25) {
  if (localStorage.getItem("gameSoundsEnabled") === "false") return;
  const ctx = ensureAudioRunning();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = freq;
  osc.type = type;

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function addVisibilityPause({
  isRunning,
  pause,
  resume,
}) {
  let pausedByVisibility = false;
  let wasRunning = false;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      wasRunning = !!isRunning();
      if (wasRunning) {
        pausedByVisibility = true;
        pause();
      }
      return;
    }

    if (pausedByVisibility) {
      pausedByVisibility = false;
      if (wasRunning) resume();
      wasRunning = false;
    }
  });
}

export function unlock(achievementId, meta) {
  Achievements.unlock(achievementId, meta);
}

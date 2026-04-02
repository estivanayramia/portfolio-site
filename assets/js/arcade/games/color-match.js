import { isMobileDevice, initSoundToggle, playBeep, addVisibilityPause } from './_shared.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let W, H;
function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  W = rect.width;
  H = Math.min(W * 1.2, window.innerHeight * 0.75);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', resize);

// --- Colors ---
const COLORS = [
  { name: 'RED',    hex: '#ff3b5c', glow: '#ff3b5c' },
  { name: 'BLUE',   hex: '#3b8bff', glow: '#3b8bff' },
  { name: 'GREEN',  hex: '#3bff7e', glow: '#3bff7e' },
  { name: 'YELLOW', hex: '#ffd53b', glow: '#ffd53b' },
  { name: 'PURPLE', hex: '#c23bff', glow: '#c23bff' },
  { name: 'ORANGE', hex: '#ff8c3b', glow: '#ff8c3b' },
];

// --- State ---
const STATE = { MENU: 0, PLAYING: 1, GAMEOVER: 2 };
let state = STATE.MENU;
let running = false;
let score = 0;
let bestScore = parseInt(localStorage.getItem('colormatch-best') || '0');
let combo = 0;
let maxCombo = 0;
let multiplier = 1;
let timeLeft = 60;
let lastTime = 0;
let frameCount = 0;
let currentWordColor = null;   // Color object for the displayed TEXT COLOR
let currentWordMeaning = null; // Color object for what the WORD SAYS
let correctAnswers = 0;
let wrongAnswers = 0;

// Buttons layout
let buttons = [];
let displayedChoices = [];
let feedbackFlash = null; // { correct: bool, time: 0 }

// Particles
let particles = [];
let bgHue = 0;

// Streak fire
let streakParticles = [];

function pickRound() {
  // Pick the word meaning and text color (Stroop effect)
  currentWordMeaning = COLORS[Math.floor(Math.random() * COLORS.length)];
  let textColorIdx;
  do {
    textColorIdx = Math.floor(Math.random() * COLORS.length);
  } while (Math.random() > 0.35 && textColorIdx === COLORS.indexOf(currentWordMeaning));
  currentWordColor = COLORS[textColorIdx];

  // Pick 3-4 choices that include the correct text color
  const numChoices = Math.min(4, 3 + Math.floor(score / 50));
  const choices = new Set();
  choices.add(COLORS.indexOf(currentWordColor)); // correct answer = match the TEXT COLOR
  while (choices.size < numChoices) {
    choices.add(Math.floor(Math.random() * COLORS.length));
  }
  displayedChoices = [...choices].sort(() => Math.random() - 0.5);
  layoutButtons();
}

function layoutButtons() {
  buttons = [];
  const btnH = 52;
  const gap = 14;
  const totalH = displayedChoices.length * btnH + (displayedChoices.length - 1) * gap;
  const startY = H * 0.58 - totalH / 2;
  const btnW = Math.min(W * 0.65, 240);
  const startX = (W - btnW) / 2;

  for (let i = 0; i < displayedChoices.length; i++) {
    const ci = displayedChoices[i];
    buttons.push({
      x: startX, y: startY + i * (btnH + gap),
      w: btnW, h: btnH,
      colorIdx: ci,
      hover: false,
      scale: 1
    });
  }
}

function handleClick(px, py) {
  if (state === STATE.MENU) {
    state = STATE.PLAYING;
    running = true;
    startGame();
    return;
  }
  if (state === STATE.GAMEOVER) {
    state = STATE.MENU;
    return;
  }
  if (state !== STATE.PLAYING) return;

  for (const btn of buttons) {
    if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
      const correct = btn.colorIdx === COLORS.indexOf(currentWordColor);
      if (correct) {
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        multiplier = 1 + Math.floor(combo / 3);
        const pts = 10 * multiplier;
        score += pts;
        correctAnswers++;
        feedbackFlash = { correct: true, time: 1 };
        playBeep(520 + combo * 30, 0.1, 'sine', 0.15);

        // Streak particles
        if (combo >= 3) {
          for (let i = 0; i < 12; i++) {
            streakParticles.push({
              x: W / 2 + (Math.random() - 0.5) * 80,
              y: H * 0.28,
              vx: (Math.random() - 0.5) * 6,
              vy: -Math.random() * 4 - 2,
              life: 1,
              r: Math.random() * 5 + 2,
              hue: Math.random() * 60 + 10
            });
          }
        }
      } else {
        combo = 0;
        multiplier = 1;
        wrongAnswers++;
        feedbackFlash = { correct: false, time: 1 };
        playBeep(180, 0.15, 'sawtooth', 0.12);
      }
      pickRound();
      break;
    }
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W / rect.width);
  const py = (e.clientY - rect.top) * (H / rect.height);
  handleClick(px, py);
});

// Keyboard shortcuts: 1-4
document.addEventListener('keydown', (e) => {
  if (state === STATE.MENU && (e.code === 'Space' || e.code === 'Enter')) {
    state = STATE.PLAYING;
    running = true;
    startGame();
    return;
  }
  if (state === STATE.GAMEOVER && (e.code === 'Space' || e.code === 'Enter')) {
    state = STATE.MENU;
    return;
  }
  if (state === STATE.PLAYING) {
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < buttons.length) {
      const btn = buttons[idx];
      const cx = btn.x + btn.w / 2;
      const cy = btn.y + btn.h / 2;
      handleClick(cx, cy);
    }
  }
});

function startGame() {
  score = 0;
  combo = 0;
  maxCombo = 0;
  multiplier = 1;
  timeLeft = 60;
  correctAnswers = 0;
  wrongAnswers = 0;
  lastTime = performance.now();
  feedbackFlash = null;
  particles = [];
  streakParticles = [];
  pickRound();
}

// --- Draw ---
function drawBackground() {
  bgHue = (bgHue + 0.15) % 360;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, `hsl(${bgHue}, 30%, 8%)`);
  bg.addColorStop(0.5, `hsl(${(bgHue + 40) % 360}, 25%, 6%)`);
  bg.addColorStop(1, `hsl(${(bgHue + 80) % 360}, 30%, 8%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient moving circles
  const t = frameCount * 0.005;
  for (let i = 0; i < 5; i++) {
    const cx = W * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t + i * 1.3)));
    const cy = H * (0.2 + 0.6 * (0.5 + 0.5 * Math.cos(t * 0.7 + i * 1.7)));
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 + i * 20);
    grad.addColorStop(0, `hsla(${(bgHue + i * 60) % 360}, 60%, 50%, 0.06)`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawColorWord() {
  if (!currentWordMeaning || !currentWordColor) return;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow
  ctx.shadowColor = currentWordColor.glow;
  ctx.shadowBlur = 25;
  ctx.fillStyle = currentWordColor.hex;
  ctx.font = 'bold 52px Inter, sans-serif';
  ctx.fillText(currentWordMeaning.name, W / 2, H * 0.2);
  ctx.shadowBlur = 0;

  // Instruction
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('Match the TEXT COLOR, not the word!', W / 2, H * 0.28);
}

function drawButtons() {
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const c = COLORS[btn.colorIdx];

    ctx.save();
    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(btn.scale, btn.scale);
    ctx.translate(-cx, -cy);

    // Button background
    ctx.fillStyle = `${c.hex}22`;
    ctx.strokeStyle = c.hex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fill();
    ctx.stroke();

    // Glow
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = c.hex;
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.name, cx, cy);

    // Number hint
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, btn.x + 12, cy);

    ctx.restore();
  }
}

function drawHUD() {
  // Timer
  ctx.textAlign = 'left';
  ctx.fillStyle = timeLeft < 10 ? '#ff4040' : '#fff';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText(`${Math.ceil(timeLeft)}s`, 16, 32);

  // Score
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText(score.toString(), W - 16, 32);

  // Combo
  if (combo >= 2) {
    ctx.textAlign = 'center';
    const pulse = 1 + 0.05 * Math.sin(frameCount * 0.2);
    ctx.save();
    ctx.translate(W / 2, 32);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(`${combo}x COMBO!`, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(`x${multiplier} multiplier`, 0, 18);
    ctx.restore();
  }

  // Timer bar
  const barW = W - 32;
  const barH = 4;
  const barY = H - 16;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.roundRect(16, barY, barW, barH, 2);
  ctx.fill();
  const frac = timeLeft / 60;
  const barColor = frac > 0.3 ? '#3bff7e' : frac > 0.15 ? '#ffd53b' : '#ff3b5c';
  ctx.fillStyle = barColor;
  ctx.shadowColor = barColor;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.roundRect(16, barY, barW * frac, barH, 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawFeedback() {
  if (!feedbackFlash || feedbackFlash.time <= 0) return;
  const alpha = feedbackFlash.time * 0.15;
  ctx.fillStyle = feedbackFlash.correct
    ? `rgba(59,255,126,${alpha})`
    : `rgba(255,59,92,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function drawStreakParticles() {
  for (const p of streakParticles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
    ctx.shadowColor = `hsl(${p.hue}, 100%, 65%)`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawMenuScreen() {
  drawBackground();
  ctx.textAlign = 'center';

  // Title
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#c23bff';
  ctx.shadowBlur = 25;
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.fillText('Color Match', W / 2, H * 0.25);
  ctx.shadowBlur = 0;

  // Animated color preview
  const t = frameCount * 0.03;
  for (let i = 0; i < COLORS.length; i++) {
    const angle = t + (i / COLORS.length) * Math.PI * 2;
    const cx = W / 2 + Math.cos(angle) * 60;
    const cy = H * 0.42 + Math.sin(angle) * 30;
    ctx.fillStyle = COLORS[i].hex;
    ctx.shadowColor = COLORS[i].glow;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '15px Inter, sans-serif';
  ctx.fillText('Match the TEXT COLOR in 60 seconds', W / 2, H * 0.55);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(isMobileDevice() ? 'Tap to start' : 'Press Space to start', W / 2, H * 0.65);

  if (bestScore > 0) {
    ctx.fillStyle = 'rgba(255,213,59,0.8)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(`Best: ${bestScore}`, W / 2, H * 0.72);
  }
}

function drawGameOverScreen() {
  drawBackground();

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('Time\'s Up!', W / 2, H * 0.2);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 56px Inter, sans-serif';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 15;
  ctx.fillText(score.toString(), W / 2, H * 0.35);
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`Best combo: ${maxCombo}x`, W / 2, H * 0.45);
  ctx.fillText(`Correct: ${correctAnswers}  |  Wrong: ${wrongAnswers}`, W / 2, H * 0.52);

  if (score >= bestScore && score > 0) {
    ctx.fillStyle = '#3bff7e';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText('NEW BEST!', W / 2, H * 0.6);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(isMobileDevice() ? 'Tap to continue' : 'Press Space to continue', W / 2, H * 0.72);
}

// --- Update ---
function update() {
  frameCount++;
  if (state !== STATE.PLAYING) return;

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  timeLeft -= dt;

  if (timeLeft <= 0) {
    timeLeft = 0;
    state = STATE.GAMEOVER;
    running = false;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('colormatch-best', bestScore.toString());
    }
    playBeep(300, 0.3, 'triangle', 0.15);
    return;
  }

  if (feedbackFlash) {
    feedbackFlash.time -= 0.04;
    if (feedbackFlash.time <= 0) feedbackFlash = null;
  }

  for (const p of streakParticles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= 0.02;
  }
  streakParticles = streakParticles.filter(p => p.life > 0);
}

function gameLoop() {
  update();

  if (state === STATE.MENU) {
    drawMenuScreen();
  } else if (state === STATE.GAMEOVER) {
    drawGameOverScreen();
  } else {
    drawBackground();
    drawColorWord();
    drawButtons();
    drawStreakParticles();
    drawHUD();
    drawFeedback();
  }

  requestAnimationFrame(gameLoop);
}

// --- Init ---
initSoundToggle('sound-toggle-colormatch');
addVisibilityPause({
  isRunning: () => running,
  pause: () => { running = false; },
  resume: () => {
    if (state === STATE.PLAYING) {
      running = true;
      lastTime = performance.now();
    }
  }
});
gameLoop();

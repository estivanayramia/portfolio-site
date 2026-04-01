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

// --- State ---
const STATE = { MENU: 0, PLAYING: 1, DEAD: 2 };
let state = STATE.MENU;
let running = false;
let score = 0;
let bestScore = parseInt(localStorage.getItem('flappy-best') || '0');
let frameCount = 0;

// --- Face (player) ---
const face = { x: 0, y: 0, vy: 0, radius: 18, rotation: 0 };
const GRAVITY = 0.45;
const FLAP_FORCE = -7.2;
const MAX_VY = 10;

// --- Pipes ---
let pipes = [];
const PIPE_WIDTH = 54;
let pipeGap = 150;
let pipeSpeed = 2.8;
let pipeTimer = 0;
const PIPE_INTERVAL = 100;

// --- Particles ---
let particles = [];
let deathParticles = [];

// --- Screen shake ---
let shakeX = 0, shakeY = 0, shakeMag = 0;

// --- Background layers ---
const bgStars = Array.from({ length: 40 }, () => ({
  x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.5 + 0.5, twinkle: Math.random() * Math.PI * 2
}));

// --- Floating score popups ---
let popups = [];

function reset() {
  face.x = W * 0.25;
  face.y = H * 0.45;
  face.vy = 0;
  face.rotation = 0;
  pipes = [];
  particles = [];
  deathParticles = [];
  popups = [];
  score = 0;
  frameCount = 0;
  pipeGap = 150;
  pipeSpeed = 2.8;
  pipeTimer = 60;
  shakeMag = 0;
}

function flap() {
  if (state === STATE.MENU) {
    state = STATE.PLAYING;
    running = true;
    reset();
  }
  if (state === STATE.PLAYING) {
    face.vy = FLAP_FORCE;
    playBeep(440, 0.08, 'sine', 0.15);
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: face.x - face.radius * 0.5,
        y: face.y + (Math.random() - 0.5) * face.radius,
        vx: -Math.random() * 2 - 1,
        vy: (Math.random() - 0.5) * 2,
        life: 1,
        r: Math.random() * 4 + 2,
        color: `hsl(${40 + Math.random() * 30}, 90%, 65%)`
      });
    }
  }
  if (state === STATE.DEAD) {
    state = STATE.MENU;
  }
}

// --- Input ---
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
});

function spawnPipe() {
  const minY = pipeGap * 0.6 + 30;
  const maxY = H - pipeGap * 0.6 - 30;
  const gapCenter = minY + Math.random() * (maxY - minY);
  pipes.push({ x: W + PIPE_WIDTH, gapCenter, scored: false });
}

function die() {
  state = STATE.DEAD;
  running = false;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappy-best', bestScore.toString());
  }
  shakeMag = 12;
  playBeep(180, 0.3, 'sawtooth', 0.2);
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    deathParticles.push({
      x: face.x, y: face.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, r: Math.random() * 6 + 3,
      color: `hsl(${Math.random() * 60 + 10}, 90%, 60%)`
    });
  }
}

// --- Draw functions ---
function drawBackground() {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#0a0e27');
  skyGrad.addColorStop(0.4, '#1a1a4e');
  skyGrad.addColorStop(0.7, '#2d1b69');
  skyGrad.addColorStop(1, '#1a0a3e');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Stars
  const t = frameCount * 0.02;
  for (const s of bgStars) {
    const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t + s.twinkle));
    ctx.fillStyle = `rgba(255,255,230,${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Parallax hills
  const scroll = state === STATE.PLAYING ? frameCount * 0.3 : frameCount * 0.1;
  drawHills(H * 0.75, 80, scroll * 0.3, 'rgba(30,15,60,0.7)');
  drawHills(H * 0.82, 50, scroll * 0.6, 'rgba(20,10,50,0.8)');
  drawHills(H * 0.9, 30, scroll, 'rgba(15,8,40,0.9)');

  // Ground
  const gndGrad = ctx.createLinearGradient(0, H - 20, 0, H);
  gndGrad.addColorStop(0, '#2a1555');
  gndGrad.addColorStop(1, '#15082e');
  ctx.fillStyle = gndGrad;
  ctx.fillRect(0, H - 20, W, 20);
}

function drawHills(baseY, amplitude, offset, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const y = baseY - amplitude * (0.5 + 0.5 * Math.sin((x + offset) * 0.01)) -
              amplitude * 0.3 * (0.5 + 0.5 * Math.sin((x + offset) * 0.025 + 1));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function drawPipe(pipe) {
  const topBottom = pipe.gapCenter - pipeGap / 2;
  const botTop = pipe.gapCenter + pipeGap / 2;
  const capH = 12;
  const capExtra = 6;

  // Top pipe
  const topGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
  topGrad.addColorStop(0, '#6c3cb0');
  topGrad.addColorStop(0.5, '#9b59d0');
  topGrad.addColorStop(1, '#6c3cb0');
  ctx.fillStyle = topGrad;
  ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topBottom);

  // Top cap
  ctx.fillStyle = '#a45de0';
  ctx.beginPath();
  ctx.roundRect(pipe.x - capExtra, topBottom - capH, PIPE_WIDTH + capExtra * 2, capH + 4, [6, 6, 0, 0]);
  ctx.fill();

  // Glow on cap
  ctx.shadowColor = '#a45de0';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#c080f0';
  ctx.fillRect(pipe.x + 4, topBottom - capH + 2, PIPE_WIDTH - 8, 3);
  ctx.shadowBlur = 0;

  // Bottom pipe
  ctx.fillStyle = topGrad;
  ctx.fillRect(pipe.x, botTop, PIPE_WIDTH, H - botTop);

  // Bottom cap
  ctx.fillStyle = '#a45de0';
  ctx.beginPath();
  ctx.roundRect(pipe.x - capExtra, botTop - 4, PIPE_WIDTH + capExtra * 2, capH + 4, [0, 0, 6, 6]);
  ctx.fill();

  ctx.shadowColor = '#a45de0';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#c080f0';
  ctx.fillRect(pipe.x + 4, botTop + capH - 2, PIPE_WIDTH - 8, 3);
  ctx.shadowBlur = 0;
}

function drawFace() {
  ctx.save();
  ctx.translate(face.x, face.y);
  const targetRot = Math.min(Math.max(face.vy * 0.06, -0.5), 0.7);
  face.rotation += (targetRot - face.rotation) * 0.15;
  ctx.rotate(face.rotation);

  // Glow
  ctx.shadowColor = '#ffc040';
  ctx.shadowBlur = 20;

  // Head
  const r = face.radius;
  const headGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  headGrad.addColorStop(0, '#ffe0a0');
  headGrad.addColorStop(0.6, '#ffcc55');
  headGrad.addColorStop(1, '#e8a020');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Eyes
  ctx.fillStyle = '#2a1a00';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.15, r * 0.12, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.32, -r * 0.15, r * 0.12, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.25, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.36, -r * 0.25, r * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#6b3a00';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (face.vy < 0) {
    ctx.arc(0, r * 0.15, r * 0.3, 0.2, Math.PI - 0.2);
  } else {
    ctx.arc(0, r * 0.25, r * 0.25, Math.PI + 0.3, -0.3);
  }
  ctx.stroke();

  // Cheeks
  ctx.fillStyle = 'rgba(255,120,80,0.25)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.55, r * 0.2, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.55, r * 0.2, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of deathParticles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  for (const p of popups) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${18 + (1 - p.life) * 8}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.fillText('+1', p.x, p.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText(score, W / 2, 50);
  ctx.shadowBlur = 0;
}

function drawMenuScreen() {
  ctx.fillStyle = 'rgba(5,5,20,0.55)';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd060';
  ctx.shadowColor = '#ffa000';
  ctx.shadowBlur = 20;
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.fillText('Flappy Face', W / 2, H * 0.3);
  ctx.shadowBlur = 0;

  // Floating face preview
  const bob = Math.sin(frameCount * 0.04) * 10;
  ctx.save();
  ctx.translate(W / 2, H * 0.45 + bob);
  const r = 28;
  const headGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  headGrad.addColorStop(0, '#ffe0a0');
  headGrad.addColorStop(1, '#e8a020');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a00';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.15, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.32, -r * 0.15, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(isMobileDevice() ? 'Tap to start' : 'Press Space or click to start', W / 2, H * 0.65);

  if (bestScore > 0) {
    ctx.fillStyle = 'rgba(255,208,96,0.8)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(`Best: ${bestScore}`, W / 2, H * 0.72);
  }
}

function drawDeadScreen() {
  ctx.fillStyle = 'rgba(5,5,20,0.65)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6060';
  ctx.shadowColor = '#ff3030';
  ctx.shadowBlur = 15;
  ctx.font = 'bold 38px Inter, sans-serif';
  ctx.fillText('Game Over', W / 2, H * 0.3);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Inter, sans-serif';
  ctx.fillText(score, W / 2, H * 0.43);

  ctx.fillStyle = 'rgba(255,208,96,0.9)';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(`Best: ${bestScore}`, W / 2, H * 0.52);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(isMobileDevice() ? 'Tap to restart' : 'Press Space to restart', W / 2, H * 0.65);
}

// --- Update ---
function update() {
  frameCount++;
  if (state !== STATE.PLAYING) return;

  face.vy += GRAVITY;
  if (face.vy > MAX_VY) face.vy = MAX_VY;
  face.y += face.vy;

  // Trail particles
  if (frameCount % 3 === 0) {
    particles.push({
      x: face.x - face.radius * 0.5,
      y: face.y + (Math.random() - 0.5) * face.radius * 0.5,
      vx: -Math.random() * 1.5 - 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      life: 1,
      r: Math.random() * 3 + 1,
      color: `hsl(${35 + Math.random() * 20}, 80%, 65%)`
    });
  }

  // Pipes
  pipeTimer++;
  if (pipeTimer >= PIPE_INTERVAL) {
    pipeTimer = 0;
    spawnPipe();
  }

  for (const pipe of pipes) {
    pipe.x -= pipeSpeed;
    // Scoring
    if (!pipe.scored && pipe.x + PIPE_WIDTH < face.x) {
      pipe.scored = true;
      score++;
      playBeep(660, 0.1, 'sine', 0.12);
      popups.push({ x: face.x, y: face.y - 30, life: 1 });

      // Difficulty ramp
      if (score % 5 === 0) {
        pipeGap = Math.max(100, pipeGap - 3);
        pipeSpeed = Math.min(5.5, pipeSpeed + 0.12);
      }
    }

    // Collision
    const topBottom = pipe.gapCenter - pipeGap / 2;
    const botTop = pipe.gapCenter + pipeGap / 2;
    if (face.x + face.radius > pipe.x && face.x - face.radius < pipe.x + PIPE_WIDTH) {
      if (face.y - face.radius < topBottom || face.y + face.radius > botTop) {
        die();
        return;
      }
    }
  }
  pipes = pipes.filter(p => p.x + PIPE_WIDTH > -20);

  // Ceiling/floor
  if (face.y - face.radius < 0 || face.y + face.radius > H - 20) {
    die();
    return;
  }

  // Update particles
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy; p.life -= 0.025;
  }
  particles = particles.filter(p => p.life > 0);

  for (const p of popups) { p.y -= 1.2; p.life -= 0.02; }
  popups = popups.filter(p => p.life > 0);

  // Shake decay
  if (shakeMag > 0) {
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag;
    shakeMag *= 0.85;
    if (shakeMag < 0.5) shakeMag = 0;
  } else {
    shakeX = 0; shakeY = 0;
  }
}

function updateDeath() {
  for (const p of deathParticles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.015;
  }
  deathParticles = deathParticles.filter(p => p.life > 0);
}

// --- Main loop ---
function gameLoop() {
  update();
  updateDeath();

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawBackground();
  for (const pipe of pipes) drawPipe(pipe);
  drawParticles();
  if (state === STATE.PLAYING || state === STATE.DEAD) drawFace();
  drawPopups();
  if (state === STATE.PLAYING) drawHUD();
  ctx.restore();

  if (state === STATE.MENU) drawMenuScreen();
  if (state === STATE.DEAD) drawDeadScreen();

  requestAnimationFrame(gameLoop);
}

// --- Init ---
initSoundToggle('sound-toggle-flappy');
addVisibilityPause({
  isRunning: () => running,
  pause: () => { running = false; },
  resume: () => { if (state === STATE.PLAYING) running = true; }
});
reset();
gameLoop();

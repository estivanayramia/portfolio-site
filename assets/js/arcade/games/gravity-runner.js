import { isMobileDevice, initSoundToggle, playBeep, addVisibilityPause } from './_shared.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let W, H;
function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  W = rect.width;
  H = Math.min(W * 0.7, window.innerHeight * 0.65);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener('resize', resize);

// --- Constants ---
const PLATFORM_H = 16;
const RUNNER_W = 20;
const RUNNER_H = 32;
const GRAVITY_ACC = 0.6;
const FLIP_SPEED = 12;

// --- State ---
const STATE = { MENU: 0, PLAYING: 1, DEAD: 2 };
let state = STATE.MENU;
let running = false;
let frameCount = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('gravrunner-best') || '0');
let distance = 0;

// --- Runner ---
const runner = {
  x: 0, y: 0, vy: 0,
  gravityDir: 1, // 1 = down, -1 = up
  onGround: false,
  shieldTimer: 0,
  slowTimer: 0,
  magnetTimer: 0,
  width: RUNNER_W,
  height: RUNNER_H,
  runFrame: 0
};

// --- World ---
let gameSpeed = 3.5;
let obstacles = [];
let coins = [];
let powerups = [];
let trailParticles = [];
let deathParticles = [];
let bgOffset = 0;
let spawnTimer = 0;
let coinTimer = 0;
let powerupTimer = 0;

// Grid lines for background
const gridLines = [];
for (let i = 0; i < 30; i++) {
  gridLines.push({ x: (i / 30) * 1200 });
}

function reset() {
  runner.x = W * 0.2;
  runner.y = H - PLATFORM_H - RUNNER_H;
  runner.vy = 0;
  runner.gravityDir = 1;
  runner.onGround = true;
  runner.shieldTimer = 0;
  runner.slowTimer = 0;
  runner.magnetTimer = 0;
  runner.runFrame = 0;
  obstacles = [];
  coins = [];
  powerups = [];
  trailParticles = [];
  deathParticles = [];
  score = 0;
  distance = 0;
  gameSpeed = 3.5;
  spawnTimer = 0;
  coinTimer = 0;
  powerupTimer = 0;
  frameCount = 0;
}

function flipGravity() {
  if (state === STATE.MENU) {
    state = STATE.PLAYING;
    running = true;
    reset();
    return;
  }
  if (state === STATE.DEAD) {
    state = STATE.MENU;
    return;
  }
  if (state === STATE.PLAYING && runner.onGround) {
    runner.gravityDir *= -1;
    runner.vy = -runner.gravityDir * FLIP_SPEED;
    runner.onGround = false;
    playBeep(runner.gravityDir === 1 ? 350 : 550, 0.08, 'sine', 0.12);

    for (let i = 0; i < 8; i++) {
      trailParticles.push({
        x: runner.x,
        y: runner.y + RUNNER_H / 2,
        vx: -Math.random() * 3 - 1,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        r: Math.random() * 4 + 2,
        hue: 180 + Math.random() * 60
      });
    }
  }
}

// --- Input ---
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flipGravity(); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    e.preventDefault();
    flipGravity();
  }
});

function spawnObstacle() {
  const side = Math.random() < 0.5 ? 'floor' : 'ceiling';
  const w = 20 + Math.random() * 20;
  const h = 25 + Math.random() * 35;
  obstacles.push({
    x: W + 20,
    w, h,
    side,
    y: side === 'floor' ? H - PLATFORM_H - h : PLATFORM_H
  });
}

function spawnCoin() {
  const y = PLATFORM_H + 30 + Math.random() * (H - PLATFORM_H * 2 - 60);
  coins.push({ x: W + 20, y, r: 8, glow: 0 });
}

function spawnPowerup() {
  const types = ['shield', 'slow', 'magnet'];
  const type = types[Math.floor(Math.random() * types.length)];
  const y = PLATFORM_H + 40 + Math.random() * (H - PLATFORM_H * 2 - 80);
  powerups.push({ x: W + 20, y, type, r: 12 });
}

function die() {
  if (runner.shieldTimer > 0) {
    runner.shieldTimer = 0;
    playBeep(600, 0.15, 'triangle', 0.15);
    return;
  }
  state = STATE.DEAD;
  running = false;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('gravrunner-best', bestScore.toString());
  }
  playBeep(150, 0.35, 'sawtooth', 0.2);

  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    deathParticles.push({
      x: runner.x + RUNNER_W / 2,
      y: runner.y + RUNNER_H / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, r: Math.random() * 5 + 2,
      hue: 0 + Math.random() * 40
    });
  }
}

// --- Draw ---
function drawBackground() {
  // Dark geometric background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0a1a');
  bg.addColorStop(0.5, '#0d1025');
  bg.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Moving grid
  ctx.strokeStyle = 'rgba(0,255,200,0.04)';
  ctx.lineWidth = 1;
  const gridSpacing = 40;
  const offset = bgOffset % gridSpacing;
  for (let x = -offset; x < W; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Platforms with glow
  const floorGrad = ctx.createLinearGradient(0, H - PLATFORM_H, 0, H);
  floorGrad.addColorStop(0, '#00ffc8');
  floorGrad.addColorStop(1, '#006650');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, H - PLATFORM_H, W, PLATFORM_H);

  const ceilGrad = ctx.createLinearGradient(0, 0, 0, PLATFORM_H);
  ceilGrad.addColorStop(0, '#006650');
  ceilGrad.addColorStop(1, '#00ffc8');
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, W, PLATFORM_H);

  // Platform glow lines
  ctx.shadowColor = '#00ffc8';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#00ffc8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - PLATFORM_H);
  ctx.lineTo(W, H - PLATFORM_H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, PLATFORM_H);
  ctx.lineTo(W, PLATFORM_H);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawRunner() {
  const cx = runner.x + RUNNER_W / 2;
  const cy = runner.y + RUNNER_H / 2;

  ctx.save();
  ctx.translate(cx, cy);
  if (runner.gravityDir === -1) ctx.scale(1, -1);

  // Body glow
  ctx.shadowColor = runner.shieldTimer > 0 ? '#00d4ff' : '#00ffc8';
  ctx.shadowBlur = 15;

  // Body (geometric humanoid)
  const bw = RUNNER_W;
  const bh = RUNNER_H;

  // Torso
  ctx.fillStyle = '#00ffc8';
  ctx.fillRect(-bw / 2, -bh * 0.3, bw, bh * 0.4);

  // Head
  ctx.fillStyle = '#40ffe0';
  ctx.beginPath();
  ctx.arc(0, -bh * 0.35, bw * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Eye visor
  ctx.fillStyle = '#fff';
  ctx.fillRect(-bw * 0.25, -bh * 0.4, bw * 0.5, bh * 0.08);

  // Legs (animated)
  runner.runFrame += 0.15;
  const legPhase = Math.sin(runner.runFrame * 3);
  ctx.strokeStyle = '#00ffc8';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // Left leg
  ctx.beginPath();
  ctx.moveTo(-bw * 0.2, bh * 0.1);
  ctx.lineTo(-bw * 0.3 + legPhase * 6, bh * 0.5);
  ctx.stroke();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(bw * 0.2, bh * 0.1);
  ctx.lineTo(bw * 0.3 - legPhase * 6, bh * 0.5);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Shield bubble
  if (runner.shieldTimer > 0) {
    ctx.strokeStyle = `rgba(0,212,255,${0.4 + 0.3 * Math.sin(frameCount * 0.15)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, bh * 0.65, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawObstacles() {
  for (const obs of obstacles) {
    const grad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
    grad.addColorStop(0, '#ff3060');
    grad.addColorStop(1, '#ff6090');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ff3060';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 4);
    ctx.fill();

    // Warning edge glow
    ctx.strokeStyle = '#ff8080';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawCoins() {
  for (const coin of coins) {
    coin.glow = (coin.glow + 0.05) % (Math.PI * 2);
    const pulse = 1 + 0.15 * Math.sin(coin.glow);

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.r * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Inner shine
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.arc(coin.x - 2, coin.y - 2, coin.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPowerups() {
  for (const pu of powerups) {
    const colors = { shield: '#00d4ff', slow: '#c040ff', magnet: '#ff40a0' };
    const icons = { shield: '\u25C6', slow: '\u29D7', magnet: '\u2666' };
    const c = colors[pu.type];

    ctx.shadowColor = c;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Diamond shape
    ctx.moveTo(pu.x, pu.y - pu.r);
    ctx.lineTo(pu.x + pu.r, pu.y);
    ctx.lineTo(pu.x, pu.y + pu.r);
    ctx.lineTo(pu.x - pu.r, pu.y);
    ctx.closePath();
    ctx.fillStyle = `${c}33`;
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = c;
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = { shield: 'S', slow: 'T', magnet: 'M' };
    ctx.fillText(labels[pu.type], pu.x, pu.y);
  }
}

function drawTrailParticles() {
  for (const p of trailParticles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
    ctx.shadowColor = `hsl(${p.hue}, 100%, 65%)`;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of deathParticles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = `hsl(${p.hue}, 100%, 55%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawHUD() {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText(score.toString(), W / 2, 40);

  // Distance indicator
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText(`${Math.floor(distance)}m`, W / 2, 58);

  // Active powerup indicators
  const indicators = [];
  if (runner.shieldTimer > 0) indicators.push({ label: 'SHIELD', color: '#00d4ff', time: runner.shieldTimer });
  if (runner.slowTimer > 0) indicators.push({ label: 'SLOW', color: '#c040ff', time: runner.slowTimer });
  if (runner.magnetTimer > 0) indicators.push({ label: 'MAGNET', color: '#ff40a0', time: runner.magnetTimer });

  for (let i = 0; i < indicators.length; i++) {
    const ind = indicators[i];
    ctx.fillStyle = ind.color;
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ind.label, 12, 30 + i * 18);
    // Bar
    ctx.fillStyle = `${ind.color}44`;
    ctx.fillRect(70, 22 + i * 18, 50, 6);
    ctx.fillStyle = ind.color;
    ctx.fillRect(70, 22 + i * 18, 50 * (ind.time / 300), 6);
  }
}

function drawMenuScreen() {
  drawBackground();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00ffc8';
  ctx.shadowColor = '#00ffc8';
  ctx.shadowBlur = 25;
  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.fillText('Gravity Runner', W / 2, H * 0.3);
  ctx.shadowBlur = 0;

  // Animated gravity arrows
  const t = frameCount * 0.04;
  const arrowY1 = H * 0.45 + Math.sin(t) * 10;
  const arrowY2 = H * 0.45 - Math.sin(t) * 10;
  ctx.strokeStyle = '#00ffc8';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // Down arrow
  ctx.beginPath();
  ctx.moveTo(W / 2 - 20, arrowY1 - 8);
  ctx.lineTo(W / 2 - 20, arrowY1 + 8);
  ctx.lineTo(W / 2 - 28, arrowY1);
  ctx.stroke();
  // Up arrow
  ctx.beginPath();
  ctx.moveTo(W / 2 + 20, arrowY2 + 8);
  ctx.lineTo(W / 2 + 20, arrowY2 - 8);
  ctx.lineTo(W / 2 + 28, arrowY2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '15px Inter, sans-serif';
  ctx.fillText('Flip gravity to dodge obstacles', W / 2, H * 0.58);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(isMobileDevice() ? 'Tap to start' : 'Press Space to start', W / 2, H * 0.68);

  if (bestScore > 0) {
    ctx.fillStyle = 'rgba(0,255,200,0.7)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(`Best: ${bestScore}`, W / 2, H * 0.76);
  }
}

function drawDeadScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4060';
  ctx.shadowColor = '#ff4060';
  ctx.shadowBlur = 15;
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('Crashed!', W / 2, H * 0.25);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Inter, sans-serif';
  ctx.fillText(score.toString(), W / 2, H * 0.4);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`Distance: ${Math.floor(distance)}m`, W / 2, H * 0.5);

  ctx.fillStyle = 'rgba(0,255,200,0.8)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`Best: ${bestScore}`, W / 2, H * 0.57);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(isMobileDevice() ? 'Tap to restart' : 'Press Space to restart', W / 2, H * 0.7);
}

// --- Update ---
function update() {
  frameCount++;
  if (state !== STATE.PLAYING) return;

  const speed = runner.slowTimer > 0 ? gameSpeed * 0.5 : gameSpeed;
  bgOffset += speed;
  distance += speed * 0.1;

  // Score from distance
  score = Math.floor(distance);

  // Speed ramp
  if (frameCount % 120 === 0) {
    gameSpeed = Math.min(8, gameSpeed + 0.05);
  }

  // Runner physics
  if (!runner.onGround) {
    runner.vy += runner.gravityDir * GRAVITY_ACC;
    runner.y += runner.vy;
  }

  // Floor/ceiling collision
  const floorY = H - PLATFORM_H - RUNNER_H;
  const ceilY = PLATFORM_H;
  if (runner.gravityDir === 1 && runner.y >= floorY) {
    runner.y = floorY;
    runner.vy = 0;
    runner.onGround = true;
  }
  if (runner.gravityDir === -1 && runner.y <= ceilY) {
    runner.y = ceilY;
    runner.vy = 0;
    runner.onGround = true;
  }

  // Spawn obstacles
  spawnTimer++;
  const spawnInterval = Math.max(40, 80 - Math.floor(distance / 50));
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnObstacle();
  }

  // Spawn coins
  coinTimer++;
  if (coinTimer >= 45) {
    coinTimer = 0;
    if (Math.random() < 0.6) spawnCoin();
  }

  // Spawn powerups
  powerupTimer++;
  if (powerupTimer >= 300) {
    powerupTimer = 0;
    if (Math.random() < 0.4) spawnPowerup();
  }

  // Move obstacles
  for (const obs of obstacles) obs.x -= speed;
  obstacles = obstacles.filter(o => o.x + o.w > -10);

  // Move coins
  for (const coin of coins) coin.x -= speed;
  coins = coins.filter(c => c.x > -20);

  // Move powerups
  for (const pu of powerups) pu.x -= speed;
  powerups = powerups.filter(p => p.x > -20);

  // Collision with obstacles
  for (const obs of obstacles) {
    if (runner.x + RUNNER_W > obs.x && runner.x < obs.x + obs.w &&
        runner.y + RUNNER_H > obs.y && runner.y < obs.y + obs.h) {
      die();
      return;
    }
  }

  // Coin collection
  const magnetRange = runner.magnetTimer > 0 ? 80 : 0;
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    if (runner.magnetTimer > 0) {
      const dx = (runner.x + RUNNER_W / 2) - coin.x;
      const dy = (runner.y + RUNNER_H / 2) - coin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < magnetRange) {
        coin.x += dx * 0.1;
        coin.y += dy * 0.1;
      }
    }
    if (runner.x + RUNNER_W > coin.x - coin.r && runner.x < coin.x + coin.r &&
        runner.y + RUNNER_H > coin.y - coin.r && runner.y < coin.y + coin.r) {
      score += 5;
      coins.splice(i, 1);
      playBeep(800, 0.06, 'sine', 0.1);
    }
  }

  // Powerup collection
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    if (runner.x + RUNNER_W > pu.x - pu.r && runner.x < pu.x + pu.r &&
        runner.y + RUNNER_H > pu.y - pu.r && runner.y < pu.y + pu.r) {
      if (pu.type === 'shield') runner.shieldTimer = 300;
      if (pu.type === 'slow') runner.slowTimer = 300;
      if (pu.type === 'magnet') runner.magnetTimer = 300;
      powerups.splice(i, 1);
      playBeep(660, 0.12, 'triangle', 0.15);
    }
  }

  // Decrement powerup timers
  if (runner.shieldTimer > 0) runner.shieldTimer--;
  if (runner.slowTimer > 0) runner.slowTimer--;
  if (runner.magnetTimer > 0) runner.magnetTimer--;

  // Trail particles
  if (frameCount % 2 === 0) {
    trailParticles.push({
      x: runner.x - 2,
      y: runner.y + RUNNER_H / 2 + (Math.random() - 0.5) * RUNNER_H * 0.5,
      vx: -Math.random() * 2 - 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      life: 1, r: Math.random() * 3 + 1,
      hue: 160 + Math.random() * 40
    });
  }

  // Update particles
  for (const p of trailParticles) {
    p.x += p.vx; p.y += p.vy; p.life -= 0.03;
  }
  trailParticles = trailParticles.filter(p => p.life > 0);

  for (const p of deathParticles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 0.018;
  }
  deathParticles = deathParticles.filter(p => p.life > 0);
}

function gameLoop() {
  update();

  if (state === STATE.MENU) {
    drawMenuScreen();
  } else {
    drawBackground();
    drawObstacles();
    drawCoins();
    drawPowerups();
    drawTrailParticles();
    if (state === STATE.PLAYING) drawRunner();
    if (state === STATE.DEAD) {
      drawRunner();
      drawDeadScreen();
    }
    if (state === STATE.PLAYING) drawHUD();
  }

  requestAnimationFrame(gameLoop);
}

// --- Init ---
initSoundToggle('sound-toggle-gravrunner');
addVisibilityPause({
  isRunning: () => running,
  pause: () => { running = false; },
  resume: () => { if (state === STATE.PLAYING) running = true; }
});
reset();
gameLoop();

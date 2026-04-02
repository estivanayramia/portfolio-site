import { addVisibilityPause, initSoundToggle, playBeep, unlock, isMobileDevice } from "./_shared.js";

const canvas = document.getElementById("snake-canvas");
const ctx = canvas?.getContext("2d");

const scoreEl = document.getElementById("snake-score");
const levelEl = document.getElementById("snake-level");

let running = false;
let paused = false;

let snake = [];
let dir = { x: 0, y: 0 };
let nextDir = { x: 0, y: 0 };
let food = { x: 5, y: 5 };

let score = 0;
let level = 1;
let speedMs = 110;
let lastStep = 0;

let foodEaten = 0;
let combo = 0;
let comboTimer = null;

// ── Phase 3A: Power-Up System ──
const POWERUP_TYPES = [
  { type: 'speed',        icon: '🍇', color: '#a855f7', duration: 10000, label: 'Speed Boost' },
  { type: 'invincible',   icon: '🍊', color: '#f59e0b', duration: 5000,  label: 'Invincible' },
  { type: 'multiplier',   icon: '🍉', color: '#eab308', duration: 15000, label: '2× Score' },
  { type: 'shrink',       icon: '🍒', color: '#ef4444', duration: 0,     label: 'Shrink' },
];

let powerUp = null;           // { x, y, type, icon, color, duration, label }
let activePowerUps = [];      // [{ type, expiresAt, label }]
let powerUpsCollected = 0;
let invincibleUses = 0;

// ── Phase 3A: Obstacle System ──
let obstacles = [];           // [{ x, y, moving?, dx?, dy? }]
let movesSurvived = 0;

function gridSize() {
  return 20;
}

function cellPx() {
  return canvas.width / gridSize();
}

function setText(el, value) {
  if (el) el.textContent = String(value);
}

function isOccupied(x, y) {
  if (snake.some(s => s.x === x && s.y === y)) return true;
  if (food.x === x && food.y === y) return true;
  if (obstacles.some(o => o.x === x && o.y === y)) return true;
  if (powerUp && powerUp.x === x && powerUp.y === y) return true;
  return false;
}

function placeFood() {
  const size = gridSize();
  let attempts = 0;
  while (attempts < 400) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    if (!isOccupied(x, y)) {
      food = { x, y };
      return;
    }
    attempts++;
  }
  food = { x: 0, y: 0 };
}

// ── Power-Up Placement ──
function maybeSpawnPowerUp() {
  if (powerUp) return;
  // 15% chance each food eaten (increases with level)
  if (Math.random() > 0.15 + level * 0.02) return;

  const size = gridSize();
  const def = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  let attempts = 0;
  while (attempts < 200) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    if (!isOccupied(x, y)) {
      powerUp = { x, y, ...def };
      return;
    }
    attempts++;
  }
}

function activatePowerUp(pu) {
  powerUpsCollected++;
  playBeep(880, 0.15, 'sine', 0.3);

  if (pu.type === 'shrink') {
    // Instantly remove up to 3 tail segments
    const removeCount = Math.min(3, Math.max(0, snake.length - 3));
    for (let i = 0; i < removeCount; i++) snake.pop();
  } else {
    // Timed power-up
    activePowerUps.push({ type: pu.type, expiresAt: Date.now() + pu.duration, label: pu.label });
  }

  // Achievements
  if (powerUpsCollected >= 10) unlock("snake:powerup_collector");
  if (pu.type === 'invincible') {
    invincibleUses++;
    if (invincibleUses >= 5) unlock("snake:invincible_master");
  }
}

function hasPowerUp(type) {
  return activePowerUps.some(p => p.type === type && Date.now() < p.expiresAt);
}

function tickPowerUps() {
  activePowerUps = activePowerUps.filter(p => Date.now() < p.expiresAt);
}

// ── Obstacle Placement ──
function generateObstacles() {
  obstacles = [];
  if (level < 4) return;

  const count = Math.min(level - 3, 6);  // 1 obstacle at level 4, up to 6
  const size = gridSize();
  for (let i = 0; i < count; i++) {
    let attempts = 0;
    while (attempts < 200) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      // Keep obstacles away from center start area
      if (Math.abs(x - 10) <= 2 && Math.abs(y - 10) <= 2) { attempts++; continue; }
      if (!isOccupied(x, y)) {
        const moving = level >= 7 && i % 2 === 0;
        obstacles.push({
          x, y,
          moving,
          dx: moving ? (Math.random() > 0.5 ? 1 : -1) : 0,
          dy: 0,
        });
        break;
      }
      attempts++;
    }
  }
}

function moveObstacles() {
  const size = gridSize();
  obstacles.forEach(o => {
    if (!o.moving) return;
    const nx = o.x + o.dx;
    if (nx < 0 || nx >= size) { o.dx *= -1; return; }
    o.x = nx;
  });
}

function reset() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  dir = { x: 0, y: 0 };
  nextDir = { x: 0, y: 0 };
  score = 0;
  level = 1;
  speedMs = 110;
  lastStep = 0;
  foodEaten = 0;
  combo = 0;
  if (comboTimer) clearTimeout(comboTimer);
  comboTimer = null;
  paused = false;
  powerUp = null;
  activePowerUps = [];
  powerUpsCollected = 0;
  invincibleUses = 0;
  obstacles = [];
  movesSurvived = 0;
  setText(scoreEl, 0);
  setText(levelEl, 1);
  placeFood();
}

function startIfNeeded() {
  if (!running) return;
  if (dir.x === 0 && dir.y === 0) {
    dir = { ...nextDir };
  }
}

function setDirection(named) {
  const opposites = { up: "down", down: "up", left: "right", right: "left" };
  const current =
    dir.y === -1
      ? "up"
      : dir.y === 1
      ? "down"
      : dir.x === -1
      ? "left"
      : dir.x === 1
      ? "right"
      : null;

  if (current && opposites[current] === named) return;

  if (named === "up") nextDir = { x: 0, y: -1 };
  if (named === "down") nextDir = { x: 0, y: 1 };
  if (named === "left") nextDir = { x: -1, y: 0 };
  if (named === "right") nextDir = { x: 1, y: 0 };

  if (dir.x === 0 && dir.y === 0) {
    dir = { ...nextDir };
  }
}

function step() {
  const size = gridSize();
  const head = snake[0];
  let next = { x: head.x + dir.x, y: head.y + dir.y };

  tickPowerUps();

  // Wall collision check (invincibility wraps around)
  const hitWall = next.x < 0 || next.x >= size || next.y < 0 || next.y >= size;
  if (hitWall && hasPowerUp('invincible')) {
    // Wrap around
    next.x = (next.x + size) % size;
    next.y = (next.y + size) % size;
  } else if (hitWall) {
    running = false;
    return;
  }

  const hitSelf = snake.slice(1).some(s => s.x === next.x && s.y === next.y);
  if (hitSelf) {
    running = false;
    return;
  }

  // Obstacle collision
  const hitObstacle = obstacles.some(o => o.x === next.x && o.y === next.y);
  if (hitObstacle && !hasPowerUp('invincible')) {
    running = false;
    return;
  }

  // Track moves survived with obstacles
  if (obstacles.length > 0) {
    movesSurvived++;
    if (movesSurvived >= 50) unlock("snake:obstacle_dodger");
  }

  snake.unshift(next);

  // Power-up collection
  if (powerUp && next.x === powerUp.x && next.y === powerUp.y) {
    activatePowerUp(powerUp);
    powerUp = null;
  }

  if (next.x === food.x && next.y === food.y) {
    foodEaten++;
    combo++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      combo = 0;
    }, 2000);

    const multiplier = Math.min(combo, 5);
    const scoreMultiplier = hasPowerUp('multiplier') ? 2 : 1;
    score += level * 10 * multiplier * scoreMultiplier;
    setText(scoreEl, score);

    playBeep(440, 0.08);

    unlock("snake:first_food");
    if (multiplier >= 5) unlock("snake:combo_5");
    if (score >= 100) unlock("snake:score_100");
    if (snake.length >= 20) unlock("snake:length_20");
    if (score >= 250) unlock("snake:score_250");
    if (snake.length >= 35) unlock("snake:length_35");

    if (foodEaten % 5 === 0) {
      level++;
      speedMs = Math.max(55, speedMs - 10);
      setText(levelEl, level);
      if (level >= 5) unlock("snake:level_5");
      if (level >= 10) unlock("snake:level_10");
      playBeep(660, 0.12);

      // Generate obstacles starting at level 4
      generateObstacles();
      // Move obstacles after level-up
    }

    placeFood();
    maybeSpawnPowerUp();
  } else {
    snake.pop();
  }

  // Move obstacles every 3rd step
  if (foodEaten > 0 && lastStep % 3 === 0) {
    moveObstacles();
  }
}

// ── Trail particles for snake movement ──
let trailParticles = [];

function emitTrailParticle(x, y, color) {
  trailParticles.push({
    x: x + (Math.random() - 0.5) * 4,
    y: y + (Math.random() - 0.5) * 4,
    r: 1.5 + Math.random() * 2,
    life: 1,
    decay: 0.04 + Math.random() * 0.03,
    color,
  });
  if (trailParticles.length > 60) trailParticles.splice(0, trailParticles.length - 60);
}

function draw() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Gradient background
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
  bg.addColorStop(0.5, 'rgba(15, 25, 45, 0.95)');
  bg.addColorStop(1, 'rgba(8, 18, 35, 0.95)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  const px = cellPx();
  const size = gridSize();
  for (let i = 1; i < size; i++) {
    ctx.beginPath();
    ctx.moveTo(i * px, 0);
    ctx.lineTo(i * px, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * px);
    ctx.lineTo(canvas.width, i * px);
    ctx.stroke();
  }

  // Update & draw trail particles
  for (let i = trailParticles.length - 1; i >= 0; i--) {
    const p = trailParticles[i];
    p.life -= p.decay;
    if (p.life <= 0) { trailParticles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life * 0.6;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Obstacles with glow
  obstacles.forEach(o => {
    const oColor = o.moving ? 'rgba(239, 68, 68, 0.8)' : 'rgba(107, 114, 128, 0.85)';
    ctx.save();
    ctx.shadowColor = o.moving ? 'rgba(239, 68, 68, 0.6)' : 'rgba(107, 114, 128, 0.4)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = oColor;
    ctx.fillRect(o.x * px + 1, o.y * px + 1, px - 2, px - 2);
    ctx.restore();
    // Draw X pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(o.x * px + 3, o.y * px + 3);
    ctx.lineTo(o.x * px + px - 3, o.y * px + px - 3);
    ctx.moveTo(o.x * px + px - 3, o.y * px + 3);
    ctx.lineTo(o.x * px + 3, o.y * px + px - 3);
    ctx.stroke();
  });

  // Power-Up with enhanced glow
  if (powerUp) {
    ctx.save();
    ctx.shadowColor = powerUp.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = powerUp.color;
    ctx.beginPath();
    ctx.arc(powerUp.x * px + px / 2, powerUp.y * px + px / 2, px * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Pulsing glow ring
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = powerUp.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = powerUp.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(powerUp.x * px + px / 2, powerUp.y * px + px / 2, px * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Icon
    ctx.font = `${Math.floor(px * 0.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerUp.icon, powerUp.x * px + px / 2, powerUp.y * px + px / 2);
  }

  // Food with glow and pulse
  const foodPulse = 0.33 + 0.04 * Math.sin(Date.now() / 150);
  const fx = food.x * px + px / 2;
  const fy = food.y * px + px / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
  ctx.shadowBlur = 12;
  const foodGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, px * foodPulse);
  foodGrad.addColorStop(0, 'rgba(255, 120, 100, 1)');
  foodGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.95)');
  foodGrad.addColorStop(1, 'rgba(200, 40, 40, 0.8)');
  ctx.fillStyle = foodGrad;
  ctx.beginPath();
  ctx.arc(fx, fy, px * foodPulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Snake with gradient body segments
  const isInvincible = hasPowerUp('invincible');
  const isSpeed = hasPowerUp('speed');
  const snakeLen = snake.length;
  snake.forEach((s, i) => {
    const cx = s.x * px + px / 2;
    const cy = s.y * px + px / 2;
    const halfPx = (px - 2) / 2;
    const t = i / Math.max(snakeLen - 1, 1); // 0 at head, 1 at tail

    let baseR, baseG, baseB, glowColor;
    if (isInvincible) {
      baseR = 245; baseG = 158; baseB = 11;
      glowColor = 'rgba(245, 158, 11, 0.7)';
    } else if (isSpeed) {
      baseR = 168; baseG = 85; baseB = 247;
      glowColor = 'rgba(168, 85, 247, 0.7)';
    } else {
      baseR = 34; baseG = 197; baseB = 94;
      glowColor = 'rgba(34, 197, 94, 0.5)';
    }

    const alpha = 1 - t * 0.35;
    const segGrad = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, halfPx * 1.4);
    const lighter = `rgba(${Math.min(255, baseR + 60)}, ${Math.min(255, baseG + 60)}, ${Math.min(255, baseB + 60)}, ${alpha})`;
    const base = `rgba(${baseR}, ${baseG}, ${baseB}, ${alpha})`;
    const darker = `rgba(${Math.max(0, baseR - 40)}, ${Math.max(0, baseG - 40)}, ${Math.max(0, baseB - 40)}, ${alpha * 0.8})`;
    segGrad.addColorStop(0, lighter);
    segGrad.addColorStop(0.5, base);
    segGrad.addColorStop(1, darker);

    ctx.save();
    if (i === 0) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = segGrad;
    const radius = i === 0 ? 4 : 3;
    const sx = s.x * px + 1;
    const sy = s.y * px + 1;
    const sw = px - 2;
    const sh = px - 2;
    ctx.beginPath();
    ctx.moveTo(sx + radius, sy);
    ctx.lineTo(sx + sw - radius, sy);
    ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + radius);
    ctx.lineTo(sx + sw, sy + sh - radius);
    ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - radius, sy + sh);
    ctx.lineTo(sx + radius, sy + sh);
    ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - radius);
    ctx.lineTo(sx, sy + radius);
    ctx.quadraticCurveTo(sx, sy, sx + radius, sy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Emit trail particle from tail segment
    if (i === snakeLen - 1 && (dir.x !== 0 || dir.y !== 0)) {
      emitTrailParticle(cx, cy, `rgba(${baseR}, ${baseG}, ${baseB}, 0.6)`);
    }
  });

  // HUD: Active Power-Ups (top-right)
  if (activePowerUps.length > 0) {
    ctx.save();
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    activePowerUps.forEach((pu, i) => {
      const remaining = Math.max(0, Math.ceil((pu.expiresAt - Date.now()) / 1000));
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`${pu.label} ${remaining}s`, canvas.width - 8, 14 + i * 14);
    });
    ctx.restore();
  }

  // Score multiplier indicator
  if (hasPowerUp('multiplier')) {
    ctx.save();
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('2x SCORE', 8, 14);
    ctx.restore();
  }

  if (dir.x === 0 && dir.y === 0) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 18px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Press an arrow key to start", canvas.width / 2, canvas.height / 2);
  }

  if (!running) {
    ctx.fillStyle = "rgba(0,0,0,0.50)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "14px Inter, system-ui, sans-serif";
    ctx.fillText("Press Restart", canvas.width / 2, canvas.height / 2 + 18);
  }
}

function loop(ts) {
  if (!running) {
    draw();
    return;
  }
  if (!paused) {
    if (!lastStep) lastStep = ts;
    const currentSpeed = hasPowerUp('speed') ? speedMs * 0.67 : speedMs;
    if (ts - lastStep >= currentSpeed) {
      dir = { ...nextDir };
      if (dir.x !== 0 || dir.y !== 0) step();
      lastStep = ts;
    }
  }

  draw();
  requestAnimationFrame(loop);
}

function setPaused(next) {
  paused = !!next;
  const btn = document.getElementById("snake-pause");
  if (!btn) return;
  btn.textContent = paused ? "Resume" : "Pause";
  btn.classList.toggle("bg-green-600", paused);
  btn.classList.toggle("bg-yellow-600", !paused);
}

function bindInputs() {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDirection("up");
        startIfNeeded();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDirection("down");
        startIfNeeded();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setDirection("left");
        startIfNeeded();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setDirection("right");
        startIfNeeded();
      }
    },
    { passive: false }
  );

  document.querySelectorAll("[data-snake-dir]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const d = btn.getAttribute("data-snake-dir");
      if (d) setDirection(d);
    });
  });

  if (isMobileDevice()) {
    let startX = 0;
    let startY = 0;
    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches?.[0]) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches?.[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dx) > 30) setDirection(dx > 0 ? "right" : "left");
        } else {
          if (Math.abs(dy) > 30) setDirection(dy > 0 ? "down" : "up");
        }
      },
      { passive: true }
    );
  }

  document.getElementById("snake-restart")?.addEventListener("click", () => {
    reset();
    running = true;
    requestAnimationFrame(loop);
  });

  document.getElementById("snake-pause")?.addEventListener("click", () => {
    if (!running) return;
    setPaused(!paused);
  });
}

function init() {
  initSoundToggle("snake-sound");

  reset();
  running = true;

  bindInputs();

  addVisibilityPause({
    isRunning: () => running && !paused,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
  });

  requestAnimationFrame(loop);
}

init();

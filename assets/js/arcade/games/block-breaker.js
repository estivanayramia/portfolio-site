import { addVisibilityPause, initSoundToggle, playBeep, unlock, isMobileDevice } from "./_shared.js";

const canvas = document.getElementById("breaker-canvas");
const ctx = canvas?.getContext("2d");

const scoreEl = document.getElementById("breaker-score");
const livesEl = document.getElementById("breaker-lives");

let running = false;
let paused = false;

let paddle = { x: 150, w: 100, h: 10 };
let balls = [];
let bricks = [];
let score = 0;
let lives = 3;
let level = 1;

let paddleDir = 0;
let started = false;

// ── Phase 3B: Multi-Ball & Laser ──
let multiBallTimer = 0;
let laserAmmo = 0;
let lasers = [];
let bricksDestroyedByLaser = 0;
let multiBallTime = 0;
let particles = [];
let shakeFrames = 0;
let shakeMagnitude = 0;
let flashFrames = 0;

const prefersReducedMotion = () => {
  try {
    return typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
};

// Brick type colors and properties
const BRICK_TYPES = {
  normal:      { hits: 1, color: 'rgba(168,85,247,0.9)',  border: 'rgba(255,255,255,0.25)', points: 10, label: '' },
  tough:       { hits: 2, color: 'rgba(59,130,246,0.9)',   border: 'rgba(147,197,253,0.4)',  points: 25, label: '2' },
  gold:        { hits: 3, color: 'rgba(234,179,8,0.9)',    border: 'rgba(253,224,71,0.5)',   points: 50, label: '3' },
  diamond:     { hits: 99,color: 'rgba(209,213,219,0.95)', border: 'rgba(255,255,255,0.6)',  points: 100,label: '💎' },
};

function setText(el, value) {
  if (el) el.textContent = String(value);
}

function makeBricks() {
  bricks = [];
  const cols = 5;
  const rows = 4;
  const brickW = 60;
  const brickH = 20;
  const gapX = 10;
  const gapY = 10;
  const startX = Math.round((canvas.width - (cols * brickW + (cols - 1) * gapX)) / 2);
  const startY = 40;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // Determine brick type based on level
      let type = 'normal';
      if (level >= 2 && r === 0) type = 'tough';
      if (level >= 3 && r === 0 && c === Math.floor(cols / 2)) type = 'gold';
      if (level >= 4 && r === 0 && (c === 0 || c === cols - 1)) type = 'diamond';

      const def = BRICK_TYPES[type];
      bricks.push({
        x: startX + c * (brickW + gapX),
        y: startY + r * (brickH + gapY),
        w: brickW,
        h: brickH,
        alive: true,
        type,
        hitsLeft: def.hits,
        maxHits: def.hits,
        points: def.points,
      });
    }
  }
}

function addBall(x, y, dx, dy) {
  balls.push({ x, y, dx, dy, r: 6, _dxHistory: [], _trail: [] });
}

function triggerShake(mag = 6, frames = 12) {
  if (prefersReducedMotion()) return;
  shakeFrames = frames;
  shakeMagnitude = mag;
}

function triggerFlash() {
  if (prefersReducedMotion()) return;
  flashFrames = 3;
}

function emitParticles(x, y, color, count = 10) {
  if (prefersReducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.04 + Math.random() * 0.04,
      r: 2 + Math.random() * 3,
      color,
      alive: true,
    });
  }
  if (particles.length > 200) {
    particles.splice(0, particles.length - 200);
  }
}

function reset() {
  paddle = { x: 150, w: 100, h: 10 };
  balls = [];
  addBall(200, 300, 0, 0);
  score = 0;
  lives = 3;
  level = 1;
  paddleDir = 0;
  started = false;
  laserAmmo = 0;
  lasers = [];
  bricksDestroyedByLaser = 0;
  multiBallTime = 0;
  particles = [];
  shakeFrames = 0;
  shakeMagnitude = 0;
  flashFrames = 0;
  makeBricks();

  setText(scoreEl, score);
  setText(livesEl, lives);
}

function startBallIfNeeded() {
  if (started) return;
  started = true;
  balls.forEach(b => {
    b.dx = 4 * (Math.random() > 0.5 ? 1 : -1);
    b.dy = -4;
  });
}

// ── Power-Up Drops ──
let powerDrops = [];

function maybeDropPower(x, y) {
  if (Math.random() > 0.15) return; // 15% chance
  const types = ['multiball', 'laser', 'widen', 'life'];
  const type = types[Math.floor(Math.random() * types.length)];
  const colors = { multiball: '#3b82f6', laser: '#ef4444', widen: '#22c55e', life: '#f59e0b' };
  const labels = { multiball: 'M', laser: 'L', widen: 'W', life: '+' };
  powerDrops.push({ x, y, w: 14, h: 14, dy: 2, type, color: colors[type], label: labels[type], alive: true });
}

function applyPower(type) {
  playBeep(520, 0.08, 'triangle', 0.2);
  if (type === 'multiball') {
    // Spawn 2 extra balls from paddle center
    const px = paddle.x + paddle.w / 2;
    addBall(px, 290, -3, -4);
    addBall(px, 290, 3, -4);
    multiBallTime = Date.now();
  }
  if (type === 'laser') {
    laserAmmo += 5;
  }
  if (type === 'widen') {
    paddle.w = Math.min(160, paddle.w + 20);
  }
  if (type === 'life') {
    lives = Math.min(5, lives + 1);
    setText(livesEl, lives);
  }
}

function fireLaser() {
  if (laserAmmo <= 0) return;
  laserAmmo--;
  const px = paddle.x + paddle.w / 2;
  lasers.push({ x: px - 2, y: 475, w: 4, h: 12, dy: -8, alive: true });
  lasers.push({ x: px + 2, y: 475, w: 4, h: 12, dy: -8, alive: true });
  playBeep(600, 0.04, 'sawtooth', 0.12);
}

function damageBrick(b) {
  b.hitsLeft--;
  if (b.hitsLeft <= 0) {
    // Diamond bricks only break when all non-diamond bricks are gone
    if (b.type === 'diamond') {
      const otherAlive = bricks.some(br => br.alive && br.type !== 'diamond' && br !== b);
      if (otherAlive) {
        b.hitsLeft = 1; // Keep alive
        return false;
      }
    }
    b.alive = false;
    const def = BRICK_TYPES[b.type] || BRICK_TYPES.normal;
    score += b.points * level;
    setText(scoreEl, score);
    emitParticles(b.x + b.w / 2, b.y + b.h / 2, def.color, 12);
    maybeDropPower(b.x + b.w / 2, b.y + b.h);

    if (b.type === 'diamond') unlock("breaker:diamond_breaker");
    return true; // brick destroyed
  }
  return false;
}

function update() {
  // paddle
  paddle.x += paddleDir * 7;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));

  if (!started) {
    if (balls.length > 0) {
      balls[0].x = paddle.x + paddle.w / 2;
      balls[0].y = 300;
    }
    return;
  }

  // Multi-ball duration achievement tracking
  if (balls.length >= 2 && multiBallTime > 0) {
    if (Date.now() - multiBallTime >= 30000) {
      unlock("breaker:multi_ball");
    }
  }

  // Lasers
  for (const l of lasers) {
    if (!l.alive) continue;
    l.y += l.dy;
    if (l.y < -20) { l.alive = false; continue; }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (l.x + l.w > b.x && l.x < b.x + b.w && l.y > b.y && l.y < b.y + b.h) {
        l.alive = false;
        if (damageBrick(b)) {
          bricksDestroyedByLaser++;
          if (bricksDestroyedByLaser >= 20) unlock("breaker:laser_master");
        }
        playBeep(250, 0.05, 'sawtooth', 0.15);
        break;
      }
    }
  }
  lasers = lasers.filter(l => l.alive);

  // Power drops
  for (const p of powerDrops) {
    if (!p.alive) continue;
    p.y += p.dy;
    if (p.y > canvas.height + 20) { p.alive = false; continue; }

    if (p.y + p.h >= 480 && p.y <= 490 && p.x + p.w >= paddle.x && p.x <= paddle.x + paddle.w) {
      p.alive = false;
      applyPower(p.type);
    }
  }
  powerDrops = powerDrops.filter(p => p.alive);

  for (const p of particles) {
    if (!p.alive) continue;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= p.decay;
    if (p.life <= 0) p.alive = false;
  }
  particles = particles.filter((p) => p.alive);

  // balls
  let anyAlive = false;
  for (const ball of balls) {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // walls
    if (ball.x + ball.r >= canvas.width || ball.x - ball.r <= 0) ball.dx *= -1;
    if (ball.y - ball.r <= 0) ball.dy *= -1;

    // bottom
    if (ball.y - ball.r > canvas.height) {
      // Remove this ball
      ball.dead = true;
      continue;
    }
    anyAlive = true;

    // paddle collision
    const paddleY = 480;
    if (
      ball.y + ball.r >= paddleY &&
      ball.y + ball.r <= paddleY + paddle.h &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.w &&
      ball.dy > 0
    ) {
      ball.dy = -Math.abs(ball.dy);
      const hit = (ball.x - paddle.x) / paddle.w;
      ball.dx = (hit - 0.5) * 8;
      playBeep(220, 0.06, "square", 0.18);
    }

    // brick collision
    for (const b of bricks) {
      if (!b.alive) continue;
      if (
        ball.x + ball.r > b.x &&
        ball.x - ball.r < b.x + b.w &&
        ball.y + ball.r > b.y &&
        ball.y - ball.r < b.y + b.h
      ) {
        ball.dy *= -1;
        damageBrick(b);
        playBeep(180, 0.07, "sawtooth", 0.2);

        unlock("breaker:first_brick");
        if (score >= 500) unlock("breaker:score_500");

        if (bricks.every(x => !x.alive)) {
          level += 1;
          makeBricks();
          balls.forEach(bl => {
            bl.dx *= 1.05;
            bl.dy *= 1.05;
          });
          triggerShake(5, 10);
          triggerFlash();
          playBeep(520, 0.1, "triangle", 0.18);
          if (level >= 3) unlock("breaker:level_3");
        }
        break;
      }
    }

    ball._trail.push({ x: ball.x, y: ball.y });
    if (ball._trail.length > 5) ball._trail.shift();

    if (!ball._dxHistory) ball._dxHistory = [];
    ball._dxHistory.push(ball.dx > 0 ? 1 : ball.dx < 0 ? -1 : 0);
    if (ball._dxHistory.length > 6) ball._dxHistory.shift();

    const allSame = ball._dxHistory.length >= 4
      && ball._dxHistory.every((v) => v === ball._dxHistory[0]);
    const speedMag = Math.hypot(ball.dx, ball.dy);
    const nearVertical = Math.abs(ball.dx) < 0.8;

    if (speedMag > 0 && (allSame || nearVertical)) {
      const nudge = (Math.random() > 0.5 ? 1 : -1) * 1.5;
      ball.dx += nudge;
      const newMag = Math.hypot(ball.dx, ball.dy);
      if (newMag > 0) {
        ball.dx = (ball.dx / newMag) * speedMag;
        ball.dy = (ball.dy / newMag) * speedMag;
      }
      ball._dxHistory = [];
    }

    const minDx = Math.max(1.2, speedMag * 0.18);
    if (Math.abs(ball.dx) < minDx) {
      ball.dx = minDx * (ball.dx >= 0 ? 1 : -1);
      const balancedMag = Math.hypot(ball.dx, ball.dy);
      if (balancedMag > 0 && speedMag > 0) {
        ball.dx = (ball.dx / balancedMag) * speedMag;
        ball.dy = (ball.dy / balancedMag) * speedMag;
      }
    }
  }

  // Remove dead balls
  balls = balls.filter(b => !b.dead);

  if (!anyAlive || balls.length === 0) {
    lives -= 1;
    triggerShake(7, 14);
    setText(livesEl, lives);
    if (lives <= 0) {
      running = false;
      return;
    }
    started = false;
    balls = [];
    addBall(paddle.x + paddle.w / 2, 300, 0, 0);
    multiBallTime = 0;
  }
}

function draw() {
  if (!ctx) return;
  ctx.save();
  if (shakeFrames > 0) {
    const sx = (Math.random() - 0.5) * shakeMagnitude;
    const sy = (Math.random() - 0.5) * shakeMagnitude;
    ctx.translate(sx, sy);
    shakeFrames -= 1;
    shakeMagnitude *= 0.85;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "rgba(15,23,42,0.95)");
  bg.addColorStop(1, "rgba(30,10,60,0.95)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // bricks
  bricks.forEach(b => {
    if (!b.alive) return;
    const def = BRICK_TYPES[b.type];
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = def.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = def.border;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    // Hit indicators for multi-hit bricks
    if (b.maxHits > 1 && b.type !== 'diamond') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(b.hitsLeft), b.x + b.w / 2, b.y + b.h / 2);
    }
    if (b.type === 'diamond') {
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💎', b.x + b.w / 2, b.y + b.h / 2);
    }
  });

  // lasers
  lasers.forEach(l => {
    if (!l.alive) return;
    ctx.shadowColor = 'rgba(239,68,68,0.95)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(239,68,68,0.95)';
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.shadowBlur = 0;
  });

  // power drops
  powerDrops.forEach(p => {
    if (!p.alive) return;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, p.x + p.w / 2, p.y + p.h / 2 + 0.5);
  });

  particles.forEach((p) => {
    if (!p.alive) return;
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // paddle
  ctx.shadowColor = laserAmmo > 0 ? "rgba(239,68,68,0.8)" : "rgba(168,85,247,0.8)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = laserAmmo > 0 ? 'rgba(239,68,68,1)' : "rgba(168,85,247,1)";
  ctx.fillRect(paddle.x, 480, paddle.w, paddle.h);
  ctx.shadowBlur = 0;

  // balls
  balls.forEach(b => {
    b._trail.forEach((pt, i) => {
      const alpha = ((i + 1) / b._trail.length) * 0.35;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, b.r * (0.4 + i * 0.12), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  // HUD: Ball count & Laser ammo
  ctx.save();
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  if (balls.length > 1) {
    ctx.fillText(`Balls: ${balls.length}`, canvas.width - 8, 14);
  }
  if (laserAmmo > 0) {
    ctx.fillStyle = 'rgba(239,68,68,0.9)';
    ctx.fillText(`Laser: ${laserAmmo}`, canvas.width - 8, balls.length > 1 ? 28 : 14);
  }
  ctx.restore();

  if (!started) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 18px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Press ← or → to start", canvas.width / 2, canvas.height / 2);
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

  if (flashFrames > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashFrames * 0.15})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashFrames -= 1;
  }

  ctx.restore();
}

function loop() {
  if (!running) {
    draw();
    return;
  }

  if (!paused) update();
  draw();
  requestAnimationFrame(loop);
}

function setPaused(next) {
  paused = !!next;
  const btn = document.getElementById("breaker-pause");
  if (!btn) return;
  btn.textContent = paused ? "Resume" : "Pause";
  btn.classList.toggle("bg-green-600", paused);
  btn.classList.toggle("bg-yellow-600", !paused);
}

function bindInputs() {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        startBallIfNeeded();
        paddleDir = -1;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        startBallIfNeeded();
        paddleDir = 1;
      }
      // Laser fire with Space
      if (e.code === "Space" && laserAmmo > 0) {
        e.preventDefault();
        fireLaser();
      }
    },
    { passive: false }
  );

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" && paddleDir === -1) paddleDir = 0;
    if (e.key === "ArrowRight" && paddleDir === 1) paddleDir = 0;
  });

  // Touch buttons (stateful so you can hold)
  document.querySelectorAll("[data-breaker-move]").forEach((btn) => {
    const dir = btn.getAttribute("data-breaker-move");
    const value = dir === "left" ? -1 : 1;

    const down = (e) => {
      e.preventDefault();
      startBallIfNeeded();
      paddleDir = value;
      btn.setPointerCapture?.(e.pointerId);
    };
    const up = (e) => {
      e.preventDefault();
      if (paddleDir === value) paddleDir = 0;
      try {
        btn.releasePointerCapture?.(e.pointerId);
      } catch {}
    };

    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  });

  if (isMobileDevice()) {
    // Optional drag on canvas
    let dragging = false;
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        dragging = true;
        startBallIfNeeded();
        canvas.setPointerCapture?.(e.pointerId);
      },
      { passive: true }
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, x - paddle.w / 2));
      },
      { passive: true }
    );
    const end = (e) => {
      dragging = false;
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {}
    };
    canvas.addEventListener("pointerup", end, { passive: true });
    canvas.addEventListener("pointercancel", end, { passive: true });
  }

  document.getElementById("breaker-restart")?.addEventListener("click", () => {
    reset();
    running = true;
    requestAnimationFrame(loop);
  });

  document.getElementById("breaker-pause")?.addEventListener("click", () => {
    if (!running) return;
    setPaused(!paused);
  });
}

function init() {
  initSoundToggle("breaker-sound");
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

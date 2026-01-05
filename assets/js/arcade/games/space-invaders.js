import { addVisibilityPause, initSoundToggle, playBeep, unlock, isMobileDevice } from "./_shared.js";

const canvas = document.getElementById("invaders-canvas");
const ctx = canvas?.getContext("2d");

const scoreEl = document.getElementById("invaders-score");
const waveEl = document.getElementById("invaders-wave");

let running = false;
let paused = false;

let player;
let bullets;
let aliens;
let alienDir;
let alienSpeed;
let score;
let wave;
let lastShot;

let waveHits; // counts hits this wave (including shield hits)
let aliensKilled;

let powerups;
let rapidFireUntil;
let spreadShotUntil;
let slowAliensUntil;
let shieldCharges;

const input = { left: false, right: false, shootHeld: false, autoFire: false };

function setText(el, value) {
  if (el) el.textContent = String(value);
}

function spawnAliens() {
  aliens = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      aliens.push({ x: c * 40 + 20, y: r * 30 + 20, w: 20, h: 20, alive: true });
    }
  }
}

function reset() {
  player = { x: 180, y: 450, w: 30, h: 20 };
  bullets = [];
  powerups = [];
  spawnAliens();
  alienDir = 1;
  alienSpeed = 0.6;
  score = 0;
  wave = 1;
  lastShot = 0;
  waveHits = 0;
  aliensKilled = 0;
  input.left = false;
  input.right = false;
  input.shootHeld = false;
  input.autoFire = false;
  rapidFireUntil = 0;
  spreadShotUntil = 0;
  slowAliensUntil = 0;
  shieldCharges = 0;
  setText(scoreEl, 0);
  setText(waveEl, 1);
}

function shoot() {
  const now = performance.now();
  const cooldown = now < rapidFireUntil ? 120 : 220;
  if (now - lastShot < cooldown) return;

  const activePlayerBullets = bullets.filter((b) => b.alive && !b.enemy).length;
  if (activePlayerBullets >= 3) return;

  const hasSpread = now < spreadShotUntil;
  if (hasSpread) {
    bullets.push({ x: player.x + 13, y: player.y, w: 4, h: 10, dx: -2, dy: -8, enemy: false, alive: true });
    bullets.push({ x: player.x + 13, y: player.y, w: 4, h: 10, dx: 0, dy: -8, enemy: false, alive: true });
    bullets.push({ x: player.x + 13, y: player.y, w: 4, h: 10, dx: 2, dy: -8, enemy: false, alive: true });
  } else {
    bullets.push({ x: player.x + 13, y: player.y, w: 4, h: 10, dy: -8, enemy: false, alive: true });
  }
  lastShot = now;
  playBeep(300, 0.04, "square", 0.15);
}

function spawnPowerup(x, y) {
  const roll = Math.random();
  const type = roll < 0.35 ? "rapid" : roll < 0.65 ? "spread" : roll < 0.85 ? "shield" : "slow";
  powerups.push({ x: x - 7, y: y - 7, w: 14, h: 14, dy: 2, type, alive: true });
}

function applyPowerup(type) {
  const now = performance.now();
  if (type === "rapid") rapidFireUntil = Math.max(rapidFireUntil, now + 8000);
  if (type === "spread") spreadShotUntil = Math.max(spreadShotUntil, now + 9000);
  if (type === "slow") slowAliensUntil = Math.max(slowAliensUntil, now + 6000);
  if (type === "shield") shieldCharges = Math.min(shieldCharges + 1, 3);

  playBeep(520, 0.05, "triangle", 0.18);
}

function update() {
  // Move player from stateful input (allows move + shoot simultaneously)
  const dir = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0;
  player.x += dir * 6;
  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));

  if (input.autoFire || input.shootHeld) shoot();

  // bullets
  for (const b of bullets) {
    if (!b.alive) continue;
    if (typeof b.dx === "number") b.x += b.dx;
    b.y += b.dy;

    if (b.y < -20 || b.y > canvas.height + 20) b.alive = false;

    if (!b.enemy) {
      // hit aliens
      for (const a of aliens) {
        if (!a.alive) continue;
        if (b.x >= a.x && b.x <= a.x + a.w && b.y >= a.y && b.y <= a.y + a.h) {
          a.alive = false;
          b.alive = false;
          score += 10 * wave;
          aliensKilled++;
          setText(scoreEl, score);
          playBeep(160, 0.06, "sawtooth", 0.18);

          if (Math.random() < 0.12) spawnPowerup(a.x + a.w / 2, a.y + a.h / 2);

          unlock("invaders:first_kill");
          if (score >= 500) unlock("invaders:score_500");
          if (aliensKilled >= 50) unlock("invaders:aliens_50");
          break;
        }
      }
    } else {
      // enemy bullet hits player
      if (
        b.y + b.h >= player.y &&
        b.y <= player.y + player.h &&
        b.x >= player.x &&
        b.x <= player.x + player.w
      ) {
        b.alive = false;
        waveHits++;
        if (shieldCharges > 0) {
          shieldCharges--;
          playBeep(140, 0.08, "triangle", 0.18);
        } else {
          running = false;
          playBeep(90, 0.12, "triangle", 0.22);
        }
      }
    }
  }

  // powerups
  for (const p of powerups) {
    if (!p.alive) continue;
    p.y += p.dy;
    if (p.y > canvas.height + 20) p.alive = false;

    if (
      p.y + p.h >= player.y &&
      p.y <= player.y + player.h &&
      p.x + p.w >= player.x &&
      p.x <= player.x + player.w
    ) {
      p.alive = false;
      applyPowerup(p.type);
    }
  }

  // enemy fire
  const fireRate = Math.min(0.006 + (wave - 1) * 0.0015, 0.02);
  if (Math.random() < fireRate) {
    const shooters = aliens.filter((a) => a.alive);
    if (shooters.length) {
      const s = shooters[Math.floor(Math.random() * shooters.length)];
      const activeEnemyBullets = bullets.filter((b) => b.alive && b.enemy).length;
      if (activeEnemyBullets < 6) {
        bullets.push({ x: s.x + 8, y: s.y + 16, w: 4, h: 10, dy: 4, enemy: true, alive: true });
      }
    }
  }

  // move aliens
  let hitEdge = false;
  const now = performance.now();
  const slowFactor = now < slowAliensUntil ? 0.6 : 1;
  for (const a of aliens) {
    if (!a.alive) continue;
    a.x += alienDir * alienSpeed * slowFactor;
    if (a.x <= 0 || a.x + a.w >= canvas.width) hitEdge = true;
  }

  if (hitEdge) {
    alienDir *= -1;
    const drop = Math.min(12 + (wave - 1) * 2, 18);
    for (const a of aliens) a.y += drop;
    alienSpeed += 0.1 + Math.min((wave - 1) * 0.02, 0.1);
  }

  // lose if aliens reach bottom
  for (const a of aliens) {
    if (a.alive && a.y >= 420) {
      running = false;
      playBeep(80, 0.15, "triangle", 0.22);
      return;
    }
  }

  // wave complete
  if (aliens.every((a) => !a.alive)) {
    if (waveHits === 0) unlock("invaders:perfect_wave");
    wave += 1;
    waveHits = 0;
    setText(waveEl, wave);
    if (wave >= 3) unlock("invaders:wave_3");

    bullets = [];
    powerups = [];
    spawnAliens();
    alienSpeed = 0.6 + (wave - 1) * 0.22;
  }
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // player
  ctx.fillStyle = "rgba(34,197,94,1)";
  ctx.beginPath();
  ctx.moveTo(player.x + 15, player.y);
  ctx.lineTo(player.x + 30, player.y + 20);
  ctx.lineTo(player.x, player.y + 20);
  ctx.closePath();
  ctx.fill();

  // shield indicator
  if (shieldCharges > 0) {
    ctx.strokeStyle = "rgba(59,130,246,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 3, player.y - 3, player.w + 6, player.h + 6);
    ctx.lineWidth = 1;
  }

  // aliens
  ctx.fillStyle = "rgba(239,68,68,0.95)";
  aliens.forEach((a) => {
    if (!a.alive) return;
    ctx.fillRect(a.x, a.y, a.w, a.h);
  });

  // bullets
  bullets.forEach((b) => {
    if (!b.alive) return;
    ctx.fillStyle = b.enemy ? "rgba(248,113,113,0.95)" : "rgba(250,204,21,0.95)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
  });

  // powerups
  powerups.forEach((p) => {
    if (!p.alive) return;
    const color = p.type === "rapid" ? "rgba(59,130,246,0.95)" : p.type === "spread" ? "rgba(168,85,247,0.95)" : p.type === "shield" ? "rgba(34,211,238,0.95)" : "rgba(250,204,21,0.95)";
    const label = p.type === "rapid" ? "R" : p.type === "spread" ? "S" : p.type === "shield" ? "H" : "L";
    ctx.fillStyle = color;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, p.x + p.w / 2, p.y + p.h / 2 + 0.5);
  });

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

function loop() {
  if (running && !paused) update();
  draw();
  if (running) requestAnimationFrame(loop);
}

function setPaused(next) {
  paused = !!next;
  const btn = document.getElementById("invaders-pause");
  if (!btn) return;
  btn.textContent = paused ? "Resume" : "Pause";
  btn.classList.toggle("bg-green-600", paused);
  btn.classList.toggle("bg-yellow-600", !paused);
}

function bindInputs() {
  // keyboard stateful
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        input.left = true;
      }
      if (e.key === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        input.right = true;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        input.autoFire = !input.autoFire;
        if (input.autoFire) shoot();
      }
      if (e.code === "KeyW" || e.code === "ArrowUp") {
        e.preventDefault();
        input.shootHeld = true;
        shoot();
      }
    },
    { passive: false }
  );

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.code === "KeyA") input.left = false;
    if (e.key === "ArrowRight" || e.code === "KeyD") input.right = false;
    if (e.code === "KeyW" || e.code === "ArrowUp") input.shootHeld = false;
  });

  // touch buttons - stateful hold
  document.querySelectorAll("[data-invaders]").forEach((btn) => {
    const action = btn.getAttribute("data-invaders");

    const down = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      if (action === "left") input.left = true;
      if (action === "right") input.right = true;
      if (action === "shoot") {
        input.shootHeld = true;
        shoot();
      }
    };
    const up = (e) => {
      e.preventDefault();
      try {
        btn.releasePointerCapture?.(e.pointerId);
      } catch {}
      if (action === "left") input.left = false;
      if (action === "right") input.right = false;
      if (action === "shoot") input.shootHeld = false;
    };

    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  });

  if (isMobileDevice()) {
    // optional drag move on canvas
    let dragging = false;
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        dragging = true;
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
        player.x = Math.max(0, Math.min(canvas.width - player.w, x - player.w / 2));
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

  document.getElementById("invaders-restart")?.addEventListener("click", () => {
    reset();
    running = true;
    requestAnimationFrame(loop);
  });

  document.getElementById("invaders-pause")?.addEventListener("click", () => {
    if (!running) return;
    setPaused(!paused);
  });
}

function init() {
  initSoundToggle("invaders-sound");

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

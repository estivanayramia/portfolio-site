import { addVisibilityPause, initSoundToggle, playBeep, unlock, isMobileDevice } from "./_shared.js";

const canvas = document.getElementById("breaker-canvas");
const ctx = canvas?.getContext("2d");

const scoreEl = document.getElementById("breaker-score");
const livesEl = document.getElementById("breaker-lives");

let running = false;
let paused = false;

let paddle = { x: 150, w: 100, h: 10 };
let ball = { x: 200, y: 300, dx: 0, dy: 0, r: 6 };
let bricks = [];
let score = 0;
let lives = 3;
let level = 1;

let paddleDir = 0; // -1, 0, 1
let started = false;

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
      bricks.push({
        x: startX + c * (brickW + gapX),
        y: startY + r * (brickH + gapY),
        w: brickW,
        h: brickH,
        alive: true,
      });
    }
  }
}

function reset() {
  paddle = { x: 150, w: 100, h: 10 };
  ball = { x: 200, y: 300, dx: 0, dy: 0, r: 6 };
  score = 0;
  lives = 3;
  level = 1;
  paddleDir = 0;
  started = false;
  makeBricks();

  setText(scoreEl, score);
  setText(livesEl, lives);
}

function startBallIfNeeded() {
  if (started) return;
  started = true;
  ball.dx = 4 * (Math.random() > 0.5 ? 1 : -1);
  ball.dy = -4;
}

function update() {
  // paddle
  paddle.x += paddleDir * 7;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));

  if (!started) {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = 300;
    return;
  }

  // ball
  ball.x += ball.dx;
  ball.y += ball.dy;

  // walls
  if (ball.x + ball.r >= canvas.width || ball.x - ball.r <= 0) ball.dx *= -1;
  if (ball.y - ball.r <= 0) ball.dy *= -1;

  // bottom
  if (ball.y - ball.r > canvas.height) {
    lives -= 1;
    setText(livesEl, lives);
    if (lives <= 0) {
      running = false;
      return;
    }
    started = false;
    ball.dx = 0;
    ball.dy = 0;
    return;
  }

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
      b.alive = false;
      ball.dy *= -1;
      score += 10 * level;
      setText(scoreEl, score);
      playBeep(180, 0.07, "sawtooth", 0.2);

      unlock("breaker:first_brick");
      if (score >= 500) unlock("breaker:score_500");

      if (bricks.every((x) => !x.alive)) {
        level += 1;
        makeBricks();
        // speed up a little
        ball.dx *= 1.05;
        ball.dy *= 1.05;
        playBeep(520, 0.1, "triangle", 0.18);
        if (level >= 3) unlock("breaker:level_3");
      }
      break;
    }
  }
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // bricks
  bricks.forEach((b) => {
    if (!b.alive) return;
    ctx.fillStyle = "rgba(168,85,247,0.9)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  });

  // paddle
  ctx.fillStyle = "rgba(168,85,247,1)";
  ctx.fillRect(paddle.x, 480, paddle.w, paddle.h);

  // ball
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

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

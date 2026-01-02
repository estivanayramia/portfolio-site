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

function gridSize() {
  return 20;
}

function cellPx() {
  return canvas.width / gridSize();
}

function setText(el, value) {
  if (el) el.textContent = String(value);
}

function placeFood() {
  const size = gridSize();
  while (true) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const onSnake = snake.some((s) => s.x === x && s.y === y);
    if (!onSnake) {
      food = { x, y };
      return;
    }
  }
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
  const next = { x: head.x + dir.x, y: head.y + dir.y };

  const hitWall = next.x < 0 || next.x >= size || next.y < 0 || next.y >= size;
  const hitSelf = snake.slice(1).some((s) => s.x === next.x && s.y === next.y);

  if (hitWall || hitSelf) {
    running = false;
    return;
  }

  snake.unshift(next);

  if (next.x === food.x && next.y === food.y) {
    foodEaten++;
    combo++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      combo = 0;
    }, 2000);

    const multiplier = Math.min(combo, 5);
    score += level * 10 * multiplier;
    setText(scoreEl, score);

    playBeep(440, 0.08);

    unlock("snake:first_food");
    if (multiplier >= 5) unlock("snake:combo_5");
    if (score >= 100) unlock("snake:score_100");
    if (snake.length >= 20) unlock("snake:length_20");

    if (foodEaten % 5 === 0) {
      level++;
      speedMs = Math.max(55, speedMs - 10);
      setText(levelEl, level);
      if (level >= 5) unlock("snake:level_5");
      playBeep(660, 0.12);
    }

    placeFood();
  } else {
    snake.pop();
  }
}

function draw() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const px = cellPx();

  // Food
  ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
  ctx.beginPath();
  ctx.arc(food.x * px + px / 2, food.y * px + px / 2, px * 0.33, 0, Math.PI * 2);
  ctx.fill();

  // Snake
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? "rgba(34,197,94,1)" : "rgba(34,197,94,0.85)";
    ctx.fillRect(s.x * px + 1, s.y * px + 1, px - 2, px - 2);
  });

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
    if (ts - lastStep >= speedMs) {
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

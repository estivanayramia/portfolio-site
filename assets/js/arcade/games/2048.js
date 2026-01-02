import { initSoundToggle, playBeep, unlock } from "./_shared.js";

const layer = document.getElementById("merge-tiles-layer");
const container = document.getElementById("merge-container");
const scoreEl = document.getElementById("merge-score");
const bestEl = document.getElementById("merge-best");

let tiles = [];
let score = 0;
let best = parseInt(localStorage.getItem("mergeBest") || "0", 10);
let idCounter = 0;

function setText(el, value) {
  if (el) el.textContent = String(value);
}

function emptyCells() {
  const empty = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!tiles.find((t) => t.r === r && t.c === c)) empty.push({ r, c });
    }
  }
  return empty;
}

function spawn() {
  const empty = emptyCells();
  if (!empty.length) return;
  const spot = empty[Math.floor(Math.random() * empty.length)];
  tiles.push({
    id: idCounter++,
    r: spot.r,
    c: spot.c,
    val: Math.random() < 0.9 ? 2 : 4,
    new: true,
    merged: false,
  });
}

function render() {
  if (!layer) return;

  const existing = new Map();
  Array.from(layer.children).forEach((el) => {
    const id = el.dataset.tileId;
    if (id) existing.set(id, el);
  });

  const gap = 12;
  const step = 70 + gap;

  tiles.forEach((t) => {
    let el = existing.get(String(t.id));
    const isNewEl = !el;
    if (!el) {
      el = document.createElement("div");
      el.className = "merge-tile";
      el.dataset.tileId = String(t.id);
      layer.appendChild(el);
    }

    const x = t.c * step;
    const y = t.r * step;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.textContent = String(t.val);

    const classes = ["merge-tile", `tile-${t.val}`];
    if (t.new) classes.push("new");
    if (t.merged) classes.push("merged");
    if (!t.new && !isNewEl) classes.push("moving");
    el.className = classes.join(" ");

    existing.delete(String(t.id));

    if (t.new || t.merged) {
      setTimeout(() => {
        t.new = false;
        t.merged = false;
        el?.classList.remove("new", "merged");
      }, 250);
    }
  });

  existing.forEach((el) => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 180);
  });
}

function canMove() {
  if (emptyCells().length) return true;
  for (const t of tiles) {
    const n1 = tiles.find((x) => x.r === t.r && x.c === t.c + 1);
    const n2 = tiles.find((x) => x.r === t.r + 1 && x.c === t.c);
    if (n1 && n1.val === t.val) return true;
    if (n2 && n2.val === t.val) return true;
  }
  return false;
}

function move(dir) {
  let moved = false;
  const sorted = [...tiles];
  if (dir === "right") sorted.sort((a, b) => b.c - a.c);
  if (dir === "left") sorted.sort((a, b) => a.c - b.c);
  if (dir === "down") sorted.sort((a, b) => b.r - a.r);
  if (dir === "up") sorted.sort((a, b) => a.r - b.r);

  const mergedIds = new Set();

  for (const t of sorted) {
    let tr = t.r;
    let tc = t.c;

    while (true) {
      let nr = tr;
      let nc = tc;
      if (dir === "right") nc++;
      if (dir === "left") nc--;
      if (dir === "down") nr++;
      if (dir === "up") nr--;

      if (nr < 0 || nr > 3 || nc < 0 || nc > 3) break;

      const obstacle = tiles.find((x) => x.r === nr && x.c === nc);
      if (!obstacle) {
        tr = nr;
        tc = nc;
        moved = true;
        continue;
      }

      if (!mergedIds.has(obstacle.id) && obstacle.val === t.val) {
        // merge t into obstacle
        tiles = tiles.filter((x) => x.id !== t.id);
        obstacle.val *= 2;
        obstacle.merged = true;
        mergedIds.add(obstacle.id);

        score += obstacle.val;
        setText(scoreEl, score);
        playBeep(520, 0.05);

        if (obstacle.val === 128) unlock("merge:tile_128");
        if (obstacle.val === 512) unlock("merge:tile_512");
        if (obstacle.val === 1024) unlock("merge:tile_1024");
        if (obstacle.val === 2048) unlock("merge:tile_2048");
        if (score >= 5000) unlock("merge:score_5000");

        if (score > best) {
          best = score;
          localStorage.setItem("mergeBest", String(best));
          setText(bestEl, best);
        }

        moved = true;
        break;
      }

      break;
    }

    if (t.r !== tr || t.c !== tc) {
      t.r = tr;
      t.c = tc;
    }
  }

  if (!moved) return;

  spawn();
  render();

  if (!canMove()) {
    // no modal: keep it simple; user can restart
    playBeep(110, 0.12, "triangle", 0.18);
  }
}

function reset() {
  tiles = [];
  idCounter = 0;
  score = 0;
  setText(scoreEl, 0);
  setText(bestEl, best);
  spawn();
  spawn();
  render();
}

function bind() {
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        move("up");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move("down");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move("left");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move("right");
      }
    },
    { passive: false }
  );

  let startX = 0;
  let startY = 0;

  container?.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
    },
    { passive: true }
  );

  container?.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 30) move(dx > 0 ? "right" : "left");
      } else {
        if (Math.abs(dy) > 30) move(dy > 0 ? "down" : "up");
      }
    },
    { passive: true }
  );

  document.getElementById("merge-restart")?.addEventListener("click", reset);
}

function init() {
  initSoundToggle("merge-sound");
  reset();
  bind();
}

init();

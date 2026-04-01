import { isMobileDevice, initSoundToggle, playBeep, addVisibilityPause } from './_shared.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let W, H;
function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  W = rect.width;
  H = Math.min(W * 1.1, window.innerHeight * 0.75);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (hexGrid.length) layoutGrid();
}
resize();
window.addEventListener('resize', resize);

// --- Hex colors ---
const HEX_COLORS = [
  { base: '#ff3b7f', glow: '#ff3b7f', light: '#ff80ab' },
  { base: '#3b9fff', glow: '#3b9fff', light: '#80c4ff' },
  { base: '#3bff8f', glow: '#3bff8f', light: '#80ffb8' },
  { base: '#ffcc3b', glow: '#ffcc3b', light: '#ffe080' },
  { base: '#c850ff', glow: '#c850ff', light: '#df90ff' },
  { base: '#ff6e3b', glow: '#ff6e3b', light: '#ff9e80' },
  { base: '#3bffea', glow: '#3bffea', light: '#80fff2' },
];

// --- State ---
const STATE = { MENU: 0, SHOWING: 1, INPUT: 2, SUCCESS: 3, FAIL: 4 };
let state = STATE.MENU;
let running = false;
let frameCount = 0;
let score = 0;
let bestScore = parseInt(localStorage.getItem('hexmem-best') || '0');
let level = 1;
let sequence = [];
let playerInput = [];
let showIdx = 0;
let showTimer = 0;
let showInterval = 35;
let flashTimer = 0;
let successTimer = 0;
let failTimer = 0;

// --- Grid ---
let hexGrid = [];
let gridCols = 3;
let gridRows = 3;
const HEX_RADIUS = 32;

// Ambient particles
let ambientParticles = [];
let burstParticles = [];

function hexCorner(cx, cy, r, i) {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function drawHexPath(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const c = hexCorner(cx, cy, r, i);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  }
  ctx.closePath();
}

function layoutGrid() {
  hexGrid = [];
  const hexW = HEX_RADIUS * Math.sqrt(3);
  const hexH = HEX_RADIUS * 2;
  const totalW = gridCols * hexW + (gridCols > 1 ? hexW * 0.5 : 0);
  const totalH = gridRows * hexH * 0.75 + hexH * 0.25;
  const startX = (W - totalW) / 2 + hexW / 2;
  const startY = (H - totalH) / 2 + hexH / 2 + 20;

  let id = 0;
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const offset = (row % 2) * hexW * 0.5;
      const cx = startX + col * hexW + offset;
      const cy = startY + row * hexH * 0.75;
      const colorIdx = id % HEX_COLORS.length;
      hexGrid.push({
        id, cx, cy, colorIdx,
        lit: 0,        // 0-1 glow intensity
        pressed: false,
        scale: 1,
        hoverGlow: 0
      });
      id++;
    }
  }
}

function updateGridSize() {
  if (level <= 3) { gridCols = 3; gridRows = 3; }
  else if (level <= 6) { gridCols = 4; gridRows = 3; }
  else if (level <= 10) { gridCols = 4; gridRows = 4; }
  else { gridCols = 5; gridRows = 4; }
  layoutGrid();
}

function startLevel() {
  updateGridSize();
  const seqLen = Math.min(level + 2, hexGrid.length);
  // Add one to existing sequence
  if (level === 1) {
    sequence = [];
  }
  // Add new items to sequence
  const newItems = level === 1 ? 3 : 1;
  for (let i = 0; i < newItems; i++) {
    sequence.push(Math.floor(Math.random() * hexGrid.length));
  }
  playerInput = [];
  showIdx = 0;
  showTimer = 0;
  showInterval = Math.max(18, 35 - level);
  state = STATE.SHOWING;
}

function startGame() {
  score = 0;
  level = 1;
  sequence = [];
  updateGridSize();
  startLevel();
  running = true;
}

function handleHexClick(hexId) {
  if (state !== STATE.INPUT) return;

  const hex = hexGrid[hexId];
  if (!hex) return;

  hex.lit = 1;
  hex.pressed = true;
  playerInput.push(hexId);

  // Check
  const idx = playerInput.length - 1;
  if (sequence[idx] !== hexId) {
    // Wrong
    state = STATE.FAIL;
    failTimer = 90;
    playBeep(160, 0.3, 'sawtooth', 0.18);

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('hexmem-best', bestScore.toString());
    }
    return;
  }

  playBeep(300 + hexId * 80, 0.08, 'sine', 0.12);

  if (playerInput.length === sequence.length) {
    // Level complete
    state = STATE.SUCCESS;
    successTimer = 60;
    score += level * 10;
    level++;

    // Burst particles
    for (let i = 0; i < 20; i++) {
      burstParticles.push({
        x: W / 2 + (Math.random() - 0.5) * 100,
        y: H / 2 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        r: Math.random() * 5 + 2,
        hue: Math.random() * 360
      });
    }

    playBeep(520, 0.1, 'sine', 0.15);
    setTimeout(() => playBeep(660, 0.1, 'sine', 0.15), 100);
  }
}

// --- Input ---
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W / rect.width);
  const py = (e.clientY - rect.top) * (H / rect.height);

  if (state === STATE.MENU) {
    startGame();
    return;
  }
  if (state === STATE.FAIL) {
    if (failTimer <= 0) state = STATE.MENU;
    return;
  }

  // Check hex hit
  if (state === STATE.INPUT) {
    for (const hex of hexGrid) {
      const dx = px - hex.cx;
      const dy = py - hex.cy;
      if (Math.sqrt(dx * dx + dy * dy) < HEX_RADIUS * 0.9) {
        handleHexClick(hex.id);
        break;
      }
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (state === STATE.MENU) {
      startGame();
    } else if (state === STATE.FAIL && failTimer <= 0) {
      state = STATE.MENU;
    }
  }
  // Number keys for hex selection
  if (state === STATE.INPUT) {
    const num = parseInt(e.key);
    if (num >= 1 && num <= hexGrid.length) {
      handleHexClick(num - 1);
    }
  }
});

// --- Draw ---
function drawBackground() {
  const t = frameCount * 0.003;
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  const hue = (frameCount * 0.1) % 360;
  bg.addColorStop(0, `hsl(${hue}, 15%, 10%)`);
  bg.addColorStop(0.5, `hsl(${(hue + 30) % 360}, 12%, 7%)`);
  bg.addColorStop(1, `hsl(${(hue + 60) % 360}, 15%, 4%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient floating particles
  if (frameCount % 8 === 0 && ambientParticles.length < 30) {
    ambientParticles.push({
      x: Math.random() * W,
      y: H + 10,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -Math.random() * 0.8 - 0.2,
      life: 1,
      r: Math.random() * 3 + 1,
      hue: Math.random() * 360
    });
  }

  for (const p of ambientParticles) {
    ctx.globalAlpha = p.life * 0.3;
    ctx.fillStyle = `hsl(${p.hue}, 60%, 60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHex(hex) {
  const { cx, cy, colorIdx, lit, scale } = hex;
  const c = HEX_COLORS[colorIdx];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // Base hex
  const alpha = 0.15 + lit * 0.85;
  drawHexPath(cx, cy, HEX_RADIUS - 2);
  ctx.fillStyle = `${c.base}${Math.floor(alpha * 40).toString(16).padStart(2, '0')}`;
  ctx.fill();

  // Border
  ctx.strokeStyle = lit > 0.3 ? c.light : `${c.base}88`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glow when lit
  if (lit > 0.1) {
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 20 * lit;
    drawHexPath(cx, cy, HEX_RADIUS - 2);
    ctx.strokeStyle = c.light;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner glow fill
    const igGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, HEX_RADIUS);
    igGrad.addColorStop(0, `${c.light}${Math.floor(lit * 180).toString(16).padStart(2, '0')}`);
    igGrad.addColorStop(1, 'transparent');
    drawHexPath(cx, cy, HEX_RADIUS - 2);
    ctx.fillStyle = igGrad;
    ctx.fill();
  }

  ctx.restore();
}

function drawGrid() {
  for (const hex of hexGrid) {
    drawHex(hex);
  }
}

function drawHUD() {
  ctx.textAlign = 'center';

  // Level
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText(`Level ${level}`, W / 2, 28);

  // Score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText(score.toString(), W / 2, 54);

  // Sequence progress
  if (state === STATE.INPUT) {
    const total = sequence.length;
    const done = playerInput.length;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(`${done} / ${total}`, W / 2, H - 24);

    // Progress dots
    const dotR = 4;
    const dotGap = 12;
    const dotsW = (total - 1) * dotGap;
    const startX = W / 2 - dotsW / 2;
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = i < done ? '#3bff8f' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(startX + i * dotGap, H - 44, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Watch prompt during showing
  if (state === STATE.SHOWING) {
    const pulse = 0.6 + 0.4 * Math.sin(frameCount * 0.1);
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('Watch carefully...', W / 2, H - 30);
  }
}

function drawBurstParticles() {
  for (const p of burstParticles) {
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
  ctx.fillStyle = '#c850ff';
  ctx.shadowColor = '#c850ff';
  ctx.shadowBlur = 25;
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.fillText('Hex Memory', W / 2, H * 0.2);
  ctx.shadowBlur = 0;

  // Animated hex preview
  const previewHexes = 7;
  const t = frameCount * 0.02;
  for (let i = 0; i < previewHexes; i++) {
    const angle = t + (i / previewHexes) * Math.PI * 2;
    const cx = W / 2 + Math.cos(angle) * 55;
    const cy = H * 0.38 + Math.sin(angle) * 35;
    const c = HEX_COLORS[i];
    const lit = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + i));

    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 10 * lit;
    drawHexPath(cx, cy, 16);
    ctx.fillStyle = `${c.base}${Math.floor(lit * 200).toString(16).padStart(2, '0')}`;
    ctx.fill();
    ctx.strokeStyle = c.light;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '15px Inter, sans-serif';
  ctx.fillText('Repeat the pattern from memory', W / 2, H * 0.55);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(isMobileDevice() ? 'Tap to start' : 'Press Space to start', W / 2, H * 0.65);

  if (bestScore > 0) {
    ctx.fillStyle = 'rgba(200,80,255,0.8)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(`Best: ${bestScore}`, W / 2, H * 0.72);
  }
}

function drawFailScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff3b7f';
  ctx.shadowColor = '#ff3b7f';
  ctx.shadowBlur = 15;
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('Wrong!', W / 2, H * 0.25);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Inter, sans-serif';
  ctx.fillText(score.toString(), W / 2, H * 0.4);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`Reached level ${level}`, W / 2, H * 0.5);
  ctx.fillText(`Sequence length: ${sequence.length}`, W / 2, H * 0.57);

  ctx.fillStyle = 'rgba(200,80,255,0.8)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`Best: ${bestScore}`, W / 2, H * 0.64);

  if (failTimer <= 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(isMobileDevice() ? 'Tap to continue' : 'Press Space to continue', W / 2, H * 0.75);
  }
}

function drawSuccessOverlay() {
  if (successTimer <= 0) return;
  const alpha = successTimer / 60 * 0.2;
  ctx.fillStyle = `rgba(59,255,143,${alpha})`;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.globalAlpha = successTimer / 60;
  ctx.fillStyle = '#3bff8f';
  ctx.shadowColor = '#3bff8f';
  ctx.shadowBlur = 15;
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.fillText('Correct!', W / 2, H / 2);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// --- Update ---
function update() {
  frameCount++;

  // Ambient particles
  for (const p of ambientParticles) {
    p.x += p.vx; p.y += p.vy; p.life -= 0.003;
  }
  ambientParticles = ambientParticles.filter(p => p.life > 0 && p.y > -10);

  for (const p of burstParticles) {
    p.x += p.vx; p.y += p.vy; p.life -= 0.02;
  }
  burstParticles = burstParticles.filter(p => p.life > 0);

  // Decay hex lit
  for (const hex of hexGrid) {
    if (hex.lit > 0) hex.lit = Math.max(0, hex.lit - 0.04);
    if (hex.pressed) { hex.pressed = false; }
    hex.scale += (1 - hex.scale) * 0.15;
  }

  if (state === STATE.SHOWING) {
    showTimer++;
    if (showTimer >= showInterval) {
      showTimer = 0;
      if (showIdx < sequence.length) {
        const hex = hexGrid[sequence[showIdx]];
        if (hex) {
          hex.lit = 1;
          hex.scale = 1.1;
          playBeep(300 + sequence[showIdx] * 80, 0.1, 'sine', 0.12);
        }
        showIdx++;
      } else {
        // Done showing, switch to input
        state = STATE.INPUT;
        playerInput = [];
      }
    }
  }

  if (state === STATE.SUCCESS) {
    successTimer--;
    if (successTimer <= 0) {
      startLevel();
    }
  }

  if (state === STATE.FAIL) {
    if (failTimer > 0) failTimer--;
  }
}

function gameLoop() {
  update();

  if (state === STATE.MENU) {
    drawMenuScreen();
  } else {
    drawBackground();
    drawGrid();
    drawBurstParticles();
    drawHUD();
    if (state === STATE.SUCCESS) drawSuccessOverlay();
    if (state === STATE.FAIL) drawFailScreen();
  }

  requestAnimationFrame(gameLoop);
}

// --- Init ---
initSoundToggle('sound-toggle-hexmem');
addVisibilityPause({
  isRunning: () => running,
  pause: () => { running = false; },
  resume: () => {
    if (state === STATE.SHOWING || state === STATE.INPUT || state === STATE.SUCCESS) {
      running = true;
    }
  }
});
updateGridSize();
gameLoop();

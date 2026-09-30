'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let startLevel = 1;
let combo = 0, maxCombo = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Skins ----
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    boardBg: null, // usa el fondo CSS del tema
    grid: null,    // usa --grid del tema
    drawBlock(context, x, y, color, size) {
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    },
  },
  neon: {
    label: 'Neón',
    colors: [null, '#00fff2', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#2d6bff', '#ff8a00', '#ff00c8'],
    boardBg: '#000000',
    grid: '#16161f',
    drawBlock(context, x, y, color, size) {
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.fillStyle = color;
      context.globalAlpha *= 0.35;
      context.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#a8e6f0', '#fff3b0', '#d7b8f3', '#b9f0c4', '#ffb3ba', '#b5c9ff', '#ffd6a5', '#f5c6e8'],
    boardBg: '#fdf6f0',
    grid: '#f0e4dc',
    drawBlock(context, x, y, color, size) {
      roundRectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, 8);
      context.fillStyle = color;
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.45)';
      roundRectPath(context, x * size + 6, y * size + 5, size - 14, 5, 2.5);
      context.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: [null, '#3ec1d3', '#f9c22e', '#9b5de5', '#5cb85c', '#e4572e', '#3a6ea5', '#f08a24', '#c9c9c9'],
    boardBg: '#1b1b2b',
    grid: '#26263a',
    drawBlock(context, x, y, color, size) {
      const px = x * size, py = y * size, u = size / 6;
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // textura: cuadritos claros y oscuros en patrón de tablero
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if ((i + j) % 2) continue;
          context.fillStyle = (i + j) % 4 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
          context.fillRect(px + 1 + i * u, py + 1 + j * u, u, u);
        }
      }
      context.strokeStyle = 'rgba(0,0,0,0.6)';
      context.lineWidth = 1;
      context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    },
  },
};

let skinName = 'retro';

function skinColor(skin, colorIndex) {
  return skin.colors[colorIndex] || skin.colors[1];
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[skinName];
  context.save();
  context.globalAlpha = alpha ?? 1;
  skin.drawBlock(context, x, y, skinColor(skin, colorIndex), size);
  context.restore();
}

function fillBg(context, cnv) {
  context.clearRect(0, 0, cnv.width, cnv.height);
  const bg = SKINS[skinName].boardBg;
  if (bg) {
    context.fillStyle = bg;
    context.fillRect(0, 0, cnv.width, cnv.height);
  }
}

function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  skinName = name;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  try { localStorage.setItem('tetris-skin', name); } catch (e) {}
  if (current && next) { draw(); drawNext(); }
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skinName].grid || getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  fillBg(ctx, canvas);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  fillBg(nextCtx, nextCanvas);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  recordsOnGameOver();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return; // endGame() ocurrió durante este frame
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hidePauseMenu();
  recordsHide();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // escribiendo el nombre (records): no disparar acciones de juego
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// ---- Pausa ----
const pauseMenu = document.getElementById('pause-menu');
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControlsList = document.getElementById('pause-controls');
const pauseLevelSel = document.getElementById('pause-level');

for (let i = 1; i <= 10; i++) pauseLevelSel.add(new Option(i, i));
pauseLevelSel.value = startLevel;

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  pauseControlsList.classList.add('hidden');
  pauseControlsBtn.setAttribute('aria-expanded', 'false');
}

// Con el menu abierto, `paused` bloquea los inputs del juego (ver keydown)
function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    if (document.activeElement) document.activeElement.blur();
    lastTime = performance.now();
    dropAccum = 0;
    animId = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(animId);
    pauseMenu.classList.remove('hidden');
    pauseResumeBtn.focus();
  }
}

pauseResumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  pauseRestartBtn.blur();
  init();
});
pauseControlsBtn.addEventListener('click', () => {
  const hidden = pauseControlsList.classList.toggle('hidden');
  pauseControlsBtn.setAttribute('aria-expanded', String(!hidden));
});
pauseLevelSel.addEventListener('change', () => {
  startLevel = parseInt(pauseLevelSel.value, 10) || 1;
});

const themeToggle = document.getElementById('theme-toggle');
const toggleIcon = themeToggle.querySelector('.toggle-icon');
const toggleLabel = themeToggle.querySelector('.toggle-label');

function applyTheme(isLight) {
  if (isLight) {
    document.documentElement.setAttribute('data-theme', 'light');
    toggleIcon.textContent = '☀';
    toggleLabel.textContent = 'DARK';
  } else {
    document.documentElement.removeAttribute('data-theme');
    toggleIcon.textContent = '☾';
    toggleLabel.textContent = 'LIGHT';
  }
  if (typeof current !== 'undefined' && current) draw();
}

const savedTheme = localStorage.getItem('tetris-theme');
applyTheme(savedTheme === 'light');

themeToggle.addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') !== 'light';
  applyTheme(isLight);
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
});

for (const key of Object.keys(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = SKINS[key].label;
  skinSelect.appendChild(opt);
}
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas/Space cambien el select
});

let savedSkin = null;
try { savedSkin = localStorage.getItem('tetris-skin'); } catch (e) {}
applySkin(savedSkin);

restartBtn.addEventListener('click', () => {
  init();
  restartBtn.textContent = 'Reiniciar';
  restartBtn.blur(); // evita que Space (caída) reactive el botón
});
// ---- Records ----
const RECORDS_KEY = 'tetris-records';
const RECORDS_TOP = 5;
const recordsSection = document.getElementById('records-section');
const recordsForm = document.getElementById('records-form');
const recordsName = document.getElementById('records-name');
const recordsList = document.getElementById('records-list');
const recordsStats = document.getElementById('records-stats');
const recordsReset = document.getElementById('records-reset');
let records = loadRecords();
let pendingScore = null; // puntuación que califica y aún no se guardó

function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const d = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!d || !Array.isArray(d.top)) return empty;
    return {
      top: d.top
        .filter(e => e && Number.isFinite(e.score))
        .map(e => ({ name: String(e.name ?? '').slice(0, 12), score: e.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, RECORDS_TOP),
      bestCombo: Number(d.bestCombo) || 0,
      maxLines: Number(d.maxLines) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

function qualifies(s) {
  return s > 0 && (records.top.length < RECORDS_TOP || s > records.top[records.top.length - 1].score);
}

// highlightIdx: fila a resaltar (-1 = ninguna)
function renderRecords(highlightIdx = -1) {
  recordsList.replaceChildren();
  for (let i = 0; i < RECORDS_TOP; i++) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const pts = document.createElement('span');
    const entry = records.top[i];
    name.textContent = `${i + 1}. ${entry ? entry.name : '---'}`;
    pts.textContent = entry ? entry.score.toLocaleString() : '';
    if (!entry) li.className = 'empty';
    if (i === highlightIdx) li.className = 'highlight';
    li.append(name, pts);
    recordsList.append(li);
  }
  recordsStats.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx: ${records.maxLines}`;
  recordsSection.classList.remove('hidden');
}

function recordsHide() {
  pendingScore = null;
  recordsSection.classList.add('hidden');
  recordsForm.classList.add('hidden');
}

function recordsOnGameOver() {
  if (maxCombo > records.bestCombo) records.bestCombo = maxCombo;
  if (lines > records.maxLines) records.maxLines = lines;
  saveRecords();
  renderRecords();
  if (qualifies(score)) {
    pendingScore = score;
    recordsName.value = '';
    recordsForm.classList.remove('hidden');
    recordsName.focus();
  }
}

recordsForm.addEventListener('submit', e => {
  e.preventDefault();
  if (pendingScore === null) return;
  const name = recordsName.value.trim().slice(0, 12) || 'Anónimo';
  const entry = { name, score: pendingScore };
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score); // estable: empate queda tras el anterior
  records.top = records.top.slice(0, RECORDS_TOP);
  const idx = records.top.lastIndexOf(entry);
  pendingScore = null;
  saveRecords();
  recordsForm.classList.add('hidden');
  renderRecords(idx);
  restartBtn.focus();
});

recordsReset.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  records = { top: [], bestCombo: 0, maxLines: 0 };
  saveRecords();
  renderRecords();
  recordsReset.blur();
});

// Pantalla de inicio: el juego arranca al pulsar "Jugar"
gameOver = true; // bloquea teclas/pausa hasta iniciar
overlayTitle.textContent = 'TETRIS';
overlayScore.textContent = '';
renderRecords();

"use strict";

/* ─────────────────────────────────────────────
   CONFIG
   ───────────────────────────────────────────── */
const SYMBOLS = [
  { id: "seven", name: "Seven", src: "assets/seven7.jpg", weight: 2, payouts: { 3: 8, 4: 20, 5: 60 } },
  { id: "grape", name: "Grape", src: "assets/rrush.jpg", weight: 4, payouts: { 3: 5, 4: 12, 5: 35 } },
  { id: "cherry", name: "Cherry", src: "assets/cherry.jpg", weight: 6, payouts: { 3: 3, 4: 8, 5: 20 } },
  { id: "watermelon", name: "Watermelon", src: "assets/watermelon.jpg", weight: 8, payouts: { 3: 2, 4: 6, 5: 15 } },
  { id: "orange", name: "Orange", src: "assets/orange.jpg", weight: 10, payouts: { 3: 1, 4: 4, 5: 10 } },
];

const TOTAL_SLOTS = 15;
const COLS = 5;
const SETTINGS_KEY = "spinwin_settings_v3";
const BALANCE_KEY = "spinwin_balance_v3";
const STATE = { READY: "READY", SPINNING: "SPINNING", GAMEOVER: "GAMEOVER" };

// 15 paylines, using the existing slot IDs.
const PAYLINES = [
  [6, 7, 8, 9, 10],
  [1, 2, 3, 4, 5],
  [11, 12, 13, 14, 15],
  [1, 7, 13, 9, 5],
  [11, 7, 3, 9, 15],
  [6, 2, 3, 4, 10],
  [6, 12, 13, 14, 10],
  [1, 2, 8, 14, 15],
  [11, 12, 8, 4, 5],
  [6, 12, 8, 4, 10],
  [6, 2, 8, 14, 10],
  [1, 7, 8, 9, 5],
  [11, 7, 8, 9, 15],
  [1, 7, 3, 9, 5],
  [11, 7, 13, 9, 15],
];

const DEFAULTS = {
  spinCost: 50,
  startBalance: 1000,
  sound: true,
  particles: true,
};

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────── */
let settings = loadSettings();
let gameState = STATE.READY;
let balance = loadBalance();
let currentGrid = Array.from({ length: TOTAL_SLOTS }, () => pickWeightedSymbol());
let audioCtx = null;
let particles = [];
let resizeTimer = 0;

/* ─────────────────────────────────────────────
   DOM
   ───────────────────────────────────────────── */
const spinBtn = document.getElementById("spinBtn");
const spinHint = document.getElementById("spinHint");
const winValue = document.getElementById("winValue");
const pointsEl = document.getElementById("currentPoints");
const resultEl = document.getElementById("result");
const winRowLabel = document.getElementById("win-row-label");
const flashOverlay = document.getElementById("flash-overlay");
const gridEl = document.getElementById("slot-grid");
const yearEl = document.getElementById("year");
const balanceChip = document.getElementById("balanceChip");
const lowBalanceBar = document.getElementById("low-balance-bar");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const spinCostInput = document.getElementById("spinCostInput");
const startBalanceInput = document.getElementById("startBalanceInput");
const soundToggle = document.getElementById("soundToggle");
const particlesToggle = document.getElementById("particlesToggle");
const resetBtn = document.getElementById("resetBtn");
const resetBalanceBtn = document.getElementById("resetBalanceBtn");
const saveBtn = document.getElementById("saveBtn");
const canvas = document.getElementById("particles");
const ctx2d = canvas.getContext("2d");

/* ─────────────────────────────────────────────
   STORAGE + RANDOM
   ───────────────────────────────────────────── */
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

function loadBalance() {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    const saved = raw == null ? NaN : Number(raw);
    return Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : settings.startBalance;
  } catch {
    return settings.startBalance;
  }
}

function saveBalance() {
  try { localStorage.setItem(BALANCE_KEY, String(balance)); } catch {}
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randInt(maxExclusive) {
  const max = Math.floor(maxExclusive);
  if (max <= 1) return 0;

  if (window.crypto && crypto.getRandomValues) {
    const bucket = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do {
      crypto.getRandomValues(bucket);
    } while (bucket[0] >= limit);
    return bucket[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function pickWeightedSymbol() {
  let roll = randInt(TOTAL_WEIGHT);
  for (const symbol of SYMBOLS) {
    if (roll < symbol.weight) return symbol;
    roll -= symbol.weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function generateGrid() {
  return Array.from({ length: TOTAL_SLOTS }, () => pickWeightedSymbol());
}

/* ─────────────────────────────────────────────
   UI
   ───────────────────────────────────────────── */
function slotEl(index) {
  return document.getElementById(`slot${index}`);
}

function setAppHeightVar() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}

function updateUIConfig() {
  spinHint.textContent = `-${settings.spinCost} pts · SPACE`;
}

function updateBalance(animate = false) {
  balance = Math.max(0, Math.floor(balance));
  pointsEl.textContent = String(balance);
  saveBalance();

  if (animate) {
    pointsEl.classList.add("bump");
    setTimeout(() => pointsEl.classList.remove("bump"), 250);
  }

  const low = balance > 0 && balance < settings.spinCost * 3;
  const critical = balance > 0 && balance < settings.spinCost;
  balanceChip.classList.toggle("warning", critical);
  lowBalanceBar.textContent = low
    ? critical
      ? `Need ${settings.spinCost} pts to spin`
      : `Low balance - ${balance} pts remaining`
    : "";
  lowBalanceBar.classList.toggle("visible", low);
}

function setResult(text, type = "") {
  resultEl.textContent = text || "";
  resultEl.className = "";
  if (text) {
    resultEl.classList.add("visible");
    if (type) resultEl.classList.add(type);
  }
}

function setWinLabel(text) {
  winRowLabel.textContent = text || "";
  winRowLabel.className = text ? "visible" : "";
}

function clearWinners() {
  document.querySelectorAll(".slot.winner").forEach((slot) => slot.classList.remove("winner"));
}

function setButtonMode(mode) {
  const text = spinBtn.querySelector(".btn-text");
  if (mode === "NEW") {
    text.textContent = "NEW GAME";
    spinHint.textContent = "RESET BALANCE";
    return;
  }
  text.textContent = "SPIN";
  spinHint.textContent = `-${settings.spinCost} pts · SPACE`;
}

function renderStaticGrid(grid) {
  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const symbol = grid[i - 1];
    const slot = slotEl(i);
    slot.innerHTML = "";
    slot.classList.remove("winner");
    slot.appendChild(createReelItem(symbol, Math.max(slot.clientHeight, 80)));
  }
}

function rerenderGridAfterResize() {
  if (gameState === STATE.SPINNING) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    renderStaticGrid(currentGrid);
  }, 120);
}

function createReelItem(symbol, height) {
  const item = document.createElement("div");
  item.className = "reel-item";
  item.style.height = `${height}px`;

  const img = document.createElement("img");
  img.src = symbol.src;
  img.alt = symbol.name;
  img.decoding = "async";
  img.loading = "eager";

  item.appendChild(img);
  return item;
}

function updateGameStateFromBalance() {
  if (balance < settings.spinCost) {
    endGame();
  } else {
    gameState = STATE.READY;
    spinBtn.disabled = false;
    setButtonMode("SPIN");
  }
}

/* ─────────────────────────────────────────────
   AUDIO
   ───────────────────────────────────────────── */
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type, duration, vol = 0.25, startDelay = 0) {
  if (!settings.sound) return;
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + startDelay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
    osc.start(ctx.currentTime + startDelay);
    osc.stop(ctx.currentTime + startDelay + duration + 0.05);
  } catch {}
}

function playSpinSound() {
  if (prefersReducedMotion) return;
  for (let i = 0; i < 5; i++) playTone(310 - i * 24, "sawtooth", 0.12, 0.07, i * 0.07);
}

function playTickSound(col) { playTone(420 + col * 35, "square", 0.05, 0.04); }
function playWinSound() { [523, 659, 784, 1047].forEach((f, i) => playTone(f, "sine", 0.32, 0.2, i * 0.09)); }
function playLoseSound() { playTone(210, "sawtooth", 0.25, 0.1); }
function playGameOverSound() { [360, 300, 230].forEach((f, i) => playTone(f, "triangle", 0.35, 0.14, i * 0.12)); }

/* ─────────────────────────────────────────────
   PARTICLES
   ───────────────────────────────────────────── */
const AMBIENT_TARGET = 70;
const PARTICLE_CAP = 220;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

class Particle {
  constructor(burst = false, x = 0, y = 0) {
    this.burst = burst;
    if (burst) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = (Math.random() - 0.5) * 8 - 3;
      this.size = Math.random() * 6 + 3;
      this.life = 1;
      this.decay = Math.random() * 0.025 + 0.015;
      this.color = Math.random() > 0.5 ? "#ffd700" : "#9b30ff";
    } else {
      this.reset(true);
    }
  }

  reset(init = false) {
    this.x = Math.random() * window.innerWidth;
    this.y = init ? Math.random() * window.innerHeight : window.innerHeight + 10;
    this.size = Math.random() * 2 + 0.5;
    this.vy = -(Math.random() * 0.5 + 0.2);
    this.vx = (Math.random() - 0.5) * 0.3;
    this.life = Math.random() * 0.5 + 0.3;
    this.decay = 0.0008 + Math.random() * 0.0005;
    this.color = Math.random() > 0.6 ? "rgba(255,215,0," : "rgba(155,48,255,";
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (this.burst) {
      this.vy += 0.15;
    } else if (this.y < -10 || this.x < -10 || this.x > window.innerWidth + 10) {
      this.reset(false);
    }
  }

  draw() {
    ctx2d.save();
    ctx2d.globalAlpha = Math.max(0, this.life);
    ctx2d.fillStyle = this.burst ? this.color : `${this.color}${this.life})`;
    ctx2d.beginPath();
    ctx2d.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.restore();
  }
}

function initParticles() {
  particles = [];
  for (let i = 0; i < AMBIENT_TARGET; i++) particles.push(new Particle(false));
}

function burstParticles(cx, cy, count = 56) {
  if (!settings.particles || prefersReducedMotion) return;
  for (let i = 0; i < count; i++) particles.push(new Particle(true, cx, cy));
  if (particles.length > PARTICLE_CAP) particles = particles.slice(particles.length - PARTICLE_CAP);
}

function animateParticles() {
  ctx2d.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (settings.particles && !prefersReducedMotion) {
    if (particles.length < AMBIENT_TARGET && Math.random() < 0.5) particles.push(new Particle(false));
    let aliveCount = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.update();
      if (p.life > 0) {
        p.draw();
        particles[aliveCount++] = p;
      }
    }
    particles.length = aliveCount;
  } else {
    particles.length = 0;
  }
  requestAnimationFrame(animateParticles);
}

function flashScreen() {
  if (prefersReducedMotion) return;
  flashOverlay.classList.add("active");
  setTimeout(() => flashOverlay.classList.remove("active"), 80);
}

/* ─────────────────────────────────────────────
   REELS + ENGINE
   ───────────────────────────────────────────── */
function buildAllReels(finalGrid) {
  const heights = [];
  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const slot = slotEl(i);
    slot.innerHTML = "";
    slot.classList.remove("winner");
    heights.push(Math.max(slot.clientHeight, 80));
  }

  if (prefersReducedMotion) {
    renderStaticGrid(finalGrid);
    return 120;
  }

  const settleTimes = [];
  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const slot = slotEl(i);
    const col = (i - 1) % COLS;
    const height = heights[i - 1];
    const rounds = 9 + col * 3 + randInt(4);
    const totalItems = rounds + 1;
    const duration = clamp(560 + rounds * 24, 760, 1450);
    const delay = col * 90;

    const reel = document.createElement("div");
    reel.className = "reel";
    const strip = document.createElement("div");
    strip.className = "reel-strip";

    for (let k = 0; k < totalItems; k++) {
      strip.appendChild(createReelItem(k === totalItems - 1 ? finalGrid[i - 1] : pickWeightedSymbol(), height));
    }

    reel.appendChild(strip);
    slot.appendChild(reel);
    settleTimes.push(duration + delay);

    setTimeout(() => {
      playTickSound(col);
      strip.style.transition = "none";
      strip.style.transform = "translateY(0)";
      void strip.offsetHeight;
      strip.style.transition = `transform ${duration}ms cubic-bezier(.12,.85,.12,1)`;
      strip.style.transform = `translateY(${-height * (totalItems - 1)}px)`;
    }, delay);
  }

  return Math.max(...settleTimes) + 90;
}

function evaluatePaylines(grid, bet) {
  const wins = [];
  const winningSlots = new Set();
  let totalReward = 0;

  for (const line of PAYLINES) {
    const first = grid[line[0] - 1];
    let matchCount = 1;

    for (let i = 1; i < line.length; i++) {
      if (grid[line[i] - 1].id !== first.id) break;
      matchCount++;
    }

    if (matchCount >= 3) {
      const multiplier = first.payouts[matchCount] || 0;
      const reward = bet * multiplier;
      const matchedSlots = line.slice(0, matchCount);
      matchedSlots.forEach((idx) => winningSlots.add(idx));
      wins.push({ symbol: first, matchCount, reward, slots: matchedSlots });
      totalReward += reward;
    }
  }

  return { wins, winningSlots, totalReward };
}

function getWinTitle(totalReward, lineCount) {
  if (totalReward === 0) return "TRY AGAIN";
  if (totalReward >= settings.spinCost * 15) return "MEGA WIN";
  if (totalReward >= settings.spinCost * 5) return "BIG WIN";
  return lineCount > 1 ? `${lineCount} WINNING LINES` : "WINNING LINE";
}

function showSpinResult(evaluation) {
  const { wins, winningSlots, totalReward } = evaluation;
  winValue.textContent = `+${totalReward}`;

  if (totalReward > 0) {
    winningSlots.forEach((idx) => slotEl(idx).classList.add("winner"));
    balance += totalReward;
    updateBalance(true);

    const title = getWinTitle(totalReward, wins.length);
    setResult(`${title} +${totalReward} PTS`, "win");
    setWinLabel(title);

    const gridRect = gridEl.getBoundingClientRect();
    burstParticles(gridRect.left + gridRect.width / 2, gridRect.top + gridRect.height / 2);
    flashScreen();
    playWinSound();
  } else {
    setResult("TRY AGAIN", "lose");
    setWinLabel("");
    playLoseSound();
  }
}

function canSpin() {
  return gameState === STATE.READY && balance >= settings.spinCost && !document.body.classList.contains("modal-open");
}

function startSpin() {
  if (!canSpin()) {
    if (gameState === STATE.READY && balance < settings.spinCost) endGame();
    return;
  }

  gameState = STATE.SPINNING;
  spinBtn.disabled = true;
  clearWinners();
  setResult("");
  setWinLabel("");
  winValue.textContent = "+0";

  balance -= settings.spinCost;
  updateBalance(false);
  playSpinSound();

  currentGrid = generateGrid();
  const settleMs = buildAllReels(currentGrid);

  setTimeout(() => {
    const evaluation = evaluatePaylines(currentGrid, settings.spinCost);
    showSpinResult(evaluation);
    if (balance < settings.spinCost) {
      endGame({ preserveResult: evaluation.totalReward > 0 });
    } else {
      gameState = STATE.READY;
      spinBtn.disabled = false;
      setButtonMode("SPIN");
    }
  }, settleMs);
}

function endGame({ preserveResult = false } = {}) {
  gameState = STATE.GAMEOVER;
  spinBtn.disabled = false;
  setButtonMode("NEW");
  if (balance < settings.spinCost && !preserveResult) {
    setResult("RESET BALANCE TO PLAY", "gameover");
  }
  balanceChip.classList.toggle("warning", balance > 0);
  lowBalanceBar.classList.remove("visible");
  if (!preserveResult) playGameOverSound();
}

function startNewGame() {
  balance = settings.startBalance;
  updateBalance(true);
  saveBalance();
  clearWinners();
  setResult("");
  setWinLabel("");
  winValue.textContent = "+0";
  setButtonMode("SPIN");
  gameState = STATE.READY;
  spinBtn.disabled = false;
}

function handleSpinButton() {
  if (gameState === STATE.SPINNING) return;
  if (gameState === STATE.GAMEOVER) {
    startNewGame();
    return;
  }
  startSpin();
}

/* ─────────────────────────────────────────────
   SETTINGS
   ───────────────────────────────────────────── */
function openModal() {
  if (gameState === STATE.SPINNING) return;
  document.body.classList.add("modal-open");
  settingsModal.setAttribute("aria-hidden", "false");
  modalBackdrop.setAttribute("aria-hidden", "false");

  spinCostInput.value = String(settings.spinCost);
  startBalanceInput.value = String(settings.startBalance);
  soundToggle.checked = !!settings.sound;
  particlesToggle.checked = !!settings.particles;
  setTimeout(() => spinCostInput.focus(), 0);
}

function closeModal() {
  document.body.classList.remove("modal-open");
  settingsModal.setAttribute("aria-hidden", "true");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

function applySettingsFromUI() {
  const previousCost = settings.spinCost;
  settings.spinCost = clamp(parseInt(spinCostInput.value, 10) || DEFAULTS.spinCost, 1, 99999);
  settings.startBalance = clamp(parseInt(startBalanceInput.value, 10) || DEFAULTS.startBalance, 1, 9999999);
  settings.sound = !!soundToggle.checked;
  settings.particles = !!particlesToggle.checked;

  saveSettings();
  updateUIConfig();
  if (previousCost !== settings.spinCost) winValue.textContent = "+0";
  updateBalance(false);
  updateGameStateFromBalance();
}

function resetSettingsAndBalance() {
  settings = { ...DEFAULTS };
  saveSettings();
  startNewGame();
  openModal();
}

function resetBalanceOnly() {
  balance = settings.startBalance;
  updateBalance(true);
  setResult("");
  setWinLabel("");
  winValue.textContent = "+0";
  updateGameStateFromBalance();
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable;
}

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
function preloadImages() {
  return Promise.all(SYMBOLS.map((symbol) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = symbol.src;
  })));
}

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && document.body.classList.contains("modal-open")) {
    e.preventDefault();
    closeModal();
    return;
  }

  if (e.code === "Space" && !e.repeat && !isTypingTarget(e.target)) {
    e.preventDefault();
    if (!document.body.classList.contains("modal-open")) handleSpinButton();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setAppHeightVar();
  resizeCanvas();
  updateUIConfig();
  updateBalance(false);
  renderStaticGrid(currentGrid);
  winValue.textContent = "+0";
  setResult(balance < settings.spinCost ? "RESET BALANCE TO PLAY" : "READY", balance < settings.spinCost ? "gameover" : "");
  updateGameStateFromBalance();

  spinBtn.addEventListener("click", handleSpinButton);
  settingsBtn.addEventListener("click", openModal);
  closeSettingsBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", closeModal);
  saveBtn.addEventListener("click", () => {
    applySettingsFromUI();
    closeModal();
  });
  resetBtn.addEventListener("click", resetSettingsAndBalance);
  resetBalanceBtn.addEventListener("click", resetBalanceOnly);

  spinBtn.disabled = true;
  await preloadImages();
  updateGameStateFromBalance();

  initParticles();
  animateParticles();

  const resize = () => {
    setAppHeightVar();
    resizeCanvas();
    rerenderGridAfterResize();
  };

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 100));
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
    window.visualViewport.addEventListener("scroll", setAppHeightVar);
  }

  document.addEventListener("touchstart", () => {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }, { once: true });
});

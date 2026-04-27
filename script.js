"use strict";

/* ─────────────────────────────────────────────
   CONFIG + PAYLINES
   ───────────────────────────────────────────── */
const SYMBOLS = [
  "assets/seven7.jpg",
  "assets/orange.jpg",
  "assets/cherry.jpg",
  "assets/rrush.jpg",
  "assets/watermelon.jpg",
];

const TOTAL_SLOTS = 15;
const COLS = 5;

// 15 paylines (indices 1-based, matching slot IDs)
const WIN_ROWS = [
  [6,  7,  8,  9,  10], // row 2 (middle) — highest priority
  [1,  2,  3,  4,  5],  // row 1 (top)
  [11, 12, 13, 14, 15], // row 3 (bottom)
  [1,  7,  13, 9,  5],  // V diagonal down
  [11, 7,  3,  9,  15], // V diagonal up
  [6,  2,  3,  4,  10], // top-left dip
  [6,  12, 13, 14, 10], // bottom-right dip
  [1,  2,  8,  14, 15], // diagonal down-right
  [11, 12, 8,  4,  5],  // diagonal up-right
  [6,  12, 8,  4,  10], // W shape
  [6,  2,  8,  14, 10], // M shape
  [1,  7,  8,  9,  5],  // arrow right
  [11, 7,  8,  9,  15], // arrow left
  [1,  7,  3,  9,  5],  // zigzag top
  [11, 7,  13, 9,  15], // zigzag bottom
];

/* ─────────────────────────────────────────────
   PERSISTENT SETTINGS  (localStorage)
   ───────────────────────────────────────────── */
const STORAGE_KEY = "spinwin_settings_v2";
const DEFAULTS = {
  spinCost:     50,
  baseWin:      100,
  winChance:    22,
  startBalance: 1000,
  sound:        true,
  particles:    true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

function persistSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
}

/* ─────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────── */
const STATE = { READY: "READY", SPINNING: "SPINNING", GAMEOVER: "GAMEOVER" };
let gameState = STATE.READY;

let points = 0;
let currentSymbols = new Array(TOTAL_SLOTS).fill(-1);
let settings = loadSettings();

/* ─────────────────────────────────────────────
   DOM
   ───────────────────────────────────────────── */
const spinBtn       = document.getElementById("spinBtn");
const spinHint      = document.getElementById("spinHint");
const winValue      = document.getElementById("winValue");
const pointsEl      = document.getElementById("currentPoints");
const resultEl      = document.getElementById("result");
const winRowLabel   = document.getElementById("win-row-label");
const flashOverlay  = document.getElementById("flash-overlay");
const gridEl        = document.getElementById("slot-grid");
const yearEl        = document.getElementById("year");
const balanceChip   = document.getElementById("balanceChip");
const lowBalanceBar = document.getElementById("low-balance-bar");

const settingsBtn      = document.getElementById("settingsBtn");
const settingsModal    = document.getElementById("settingsModal");
const modalBackdrop    = document.getElementById("modalBackdrop");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

const spinCostInput    = document.getElementById("spinCostInput");
const winRewardInput   = document.getElementById("winRewardInput");
const winChanceInput   = document.getElementById("winChanceInput");
const startBalanceInput= document.getElementById("startBalanceInput");
const soundToggle      = document.getElementById("soundToggle");
const particlesToggle  = document.getElementById("particlesToggle");
const resetBtn         = document.getElementById("resetBtn");
const saveBtn          = document.getElementById("saveBtn");

/* ─────────────────────────────────────────────
   UTIL
   ───────────────────────────────────────────── */
function setAppHeightVar() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function randInt(maxExclusive) {
  maxExclusive = maxExclusive | 0;
  if (maxExclusive <= 1) return 0;
  if (window.crypto && crypto.getRandomValues) {
    const u32  = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    while (true) {
      crypto.getRandomValues(u32);
      if (u32[0] < limit) return u32[0] % maxExclusive;
    }
  }
  return Math.floor(Math.random() * maxExclusive);
}

function chance(pct) {
  return randInt(10000) < Math.floor(clamp(pct, 0, 100) * 100);
}

function slotEl(i) { return document.getElementById(`slot${i}`); }

function updateUIConfig() {
  spinHint.textContent = `−${settings.spinCost} pts · SPACE`;
  winValue.textContent  = `+${settings.baseWin}`;
}

function updatePoints(animate = false) {
  points = Math.max(0, points | 0);
  pointsEl.textContent = String(points);
  if (animate) {
    pointsEl.classList.add("bump");
    setTimeout(() => pointsEl.classList.remove("bump"), 250);
  }
  // Low-balance indicator
  const low = points < settings.spinCost * 3 && points > 0;
  const critical = points > 0 && points < settings.spinCost * 2;
  balanceChip.classList.toggle("warning", critical);
  lowBalanceBar.textContent = low
    ? critical
      ? `⚠ CRITICAL — only ${points} pts left`
      : `Low balance — ${points} pts remaining`
    : "";
  lowBalanceBar.classList.toggle("visible", low);
}

function setResult(text, type = "") {
  resultEl.textContent = text || "";
  resultEl.className   = "";
  if (text) {
    resultEl.classList.add("visible");
    if (type) resultEl.classList.add(type);
  }
}

function setWinLabel(text) {
  winRowLabel.textContent = text || "";
  winRowLabel.className   = text ? "visible" : "";
}

function clearWinners() {
  document.querySelectorAll(".slot.winner").forEach(s => s.classList.remove("winner"));
}

function setButtonMode(mode) {
  const t = spinBtn.querySelector(".btn-text");
  const h = spinBtn.querySelector(".btn-hint");
  if (mode === "SPIN") {
    t.textContent = "SPIN";
    h.textContent = `−${settings.spinCost} pts · SPACE`;
  } else {
    t.textContent = "NEW GAME";
    h.textContent = "Press SPACE to restart";
  }
}

/* ─────────────────────────────────────────────
   AUDIO
   ───────────────────────────────────────────── */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol = 0.3, startDelay = 0) {
  if (!settings.sound) return;
  try {
    const ctx  = getAudio();
    const osc  = ctx.createOscillator();
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
function playSpinSound()       { for (let i = 0; i < 5; i++) playTone(300 - i * 30, "sawtooth", 0.12, 0.08, i * 0.07); }
function playTickSound(col)    { playTone(400 + col * 40, "square", 0.06, 0.05, 0); }
function playWinSound()        { [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(f, "sine", 0.35, 0.22, i * 0.1)); }
function playLoseSound()       { playTone(220, "sawtooth", 0.3, 0.15, 0); playTone(180, "sawtooth", 0.3, 0.12, 0.15); }
function playGameOverSound()   { [400, 350, 300, 220].forEach((f, i) => playTone(f, "triangle", 0.4, 0.18, i * 0.12)); }

/* ─────────────────────────────────────────────
   PARTICLES  (HiDPI + capped + toggle)
   ───────────────────────────────────────────── */
const canvas   = document.getElementById("particles");
const ctx2d    = canvas.getContext("2d");
let particles  = [];

const AMBIENT_TARGET = 80;
const PARTICLE_CAP   = 240;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  canvas.style.width  = w + "px";
  canvas.style.height = h + "px";
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

class Particle {
  constructor(burst = false, x = 0, y = 0) {
    this.burst = burst;
    if (burst) {
      this.x = x; this.y = y;
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = (Math.random() - 0.5) * 8 - 3;
      this.size  = Math.random() * 6 + 3;
      this.life  = 1;
      this.decay = Math.random() * 0.025 + 0.015;
      this.color = Math.random() > 0.5 ? "#ffd700" : "#9b30ff";
      this.spin  = (Math.random() - 0.5) * 0.3;
    } else {
      this.reset(true);
    }
  }
  reset(init = false) {
    this.x     = Math.random() * window.innerWidth;
    this.y     = init ? Math.random() * window.innerHeight : window.innerHeight + 10;
    this.size  = Math.random() * 2 + 0.5;
    this.vy    = -(Math.random() * 0.5 + 0.2);
    this.vx    = (Math.random() - 0.5) * 0.3;
    this.life  = Math.random() * 0.5 + 0.3;
    this.decay = 0.0008 + Math.random() * 0.0005;
    this.color = Math.random() > 0.6 ? "rgba(255,215,0," : "rgba(155,48,255,";
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (this.burst) {
      this.vy  += 0.15;
      this.vx  += this.spin;
    } else {
      if (this.y < -10) this.reset(false);
      if (this.x < -10 || this.x > window.innerWidth + 10) this.x = Math.random() * window.innerWidth;
    }
  }
  draw() {
    ctx2d.save();
    ctx2d.globalAlpha = Math.max(0, this.life);
    ctx2d.fillStyle   = this.burst ? this.color : this.color + this.life + ")";
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

function burstParticles(cx, cy, count = 60) {
  if (!settings.particles) return;
  for (let i = 0; i < count; i++) particles.push(new Particle(true, cx, cy));
  if (particles.length > PARTICLE_CAP) particles = particles.slice(particles.length - PARTICLE_CAP);
}

// Reuse array slots to avoid per-frame allocation
function animateParticles() {
  ctx2d.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (settings.particles) {
    if (particles.length < AMBIENT_TARGET && Math.random() < 0.6) particles.push(new Particle(false));
    let aliveCount = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.update();
      if (p.life > 0) {
        p.draw();
        particles[aliveCount++] = p;
      }
    }
    particles.length = aliveCount; // compact in-place, no new array
  } else if (particles.length > 0) {
    particles.length = 0;
  }
  requestAnimationFrame(animateParticles);
}

/* Flash overlay */
function flashScreen() {
  flashOverlay.classList.add("active");
  setTimeout(() => flashOverlay.classList.remove("active"), 80);
  setTimeout(() => {
    flashOverlay.classList.add("active");
    setTimeout(() => flashOverlay.classList.remove("active"), 80);
  }, 160);
}

/* ─────────────────────────────────────────────
   PRO REEL SPIN RENDER
   FIX: batch all clientHeight reads BEFORE writing any strips
   ───────────────────────────────────────────── */
function buildAllReels(finalSymbols) {
  // 1. READ phase — measure all slot heights before any DOM writes
  const heights = [];
  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const el = slotEl(i);
    el.innerHTML = "";
    el.classList.remove("winner");
    heights.push(el.clientHeight || 100);
  }

  // 2. WRITE phase — build all strips
  const longestByCol = new Array(COLS).fill(0);

  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const el  = slotEl(i);
    const col = (i - 1) % COLS;
    const h   = heights[i - 1];

    const rounds     = 10 + col * 3 + randInt(4);
    const totalItems = rounds + 1;
    const duration   = clamp(520 + rounds * 22, 700, 1400);

    const reel  = document.createElement("div");
    reel.className = "reel";
    const strip = document.createElement("div");
    strip.className = "reel-strip";

    for (let k = 0; k < totalItems; k++) {
      const symId = (k === totalItems - 1) ? finalSymbols[i - 1] : randInt(SYMBOLS.length);
      const item  = document.createElement("div");
      item.className  = "reel-item";
      item.style.height = h + "px";
      const img = document.createElement("img");
      img.src     = SYMBOLS[symId];
      img.alt     = SYMBOLS[symId].split("/").pop().replace(/\.\w+$/, "");
      img.decoding = "async";
      img.loading  = "eager";
      item.appendChild(img);
      strip.appendChild(item);
    }

    reel.appendChild(strip);
    el.appendChild(reel);

    // Track longest duration per column for stagger settle calculation
    const delay = col * 90;
    if (duration + delay > longestByCol[col]) longestByCol[col] = duration + delay;

    // Stagger animation start per column
    const colDelay = delay;
    setTimeout(() => {
      playTickSound(col);
      const endY = -h * (totalItems - 1);
      strip.style.transition  = "none";
      strip.style.transform   = "translateY(0px)";
      void strip.offsetHeight; // force reflow
      strip.style.transition  = `transform ${duration}ms cubic-bezier(.12,.85,.12,1)`;
      strip.style.transform   = `translateY(${endY}px)`;
    }, colDelay);
  }

  // Return the actual maximum settle time (correctly computed BEFORE timeouts fire)
  return Math.max(900, Math.max(...longestByCol) + 80);
}

/* ─────────────────────────────────────────────
   OUTCOME GENERATION
   ───────────────────────────────────────────── */
function generateOutcome() {
  const out = new Array(TOTAL_SLOTS).fill(0).map(() => randInt(SYMBOLS.length));
  if (!chance(settings.winChance)) return out;

  const linesToForce = chance(Math.min(18, settings.winChance * 0.6)) ? 2 : 1;
  const used = new Set();

  for (let n = 0; n < linesToForce; n++) {
    let li = randInt(WIN_ROWS.length), guard = 0;
    while (used.has(li) && guard++ < 50) li = randInt(WIN_ROWS.length);
    used.add(li);
    const symId = randInt(SYMBOLS.length);
    for (const idx of WIN_ROWS[li]) out[idx - 1] = symId;
  }
  return out;
}

/* ─────────────────────────────────────────────
   WIN CHECK + PAY
   ───────────────────────────────────────────── */
function checkWinAndPay() {
  const winningSlots    = new Set();
  const winningRowNames = [];

  for (let ri = 0; ri < WIN_ROWS.length; ri++) {
    const row   = WIN_ROWS[ri];
    const first = currentSymbols[row[0] - 1];
    if (row.every(idx => currentSymbols[idx - 1] === first)) {
      row.forEach(idx => winningSlots.add(idx));
      winningRowNames.push(`ROW ${ri + 1}`);
    }
  }

  const linesWon = winningRowNames.length;

  if (linesWon > 0) {
    winningSlots.forEach(idx => slotEl(idx).classList.add("winner"));
    const reward = settings.baseWin * linesWon;
    points += reward;
    updatePoints(true);

    // Update the win chip to show actual reward earned
    winValue.textContent = `+${reward}`;

    setResult(`YOU WIN! +${reward} PTS`, "win");
    setWinLabel("✦ " + winningRowNames.join(" · ") + " ✦");

    const r = gridEl.getBoundingClientRect();
    burstParticles(r.left + r.width / 2, r.top + r.height / 2, 60);
    flashScreen();
    playWinSound();
  } else {
    // Reset win chip to base value
    winValue.textContent = `+${settings.baseWin}`;
    setResult("BETTER LUCK NEXT TIME", "lose");
    setWinLabel("");
    playLoseSound();
  }
}

/* ─────────────────────────────────────────────
   GAME FLOW
   FIX: check balance BEFORE deducting; fix settle timer
   ───────────────────────────────────────────── */
function canSpin() {
  return gameState === STATE.READY && points >= settings.spinCost;
}

function startSpin() {
  // FIX: guard with canSpin() — prevents double-fire
  if (!canSpin()) {
    if (gameState === STATE.READY && points < settings.spinCost) endGame();
    return;
  }

  gameState = STATE.SPINNING;
  spinBtn.disabled = true;
  clearWinners();
  setResult("");
  setWinLabel("");

  // FIX: deduct AFTER confirming player can afford it
  points -= settings.spinCost;
  updatePoints(false);

  playSpinSound();

  currentSymbols = generateOutcome();

  // FIX: settle time is computed synchronously from real durations, not from a stale variable
  const settleMs = buildAllReels(currentSymbols);

  setTimeout(() => {
    checkWinAndPay();
    // FIX: check balance AFTER deduction, never allowing negative
    if (points < settings.spinCost) {
      if (points <= 0) {
        endGame();
      } else {
        // Has some points but not enough to spin — game over
        endGame();
      }
    } else {
      gameState = STATE.READY;
      spinBtn.disabled = false;
    }
  }, settleMs);
}

function endGame() {
  gameState = STATE.GAMEOVER;
  spinBtn.disabled = false;
  setResult("GAME OVER — OUT OF POINTS", "gameover");
  setWinLabel("");
  setButtonMode("NEW");
  lowBalanceBar.classList.remove("visible");
  balanceChip.classList.remove("warning");
  playGameOverSound();
}

function startNewGame() {
  points = settings.startBalance;
  updatePoints(false);
  setResult("");
  setWinLabel("");
  clearWinners();
  winValue.textContent = `+${settings.baseWin}`;

  currentSymbols = new Array(TOTAL_SLOTS).fill(-1);
  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const el = slotEl(i);
    el.innerHTML = "";
    el.classList.remove("winner");
  }

  setButtonMode("SPIN");
  gameState = STATE.READY;
  spinBtn.disabled = false;
}

function handleSpinButton() {
  if (gameState === STATE.SPINNING) return;
  if (gameState === STATE.GAMEOVER) return startNewGame();
  startSpin();
}

/* ─────────────────────────────────────────────
   SETTINGS MODAL
   FIX: reset writes defaults THEN re-syncs; startBalance added
   ───────────────────────────────────────────── */
function openModal() {
  document.body.classList.add("modal-open");
  settingsModal.setAttribute("aria-hidden", "false");
  modalBackdrop.setAttribute("aria-hidden", "false");

  spinCostInput.value      = String(settings.spinCost);
  winRewardInput.value     = String(settings.baseWin);
  winChanceInput.value     = String(settings.winChance);
  startBalanceInput.value  = String(settings.startBalance);
  soundToggle.checked      = !!settings.sound;
  particlesToggle.checked  = !!settings.particles;

  setTimeout(() => spinCostInput.focus(), 0);
}

function closeModal() {
  document.body.classList.remove("modal-open");
  settingsModal.setAttribute("aria-hidden", "true");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

function applySettingsFromUI() {
  settings.spinCost     = clamp(parseInt(spinCostInput.value,     10) || DEFAULTS.spinCost,     1, 99999);
  settings.baseWin      = clamp(parseInt(winRewardInput.value,    10) || DEFAULTS.baseWin,      1, 999999);
  settings.winChance    = clamp(parseInt(winChanceInput.value,    10) || DEFAULTS.winChance,    0, 100);
  settings.startBalance = clamp(parseInt(startBalanceInput.value, 10) || DEFAULTS.startBalance, 1, 9999999);
  settings.sound        = !!soundToggle.checked;
  settings.particles    = !!particlesToggle.checked;

  persistSettings();
  updateUIConfig();
  winValue.textContent = `+${settings.baseWin}`;

  if (gameState === STATE.READY) {
    spinBtn.disabled = points < settings.spinCost;
  }
}

function resetSettings() {
  // FIX: write defaults first, THEN re-sync the UI inputs
  settings = { ...DEFAULTS };
  persistSettings();
}

/* ─────────────────────────────────────────────
   KEYBOARD
   ───────────────────────────────────────────── */
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && document.body.classList.contains("modal-open")) {
    e.preventDefault();
    closeModal();
    return;
  }
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    if (!spinBtn.disabled && gameState !== STATE.SPINNING) spinBtn.click();
  }
});

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
function preloadImages(paths) {
  return Promise.all(paths.map(src => new Promise(resolve => {
    const img  = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src    = src;
  })));
}

document.addEventListener("DOMContentLoaded", async () => {
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setAppHeightVar();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setAppHeightVar);
    window.visualViewport.addEventListener("scroll", setAppHeightVar);
  }
  window.addEventListener("resize", setAppHeightVar);
  window.addEventListener("orientationchange", () => {
    // Small delay to let the browser settle after rotation
    setTimeout(setAppHeightVar, 100);
  });

  // Apply loaded settings to UI
  updateUIConfig();
  setButtonMode("SPIN");
  points = settings.startBalance;
  updatePoints(false);

  // Wire up buttons
  spinBtn.addEventListener("click", handleSpinButton);
  settingsBtn.addEventListener("click", openModal);
  closeSettingsBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", closeModal);

  resetBtn.addEventListener("click", () => {
    resetSettings();  // FIX: writes defaults first
    openModal();      // then re-syncs inputs
  });

  saveBtn.addEventListener("click", () => {
    applySettingsFromUI();
    closeModal();
  });

  // Preload images — disable spin until ready
  spinBtn.disabled = true;
  await preloadImages(SYMBOLS);
  spinBtn.disabled = false;

  // Particles
  resizeCanvas();
  initParticles();
  animateParticles();

  window.addEventListener("resize", resizeCanvas);

  // Resume AudioContext on first touch (mobile Safari requirement)
  document.addEventListener("touchstart", () => {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }, { once: true });
});
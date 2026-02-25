/* =============================================
   SPINWIN SLOTS — Bulletproof JS (Static)
   - /assets paths
   - Stable symbol IDs (no img.src equality)
   - Single click handler (no onclick swapping bugs)
   - HiDPI canvas + mobile 100vh fix
   - Particles capped (no long-session lag)
   ============================================= */

"use strict";

/* ── Config ── */
const SYMBOLS = [
  "assets/seven7.jpg",
  "assets/orange.jpg",
  "assets/cherry.jpg",
  "assets/rrush.jpg",
  "assets/watermelon.jpg",
];

const SPIN_COST = 50;
const WIN_REWARD = 100;
const TOTAL_SLOTS = 15;
const COLS = 5;

/* Win lines (1..15) */
const WIN_ROWS = [
  [6, 7, 8, 9, 10], [1, 2, 3, 4, 5], [11, 12, 13, 14, 15],
  [1, 7, 13, 9, 5], [11, 7, 3, 9, 15],
  [6, 2, 3, 4, 10], [6, 12, 13, 14, 10],
  [1, 2, 8, 14, 15], [11, 12, 8, 4, 5],
  [6, 12, 8, 4, 10], [6, 2, 8, 14, 10],
  [1, 7, 8, 9, 5], [11, 7, 8, 9, 15],
  [1, 7, 3, 9, 5], [11, 7, 13, 9, 15],
  [6, 7, 3, 9, 10], [6, 7, 13, 9, 10],
  [1, 2, 13, 4, 5], [11, 12, 3, 14, 15],
  [1, 12, 13, 14, 5], [11, 2, 3, 4, 15],
  [6, 12, 3, 14, 10], [6, 2, 13, 4, 10],
  [1, 12, 3, 14, 5], [11, 2, 13, 4, 15],
];

/* ── State ── */
const STATE = { READY: "READY", SPINNING: "SPINNING", GAMEOVER: "GAMEOVER" };
let gameState = STATE.READY;

let points = 1000;
let currentSymbols = new Array(TOTAL_SLOTS).fill(-1);

/* ── DOM ── */
const spinBtn = document.getElementById("spinBtn");
const pointsEl = document.getElementById("currentPoints");
const resultEl = document.getElementById("result");
const winRowLabel = document.getElementById("win-row-label");
const flashOverlay = document.getElementById("flash-overlay");
const gridEl = document.getElementById("slot-grid");
const yearEl = document.getElementById("year");

/* ── Viewport fix (mobile address bar) ── */
function setAppHeightVar() {
  const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}

/* ── Random (crypto when available) ── */
function randInt(maxExclusive) {
  maxExclusive = maxExclusive | 0;
  if (maxExclusive <= 1) return 0;

  if (window.crypto && crypto.getRandomValues) {
    const u32 = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    while (true) {
      crypto.getRandomValues(u32);
      const x = u32[0];
      if (x < limit) return x % maxExclusive;
    }
  }
  return Math.floor(Math.random() * maxExclusive);
}

function pickSymbolId() {
  return randInt(SYMBOLS.length);
}

function slotEl(i) {
  return document.getElementById(`slot${i}`);
}

function updatePoints(animate = false) {
  pointsEl.textContent = String(points);
  if (animate) {
    pointsEl.classList.add("bump");
    setTimeout(() => pointsEl.classList.remove("bump"), 250);
  }
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
  document.querySelectorAll(".slot.winner").forEach((s) => s.classList.remove("winner"));
}

function setButtonMode(mode) {
  const textEl = spinBtn.querySelector(".btn-text");
  const hintEl = spinBtn.querySelector(".btn-hint");
  if (mode === "SPIN") {
    textEl.textContent = "SPIN";
    hintEl.textContent = "−50 pts · SPACE";
  } else {
    textEl.textContent = "NEW GAME";
    hintEl.textContent = "Press SPACE to restart";
  }
}

/* ── Image preloader (first spin no blank flashes) ── */
function preloadImages(paths) {
  return Promise.all(paths.map((src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  })));
}

function renderSlot(i, symbolId) {
  const el = slotEl(i);
  const img = document.createElement("img");
  img.src = SYMBOLS[symbolId];
  img.alt = SYMBOLS[symbolId].split("/").pop().replace(/\.\w+$/, "");
  img.decoding = "async";
  img.loading = "eager";
  el.innerHTML = "";
  el.appendChild(img);
}

/* ─────────────────────────────────────────────
   AUDIO (unchanged)
   ───────────────────────────────────────────── */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol = 0.3, startDelay = 0) {
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
function playSpinSound() { for (let i = 0; i < 5; i++) playTone(300 - i * 30, "sawtooth", 0.12, 0.08, i * 0.07); }
function playTickSound(col) { playTone(400 + col * 40, "square", 0.06, 0.05, 0); }
function playWinSound() { [523,659,784,1047,1319].forEach((f,i)=>playTone(f,"sine",0.35,0.22,i*0.1)); }
function playLoseSound() { playTone(220,"sawtooth",0.3,0.15,0); playTone(180,"sawtooth",0.3,0.12,0.15); }
function playGameOverSound() { [400,350,300,220].forEach((f,i)=>playTone(f,"triangle",0.4,0.18,i*0.12)); }

/* ─────────────────────────────────────────────
   PARTICLES (HiDPI + capped)
   ───────────────────────────────────────────── */
const canvas = document.getElementById("particles");
const ctx2d = canvas.getContext("2d");
let particles = [];

const AMBIENT_TARGET = 80;
const PARTICLE_CAP = 240;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

class Particle {
  constructor(burst = false, x, y) {
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
      this.spin = (Math.random() - 0.5) * 0.3;
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
      this.vx += this.spin;
    } else {
      if (this.y < -10) this.reset(false);
      if (this.x < -10 || this.x > window.innerWidth + 10) this.x = Math.random() * window.innerWidth;
    }
  }
  draw() {
    ctx2d.save();
    ctx2d.globalAlpha = Math.max(0, this.life);
    ctx2d.fillStyle = this.burst ? this.color : this.color + this.life + ")";
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
  for (let i = 0; i < count; i++) particles.push(new Particle(true, cx, cy));
  if (particles.length > PARTICLE_CAP) particles = particles.slice(particles.length - PARTICLE_CAP);
}

function animateParticles() {
  ctx2d.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (particles.length < AMBIENT_TARGET && Math.random() < 0.6) {
    particles.push(new Particle(false));
  }

  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.update();
    p.draw();
  }
  requestAnimationFrame(animateParticles);
}

/* ── Flash overlay ── */
function flashScreen() {
  flashOverlay.classList.add("active");
  setTimeout(() => flashOverlay.classList.remove("active"), 80);
  setTimeout(() => {
    flashOverlay.classList.add("active");
    setTimeout(() => flashOverlay.classList.remove("active"), 80);
  }, 160);
}

/* ─────────────────────────────────────────────
   GAME
   ───────────────────────────────────────────── */
function canSpin() {
  return gameState === STATE.READY && points >= SPIN_COST;
}

function startSpin() {
  if (!canSpin()) {
    if (points < SPIN_COST) endGame();
    return;
  }

  gameState = STATE.SPINNING;
  spinBtn.disabled = true;

  points -= SPIN_COST;
  updatePoints(false);

  setResult("");
  setWinLabel("");
  clearWinners();
  playSpinSound();

  // Pre-pick results (deterministic)
  for (let i = 0; i < TOTAL_SLOTS; i++) currentSymbols[i] = pickSymbolId();

  // Animate per column
  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const col = (i - 1) % COLS;
    const delay = col * 60;
    const symbolId = currentSymbols[i - 1];

    setTimeout(() => {
      const el = slotEl(i);
      el.classList.add("spinning");
      playTickSound(col);

      renderSlot(i, symbolId);

      el.addEventListener("animationend", () => el.classList.remove("spinning"), { once: true });
    }, delay);
  }

  const settleMs = (COLS - 1) * 60 + 520;

  setTimeout(() => {
    checkWin();
    if (points <= 0) {
      endGame();
    } else {
      gameState = STATE.READY;
      spinBtn.disabled = false;
    }
  }, settleMs);
}

function checkWin() {
  const winningSlots = new Set();
  const winningRowNames = [];

  for (let ri = 0; ri < WIN_ROWS.length; ri++) {
    const row = WIN_ROWS[ri];
    const firstId = currentSymbols[row[0] - 1];
    if (firstId < 0) continue;

    let allSame = true;
    for (let k = 1; k < row.length; k++) {
      if (currentSymbols[row[k] - 1] !== firstId) { allSame = false; break; }
    }

    if (allSame) {
      row.forEach((idx) => winningSlots.add(idx));
      winningRowNames.push(`ROW ${ri + 1}`);
    }
  }

  if (winningSlots.size > 0) {
    winningSlots.forEach((idx) => slotEl(idx).classList.add("winner"));

    points += WIN_REWARD;
    updatePoints(true);

    setResult(`YOU WIN! +${WIN_REWARD} PTS`, "win");
    setWinLabel("✦ " + winningRowNames.join(" · ") + " ✦");

    const r = gridEl.getBoundingClientRect();
    burstParticles(r.left + r.width / 2, r.top + r.height / 2, 60);

    flashScreen();
    playWinSound();
  } else {
    setResult("BETTER LUCK NEXT TIME", "lose");
    playLoseSound();
  }
}

function endGame() {
  gameState = STATE.GAMEOVER;
  spinBtn.disabled = false;

  setResult("GAME OVER — OUT OF POINTS", "gameover");
  setWinLabel("");
  clearWinners();

  setButtonMode("NEW");
  playGameOverSound();
}

function startNewGame() {
  points = 1000;
  updatePoints(false);

  setResult("");
  setWinLabel("");
  clearWinners();

  currentSymbols.fill(-1);

  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const el = slotEl(i);
    el.innerHTML = "";
    el.classList.remove("winner", "spinning");
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

/* Keyboard */
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    if (!spinBtn.disabled) spinBtn.click();
  }
});

/* Init */
document.addEventListener("DOMContentLoaded", async () => {
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setAppHeightVar();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setAppHeightVar);
    window.visualViewport.addEventListener("scroll", setAppHeightVar);
  }
  window.addEventListener("resize", setAppHeightVar);
  window.addEventListener("orientationchange", setAppHeightVar);

  spinBtn.addEventListener("click", handleSpinButton);
  setButtonMode("SPIN");
  updatePoints(false);

  // Preload images then enable (prevents blank first spin on slow phones)
  spinBtn.disabled = true;
  await preloadImages(SYMBOLS);
  spinBtn.disabled = false;

  resizeCanvas();
  initParticles();
  animateParticles();

  window.addEventListener("resize", () => {
    resizeCanvas();
  });
});
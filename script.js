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
const ROWS = 3;

// PAYLINES (1..15)
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

/* ─────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────── */
const STATE = { READY:"READY", SPINNING:"SPINNING", GAMEOVER:"GAMEOVER" };
let gameState = STATE.READY;

let points = 1000;
let currentSymbols = new Array(TOTAL_SLOTS).fill(-1);

let settings = {
  spinCost: 50,
  baseWin: 100,
  winChance: 22, // %
  sound: true,
  particles: true,
};

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

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");

const spinCostInput = document.getElementById("spinCostInput");
const winRewardInput = document.getElementById("winRewardInput");
const winChanceInput = document.getElementById("winChanceInput");
const soundToggle = document.getElementById("soundToggle");
const particlesToggle = document.getElementById("particlesToggle");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");

/* ─────────────────────────────────────────────
   UTIL
   ───────────────────────────────────────────── */
function setAppHeightVar(){
  const h = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function randInt(maxExclusive){
  maxExclusive = maxExclusive | 0;
  if (maxExclusive <= 1) return 0;

  if (window.crypto && crypto.getRandomValues){
    const u32 = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    while (true){
      crypto.getRandomValues(u32);
      const x = u32[0];
      if (x < limit) return x % maxExclusive;
    }
  }
  return Math.floor(Math.random() * maxExclusive);
}

function chance(pct){
  return randInt(10000) < Math.floor(clamp(pct, 0, 100) * 100);
}

function slotEl(i){ return document.getElementById(`slot${i}`); }

function updateUIConfig(){
  spinHint.textContent = `−${settings.spinCost} pts · SPACE`;
  winValue.textContent = `+${settings.baseWin}`;
}

function updatePoints(animate=false){
  points = Math.max(0, points|0);
  pointsEl.textContent = String(points);
  if (animate){
    pointsEl.classList.add("bump");
    setTimeout(() => pointsEl.classList.remove("bump"), 250);
  }
}

function setResult(text, type=""){
  resultEl.textContent = text || "";
  resultEl.className = "";
  if (text){
    resultEl.classList.add("visible");
    if (type) resultEl.classList.add(type);
  }
}

function setWinLabel(text){
  winRowLabel.textContent = text || "";
  winRowLabel.className = text ? "visible" : "";
}

function clearWinners(){
  document.querySelectorAll(".slot.winner").forEach(s => s.classList.remove("winner"));
}

function setButtonMode(mode){
  const t = spinBtn.querySelector(".btn-text");
  const h = spinBtn.querySelector(".btn-hint");
  if (mode === "SPIN"){
    t.textContent = "SPIN";
    h.textContent = `−${settings.spinCost} pts · SPACE`;
  } else {
    t.textContent = "NEW GAME";
    h.textContent = "Press SPACE to restart";
  }
}

/* ─────────────────────────────────────────────
   AUDIO (gated by settings.sound)
   ───────────────────────────────────────────── */
let audioCtx = null;
function getAudio(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, vol=0.3, startDelay=0){
  if (!settings.sound) return;
  try{
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
function playSpinSound(){ for (let i=0;i<5;i++) playTone(300 - i*30, "sawtooth", 0.12, 0.08, i*0.07); }
function playTickSound(col){ playTone(400 + col*40, "square", 0.06, 0.05, 0); }
function playWinSound(){ [523,659,784,1047,1319].forEach((f,i)=>playTone(f,"sine",0.35,0.22,i*0.1)); }
function playLoseSound(){ playTone(220,"sawtooth",0.3,0.15,0); playTone(180,"sawtooth",0.3,0.12,0.15); }
function playGameOverSound(){ [400,350,300,220].forEach((f,i)=>playTone(f,"triangle",0.4,0.18,i*0.12)); }

/* ─────────────────────────────────────────────
   PARTICLES (HiDPI + capped + toggle)
   ───────────────────────────────────────────── */
const canvas = document.getElementById("particles");
const ctx2d = canvas.getContext("2d");
let particles = [];

const AMBIENT_TARGET = 80;
const PARTICLE_CAP = 240;

function resizeCanvas(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

class Particle{
  constructor(burst=false, x=0, y=0){
    this.burst = burst;
    if (burst){
      this.x=x; this.y=y;
      this.vx=(Math.random()-0.5)*8;
      this.vy=(Math.random()-0.5)*8 - 3;
      this.size=Math.random()*6 + 3;
      this.life=1;
      this.decay=Math.random()*0.025 + 0.015;
      this.color=Math.random()>0.5 ? "#ffd700" : "#9b30ff";
      this.spin=(Math.random()-0.5)*0.3;
    } else this.reset(true);
  }
  reset(init=false){
    this.x=Math.random()*window.innerWidth;
    this.y=init ? Math.random()*window.innerHeight : window.innerHeight + 10;
    this.size=Math.random()*2 + 0.5;
    this.vy=-(Math.random()*0.5 + 0.2);
    this.vx=(Math.random()-0.5)*0.3;
    this.life=Math.random()*0.5 + 0.3;
    this.decay=0.0008 + Math.random()*0.0005;
    this.color=Math.random()>0.6 ? "rgba(255,215,0," : "rgba(155,48,255,";
  }
  update(){
    this.x+=this.vx; this.y+=this.vy; this.life-=this.decay;
    if (this.burst){
      this.vy+=0.15; this.vx+=this.spin;
    } else {
      if (this.y < -10) this.reset(false);
      if (this.x < -10 || this.x > window.innerWidth+10) this.x = Math.random()*window.innerWidth;
    }
  }
  draw(){
    ctx2d.save();
    ctx2d.globalAlpha=Math.max(0,this.life);
    ctx2d.fillStyle=this.burst ? this.color : this.color + this.life + ")";
    ctx2d.beginPath();
    ctx2d.arc(this.x,this.y,this.size,0,Math.PI*2);
    ctx2d.fill();
    ctx2d.restore();
  }
}

function initParticles(){
  particles=[];
  for (let i=0;i<AMBIENT_TARGET;i++) particles.push(new Particle(false));
}

function burstParticles(cx, cy, count=60){
  if (!settings.particles) return;
  for (let i=0;i<count;i++) particles.push(new Particle(true,cx,cy));
  if (particles.length > PARTICLE_CAP) particles = particles.slice(particles.length - PARTICLE_CAP);
}

function animateParticles(){
  ctx2d.clearRect(0,0,window.innerWidth,window.innerHeight);

  if (settings.particles){
    if (particles.length < AMBIENT_TARGET && Math.random() < 0.6) particles.push(new Particle(false));
    particles = particles.filter(p => p.life > 0);
    for (const p of particles){ p.update(); p.draw(); }
  } else {
    particles = [];
  }

  requestAnimationFrame(animateParticles);
}

/* Flash overlay */
function flashScreen(){
  flashOverlay.classList.add("active");
  setTimeout(()=>flashOverlay.classList.remove("active"), 80);
  setTimeout(()=>{
    flashOverlay.classList.add("active");
    setTimeout(()=>flashOverlay.classList.remove("active"), 80);
  }, 160);
}

/* ─────────────────────────────────────────────
   PRO REEL SPIN RENDER
   Each slot builds a strip of images and scrolls it.
   ───────────────────────────────────────────── */
function buildReel(slotIndex1based, finalSymbolId, rounds){
  const el = slotEl(slotIndex1based);
  el.innerHTML = "";
  el.classList.remove("winner");

  const reel = document.createElement("div");
  reel.className = "reel";

  const strip = document.createElement("div");
  strip.className = "reel-strip";

  // Build items: randoms + final at end
  const totalItems = rounds + 1;
  for (let i=0;i<totalItems;i++){
    const symId = (i === totalItems - 1) ? finalSymbolId : randInt(SYMBOLS.length);
    const item = document.createElement("div");
    item.className = "reel-item";

    const img = document.createElement("img");
    img.src = SYMBOLS[symId];
    img.alt = SYMBOLS[symId].split("/").pop().replace(/\.\w+$/, "");
    img.decoding = "async";
    img.loading = "eager";

    item.appendChild(img);
    strip.appendChild(item);
  }

  reel.appendChild(strip);
  el.appendChild(reel);

  // Size each item to the slot height (after it's in DOM)
  const h = el.clientHeight || 100;
  Array.from(strip.children).forEach(ch => { ch.style.height = h + "px"; });

  // Animate: start at 0 then transition to -(h*(totalItems-1))
  const endY = -h * (totalItems - 1);

  strip.style.transition = "none";
  strip.style.transform = "translateY(0px)";
  // Force reflow
  void strip.offsetHeight;

  // Use a smooth easing (feels premium)
  const duration = clamp(520 + rounds * 22, 700, 1400);
  strip.style.transition = `transform ${duration}ms cubic-bezier(.12,.85,.12,1)`;
  strip.style.transform = `translateY(${endY}px)`;

  return { el, strip, duration };
}

/* ─────────────────────────────────────────────
   OUTCOME GENERATION (PRO)
   - Instead of random per cell, we decide: win or lose.
   - If win, force 1–2 paylines occasionally (still feels fair).
   ───────────────────────────────────────────── */
function generateOutcome(){
  // Start random
  const out = new Array(TOTAL_SLOTS).fill(0).map(() => randInt(SYMBOLS.length));

  const doWin = chance(settings.winChance);
  if (!doWin) return out;

  // force 1 line, sometimes 2
  const linesToForce = chance(Math.min(18, settings.winChance * 0.6)) ? 2 : 1;

  const used = new Set();
  for (let n=0;n<linesToForce;n++){
    let li = randInt(WIN_ROWS.length);
    let guard = 0;
    while (used.has(li) && guard++ < 50) li = randInt(WIN_ROWS.length);
    used.add(li);

    const line = WIN_ROWS[li];
    const symId = randInt(SYMBOLS.length);

    for (const idx of line){
      out[idx - 1] = symId;
    }
  }

  return out;
}

/* ─────────────────────────────────────────────
   WIN CHECK
   ───────────────────────────────────────────── */
function checkWinAndPay(){
  const winningSlots = new Set();
  const winningRowNames = [];

  for (let ri=0;ri<WIN_ROWS.length;ri++){
    const row = WIN_ROWS[ri];
    const first = currentSymbols[row[0]-1];
    let allSame = true;

    for (let k=1;k<row.length;k++){
      if (currentSymbols[row[k]-1] !== first){ allSame = false; break; }
    }

    if (allSame){
      row.forEach(idx => winningSlots.add(idx));
      winningRowNames.push(`ROW ${ri+1}`);
    }
  }

  const linesWon = winningRowNames.length;

  if (linesWon > 0){
    winningSlots.forEach(idx => slotEl(idx).classList.add("winner"));

    const reward = settings.baseWin * linesWon;
    points += reward;
    updatePoints(true);

    setResult(`YOU WIN! +${reward} PTS`, "win");
    setWinLabel("✦ " + winningRowNames.join(" · ") + " ✦");

    const r = gridEl.getBoundingClientRect();
    burstParticles(r.left + r.width/2, r.top + r.height/2, 60);
    flashScreen();
    playWinSound();
  } else {
    setResult("BETTER LUCK NEXT TIME", "lose");
    setWinLabel("");
    playLoseSound();
  }
}

/* ─────────────────────────────────────────────
   GAME FLOW
   ───────────────────────────────────────────── */
function canSpin(){
  return gameState === STATE.READY && points >= settings.spinCost;
}

function startSpin(){
  if (!canSpin()){
    if (points < settings.spinCost) endGame();
    return;
  }

  gameState = STATE.SPINNING;
  spinBtn.disabled = true;
  clearWinners();
  setResult("");
  setWinLabel("");

  points -= settings.spinCost;
  updatePoints(false);

  playSpinSound();

  // Decide outcome (PRO)
  currentSymbols = generateOutcome();

  // Reel animation (stagger per column)
  let longest = 0;

  for (let i=1;i<=TOTAL_SLOTS;i++){
    const col = (i - 1) % COLS;

    // More rounds on later columns for a real “reel settle” vibe
    const rounds = 10 + col * 3 + randInt(4);
    const delay = col * 90;

    setTimeout(() => {
      playTickSound(col);
      const { duration } = buildReel(i, currentSymbols[i-1], rounds);
      if (duration + delay > longest) longest = duration + delay;
    }, delay);
  }

  // settle after the longest reel
  const settleMs = Math.max(900, longest + 30);

  setTimeout(() => {
    checkWinAndPay();

    if (points <= 0){
      endGame();
    } else {
      gameState = STATE.READY;
      spinBtn.disabled = false;
    }
  }, settleMs);
}

function endGame(){
  gameState = STATE.GAMEOVER;
  spinBtn.disabled = false;
  setResult("GAME OVER — OUT OF POINTS", "gameover");
  setWinLabel("");
  setButtonMode("NEW");
  playGameOverSound();
}

function startNewGame(){
  points = 1000;
  updatePoints(false);
  setResult("");
  setWinLabel("");
  clearWinners();

  currentSymbols = new Array(TOTAL_SLOTS).fill(-1);
  for (let i=1;i<=TOTAL_SLOTS;i++){
    const el = slotEl(i);
    el.innerHTML = "";
    el.classList.remove("winner");
  }

  setButtonMode("SPIN");
  gameState = STATE.READY;
  spinBtn.disabled = false;
}

function handleSpinButton(){
  if (gameState === STATE.SPINNING) return;
  if (gameState === STATE.GAMEOVER) return startNewGame();
  startSpin();
}

/* ─────────────────────────────────────────────
   SETTINGS MODAL
   ───────────────────────────────────────────── */
function openModal(){
  document.body.classList.add("modal-open");
  settingsModal.setAttribute("aria-hidden", "false");
  modalBackdrop.setAttribute("aria-hidden", "false");

  // Sync UI with settings
  spinCostInput.value = String(settings.spinCost);
  winRewardInput.value = String(settings.baseWin);
  winChanceInput.value = String(settings.winChance);
  soundToggle.checked = !!settings.sound;
  particlesToggle.checked = !!settings.particles;

  // focus
  setTimeout(() => spinCostInput.focus(), 0);
}

function closeModal(){
  document.body.classList.remove("modal-open");
  settingsModal.setAttribute("aria-hidden", "true");
  modalBackdrop.setAttribute("aria-hidden", "true");
}

function applySettingsFromUI(){
  settings.spinCost = clamp(parseInt(spinCostInput.value || "50", 10) || 50, 1, 99999);
  settings.baseWin = clamp(parseInt(winRewardInput.value || "100", 10) || 100, 1, 999999);
  settings.winChance = clamp(parseInt(winChanceInput.value || "22", 10) || 22, 0, 100);
  settings.sound = !!soundToggle.checked;
  settings.particles = !!particlesToggle.checked;

  updateUIConfig();

  // If game is ready, keep button enabled logic consistent
  if (gameState === STATE.READY){
    spinBtn.disabled = points < settings.spinCost;
  }
}

function resetSettings(){
  settings = { spinCost: 50, baseWin: 100, winChance: 22, sound: true, particles: true };
  updateUIConfig();
}

/* Keyboard */
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && document.body.classList.contains("modal-open")){
    e.preventDefault();
    closeModal();
    return;
  }
  if (e.code === "Space" && !e.repeat){
    e.preventDefault();
    if (!spinBtn.disabled) spinBtn.click();
  }
});

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */
function preloadImages(paths){
  return Promise.all(paths.map(src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  })));
}

document.addEventListener("DOMContentLoaded", async () => {
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setAppHeightVar();
  if (window.visualViewport){
    window.visualViewport.addEventListener("resize", setAppHeightVar);
    window.visualViewport.addEventListener("scroll", setAppHeightVar);
  }
  window.addEventListener("resize", setAppHeightVar);
  window.addEventListener("orientationchange", setAppHeightVar);

  updateUIConfig();
  setButtonMode("SPIN");
  updatePoints(false);

  spinBtn.addEventListener("click", handleSpinButton);

  // Settings modal
  settingsBtn.addEventListener("click", openModal);
  closeSettingsBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", closeModal);

  resetBtn.addEventListener("click", () => {
    resetSettings();
    openModal(); // re-sync inputs
  });

  saveBtn.addEventListener("click", () => {
    applySettingsFromUI();
    closeModal();
  });

  // Preload images for first spin
  spinBtn.disabled = true;
  await preloadImages(SYMBOLS);
  spinBtn.disabled = false;

  // Particles
  resizeCanvas();
  initParticles();
  animateParticles();

  window.addEventListener("resize", resizeCanvas);
});
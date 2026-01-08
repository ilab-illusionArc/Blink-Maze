<template>
  <div
    ref="root"
    class="root"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointermove="onPointerMove"
  >
    <canvas ref="canvas" class="canvas"></canvas>

    <!-- ===== STATS OVERLAY (always visible; not blocking) ===== -->
<div class="statsOverlay" aria-hidden="true">
  <div class="statsRow">
    <span class="statPill">⭐ {{ scoreNow }}</span>
    <span class="statPill">⏱ {{ (elapsedMs / 1000).toFixed(0) }}s</span>
    <span class="statPill">⚡ {{ blinksUsed }}</span>
    <span class="statPill">❌ {{ invalidMoves }}</span>
  </div>
</div>

<!-- ===== TOAST (always visible) ===== -->
<div v-if="toastMsg" class="toastOverlay">
  <div class="toast" :class="toastType">{{ toastMsg }}</div>
</div>

<!-- ===== DESKTOP CONTROLS (always visible) ===== -->
<div v-if="!isTouch" class="controlsHud desktop">
  <button class="cBtn primary" :disabled="cooldownMsLeft > 0 || won" @click="blink">
    Blink
    <span class="sub">{{ cooldownMsLeft > 0 ? `${(cooldownMsLeft / 1000).toFixed(1)}s` : "ready" }}</span>
  </button>
  <button class="cBtn" @click="restart">↻ Restart</button>
</div>

<!-- ===== MOBILE CONTROLS: D-PAD (always visible) ===== -->
<div
  v-else
  class="controlsHud mobile"
  @pointerdown.stop
  @pointerup.stop
  @pointermove.stop
  @pointercancel.stop
>
  <button class="mMini" @click="restart">↻</button>

  <div class="pad">
    <button class="mBtn" @click="tryMove(0,-1)">▲</button>

    <div class="mRow">
      <button class="mBtn" @click="tryMove(-1,0)">◀</button>
      <button class="mBtn blink" :disabled="cooldownMsLeft > 0 || won" @click="blink">
        BLINK
      </button>
      <button class="mBtn" @click="tryMove(1,0)">▶</button>
    </div>

    <button class="mBtn" @click="tryMove(0,1)">▼</button>
  </div>
</div>


    <!-- Focus overlay for desktop -->
    <div v-if="!hasFocus && !isTouch" class="focusOverlay" @pointerdown="focusGame">
      Click / tap to focus (keyboard)
    </div>
  </div>
</template>


<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from "vue";

type Cell = { x: number; y: number };
type MazeCell = { n: boolean; e: boolean; s: boolean; w: boolean; visited: boolean };

const root = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const GRID_W = 17;
const GRID_H = 17;

const blinkDurationMs = 220;
const blinkCooldownMs = 700;

const showMaze = ref(false);
const blinksUsed = ref(0);
const movesUsed = ref(0);
const invalidMoves = ref(0);
const won = ref(false);

const cooldownUntil = ref<number>(0);

const hasFocus = ref(false);
const isTouch = ref(false);

let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;

// ======= Stars background =======
type Star = { x: number; y: number; r: number; s: number; a: number };
let stars: Star[] = [];

function initStars(w: number, h: number) {
  const count = Math.floor(Math.min(160, (w * h) / 9000));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.6 + Math.random() * 1.6,
    s: 0.15 + Math.random() * 0.55,
    a: 0.25 + Math.random() * 0.55,
  }));
}

// ======= Toasts =======
const toastMsg = ref("");
const toastType = ref<"info" | "warn" | "ok">("info");
let toastTimer: number | null = null;

function toast(msg: string, type: "info" | "warn" | "ok" = "info", ms = 900) {
  toastMsg.value = msg;
  toastType.value = type;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toastMsg.value = ""), ms);
}

// ======= Seed (RANDOM ONLY) =======
const randomSeed = ref(Math.floor(Math.random() * 1e9));
const seedKey = computed(() => String(randomSeed.value));

// Optional: keep seed in URL (no share button, but preserves on refresh)
function readSeedFromQuery() {
  const url = new URL(window.location.href);
  const s = url.searchParams.get("seed");
  if (s && /^\d+$/.test(s) && s.length <= 12) randomSeed.value = Number(s);
}
function writeSeedToQuery() {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seedKey.value);
  window.history.replaceState({}, "", url.toString());
}

// ======= Timer (reactive tick) =======
const hasStarted = ref(false);
const runStartedAt = ref<number>(0);
const nowMs = ref<number>(Date.now());
let clockTimer: number | null = null;

const elapsedMs = computed(() => {
  if (!hasStarted.value || runStartedAt.value === 0) return 0;
  return Math.max(0, nowMs.value - runStartedAt.value);
});

function startRunIfNeeded() {
  if (won.value) return;
  if (hasStarted.value) return;
  hasStarted.value = true;
  runStartedAt.value = Date.now();
}

// cooldown depends on nowMs (reactive)
const cooldownMsLeft = computed(() => Math.max(0, cooldownUntil.value - nowMs.value));

// ======= Score =======
const SCORE_BASE = 6000;
const TIME_PENALTY_PER_SEC = 10;
const MOVE_PENALTY = 4;
const INVALID_PENALTY = 14;
const BLINK_PENALTY = 160;

function computeScore(timeMs: number, blinks: number, moves: number, invalid: number) {
  const seconds = Math.floor(Math.max(0, timeMs) / 1000);
  return Math.max(
    0,
    Math.floor(
      SCORE_BASE
        - seconds * TIME_PENALTY_PER_SEC
        - blinks * BLINK_PENALTY
        - moves * MOVE_PENALTY
        - invalid * INVALID_PENALTY
    )
  );
}

const finalTimeMs = ref(0);
const finalBlinks = ref(0);
const finalMoves = ref(0);
const finalInvalid = ref(0);
const finalScore = ref(0);

const scoreNow = computed(() => {
  if (!hasStarted.value) return 0;
  if (won.value) return finalScore.value;
  return computeScore(elapsedMs.value, blinksUsed.value, movesUsed.value, invalidMoves.value);
});

// ======= Mobile “peek” while blinking =======
const uiPeekWhileBlink = computed(() => isTouch.value && showMaze.value);

// ======= Maze =======
function makeCell(): MazeCell {
  return { n: true, e: true, s: true, w: true, visited: false };
}
let maze: MazeCell[][] = Array.from({ length: GRID_H }, () =>
  Array.from({ length: GRID_W }, () => makeCell())
);

function inBounds(x: number, y: number) {
  return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
}
function cellAt(x: number, y: number): MazeCell {
  return maze[y]?.[x] ?? makeCell();
}

const player = ref<Cell>({ x: 0, y: 0 });
const goal = ref<Cell>({ x: GRID_W - 1, y: GRID_H - 1 });

function generateMazeFromSeed(seed: number) {
  generateMaze(seed);
}

function generateMaze(seed = Math.floor(Math.random() * 1e9)) {
  function mulberry32(a: number) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(seed);

  maze = Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, () => makeCell())
  );

  const stack: Cell[] = [];
  const start: Cell = { x: 0, y: 0 };

  cellAt(start.x, start.y).visited = true;
  stack.push(start);

  const dirs = [
    { dx: 0, dy: -1, a: "n" as const, b: "s" as const },
    { dx: 1, dy: 0, a: "e" as const, b: "w" as const },
    { dx: 0, dy: 1, a: "s" as const, b: "n" as const },
    { dx: -1, dy: 0, a: "w" as const, b: "e" as const },
  ] as const;

  while (stack.length > 0) {
    const cur = stack.at(-1);
    if (!cur) break;

    const neighbors = dirs
      .map(d => ({ ...d, nx: cur.x + d.dx, ny: cur.y + d.dy }))
      .filter(n => inBounds(n.nx, n.ny) && !cellAt(n.nx, n.ny).visited);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const pick = neighbors[Math.floor(rnd() * neighbors.length)];
    if (!pick) { stack.pop(); continue; }

    cellAt(cur.x, cur.y)[pick.a] = false;
    cellAt(pick.nx, pick.ny)[pick.b] = false;

    cellAt(pick.nx, pick.ny).visited = true;
    stack.push({ x: pick.nx, y: pick.ny });
  }

  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++)
      cellAt(x, y).visited = false;

  // reset run
  player.value = { x: 0, y: 0 };
  goal.value = { x: GRID_W - 1, y: GRID_H - 1 };
  won.value = false;
  blinksUsed.value = 0;
  movesUsed.value = 0;
  invalidMoves.value = 0;
  cooldownUntil.value = 0;
  showMaze.value = false;

  finalTimeMs.value = 0;
  finalBlinks.value = 0;
  finalMoves.value = 0;
  finalInvalid.value = 0;
  finalScore.value = 0;

  hasStarted.value = false;
  runStartedAt.value = 0;

  sentMsg.value = "";
  sentOnce.value = false;
}

// ======= Movement =======
function canMove(from: Cell, to: Cell) {
  if (!inBounds(to.x, to.y)) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const c = cellAt(from.x, from.y);

  if (dx === 1) return !c.e;
  if (dx === -1) return !c.w;
  if (dy === 1) return !c.s;
  if (dy === -1) return !c.n;
  return false;
}

function failMove() {
  invalidMoves.value++;
  toast("Blocked!", "warn", 450);
  if (navigator.vibrate) navigator.vibrate(22);
}

const sentOnce = ref(false);
const sentMsg = ref("");

function sendScoreToHost(payload: any) {
  // main website (parent iframe) should listen for this
  window.parent.postMessage(payload, "*");
}

function autoSendWinScore() {
  if (sentOnce.value) return;
  sentOnce.value = true;

  sendScoreToHost({
    type: "SCORE",
    gameSlug: "blink-maze",
    score: finalScore.value,
    meta: {
      seed: seedKey.value,
      timeMs: finalTimeMs.value,
      blinks: finalBlinks.value,
      moves: finalMoves.value,
      invalidMoves: finalInvalid.value,
    },
  });

  toast("Score sent to main site 🏆", "ok", 1200);
  sentMsg.value = "Saved on main website ✅";
}

function tryMove(dx: number, dy: number) {
  if (won.value) return;
  startRunIfNeeded();

  const from = player.value;
  const to = { x: from.x + dx, y: from.y + dy };

  if (!canMove(from, to)) {
    failMove();
    return;
  }

  player.value = to;
  movesUsed.value++;

  if (to.x === goal.value.x && to.y === goal.value.y) {
    won.value = true;

    finalTimeMs.value = elapsedMs.value;
    finalBlinks.value = blinksUsed.value;
    finalMoves.value = movesUsed.value;
    finalInvalid.value = invalidMoves.value;
    finalScore.value = computeScore(finalTimeMs.value, finalBlinks.value, finalMoves.value, finalInvalid.value);

    autoSendWinScore();
  }
}

// ======= Blink =======
function blink() {
  const now = Date.now();
  if (now < cooldownUntil.value || won.value) return;

  startRunIfNeeded();

  blinksUsed.value++;
  showMaze.value = true;
  cooldownUntil.value = now + blinkCooldownMs;

  window.setTimeout(() => { showMaze.value = false; }, blinkDurationMs);
}

// ======= UI =======
function restart() {
  randomSeed.value = Math.floor(Math.random() * 1e9);
  writeSeedToQuery();
  generateMazeFromSeed(randomSeed.value);
  toast("Restarted", "info", 650);
}

function focusGame() {
  hasFocus.value = true;
  root.value?.focus?.();
}

// ======= Keyboard =======
function handleKey(e: KeyboardEvent) {
  if (!hasFocus.value) return;

  const k = e.key.toLowerCase();
  if (k === " " || k === "spacebar" || k === "b") {
    e.preventDefault();
    blink();
    return;
  }

  if (k === "arrowup" || k === "w") { e.preventDefault(); tryMove(0, -1); }
  else if (k === "arrowdown" || k === "s") { e.preventDefault(); tryMove(0, 1); }
  else if (k === "arrowleft" || k === "a") { e.preventDefault(); tryMove(-1, 0); }
  else if (k === "arrowright" || k === "d") { e.preventDefault(); tryMove(1, 0); }
}

// ======= Touch (swipe/tap gameplay) =======
function isFromHud(e: PointerEvent) {
  const el = e.target as HTMLElement | null;
  return !!el?.closest?.(".hud") || !!el?.closest?.(".hudMobile") || !!el?.closest?.(".mobileControls");
}

let pointerActive = false;
let startX = 0;
let startY = 0;
let startT = 0;
let moved = false;

const SWIPE_MIN = 26;
const TAP_MAX_TIME = 260;

function onPointerDown(e: PointerEvent) {
  if (isFromHud(e)) return;
  focusGame();

  try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
  pointerActive = true;
  moved = false;
  startX = e.clientX;
  startY = e.clientY;
  startT = Date.now();
}
function onPointerMove(e: PointerEvent) {
  if (!pointerActive) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
}
function onPointerUp(e: PointerEvent) {
  if (!pointerActive) return;
  pointerActive = false;

  const endX = e.clientX;
  const endY = e.clientY;
  const dt = Date.now() - startT;

  const dx = endX - startX;
  const dy = endY - startY;

  if (Math.abs(dx) >= SWIPE_MIN || Math.abs(dy) >= SWIPE_MIN) {
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
    else tryMove(0, dy > 0 ? 1 : -1);
    return;
  }

  if (!moved && dt <= TAP_MAX_TIME) blink();
}
function onPointerCancel() {
  pointerActive = false;
}

// ======= Canvas =======
function resizeCanvas() {
  if (!canvas.value) return;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.value.getBoundingClientRect();

  canvas.value.width = Math.floor(rect.width * dpr);
  canvas.value.height = Math.floor(rect.height * dpr);

  ctx = canvas.value.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  initStars(rect.width, rect.height);
}

function drawGlowCircle(x: number, y: number, r: number, core: string, glow: string) {
  if (!ctx) return;
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = r * 1.8;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  if (!ctx || !canvas.value) return;

  const w = canvas.value.getBoundingClientRect().width;
  const h = canvas.value.getBoundingClientRect().height;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#050712");
  bg.addColorStop(1, "#02030a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  for (const s of stars) {
    s.y += s.s;
    if (s.y > h + 4) { s.y = -4; s.x = Math.random() * w; }
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#cfe6ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const pad = 18;
  const cellSize = Math.max(12, Math.floor(Math.min((w - pad * 2) / GRID_W, (h - pad * 2) / GRID_H)));
  const mazeW = cellSize * GRID_W;
  const mazeH = cellSize * GRID_H;
  const ox = Math.floor((w - mazeW) / 2);
  const oy = Math.floor((h - mazeH) / 2);

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(ox - 10, oy - 10, mazeW + 20, mazeH + 20);

  if (showMaze.value) {
    ctx.save();
    ctx.strokeStyle = "rgba(160, 210, 255, 0.95)";
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "rgba(120, 200, 255, 0.75)";
    ctx.shadowBlur = 10;

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const c = cellAt(x, y);
        const x0 = ox + x * cellSize;
        const y0 = oy + y * cellSize;
        const x1 = x0 + cellSize;
        const y1 = y0 + cellSize;

        ctx.beginPath();
        if (c.n) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
        if (c.e) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
        if (c.s) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
        if (c.w) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  const gx = ox + goal.value.x * cellSize + cellSize / 2;
  const gy = oy + goal.value.y * cellSize + cellSize / 2;
  drawGlowCircle(gx, gy, Math.max(7, cellSize * 0.22), "rgba(90,255,160,0.9)", "rgba(90,255,160,0.8)");

  const px = ox + player.value.x * cellSize + cellSize / 2;
  const py = oy + player.value.y * cellSize + cellSize / 2;
  drawGlowCircle(px, py, Math.max(8, cellSize * 0.26), "rgba(255,230,120,0.95)", "rgba(255,220,140,0.85)");

  const vign = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.25, w/2, h/2, Math.min(w,h)*0.75);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, w, h);
}

function loop() {
  draw();
  raf = requestAnimationFrame(loop);
}

// ======= Lifecycle =======
let resizeObs: ResizeObserver | null = null;

onMounted(() => {
  isTouch.value = window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
  if (isTouch.value) hasFocus.value = true;

  readSeedFromQuery();
  writeSeedToQuery();
  generateMazeFromSeed(randomSeed.value);

  resizeCanvas();
  requestAnimationFrame(() => resizeCanvas());
  requestAnimationFrame(() => resizeCanvas());

  loop();
  window.addEventListener("keydown", handleKey, { passive: false });

  resizeObs = new ResizeObserver(() => resizeCanvas());
  if (root.value) resizeObs.observe(root.value);

  // drives cooldown + time + UI updates
  clockTimer = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 100);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener("keydown", handleKey as any);
  if (clockTimer) window.clearInterval(clockTimer);
  resizeObs?.disconnect();
  if (toastTimer) window.clearTimeout(toastTimer);
});
</script>

<style scoped>
/* root/canvas stay same */
.root { position: relative; width: 100vw; height: 100dvh; outline: none; }
.canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

/* ===== Toggle always accessible ===== */
.hudToggle{
  position:absolute;
  left: 10px;
  top: calc(10px + env(safe-area-inset-top));
  z-index: 40;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(140,180,255,0.18);
  background: rgba(12, 16, 30, 0.55);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
  color: rgba(240,250,255,0.96);
  font-weight: 950;
  cursor: pointer;
}

/* ===== STATS OVERLAY: thin strip, pointer-events none so it doesn't block game ===== */
.statsOverlay{
  position: absolute;
  left: 0; right: 0;
  top: calc(10px + env(safe-area-inset-top));
  z-index: 20;
  display: flex;
  justify-content: center;
  pointer-events: none; /* IMPORTANT */
}
.statsRow{
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: min(820px, calc(100% - 120px));
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(10,14,26,0.28);
  border: 1px solid rgba(120,170,255,0.10);
  backdrop-filter: blur(10px);
}
.statPill{
  font-size: 11px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(140,180,255,0.10);
  color: rgba(234,245,255,0.92);
  font-weight: 900;
  white-space: nowrap;
}
.statPill.dim{ opacity: 0.75; }

/* ===== Toast centered, never inside controls ===== */
.toastOverlay{
  position: absolute;
  left: 0; right: 0;
  top: calc(62px + env(safe-area-inset-top));
  z-index: 45;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.toast {
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(140,180,255,0.12);
  background: rgba(16,22,40,0.82);
  backdrop-filter: blur(10px);
  color: rgba(234,245,255,0.92);
  box-shadow: 0 18px 60px rgba(0,0,0,0.35);
}
.toast.warn { border-color: rgba(255,180,120,0.25); background: rgba(55,30,12,0.75); }
.toast.ok { border-color: rgba(90,255,160,0.25); background: rgba(12,40,22,0.75); }

/* ===== Controls HUD (hideable) ===== */
.controlsHud{
  position: absolute;
  z-index: 35;
  display: flex;
  gap: 10px;
  align-items: center;
  pointer-events: auto;
}

/* desktop: small bar bottom-left (doesn't block maze center) */
.controlsHud.desktop{
  left: 14px;
  bottom: 14px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(12, 16, 30, 0.55);
  border: 1px solid rgba(120,170,255,0.14);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
}

.cBtn{
  cursor:pointer;
  border:1px solid rgba(140,180,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(240,250,255,0.95);
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 950;
}
.cBtn:disabled { opacity: 0.55; cursor:not-allowed; }
.cBtn.primary{
  background: radial-gradient(120% 160% at 20% 10%, rgba(120,170,255,0.40), rgba(80,140,255,0.14));
  border-color: rgba(120,170,255,0.28);
}
.sub { font-size:12px; margin-left:8px; opacity:0.85; font-weight:850; }

/* mobile: bottom controls only */
.controlsHud.mobile{
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(12, 16, 30, 0.55);
  border: 1px solid rgba(120,170,255,0.14);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
}

.mMini{
  align-self: flex-end;
  width: 54px;
  height: 38px;
  border-radius: 14px;
  border: 1px solid rgba(140, 180, 255, 0.20);
  background: rgba(255,255,255,0.06);
  color: rgba(240, 250, 255, 0.96);
  font-weight: 950;
}

.pad{ display: grid; gap: 10px; justify-items: center; }
.mRow { display:flex; gap:10px; align-items:center; }
.mBtn {
  width: 64px;
  height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(140, 180, 255, 0.20);
  background: rgba(255,255,255,0.06);
  color: rgba(240, 250, 255, 0.96);
  font-weight: 950;
  font-size: 16px;
}
.mBtn.blink {
  width: 94px;
  background: rgba(255, 230, 120, 0.10);
  border-color: rgba(255, 230, 120, 0.20);
}

/* focus overlay stays */
.focusOverlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(230, 240, 255, 0.85);
  background: rgba(0,0,0,0.20);
  font-weight: 900;
}
/* ===== STATS OVERLAY ===== */
.statsOverlay{
  position: absolute;
  left: 0; right: 0;
  top: calc(10px + env(safe-area-inset-top));
  z-index: 20;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.statsRow{
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(10,14,26,0.28);
  border: 1px solid rgba(120,170,255,0.10);
  backdrop-filter: blur(10px);
}
.statPill{
  font-size: 11px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(140,180,255,0.10);
  color: rgba(234,245,255,0.92);
  font-weight: 900;
  white-space: nowrap;
}

/* ===== TOAST ===== */
.toastOverlay{
  position: absolute;
  left: 0; right: 0;
  top: calc(62px + env(safe-area-inset-top));
  z-index: 45;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.toast {
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(140,180,255,0.12);
  background: rgba(16,22,40,0.82);
  backdrop-filter: blur(10px);
  color: rgba(234,245,255,0.92);
  box-shadow: 0 18px 60px rgba(0,0,0,0.35);
}
.toast.warn { border-color: rgba(255,180,120,0.25); background: rgba(55,30,12,0.75); }
.toast.ok { border-color: rgba(90,255,160,0.25); background: rgba(12,40,22,0.75); }

/* ===== CONTROLS HUD ===== */
.controlsHud{
  position: absolute;
  z-index: 35;
  display: flex;
  gap: 10px;
  align-items: center;
}

/* desktop bottom-left */
.controlsHud.desktop{
  left: 14px;
  bottom: 14px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(12, 16, 30, 0.55);
  border: 1px solid rgba(120,170,255,0.14);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
}

.cBtn{
  cursor:pointer;
  border:1px solid rgba(140,180,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(240,250,255,0.95);
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 950;
}
.cBtn:disabled { opacity: 0.55; cursor:not-allowed; }
.cBtn.primary{
  background: radial-gradient(120% 160% at 20% 10%, rgba(120,170,255,0.40), rgba(80,140,255,0.14));
  border-color: rgba(120,170,255,0.28);
}
.sub { font-size:12px; margin-left:8px; opacity:0.85; font-weight:850; }

/* mobile bottom center D-pad */
.controlsHud.mobile{
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(12, 16, 30, 0.55);
  border: 1px solid rgba(120,170,255,0.14);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
}

.mMini{
  align-self: flex-end;
  width: 54px;
  height: 38px;
  border-radius: 14px;
  border: 1px solid rgba(140, 180, 255, 0.20);
  background: rgba(255,255,255,0.06);
  color: rgba(240, 250, 255, 0.96);
  font-weight: 950;
}

.pad{ display: grid; gap: 10px; justify-items: center; }
.mRow { display:flex; gap:10px; align-items:center; }
.mBtn {
  width: 64px;
  height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(140, 180, 255, 0.20);
  background: rgba(255,255,255,0.06);
  color: rgba(240, 250, 255, 0.96);
  font-weight: 950;
  font-size: 16px;
}
.mBtn.blink {
  width: 94px;
  background: rgba(255, 230, 120, 0.10);
  border-color: rgba(255, 230, 120, 0.20);
}
</style>

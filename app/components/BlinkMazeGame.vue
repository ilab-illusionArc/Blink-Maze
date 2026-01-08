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

    <!-- ===== MOBILE HUD (compact) ===== -->
    <div
      v-if="isTouch"
      class="hudMobile"
      :class="{ peek: uiPeekWhileBlink }"
      @pointerdown.stop
      @pointerup.stop
      @pointermove.stop
      @pointercancel.stop
    >
      <div class="mTop">
        <div class="mTitle">Blink Maze</div>
        <div class="mTags">
          <span class="tag">{{ modeLabel }}</span>
          <span class="tag">{{ seedKey }}</span>
        </div>
      </div>

      <div class="mActions">
        <button class="mBtn2 primary" :disabled="cooldownMsLeft > 0 || won" @click="blink">
          Blink
          <span class="sub">{{ cooldownMsLeft > 0 ? `${(cooldownMsLeft / 1000).toFixed(1)}s` : "ready" }}</span>
        </button>

        <button class="mBtn2" @click="restart">↻</button>
        <button class="mBtn2" @click="openLeaderboard">🏆</button>
        <button class="mBtn2" @click="copyShareLink">⤴</button>
        <button class="mBtn2" @click="openSettings">⚙</button>
      </div>

      <div class="mStats">
        <span class="chip">⏱ {{ (elapsedMs / 1000).toFixed(0) }}s</span>
        <span class="chip">⭐ {{ scoreNow }}</span>
        <span class="chip">⚡ {{ blinksUsed }}</span>
        <span class="chip">❌ {{ invalidMoves }}</span>
      </div>

      <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>
    </div>

    <!-- ===== DESKTOP HUD (full) ===== -->
    <div
      v-else
      class="hud"
      @pointerdown.stop
      @pointerup.stop
      @pointermove.stop
      @pointercancel.stop
    >
      <div class="titleRow">
        <div class="title">Blink Maze</div>
        <div class="badge">{{ modeLabel }} • {{ seedKey }}</div>
      </div>

      <div class="hint">Desktop: WASD / Arrow • Blink: Space</div>

      <div class="row">
        <button class="btn primary" :disabled="cooldownMsLeft > 0 || won" @click="blink">
          Blink <span class="sub">{{ cooldownMsLeft > 0 ? `${(cooldownMsLeft / 1000).toFixed(1)}s` : "ready" }}</span>
        </button>
        <button class="btn" @click="restart">Restart</button>
        <button class="btn" @click="copyShareLink">Share</button>
        <button class="btn" @click="openLeaderboard">Leaderboard</button>
      </div>

      <div class="row modeRow">
        <label class="pill">
          <input type="radio" value="daily" v-model="mode" />
          <span>Daily</span>
        </label>
        <label class="pill">
          <input type="radio" value="random" v-model="mode" />
          <span>Random</span>
        </label>
        <input class="name" v-model="playerName" maxlength="18" placeholder="Name" />
      </div>

      <div class="stats">
        <div class="stat"><span>Time</span><b>{{ (elapsedMs / 1000).toFixed(0) }}s</b></div>
        <div class="stat"><span>Blinks</span><b>{{ blinksUsed }}</b></div>
        <div class="stat"><span>Moves</span><b>{{ movesUsed }}</b></div>
        <div class="stat"><span>Invalid</span><b>{{ invalidMoves }}</b></div>
        <div class="stat score"><span>Score</span><b>{{ scoreNow }}</b></div>
      </div>

      <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>

      <div v-if="!hasStarted && !won" class="startHint">Move or Blink to start</div>

      <div v-if="won" class="winBox">
        <div class="winTitle">✅ Escaped!</div>
        <div class="winMeta">
          <span><b>{{ finalScore }}</b> pts</span>
          <span>{{ (finalTimeMs / 1000).toFixed(1) }}s</span>
          <span>{{ finalBlinks }} blinks</span>
          <span>{{ finalMoves }} moves</span>
          <span>{{ finalInvalid }} invalid</span>
        </div>

        <div class="row">
          <button class="btn primary" :disabled="submitting" @click="submitScore">
            {{ submitting ? "Submitting..." : "Submit" }}
          </button>
          <button class="btn" @click="restart">Play Again</button>
        </div>

        <div v-if="rankMsg" class="rankBox">{{ rankMsg }}</div>
      </div>
    </div>

    <!-- ===== MOBILE D-PAD (kept, but compact HUD now doesn’t block maze much) ===== -->
    <div
      v-if="isTouch"
      class="mobileControls"
      :class="{ peek: uiPeekWhileBlink }"
      @pointerdown.stop
      @pointerup.stop
      @pointermove.stop
      @pointercancel.stop
    >
      <button class="mBtn" @click="tryMove(0,-1)">▲</button>
      <div class="mRow">
        <button class="mBtn" @click="tryMove(-1,0)">◀</button>
        <button class="mBtn blink" :disabled="cooldownMsLeft > 0 || won" @click="blink">BLINK</button>
        <button class="mBtn" @click="tryMove(1,0)">▶</button>
      </div>
      <button class="mBtn" @click="tryMove(0,1)">▼</button>
    </div>

    <!-- ===== LEADERBOARD MODAL ===== -->
    <div v-if="showLeaderboard" class="modalOverlay" @pointerdown="closeLeaderboard">
      <div class="modal" @pointerdown.stop>
        <div class="modalHead">
          <div>
            <div class="modalTitle">🏆 Leaderboard</div>
            <div class="modalSub">{{ modeLabel }} • Seed: {{ seedKey }}</div>
          </div>
          <button class="xBtn" @click="closeLeaderboard">✕</button>
        </div>

        <div v-if="lbLoading" class="lbLoading">Loading…</div>
        <ol v-else class="lbList">
          <li v-for="(r, i) in leaderboard" :key="i" class="lbRow">
            <span class="rank">#{{ i + 1 }}</span>
            <span class="nameRow">{{ r.name }}</span>
            <span class="scoreRow">{{ r.score }}</span>
            <span class="small">{{ (r.time_ms / 1000).toFixed(1) }}s</span>
          </li>
          <li v-if="leaderboard.length === 0" class="lbEmpty">No scores yet. Be the first!</li>
        </ol>
      </div>
    </div>

    <!-- ===== SETTINGS MODAL (mobile) ===== -->
    <div v-if="showSettings" class="modalOverlay" @pointerdown="closeSettings">
      <div class="modal" @pointerdown.stop>
        <div class="modalHead">
          <div>
            <div class="modalTitle">⚙ Settings</div>
            <div class="modalSub">Mode + name</div>
          </div>
          <button class="xBtn" @click="closeSettings">✕</button>
        </div>

        <div class="settingsBlock">
          <div class="settingsRow">
            <label class="pill">
              <input type="radio" value="daily" v-model="mode" />
              <span>Daily</span>
            </label>
            <label class="pill">
              <input type="radio" value="random" v-model="mode" />
              <span>Random</span>
            </label>
          </div>

          <input class="name wide" v-model="playerName" maxlength="18" placeholder="Name" />
          <button class="btn primary wide" @click="closeSettings">Done</button>
        </div>
      </div>
    </div>

    <!-- Focus overlay for desktop -->
    <div v-if="!hasFocus && !isTouch" class="focusOverlay" @pointerdown="focusGame">
      Click / tap to focus (keyboard)
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from "vue";

type Cell = { x: number; y: number };
type MazeCell = { n: boolean; e: boolean; s: boolean; w: boolean; visited: boolean };
type LbRow = { name: string; score: number; time_ms: number; blinks: number; moves: number; invalid_moves?: number; created_at: number };

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

// ======= Modal state =======
const showLeaderboard = ref(false);
const showSettings = ref(false);

function openLeaderboard() {
  showLeaderboard.value = true;
  void loadLeaderboard();
}
function closeLeaderboard() {
  showLeaderboard.value = false;
}
function openSettings() {
  showSettings.value = true;
}
function closeSettings() {
  showSettings.value = false;
}

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

// ======= Mode + seed =======
const mode = ref<"daily" | "random">("daily");
const playerName = ref("Guest");

function todayKeyLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
const dailyKey = ref(todayKeyLocal());
const randomSeed = ref(Math.floor(Math.random() * 1e9));

const seedKey = computed(() => (mode.value === "daily" ? dailyKey.value : String(randomSeed.value)));
const modeLabel = computed(() => (mode.value === "daily" ? "Daily" : "Random"));

function readQuery() {
  const url = new URL(window.location.href);
  const m = url.searchParams.get("mode");
  const s = url.searchParams.get("seed");

  if (m === "random" || m === "daily") mode.value = m;
  if (s && s.length <= 32) {
    if (mode.value === "daily") dailyKey.value = s;
    else randomSeed.value = /^\d+$/.test(s) ? Number(s) : Math.floor(Math.random() * 1e9);
  }
}
function writeQuery() {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode.value);
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

// ✅ FIX: cooldown depends on nowMs (reactive)
const cooldownMsLeft = computed(() => Math.max(0, cooldownUntil.value - nowMs.value));

// ======= Score (matches your server constants) =======
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

function hashStringToInt(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateMazeFromSeedKey(key: string) {
  const seed = /^\d+$/.test(key) ? Number(key) : hashStringToInt(key);
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

  rankMsg.value = "";
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

    toast("Escaped! Submit your score 🏆", "ok", 1200);
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
  if (mode.value === "random") randomSeed.value = Math.floor(Math.random() * 1e9);
  writeQuery();
  generateMazeFromSeedKey(seedKey.value);
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
  return !!el?.closest?.(".hud") || !!el?.closest?.(".hudMobile") || !!el?.closest?.(".mobileControls") || !!el?.closest?.(".modalOverlay");
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

// ======= Leaderboard + submit =======
const leaderboard = ref<LbRow[]>([]);
const lbLoading = ref(false);
const submitting = ref(false);
const rankMsg = ref("");

async function loadLeaderboard() {
  lbLoading.value = true;
  try {
    const res = await $fetch<{ ok: boolean; rows?: LbRow[] }>(`/api/leaderboard`, {
      query: { mode: mode.value, seed: seedKey.value, limit: 20 },
    });
    leaderboard.value = res.ok && res.rows ? res.rows : [];
  } catch {
    leaderboard.value = [];
  } finally {
    lbLoading.value = false;
  }
}

async function submitScore() {
  if (!won.value) return;

  // compute final score (you already do this)
  const score = finalScore.value;

  // If embedded inside Illusion Arc, send SCORE to the host instead of using /api/submit of blink-maze
  if (isEmbedded()) {
    sendScoreToHost({
      type: "SCORE",
      score,
      // optional extra data (won’t break your host listener)
      gameSlug: "blink-maze",
      meta: {
        mode: mode.value,
        seed: seedKey.value,
        timeMs: finalTimeMs.value,
        blinks: finalBlinks.value,
        moves: finalMoves.value,
        invalidMoves: finalInvalid.value,
      }
    });

    toast("Submitted to Illusion Arc 🏆", "ok", 1200);
    rankMsg.value = "Saved to Illusion Arc leaderboard ✅";
    return;
  }

  // otherwise keep your existing standalone behaviour on vercel:
  submitting.value = true;
  rankMsg.value = "";
  try {
    const payload = {
      mode: mode.value,
      seed: seedKey.value,
      name: playerName.value || "Guest",
      timeMs: finalTimeMs.value,
      blinks: finalBlinks.value,
      moves: finalMoves.value,
      invalidMoves: finalInvalid.value,
    };

    const res = await $fetch<{ ok: boolean; error?: string; score?: number; rank?: number }>(`/api/submit`, {
      method: "POST",
      body: payload,
    });

    if (res.ok) {
      toast("Submitted!", "ok", 900);
      if (typeof res.score === "number") finalScore.value = res.score;
      if (typeof res.rank === "number") rankMsg.value = `🏆 You placed #${res.rank}`;
      await loadLeaderboard();
    } else {
      toast(`Submit failed: ${res.error ?? "unknown"}`, "warn", 1200);
    }
  } catch {
    toast("Submit failed (network/server).", "warn", 1200);
  } finally {
    submitting.value = false;
  }
}


async function copyShareLink() {
  writeQuery();
  const link = new URL(window.location.href).toString();

  try {
    await navigator.clipboard.writeText(link);
    toast("Link copied!", "ok", 900);
  } catch {
    toast("Copy failed. Use address bar.", "warn", 1200);
  }
}

function isEmbedded() {
  try { return window.self !== window.top } catch { return true }
}

function sendScoreToHost(payload: any) {
  // send to wrapper (parent). Wrapper will relay to IllusionArc.
  window.parent.postMessage(payload, "*")
}


// ======= Mode change =======
watch(mode, async () => {
  if (mode.value === "random") randomSeed.value = Math.floor(Math.random() * 1e9);
  writeQuery();
  generateMazeFromSeedKey(seedKey.value);
  toast(`Mode: ${modeLabel.value}`, "info", 700);
});

// ======= Lifecycle =======
let resizeObs: ResizeObserver | null = null;

onMounted(() => {
  isTouch.value = window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
  if (isTouch.value) hasFocus.value = true;

  readQuery();
  writeQuery();
  generateMazeFromSeedKey(seedKey.value);

  resizeCanvas();
  requestAnimationFrame(() => resizeCanvas());
  requestAnimationFrame(() => resizeCanvas());

  loop();
  window.addEventListener("keydown", handleKey, { passive: false });

  resizeObs = new ResizeObserver(() => resizeCanvas());
  if (root.value) resizeObs.observe(root.value);

  // ✅ drives cooldown + time + UI updates
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
.root { position: relative; width: 100vw; height: 100dvh; outline: none; }
.canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

/* ===== Desktop HUD ===== */
.hud {
  position: absolute;
  left: 14px; top: 14px;
  padding: 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(16,22,40,0.74), rgba(10,14,26,0.66));
  border: 1px solid rgba(120, 170, 255, 0.18);
  box-shadow: 0 18px 60px rgba(0,0,0,0.35);
  backdrop-filter: blur(12px);
  color: rgba(234, 245, 255, 0.92);
  max-width: min(540px, calc(100% - 28px));
}

.titleRow { display:flex; gap:10px; align-items:baseline; justify-content:space-between; flex-wrap:wrap; }
.title { font-weight: 950; font-size: 16px; }
.badge {
  font-size: 11px; padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(120,170,255,0.16);
  background: rgba(255,255,255,0.06);
  opacity: 0.9;
}
.hint { margin-top: 6px; font-size: 12px; opacity: 0.85; }

.row { display:flex; gap:10px; margin-top:10px; flex-wrap:wrap; align-items:center; }
.btn {
  cursor:pointer;
  border:1px solid rgba(140,180,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(240,250,255,0.95);
  padding: 10px 12px;
  border-radius: 14px;
  font-weight: 900;
}
.btn:disabled { opacity: 0.55; cursor:not-allowed; }
.btn.primary {
  background: radial-gradient(120% 160% at 20% 10%, rgba(120,170,255,0.40), rgba(80,140,255,0.14));
  border-color: rgba(120,170,255,0.28);
}
.sub { font-size:12px; margin-left:8px; opacity:0.85; font-weight:850; }

.modeRow { gap: 8px; }
.pill {
  display:inline-flex; align-items:center; gap:8px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(140,180,255,0.14);
  background: rgba(255,255,255,0.05);
  font-size: 12px;
  font-weight: 900;
}
.pill input { accent-color: #8fb9ff; }
.name {
  flex:1; min-width:160px;
  border-radius:14px;
  border:1px solid rgba(140,180,255,0.14);
  background: rgba(0,0,0,0.18);
  color: rgba(240,250,255,0.95);
  padding: 10px 12px;
  outline:none;
}
.name.wide { width: 100%; }

.stats {
  display:grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.stat {
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(140,180,255,0.10);
  background: rgba(255,255,255,0.04);
  font-size: 12px;
  display:flex; align-items:baseline; justify-content:space-between; gap:10px;
}
.stat span { opacity:0.75; font-weight:800; }
.stat b { font-weight:950; }
.stat.score { border-color: rgba(255,230,120,0.16); }

.toast {
  margin-top: 10px;
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(140,180,255,0.12);
  background: rgba(255,255,255,0.06);
}
.toast.warn { border-color: rgba(255,180,120,0.25); background: rgba(255,180,120,0.08); }
.toast.ok { border-color: rgba(90,255,160,0.25); background: rgba(90,255,160,0.08); }
.startHint { margin-top: 10px; font-size: 12px; opacity: 0.86; }

.winBox { margin-top:10px; padding:10px; border-radius:18px; background: rgba(90,255,160,0.08); border:1px solid rgba(90,255,160,0.18); }
.winTitle { font-weight:950; margin-bottom:6px; }
.winMeta { display:flex; gap:10px; flex-wrap:wrap; font-size:12px; opacity:0.95; margin-bottom:8px; }
.rankBox { margin-top:10px; padding:8px 10px; border-radius:14px; background: rgba(255,220,120,0.10); border:1px solid rgba(255,220,120,0.18); font-size:12px; font-weight:950; }

/* ===== Mobile HUD (compressed) ===== */
.hudMobile {
  position: absolute;
  left: 10px; right: 10px; top: 10px;
  padding: 10px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(16,22,40,0.74), rgba(10,14,26,0.62));
  border: 1px solid rgba(120, 170, 255, 0.16);
  box-shadow: 0 18px 60px rgba(0,0,0,0.28);
  backdrop-filter: blur(12px);
  color: rgba(234, 245, 255, 0.92);
}

.mTop { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.mTitle { font-weight: 950; font-size: 14px; }
.mTags { display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.tag {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(120,170,255,0.14);
  background: rgba(255,255,255,0.06);
  opacity: 0.9;
}

.mActions { display:flex; gap:8px; margin-top:8px; align-items:center; }
.mBtn2 {
  height: 40px;
  min-width: 40px;
  padding: 0 10px;
  border-radius: 14px;
  border: 1px solid rgba(140,180,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(240,250,255,0.96);
  font-weight: 950;
}
.mBtn2.primary {
  flex: 1;
  min-width: 140px;
  background: radial-gradient(120% 160% at 20% 10%, rgba(120,170,255,0.40), rgba(80,140,255,0.14));
  border-color: rgba(120,170,255,0.28);
}
.mBtn2:disabled { opacity: 0.55; }

.mStats { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; }
.chip {
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 999px;
  border: 1px solid rgba(140,180,255,0.10);
  background: rgba(255,255,255,0.04);
  opacity: 0.95;
}

/* ===== Mobile Controls ===== */
.mobileControls {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: grid;
  gap: 10px;
  justify-items: center;
  padding: 10px;
  border-radius: 18px;
  background: rgba(12, 16, 30, 0.55);
  border: 1px solid rgba(120,170,255,0.14);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 60px rgba(0,0,0,0.25);
}

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

/* ===== Modals ===== */
.modalOverlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: grid;
  place-items: center;
  padding: 16px;
}
.modal {
  width: min(520px, 100%);
  max-height: min(70vh, 600px);
  overflow: auto;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(16,22,40,0.96), rgba(10,14,26,0.94));
  border: 1px solid rgba(120,170,255,0.16);
  box-shadow: 0 22px 70px rgba(0,0,0,0.55);
  color: rgba(234,245,255,0.92);
  padding: 12px;
}
.modalHead { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
.modalTitle { font-weight: 950; font-size: 14px; }
.modalSub { font-size: 11px; opacity: 0.8; margin-top: 2px; }
.xBtn {
  border: 1px solid rgba(140,180,255,0.16);
  background: rgba(255,255,255,0.06);
  color: rgba(234,245,255,0.92);
  border-radius: 12px;
  width: 40px;
  height: 40px;
  font-weight: 950;
}

.lbLoading { margin-top: 10px; font-size: 12px; opacity: 0.85; }
.lbList { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.lbRow {
  display:grid;
  grid-template-columns: 44px 1fr auto auto;
  gap: 8px;
  align-items:center;
  font-size: 12px;
  padding: 9px 10px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(140,180,255,0.10);
}
.rank { opacity: 0.75; font-weight: 900; }
.nameRow { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.scoreRow { font-weight: 950; }
.small { opacity: 0.75; }
.lbEmpty { font-size: 12px; opacity: 0.75; padding: 8px 10px; }

.settingsBlock { margin-top: 12px; display: grid; gap: 10px; }
.settingsRow { display:flex; gap:8px; flex-wrap:wrap; }
.wide { width: 100%; }
.btn.wide { width: 100%; }

/* desktop focus overlay */
.focusOverlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(230, 240, 255, 0.85);
  background: rgba(0,0,0,0.20);
  font-weight: 900;
}

/* fade UI during blink on mobile */
.peek { opacity: 0.08; pointer-events: none; backdrop-filter: none; }
</style>

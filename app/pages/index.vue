<!-- app/pages/index.vue -->
<template>
  <div class="menuRoot">
    <div class="bgGlow" />

    <!-- TOP: LOGO -->
    <header class="topBrand" aria-label="Blink Maze">
      <img class="logo" src="/blink-maze-logo.png" alt="Blink Maze logo" />
    </header>

    <!-- MIDDLE: PLAY -->
    <main class="centerArea">
      <button class="playBtn" @click="goPlay">
        ▶ Play
        <span class="playSub">Start a new run</span>
      </button>
    </main>

    <!-- BOTTOM: LEGACY MENU (ONLY HOW TO PLAY) -->
    <footer class="legacyBar" role="navigation" aria-label="Menu">
      <button class="legacyItem" @click="showHow = true">
        ? How to Play
      </button>
    </footer>

    <!-- HOW TO PLAY MODAL -->
    <div v-if="showHow" class="modalOverlay" @pointerdown.self="showHow = false">
      <div class="modal" role="dialog" aria-modal="true" aria-label="How to Play">
        <div class="modalHeader">
          <h2>How to Play</h2>
          <button class="x" @click="showHow = false" aria-label="Close">✕</button>
        </div>

        <div class="modalBody">
          <ul>
            <li><b>Goal:</b> reach the <span class="chip green">green</span> target.</li>
            <li><b>Maze is hidden</b> most of the time.</li>
            <li><b>Press Space</b> to reveal the maze briefly (Blink).</li>
            <li><b>Move:</b> Arrow keys / WASD (desktop), swipe or D-pad (mobile).</li>
            <li><b>Score:</b> faster time + fewer blinks + fewer invalid moves = higher score.</li>
          </ul>

          <div class="modalActions">
            <button class="btn primary" @click="goPlayFromHow">▶ Play Now</button>
            <button class="btn" @click="showHow = false">Close</button>
          </div>

          <p class="smallHint">Tip: Use <b>Space</b> only when you need a quick peek.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

useHead({ title: "Blink Maze" });

const showHow = ref(false);

function goPlay() {
  navigateTo("/play");
}

function goPlayFromHow() {
  showHow.value = false;
  navigateTo("/play");
}
</script>

<style scoped>
.menuRoot{
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background:
    radial-gradient(1200px 800px at 30% 20%, rgba(120,170,255,0.18), transparent 60%),
    linear-gradient(180deg, #050712, #02030a);
}

.bgGlow{
  position:absolute;
  inset:-40px;
  background:
    radial-gradient(700px 500px at 70% 30%, rgba(90,255,160,0.12), transparent 60%),
    radial-gradient(600px 450px at 20% 80%, rgba(255,230,120,0.10), transparent 60%);
  filter: blur(10px);
  opacity: 0.9;
  pointer-events: none;
}

/* TOP */
.topBrand{
  padding-top: calc(18px + env(safe-area-inset-top));
  padding-bottom: 8px;
  display:flex;
  justify-content:center;
  align-items:center;
  z-index: 2;
}
.logo{
  width: min(360px, calc(100% - 40px));
  height: auto;
  image-rendering: auto;
  filter: drop-shadow(0 18px 60px rgba(0,0,0,0.45));
}

/* CENTER */
.centerArea{
  display:grid;
  place-items:center;
  z-index: 2;
  padding: 16px;
}

.playBtn{
  width: min(420px, calc(100% - 20px));
  padding: 18px 18px;
  border-radius: 22px;
  cursor: pointer;
  border: 1px solid rgba(120,170,255,0.28);
  color: rgba(240,250,255,0.95);
  font-weight: 1000;
  font-size: 22px;

  background:
    radial-gradient(120% 160% at 20% 10%, rgba(120,170,255,0.44), rgba(80,140,255,0.12)),
    rgba(12,16,30,0.55);

  backdrop-filter: blur(12px);
  box-shadow: 0 22px 80px rgba(0,0,0,0.45);

  display:flex;
  flex-direction: column;
  align-items:center;
  gap: 6px;
}

.playSub{
  font-size: 13px;
  opacity: 0.85;
  font-weight: 850;
}

/* LEGACY MENU BAR */
.legacyBar{
  z-index: 3;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  display:flex;
  justify-content: center;
  gap: 10px;

  background: rgba(8,10,18,0.58);
  border-top: 1px solid rgba(120,170,255,0.12);
  backdrop-filter: blur(12px);
}

.legacyItem{
  min-width: min(260px, calc(100vw - 40px));
  padding: 12px 14px;
  border-radius: 16px;
  cursor:pointer;
  border: 1px solid rgba(140,180,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(240,250,255,0.95);
  font-weight: 950;
}

/* MODAL */
.modalOverlay{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  background: rgba(0,0,0,0.38);
  z-index: 50;
  padding: 18px;
}

.modal{
  width: min(560px, 100%);
  border-radius: 22px;
  background: rgba(12,16,30,0.80);
  border: 1px solid rgba(120,170,255,0.18);
  backdrop-filter: blur(12px);
  box-shadow: 0 22px 80px rgba(0,0,0,0.55);
  color: rgba(240,250,255,0.95);
}

.modalHeader{
  display:flex;
  align-items:center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(140,180,255,0.10);
}
.modalHeader h2{
  margin:0;
  font-size: 16px;
  font-weight: 1000;
}
.x{
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(140,180,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(240,250,255,0.95);
  font-weight: 1000;
  cursor:pointer;
}

.modalBody{
  padding: 14px;
  font-size: 13px;
  line-height: 1.65;
}
.modalBody ul{
  margin: 0;
  padding-left: 18px;
}

.modalActions{
  display:flex;
  gap: 10px;
  margin-top: 14px;
}

.btn{
  flex: 1;
  cursor:pointer;
  border: 1px solid rgba(140,180,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(240,250,255,0.95);
  padding: 12px 12px;
  border-radius: 16px;
  font-weight: 950;
}

.btn.primary{
  background: radial-gradient(120% 160% at 20% 10%, rgba(120,170,255,0.40), rgba(80,140,255,0.14));
  border-color: rgba(120,170,255,0.28);
}

.smallHint{
  margin: 12px 2px 0;
  font-size: 12px;
  opacity: 0.78;
}

.chip{
  display:inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(140,180,255,0.12);
  background: rgba(255,255,255,0.06);
  font-weight: 950;
}
.chip.green{
  border-color: rgba(90,255,160,0.22);
  background: rgba(90,255,160,0.10);
}
</style>
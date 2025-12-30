<template>
  <div class="page">
    <BlinkMazeGame />
  </div>
</template>

<script setup lang="ts">
import BlinkMazeGame from "~/components/BlinkMazeGame.vue";
</script>

<style scoped>
.page {
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
}
</style>

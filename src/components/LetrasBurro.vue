<template>
  <span class="letras" :aria-label="`${letras} de 5 letras da palavra BURRO`">
    <span v-for="(l, i) in PALAVRA" :key="i" :class="{ marcada: i < letras }">{{ l }}</span>
  </span>
</template>

<script setup lang="ts">
import { PALAVRA_PENALIDADE } from '@/game/types';

defineProps<{ letras: number }>();
const PALAVRA = PALAVRA_PENALIDADE.split('');
</script>

<style scoped>
.letras {
  display: inline-flex;
  gap: 2px;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: 0.02em;
}
.letras span {
  opacity: 0.28;
}
.letras span.marcada {
  opacity: 1;
  color: var(--perigo);
}
</style>

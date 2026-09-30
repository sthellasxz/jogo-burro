<template>
  <button
    type="button"
    class="carta"
    :class="{ selecionada, vermelha, burro: ehBurro, pequena, desabilitada: desabilitada }"
    :disabled="desabilitada"
    :aria-pressed="selecionada"
    :aria-label="rotulo"
    @click="$emit('escolher', carta.id)"
  >
    <template v-if="ehBurro">
      <span class="emoji" aria-hidden="true">🐴</span>
      <span class="texto-burro">BURRO</span>
    </template>
    <template v-else>
      <span class="canto">{{ carta.valor }}<br />{{ simbolo }}</span>
      <span class="centro" aria-hidden="true">{{ simbolo }}</span>
      <span class="canto inferior">{{ carta.valor }}<br />{{ simbolo }}</span>
    </template>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { VALOR_BURRO, type Carta } from '@/game/types';

const props = defineProps<{
  carta: Carta;
  selecionada?: boolean;
  pequena?: boolean;
  desabilitada?: boolean;
}>();
defineEmits<{ escolher: [id: string] }>();

const SIMBOLOS = { copas: '♥', ouros: '♦', espadas: '♠', paus: '♣' } as const;

const ehBurro = computed(() => props.carta.valor === VALOR_BURRO);
const simbolo = computed(() => (props.carta.naipe ? SIMBOLOS[props.carta.naipe] : ''));
const vermelha = computed(() => props.carta.naipe === 'copas' || props.carta.naipe === 'ouros');
const rotulo = computed(() =>
  ehBurro.value ? 'Carta Burro (não forma grupo)' : `${props.carta.valor} de ${props.carta.naipe}`,
);
</script>

<style scoped>
.carta {
  position: relative;
  width: clamp(54px, 17.5vw, 72px);
  aspect-ratio: 64 / 94;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1.5px solid var(--carta-borda);
  background: var(--carta-fundo);
  color: var(--carta-preta);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
  font-weight: 800;
  transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 160ms;
  touch-action: manipulation;
  padding: 0;
}
.carta.vermelha {
  color: var(--carta-vermelha);
}
.carta.selecionada {
  transform: translateY(-16px);
  box-shadow: 0 0 0 3px var(--destaque), 0 10px 18px rgba(0, 0, 0, 0.45);
}
.carta.desabilitada {
  opacity: 1;
  cursor: default;
}
.carta:not(.desabilitada):active {
  transform: translateY(-8px) scale(0.98);
}
.canto {
  position: absolute;
  top: 5px;
  left: 6px;
  font-size: 14px;
  line-height: 1;
  text-align: center;
}
.canto.inferior {
  top: auto;
  left: auto;
  bottom: 5px;
  right: 6px;
  transform: rotate(180deg);
}
.centro {
  font-size: 32px;
}
.carta.burro {
  background: linear-gradient(160deg, #fff3cf, #f5d98b);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.emoji {
  font-size: 30px;
}
.texto-burro {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #7a5200;
}
.carta.pequena {
  width: 40px;
  border-radius: 6px;
}
.carta.pequena .centro {
  font-size: 20px;
}
.carta.pequena .canto {
  font-size: 10px;
}
.carta.pequena .emoji {
  font-size: 18px;
}
.carta.pequena .texto-burro {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .carta {
    transition: none;
  }
}
</style>

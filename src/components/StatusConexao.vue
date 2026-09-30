<template>
  <ion-chip class="status" :style="{ '--color': CORES[info.cor] }" role="status">
    <ion-spinner v-if="info.girando" name="dots" />
    <ion-icon v-else :icon="info.icone" />
    <ion-label>{{ info.texto }}</ion-label>
  </ion-chip>
</template>

<script setup lang="ts">
import { IonChip, IonIcon, IonLabel, IonSpinner } from '@ionic/vue';
import { bluetooth, cloudOfflineOutline, flask, radioOutline, warningOutline } from 'ionicons/icons';
import { computed } from 'vue';
import type { ConexaoSessao, Modo } from '@/stores/sessao';

const CORES: Record<string, string> = {
  tertiary: '#5b3fd6',
  warning: '#9a6200',
  success: '#1d6b47',
  medium: '#555',
  danger: '#c0392b',
};

const props = defineProps<{ conexao: ConexaoSessao; modo: Modo; pausada?: boolean }>();

const info = computed(() => {
  if (props.modo === 'demo') return { cor: 'tertiary', icone: flask, texto: 'Demonstração', girando: false };
  if (props.pausada) return { cor: 'warning', icone: warningOutline, texto: 'Pausada', girando: false };
  switch (props.conexao) {
    case 'anunciando':
      return { cor: 'success', icone: radioOutline, texto: 'Anunciando', girando: false };
    case 'conectado':
      return { cor: 'success', icone: bluetooth, texto: 'Conectado', girando: false };
    case 'conectando':
      return { cor: 'medium', icone: bluetooth, texto: 'Conectando', girando: true };
    case 'aguardando_aprovacao':
      return { cor: 'medium', icone: bluetooth, texto: 'Aguardando', girando: true };
    case 'reconectando':
      return { cor: 'warning', icone: bluetooth, texto: 'Reconectando', girando: true };
    default:
      return { cor: 'danger', icone: cloudOfflineOutline, texto: 'Desconectado', girando: false };
  }
});
</script>

<style scoped>
.status {
  margin: 0;
  height: 28px;
  font-size: 13px;
  --background: #ffffff;
  font-weight: 600;
}
.status ion-spinner {
  width: 18px;
  height: 18px;
  margin-right: 4px;
}
</style>

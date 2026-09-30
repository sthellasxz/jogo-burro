<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button default-href="/historico" text="" /></ion-buttons>
        <ion-title>Detalhes da partida</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="p" aria-label="Excluir partida" @click="excluir">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div v-if="carregando" class="centro-vazio"><ion-spinner /></div>
      <div v-else-if="!p" class="centro-vazio">Partida não encontrada.</div>

      <div v-else class="largura-maxima">
        <div class="cabeca">
          <span class="emoji">{{ EMOJI[p.resultadoLocal] }}</span>
          <div>
            <ion-badge :color="COR_STATUS[p.status]">{{ p.status }}</ion-badge>
            <h2>{{ ROTULO_RESULTADO[p.resultadoLocal] }}</h2>
          </div>
        </div>

        <ion-list lines="full" class="caixa">
          <ion-item><ion-label>Início</ion-label><ion-note slot="end">{{ dataHora(p.iniciadaEm) }}</ion-note></ion-item>
          <ion-item><ion-label>Término</ion-label><ion-note slot="end">{{ dataHora(p.finalizadaEm) }}</ion-note></ion-item>
          <ion-item><ion-label>Duração</ion-label><ion-note slot="end">{{ duracao(p.iniciadaEm, p.finalizadaEm) }}</ion-note></ion-item>
          <ion-item><ion-label>Encerramento</ion-label><ion-note slot="end">{{ ROTULO_MOTIVO[p.motivo] }}</ion-note></ion-item>
          <ion-item v-if="p.responsavelNome"><ion-label>Responsável</ion-label><ion-note slot="end">{{ p.responsavelNome }}</ion-note></ion-item>
          <ion-item><ion-label>Vencedor</ion-label><ion-note slot="end">{{ p.vencedorNome ?? '—' }}</ion-note></ion-item>
          <ion-item><ion-label>Penalizado (Burro)</ion-label><ion-note slot="end">{{ p.penalizadoNome ?? '—' }}</ion-note></ion-item>
          <ion-item><ion-label>Rodadas (mãos)</ion-label><ion-note slot="end">{{ p.qtdMaos }}</ion-note></ion-item>
          <ion-item><ion-label>Trocas de cartas</ion-label><ion-note slot="end">{{ p.qtdTrocas }}</ion-note></ion-item>
          <ion-item><ion-label>Seu papel</ion-label><ion-note slot="end">{{ p.papel === 'anfitriao' ? 'Anfitrião' : 'Convidado' }}{{ p.modo === 'demo' ? ' (demonstração)' : '' }}</ion-note></ion-item>
        </ion-list>

        <h3>Participantes (ordem da mesa)</h3>
        <ion-list lines="full" class="caixa">
          <ion-item v-for="j in p.participantes" :key="j.jogadorId">
            <ion-avatar slot="start" class="avatar">{{ j.ordem + 1 }}</ion-avatar>
            <ion-label>
              {{ j.nome }}<span v-if="j.jogadorId === p.jogadorLocalId" class="voce"> (você)</span>
              <p>{{ j.maosVencidas }} mão(s) vencida(s){{ j.anfitriao ? ' · anfitrião' : '' }}</p>
            </ion-label>
            <letras-burro slot="end" :letras="j.letras" />
          </ion-item>
        </ion-list>

        <template v-if="p.maos.length">
          <h3>Resultado final — mão a mão</h3>
          <ion-list lines="full" class="caixa">
            <ion-item v-for="m in p.maos" :key="m.numero">
              <ion-label>
                Mão {{ m.numero }}: <strong>{{ nome(m.vencedorId) }}</strong> completou quatro {{ m.valor }}
                <p>Letra para {{ nome(m.penalizadoId) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonAvatar,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import { trashOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import LetrasBurro from '@/components/LetrasBurro.vue';
import { historico, type RegistroPartida } from '@/storage';
import { confirmar } from '@/ui/avisos';
import { COR_STATUS, EMOJI, ROTULO_MOTIVO, ROTULO_RESULTADO, dataHora, duracao } from './formatacao';

const props = defineProps<{ id: string }>();
const router = useIonRouter();
const p = ref<RegistroPartida | null>(null);
const carregando = ref(true);

onMounted(async () => {
  p.value = await historico().buscar(props.id);
  carregando.value = false;
});

function nome(id: string): string {
  return p.value?.participantes.find((j) => j.jogadorId === id)?.nome ?? '—';
}

async function excluir() {
  if (!p.value) return;
  if (!(await confirmar('Excluir partida?', 'Ela será removida do histórico.', 'Excluir'))) return;
  await historico().excluir(p.value.id);
  router.navigate('/historico', 'back', 'replace');
}
</script>

<style scoped>
.cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.cabeca h2 {
  margin: 4px 0 0;
}
.cabeca h2::first-letter {
  text-transform: uppercase;
}
ion-item ion-note[slot='end'] {
  font-size: 14px;
  color: var(--ion-text-color);
}
.emoji {
  font-size: 44px;
}
h3 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ion-color-medium);
  margin: 20px 0 8px;
}
.caixa {
  border-radius: 12px;
  overflow: hidden;
}
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-primary);
  color: #fff;
  font-weight: 800;
  width: 30px;
  height: 30px;
}
.voce {
  color: var(--ion-color-medium);
}
</style>

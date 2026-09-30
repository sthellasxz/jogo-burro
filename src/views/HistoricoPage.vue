<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button default-href="/" text="" /></ion-buttons>
        <ion-title>Histórico</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="!partidas.length" aria-label="Exportar histórico" @click="exportar">
            <ion-icon slot="icon-only" :icon="downloadOutline" />
          </ion-button>
          <ion-button :disabled="!partidas.length" aria-label="Limpar histórico" @click="limpar">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="carregando" class="centro-vazio"><ion-spinner /></div>

      <div v-else-if="!partidas.length" class="centro-vazio">
        <ion-icon :icon="timeOutline" class="grande" />
        <strong>Nenhuma partida ainda</strong>
        <span>As partidas finalizadas, canceladas ou interrompidas aparecem aqui.</span>
      </div>

      <ion-list v-else class="largura-maxima">
        <resumo-historico :partidas="partidas" />
        <ion-item-sliding v-for="p in partidas" :key="p.id">
          <ion-item button :detail="true" :router-link="`/historico/${p.id}`">
            <div slot="start" class="emoji" aria-hidden="true">{{ EMOJI[p.resultadoLocal] }}</div>
            <ion-label>
              <h3>{{ dataHora(p.iniciadaEm) }}</h3>
              <p>{{ p.participantes.map((j) => j.nome).join(', ') }}</p>
              <p>
                <span v-if="p.vencedorNome">🏆 {{ p.vencedorNome }}</span>
                <span v-if="p.penalizadoNome"> · 🐴 {{ p.penalizadoNome }}</span>
              </p>
            </ion-label>
            <div slot="end" class="fim">
              <ion-badge :color="COR_STATUS[p.status]">{{ p.status }}</ion-badge>
              <ion-note>{{ p.participantes.length }} jog. · {{ ROTULO_RESULTADO[p.resultadoLocal] }}</ion-note>
            </div>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" @click="excluir(p)">
              <ion-icon slot="icon-only" :icon="trashOutline" aria-label="Excluir" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
        <p class="dica">Deslize uma partida para a esquerda para excluí-la.</p>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
} from '@ionic/vue';
import { downloadOutline, timeOutline, trashOutline } from 'ionicons/icons';
import { ref } from 'vue';
import ResumoHistorico from '@/components/ResumoHistorico.vue';
import { exportarHistorico, historico, type RegistroPartida } from '@/storage';
import { confirmar, erro, mostrarAviso } from '@/ui/avisos';
import { COR_STATUS, EMOJI, ROTULO_RESULTADO, dataHora } from './formatacao';

const partidas = ref<RegistroPartida[]>([]);
const carregando = ref(true);

async function carregar() {
  carregando.value = true;
  try {
    partidas.value = await historico().listar();
  } catch (e) {
    await erro(`Erro ao ler o histórico: ${(e as Error).message}`);
  } finally {
    carregando.value = false;
  }
}

onIonViewWillEnter(carregar);

async function excluir(p: RegistroPartida) {
  if (!(await confirmar('Excluir partida?', `A partida de ${dataHora(p.iniciadaEm)} será apagada.`, 'Excluir'))) return;
  await historico().excluir(p.id);
  await carregar();
  await mostrarAviso({ texto: 'Partida excluída', tipo: 'sucesso' });
}

async function limpar() {
  const ok = await confirmar('Limpar todo o histórico?', `${partidas.value.length} partida(s) serão apagadas. Não dá para desfazer.`, 'Apagar tudo');
  if (!ok) return;
  await historico().limpar();
  await carregar();
  await mostrarAviso({ texto: 'Histórico apagado', tipo: 'sucesso' });
}

async function exportar() {
  try {
    const onde = await exportarHistorico(partidas.value);
    await mostrarAviso({ texto: `Exportado para ${onde}`, tipo: 'sucesso' });
  } catch (e) {
    await erro(`Falha ao exportar: ${(e as Error).message}`);
  }
}
</script>

<style scoped>
.grande {
  font-size: 56px;
  color: var(--ion-color-primary);
}
.emoji {
  font-size: 26px;
  margin-right: 12px;
}
.fim {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 12px;
}
.dica {
  text-align: center;
  font-size: 12px;
  color: var(--ion-color-medium);
}
</style>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button default-href="/partida" text="" /></ion-buttons>
        <ion-title>Conexão Bluetooth</ion-title>
        <ion-buttons slot="end">
          <status-conexao :conexao="sessao.conexao" modo="bluetooth" class="ion-margin-end" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="largura-maxima">
        <ion-note v-if="sessao.mensagemErro" color="danger" class="erro" role="alert">
          <ion-icon :icon="alertCircleOutline" />
          <span>{{ sessao.mensagemErro }}</span>
        </ion-note>
        <ion-button v-if="sessao.mensagemErro" fill="outline" size="small" @click="abrirConfiguracoesApp">
          Abrir configurações do app
        </ion-button>

        <div v-if="aguardando" class="centro-vazio">
          <ion-spinner />
          <strong>{{ sessao.conexao === 'conectando' ? 'Conectando…' : 'Aguardando o anfitrião aceitar…' }}</strong>
          <ion-button fill="clear" color="medium" @click="cancelar">Cancelar</ion-button>
        </div>

        <template v-else>
          <div class="cabecalho">
            <h2>Partidas próximas</h2>
            <ion-button size="small" :fill="sessao.procurando ? 'outline' : 'solid'" @click="alternarProcura">
              <ion-spinner v-if="sessao.procurando" name="dots" slot="start" />
              {{ sessao.procurando ? 'Parar' : 'Procurar' }}
            </ion-button>
          </div>

          <ion-list v-if="sessao.salasEncontradas.length" lines="full" class="lista">
            <ion-item
              v-for="s in sessao.salasEncontradas"
              :key="s.deviceId"
              button
              :detail="true"
              :disabled="s.emAndamento || s.jogadores >= s.maxJogadores"
              @click="sessao.entrar(s)"
            >
              <ion-icon slot="start" :icon="peopleOutline" color="primary" />
              <ion-label>
                <h3>Partida de {{ s.nomeAnfitriao }}</h3>
                <p>
                  {{ s.jogadores }}/{{ s.maxJogadores }} jogadores ·
                  {{ s.emAndamento ? 'em andamento' : 'aguardando jogadores' }}
                </p>
              </ion-label>
              <ion-note slot="end">{{ sinal(s.rssi) }}</ion-note>
            </ion-item>
          </ion-list>

          <div v-else class="centro-vazio">
            <ion-icon :icon="bluetoothOutline" class="grande" />
            <p v-if="sessao.procurando">Procurando partidas… Peça para o anfitrião tocar em “Criar partida”.</p>
            <p v-else>Toque em Procurar para encontrar partidas próximas.</p>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
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
  onIonViewDidEnter,
  onIonViewWillLeave,
} from '@ionic/vue';
import { alertCircleOutline, bluetoothOutline, peopleOutline } from 'ionicons/icons';
import { computed } from 'vue';
import StatusConexao from '@/components/StatusConexao.vue';
import { useSessaoStore } from '@/stores/sessao';
import { abrirConfiguracoesApp } from '@/transport/ble/bluetooth';

const sessao = useSessaoStore();
const aguardando = computed(
  () => sessao.papel === 'convidado' && ['conectando', 'aguardando_aprovacao'].includes(sessao.conexao),
);

onIonViewDidEnter(() => {
  if (!sessao.papel) sessao.iniciarProcura();
});
onIonViewWillLeave(() => sessao.pararProcura());

function alternarProcura() {
  if (sessao.procurando) sessao.pararProcura();
  else sessao.iniciarProcura();
}

async function cancelar() {
  await sessao.sair();
  sessao.iniciarProcura();
}

function sinal(rssi: number | null): string {
  if (rssi === null) return '';
  if (rssi > -60) return 'sinal forte';
  if (rssi > -80) return 'sinal médio';
  return 'sinal fraco';
}
</script>

<style scoped>
.erro {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  margin-bottom: 8px;
}
.cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cabecalho h2 {
  font-size: 18px;
}
.lista {
  border-radius: 12px;
  overflow: hidden;
}
.grande {
  font-size: 56px;
  color: var(--ion-color-primary);
}
</style>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-button aria-label="Sair da sala" @click="sair"><ion-icon slot="icon-only" :icon="exitOutline" /></ion-button>
        </ion-buttons>
        <ion-title>Sala de espera</ion-title>
        <ion-buttons slot="end">
          <status-conexao :conexao="sessao.conexao" :modo="sessao.modo" class="ion-margin-end" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="largura-maxima">
        <p class="topo">
          Partida de <strong>{{ sessao.sala?.nomeAnfitriao }}</strong> ·
          {{ jogadores.length }}/{{ sessao.sala?.maxJogadores ?? 6 }} jogadores
        </p>

        <template v-if="sessao.ehAnfitriao && sessao.pendentes.length">
          <h2>Pedidos para entrar</h2>
          <ion-list lines="full" class="caixa">
            <ion-item v-for="p in sessao.pendentes" :key="p.deviceId">
              <ion-icon slot="start" :icon="personAddOutline" color="warning" />
              <ion-label>{{ p.nome }}</ion-label>
              <ion-button slot="end" color="danger" fill="clear" @click="sessao.recusar(p.deviceId)">Recusar</ion-button>
              <ion-button slot="end" color="success" @click="sessao.aceitar(p.deviceId)">Aceitar</ion-button>
            </ion-item>
          </ion-list>
        </template>

        <h2>Jogadores na mesa</h2>
        <ion-list lines="full" class="caixa">
          <ion-item v-for="(j, i) in jogadores" :key="j.id">
            <ion-avatar slot="start" class="avatar">{{ i + 1 }}</ion-avatar>
            <ion-label>
              {{ j.nome }} <span v-if="j.id === perfil.id" class="voce">(você)</span>
            </ion-label>
            <ion-badge v-if="j.anfitriao" slot="end" color="secondary">anfitrião</ion-badge>
          </ion-item>
        </ion-list>
        <p class="dica">A carta sempre vai para o jogador de baixo; o último passa para o primeiro.</p>

        <div v-if="sessao.ehAnfitriao" class="acoes">
          <p v-if="sessao.modo === 'bluetooth'" class="dica">
            <ion-icon :icon="radioOutline" /> Seu celular está anunciando a partida. Peça aos amigos para tocarem
            em “Procurar partida”.
          </p>
          <p v-else class="dica">Os bots vão pedir para entrar em instantes. Aceite ou recuse cada um.</p>
          <ion-button expand="block" size="large" :disabled="jogadores.length < 2" @click="sessao.iniciarPartida()">
            Iniciar partida
          </ion-button>
          <ion-note v-if="jogadores.length < 2">São necessários pelo menos 2 jogadores.</ion-note>
        </div>
        <div v-else class="centro-vazio">
          <ion-spinner name="dots" />
          Aguardando o anfitrião iniciar a partida…
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonAvatar,
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
import { exitOutline, personAddOutline, radioOutline } from 'ionicons/icons';
import { computed } from 'vue';
import StatusConexao from '@/components/StatusConexao.vue';
import { usePerfilStore } from '@/stores/perfil';
import { useSessaoStore } from '@/stores/sessao';
import { confirmar } from '@/ui/avisos';

const sessao = useSessaoStore();
const perfil = usePerfilStore();
const router = useIonRouter();
const jogadores = computed(() => sessao.sala?.jogadores ?? []);

async function sair() {
  const texto = sessao.ehAnfitriao
    ? 'A sala será fechada e todos os jogadores serão desconectados.'
    : 'Você sairá desta sala de espera.';
  if (!(await confirmar('Sair da sala?', texto, 'Sair'))) return;
  await sessao.sair();
  router.navigate('/partida', 'back', 'replace');
}
</script>

<style scoped>
.topo {
  margin-top: 0;
}
h2 {
  font-size: 16px;
  margin: 20px 0 8px;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  width: 32px;
  height: 32px;
}
.voce {
  color: var(--ion-color-medium);
}
.acoes {
  margin-top: 16px;
}
.dica {
  font-size: 13px;
  color: var(--ion-color-medium);
}
</style>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button default-href="/" text="" /></ion-buttons>
        <ion-title>Nova partida</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="largura-maxima">
        <p class="ola">Jogando como <strong>{{ perfil.nome }}</strong></p>

        <ion-note v-if="!bluetoothOk" color="warning" class="aviso">
          <ion-icon :icon="informationCircleOutline" />
          Bluetooth só funciona no app Android instalado. No navegador, use o modo demonstração.
        </ion-note>

        <ion-card button :disabled="!bluetoothOk || sessao.carregando" @click="criar">
          <ion-card-header>
            <ion-icon :icon="radioOutline" class="icone" color="primary" />
            <ion-card-title>Criar partida</ion-card-title>
            <ion-card-subtitle>Você será o anfitrião</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            Seu celular anuncia a partida via Bluetooth. Você aceita ou recusa quem pedir para entrar e inicia
            quando houver pelo menos 2 jogadores.
          </ion-card-content>
        </ion-card>

        <ion-card button :disabled="!bluetoothOk" router-link="/bluetooth">
          <ion-card-header>
            <ion-icon :icon="searchOutline" class="icone" color="primary" />
            <ion-card-title>Procurar partida</ion-card-title>
            <ion-card-subtitle>Entrar como convidado</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>Encontre partidas abertas por celulares próximos e peça para entrar.</ion-card-content>
        </ion-card>

        <ion-card>
          <ion-card-header>
            <ion-icon :icon="flaskOutline" class="icone" color="tertiary" />
            <ion-card-title>Modo demonstração</ion-card-title>
            <ion-card-subtitle>Sem Bluetooth, contra bots</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <p>Os bots usam o mesmo protocolo de mensagens do Bluetooth. Bom para testar e aprender.</p>
            <ion-segment v-model="qtdBots" class="bots" aria-label="Quantidade de bots">
              <ion-segment-button v-for="n in 5" :key="n" :value="n">
                <ion-label>{{ n }}</ion-label>
              </ion-segment-button>
            </ion-segment>
            <ion-button expand="block" color="tertiary" :disabled="sessao.carregando" @click="demo">
              Jogar contra {{ qtdBots }} bot{{ qtdBots > 1 ? 's' : '' }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <div v-if="sessao.carregando" class="centro-vazio">
          <ion-spinner />
          Preparando Bluetooth…
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { flaskOutline, informationCircleOutline, radioOutline, searchOutline } from 'ionicons/icons';
import { ref } from 'vue';
import { usePerfilStore } from '@/stores/perfil';
import { useSessaoStore } from '@/stores/sessao';
import { bluetoothNativoDisponivel } from '@/transport/ble/bluetooth';

const perfil = usePerfilStore();
const sessao = useSessaoStore();
const bluetoothOk = bluetoothNativoDisponivel();
const qtdBots = ref(2);

function criar() {
  sessao.criarPartida('bluetooth');
}

function demo() {
  sessao.criarPartida('demo', Number(qtdBots.value));
}
</script>

<style scoped>
.ola {
  margin-top: 0;
}
.aviso {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(var(--ion-color-warning-rgb), 0.12);
  margin-bottom: 8px;
  font-size: 14px;
}
ion-card {
  margin-left: 0;
  margin-right: 0;
}
.icone {
  font-size: 28px;
  margin-bottom: 4px;
}
.bots {
  margin: 12px 0;
}
</style>

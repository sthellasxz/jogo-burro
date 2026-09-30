<template>
  <ion-page>
    <ion-content class="mesa" :fullscreen="true">
      <div class="inicio">
        <div class="leque" aria-hidden="true">
          <span class="c c1">A<br />♠</span>
          <span class="c c2">🐴</span>
          <span class="c c3 v">A<br />♥</span>
        </div>
        <h1 class="titulo-jogo">BURRO</h1>
        <p class="sub">O jogo de cartas por Bluetooth. Sem internet, só com os amigos por perto.</p>

        <p v-if="perfil.identificado" class="ola">
          Olá, <strong>{{ perfil.nome }}</strong>
          <ion-button fill="clear" size="small" color="light" router-link="/identificacao">trocar</ion-button>
        </p>

        <div class="acoes">
          <ion-button expand="block" color="secondary" size="large" @click="jogar">
            <ion-icon slot="start" :icon="play" /> Jogar
          </ion-button>
          <ion-button expand="block" fill="outline" color="light" router-link="/historico">
            <ion-icon slot="start" :icon="timeOutline" /> Histórico de partidas
          </ion-button>
          <ion-button expand="block" fill="clear" color="light" @click="regrasAbertas = true">
            <ion-icon slot="start" :icon="helpCircleOutline" /> Como jogar
          </ion-button>
        </div>
      </div>

      <ion-modal :is-open="regrasAbertas" @did-dismiss="regrasAbertas = false">
        <ion-header>
          <ion-toolbar color="primary">
            <ion-title>Como jogar</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="regrasAbertas = false">Fechar</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding regras">
          <h2>Objetivo</h2>
          <p>Juntar <strong>quatro cartas do mesmo valor</strong> (ex.: quatro Reis) antes de todo mundo.</p>
          <h2>A rodada</h2>
          <ol>
            <li>Cada jogador recebe 4 cartas. Quem começa recebe 5.</li>
            <li>Quem está na vez (com 5 cartas) escolhe uma e envia para o próximo jogador da mesa.</li>
            <li>O próximo fica com 5 cartas e passa a ser a vez dele. E assim a carta gira.</li>
            <li>A carta <strong>🐴 Burro</strong> não forma grupo: passe-a adiante!</li>
          </ol>
          <h2>Completou? Bata!</h2>
          <p>
            Quando formar quatro iguais, toque em <strong>COMPLETEI</strong>. Todos os outros têm 6 segundos
            para tocar em <strong>BATER</strong>. O último a bater leva uma letra de <strong>B-U-R-R-O</strong>.
          </p>
          <h2>Fim da partida</h2>
          <p>
            Quem completar a palavra BURRO perde a partida. Vence quem tiver menos letras (empate: quem venceu
            mais mãos).
          </p>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import { helpCircleOutline, play, timeOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { usePerfilStore } from '@/stores/perfil';

const perfil = usePerfilStore();
const router = useIonRouter();
const regrasAbertas = ref(false);

onMounted(() => perfil.carregar());

function jogar() {
  router.push(perfil.identificado ? '/partida' : '/identificacao?voltar=/partida');
}
</script>

<style scoped>
.inicio {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px calc(32px + env(safe-area-inset-bottom));
  text-align: center;
  max-width: 420px;
  margin: 0 auto;
}
.leque {
  position: relative;
  width: 160px;
  height: 120px;
  margin-bottom: 8px;
}
.c {
  position: absolute;
  left: 50%;
  top: 8px;
  width: 64px;
  height: 94px;
  margin-left: -32px;
  border-radius: 9px;
  background: var(--carta-fundo);
  border: 1.5px solid var(--carta-borda);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
  color: var(--carta-preta);
  font-weight: 900;
  font-size: 20px;
  line-height: 1.1;
  padding-top: 18px;
  transform-origin: 50% 110%;
}
.c.v {
  color: var(--carta-vermelha);
}
.c1 {
  transform: rotate(-18deg);
}
.c2 {
  font-size: 34px;
  padding-top: 26px;
  background: linear-gradient(160deg, #fff3cf, #f5d98b);
  transform: translateY(-10px);
  z-index: 3;
}
.c3 {
  transform: rotate(18deg);
  z-index: 2;
}
h1 {
  font-size: 52px;
  margin: 8px 0 4px;
  color: var(--destaque);
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.35);
}
.sub {
  opacity: 0.85;
  margin: 0 0 20px;
}
.ola {
  margin: 0 0 12px;
}
.acoes {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.regras h2 {
  font-size: 18px;
  margin-top: 20px;
  color: var(--ion-color-primary);
}
.regras li {
  margin-bottom: 6px;
}
</style>

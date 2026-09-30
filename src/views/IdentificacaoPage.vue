<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button default-href="/" text="" /></ion-buttons>
        <ion-title>Identificação</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form class="largura-maxima" @submit.prevent="salvar">
        <p>Como os outros jogadores vão ver você na mesa?</p>
        <ion-input
          v-model="nome"
          label="Seu nome"
          label-placement="floating"
          fill="outline"
          :maxlength="20"
          :counter="true"
          autocapitalize="words"
          :error-text="erro ?? undefined"
          :class="{ 'ion-invalid ion-touched': erro }"
          @ion-input="erro = null"
        />
        <p class="dica">
          Seu identificador neste aparelho: <code>{{ perfil.id.slice(0, 8) || '…' }}</code>. Ele é gerado
          automaticamente e salvo em arquivo local, junto com o nome.
        </p>
        <ion-button expand="block" :disabled="salvando" @click="salvar">Continuar</ion-button>
      </form>
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
  IonInput,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { usePerfilStore } from '@/stores/perfil';

const perfil = usePerfilStore();
const router = useIonRouter();
const route = useRoute();
const nome = ref('');
const erro = ref<string | null>(null);
const salvando = ref(false);

onMounted(async () => {
  await perfil.carregar();
  nome.value = perfil.nome;
});

async function salvar() {
  salvando.value = true;
  try {
    await perfil.definirNome(nome.value);
    const voltar = typeof route.query.voltar === 'string' ? route.query.voltar : '/partida';
    router.replace(voltar);
  } catch (e) {
    erro.value = (e as Error).message;
  } finally {
    salvando.value = false;
  }
}
</script>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.dica {
  font-size: 13px;
  color: var(--ion-color-medium);
  margin: 0;
}
</style>

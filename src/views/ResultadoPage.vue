<template>
  <ion-page>
    <ion-content class="mesa">
      <div class="resultado largura-maxima">
        <template v-if="r">
          <div class="emoji" aria-hidden="true">{{ emoji }}</div>
          <h1>{{ titulo }}</h1>
          <p class="texto">{{ textoResultado(r, v) }}</p>

          <ol v-if="v" class="placar">
            <li v-for="j in ranking" :key="j.id" :class="{ eu: j.id === v.meuId, burro: j.id === r.penalizadoId }">
              <span class="nome">{{ j.nome }}<span v-if="j.id === v.meuId"> (você)</span></span>
              <letras-burro :letras="j.letras" />
              <span class="maos">{{ j.maosVencidas }} mão(s)</span>
            </li>
          </ol>
          <p v-if="v" class="meta">{{ v.mao }} mão(s) · {{ v.totalTrocas }} trocas de cartas</p>
          <p v-if="sessao.registroId" class="meta"><ion-icon :icon="saveOutline" /> Salvo no histórico</p>
        </template>

        <div class="acoes">
          <ion-button v-if="podeNovaPartida" expand="block" color="secondary" size="large" @click="sessao.novaPartida()">
            Nova partida com a mesma sala
          </ion-button>
          <p v-else-if="aguardandoAnfitriao" class="meta">Aguarde: o anfitrião pode iniciar uma nova partida.</p>
          <ion-button v-if="sessao.registroId" expand="block" fill="outline" color="light" @click="verDetalhes">
            Ver detalhes da partida
          </ion-button>
          <ion-button expand="block" fill="clear" color="light" @click="inicio">Voltar ao início</ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/vue';
import { saveOutline } from 'ionicons/icons';
import { computed } from 'vue';
import LetrasBurro from '@/components/LetrasBurro.vue';
import { textoResultado } from '@/session/descrever';
import { useSessaoStore } from '@/stores/sessao';

const sessao = useSessaoStore();
const router = useIonRouter();
const r = computed(() => sessao.resultado);
const v = computed(() => sessao.visao);

const ranking = computed(() =>
  [...(v.value?.jogadores ?? [])].sort(
    (a, b) => a.letras - b.letras || b.maosVencidas - a.maosVencidas || a.ordem - b.ordem,
  ),
);

const emoji = computed(() => {
  if (!r.value || r.value.status !== 'finalizada') return '⚠️';
  if (r.value.vencedorId === v.value?.meuId) return '🏆';
  if (r.value.penalizadoId === v.value?.meuId) return '🐴';
  return '🃏';
});

const titulo = computed(() => {
  if (!r.value) return '';
  if (r.value.status === 'cancelada') return 'Partida cancelada';
  if (r.value.status === 'interrompida') return 'Partida interrompida';
  if (r.value.vencedorId === v.value?.meuId) return 'Você venceu!';
  if (r.value.penalizadoId === v.value?.meuId) return 'Você é o BURRO!';
  return 'Fim de partida';
});

const conectado = computed(() => sessao.conexao === 'conectado' || sessao.conexao === 'anunciando');
const podeNovaPartida = computed(() => sessao.ehAnfitriao && conectado.value);
const aguardandoAnfitriao = computed(() => sessao.papel === 'convidado' && conectado.value);

function verDetalhes() {
  router.push(`/historico/${sessao.registroId}`);
}

async function inicio() {
  await sessao.sair();
  router.navigate('/', 'root', 'replace');
}
</script>

<style scoped>
.resultado {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
  text-align: center;
}
.emoji {
  font-size: 72px;
}
h1 {
  font-size: 32px;
  font-weight: 900;
  margin: 8px 0;
  color: var(--destaque);
}
.texto {
  opacity: 0.9;
}
.placar {
  list-style: none;
  padding: 0;
  margin: 16px 0 8px;
  text-align: left;
}
.placar li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 6px;
}
.placar li.eu {
  outline: 2px solid var(--destaque);
}
.placar li.burro {
  background: rgba(229, 72, 77, 0.25);
}
.nome {
  font-weight: 700;
}
.maos,
.meta {
  font-size: 13px;
  opacity: 0.8;
}
.acoes {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>

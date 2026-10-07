<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-button aria-label="Sair da partida" @click="sair"><ion-icon slot="icon-only" :icon="exitOutline" /></ion-button>
        </ion-buttons>
        <ion-title>Mão {{ v?.mao ?? 1 }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="sessao.modo === 'demo' && sessao.ehAnfitriao" aria-label="Testes de conexão" @click="testesConexao">
            <ion-icon slot="icon-only" :icon="bugOutline" />
          </ion-button>
          <status-conexao :conexao="sessao.conexao" :modo="sessao.modo" :pausada="v?.pausada" class="ion-margin-end" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="mesa" :scroll-y="false">
      <div v-if="v" class="jogo">
        <!-- Jogadores na ordem da mesa -->
        <ul class="adversarios" aria-label="Jogadores">
          <li
            v-for="j in v.jogadores"
            :key="j.id"
            class="jogador"
            :class="{ vez: j.id === v.vez, eu: j.id === v.meuId, off: !j.conectado, bateu: j.bateu }"
          >
            <span class="nome">
              <ion-icon v-if="!j.conectado" :icon="cloudOfflineOutline" aria-label="desconectado" />
              <ion-icon v-else-if="j.bateu" :icon="handLeftOutline" aria-label="bateu" />
              {{ j.id === v.meuId ? 'Você' : j.nome }}
            </span>
            <span class="detalhe">
              <span class="qtd" :aria-label="`${j.qtdCartas} cartas`"><ion-icon :icon="albumsOutline" /> {{ j.qtdCartas }}</span>
              <letras-burro :letras="j.letras" />
            </span>
          </li>
        </ul>

        <!-- Situação atual -->
        <section class="painel" :class="{ minha: minhaVez && !v.pausada }" aria-live="polite">
          <template v-if="v.pausada">
            <ion-spinner name="dots" />
            <strong>Partida pausada</strong>
            <span>Aguardando {{ desconectados }} reconectar…</span>
          </template>
          <template v-else-if="v.fase === 'jogando'">
            <strong>{{ minhaVez ? 'SUA VEZ!' : `Vez de ${nomeDe(v, v.vez)}` }}</strong>
            <span v-if="minhaVez">Escolha uma carta para enviar a {{ nomeDe(v, v.enviaPara) }}</span>
            <span v-else>Você recebe de {{ nomeDe(v, v.recebeDe) }} e envia para {{ nomeDe(v, v.enviaPara) }}</span>
          </template>
          <template v-else-if="v.fase === 'batendo' && v.batida">
            <strong>{{ v.batida.vencedorId === v.meuId ? 'Você completou!' : `${nomeDe(v, v.batida.vencedorId)} completou!` }}</strong>
            <span>Quatro {{ v.batida.valor }} — último a bater leva uma letra ({{ segundos }}s)</span>
          </template>
          <template v-else-if="v.fase === 'fim_mao' && ultimaMao">
            <strong>
              {{ ultimaMao.penalizadoId === v.meuId ? 'Você levou uma letra!' : `${nomeDe(v, ultimaMao.penalizadoId)} levou uma letra` }}
            </strong>
            <span>{{ nomeDe(v, ultimaMao.vencedorId) }} venceu a mão com quatro {{ ultimaMao.valor }}</span>
          </template>
        </section>

        <!-- Ações -->
        <div class="acoes">
          <ion-button
            v-if="podeCompletar"
            class="completei"
            color="secondary"
            size="large"
            expand="block"
            @click="sessao.completar()"
          >
            🐴 COMPLETEI!
          </ion-button>
          <ion-button
            v-else-if="podeBater"
            class="bater"
            color="danger"
            size="large"
            expand="block"
            @click="sessao.bater()"
          >
            ✋ BATER!
          </ion-button>
          <template v-else-if="v.fase === 'fim_mao'">
            <ion-button v-if="sessao.ehAnfitriao" expand="block" color="secondary" :disabled="v.pausada" @click="sessao.proximaMao()">
              Distribuir próxima mão
            </ion-button>
            <p v-else class="espera">Aguardando o anfitrião distribuir a próxima mão…</p>
          </template>
          <ion-button
            v-else-if="minhaVez && !v.pausada"
            expand="block"
            color="light"
            :disabled="!selecionada"
            @click="enviar"
          >
            <ion-icon slot="start" :icon="arrowForwardCircleOutline" />
            {{ selecionada ? `Enviar para ${nomeDe(v, v.enviaPara)}` : 'Toque em uma carta' }}
          </ion-button>
          <ion-button v-if="minhaVez && !v.pausada" fill="clear" color="light" size="small" expand="block" @click="darDica">
            💡 Dica: qual carta passar?
          </ion-button>
        </div>

        <!-- Minha mão -->
        <div class="mao" aria-label="Suas cartas">
          <carta-baralho
            v-for="c in v.minhaMao"
            :key="c.id"
            :carta="c"
            :selecionada="c.id === selecionada"
            :desabilitada="!minhaVez || v.pausada || v.fase !== 'jogando'"
            @escolher="escolher"
          />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  actionSheetController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/vue';
import {
  albumsOutline,
  arrowForwardCircleOutline,
  bugOutline,
  cloudOfflineOutline,
  exitOutline,
  handLeftOutline,
} from 'ionicons/icons';
import { computed, onUnmounted, ref, watch } from 'vue';
import CartaBaralho from '@/components/CartaBaralho.vue';
import LetrasBurro from '@/components/LetrasBurro.vue';
import StatusConexao from '@/components/StatusConexao.vue';
import { grupoCompleto, sugerirCarta } from '@/game';
import { nomeDe } from '@/session/descrever';
import { useSessaoStore } from '@/stores/sessao';
import { confirmar } from '@/ui/avisos';

const sessao = useSessaoStore();
const router = useIonRouter();
const v = computed(() => sessao.visao);
const selecionada = ref<string | null>(null);
const agora = ref(Date.now());
const relogio = setInterval(() => (agora.value = Date.now()), 250);
onUnmounted(() => clearInterval(relogio));

const minhaVez = computed(() => v.value?.fase === 'jogando' && v.value.vez === v.value.meuId);
const podeCompletar = computed(
  () => v.value?.fase === 'jogando' && !v.value.pausada && grupoCompleto(v.value.minhaMao) !== null,
);
const podeBater = computed(
  () => v.value?.fase === 'batendo' && !v.value.pausada && !v.value.batida?.ordem.includes(v.value.meuId),
);
const segundos = computed(() => Math.max(0, Math.ceil(((v.value?.batida?.prazo ?? 0) - agora.value) / 1000)));
const ultimaMao = computed(() => v.value?.historicoMaos[v.value.historicoMaos.length - 1] ?? null);
const desconectados = computed(
  () =>
    v.value?.jogadores
      .filter((j) => !j.conectado)
      .map((j) => j.nome)
      .join(', ') ?? '',
);

// A carta selecionada some da mão quando é enviada: limpa a seleção.
watch(
  () => v.value?.minhaMao.map((c) => c.id).join(),
  () => {
    if (selecionada.value && !v.value?.minhaMao.some((c) => c.id === selecionada.value)) selecionada.value = null;
  },
);

/** Seleciona a carta sugerida pela dica (o jogador ainda precisa confirmar o envio). */
function darDica() {
  const carta = sugerirCarta(v.value?.minhaMao ?? []);
  if (carta) selecionada.value = carta.id;
}

function escolher(id: string) {
  selecionada.value = selecionada.value === id ? null : id;
}

async function enviar() {
  if (!selecionada.value) return;
  const id = selecionada.value;
  selecionada.value = null;
  await sessao.jogar(id);
}

async function sair() {
  const texto = sessao.ehAnfitriao
    ? 'A partida será cancelada para todos os jogadores.'
    : 'Você vai abandonar a partida e ela será interrompida para todos.';
  if (!(await confirmar('Sair da partida?', texto, 'Sair'))) return;
  await sessao.sair();
  router.navigate('/', 'back', 'replace');
}

/** Modo demonstração: simula perda de conexão de um bot (teste de desconexão/reconexão). */
async function testesConexao() {
  const bots = sessao.botsDemo;
  const sheet = await actionSheetController.create({
    header: 'Testes de conexão (demo)',
    buttons: [
      ...bots.map((b) => ({ text: `${b.nome}: cair e voltar em 4s`, handler: () => sessao.simularQueda(b.deviceId, true) })),
      ...bots.map((b) => ({ text: `${b.nome}: cair sem voltar`, role: 'destructive', handler: () => sessao.simularQueda(b.deviceId, false) })),
      { text: 'Fechar', role: 'cancel' },
    ],
  });
  await sheet.present();
}
</script>

<style scoped>
.jogo {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom));
  gap: 10px;
  max-width: 560px;
  margin: 0 auto;
}
.adversarios {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 6px;
}
.jogador {
  background: rgba(0, 0, 0, 0.22);
  border: 2px solid transparent;
  border-radius: 10px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  transition: border-color 200ms, background 200ms;
}
.jogador.vez {
  border-color: var(--destaque);
  background: rgba(255, 209, 102, 0.18);
}
.jogador.eu .nome {
  color: var(--destaque);
}
.jogador.off {
  opacity: 0.55;
}
.nome {
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
}
.detalhe {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.qtd {
  opacity: 0.8;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.painel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 6px;
  border-radius: 16px;
  border: 2px dashed rgba(255, 255, 255, 0.18);
  padding: 12px;
  min-height: 110px;
}
.painel strong {
  font-size: 22px;
  letter-spacing: 0.02em;
}
.painel.minha {
  border: 2px solid var(--destaque);
  background: rgba(255, 209, 102, 0.1);
}
.painel.minha strong {
  color: var(--destaque);
}
.acoes {
  min-height: 52px;
}
.espera {
  text-align: center;
  margin: 12px 0;
  opacity: 0.85;
}
.completei,
.bater {
  font-weight: 900;
  font-size: 20px;
  animation: pulsar 900ms ease-in-out infinite;
}
@keyframes pulsar {
  50% {
    transform: scale(1.03);
  }
}
@media (prefers-reduced-motion: reduce) {
  .completei,
  .bater {
    animation: none;
  }
}
.mao {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding-top: 18px;
  flex-wrap: nowrap;
}
</style>

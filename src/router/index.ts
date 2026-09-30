import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router';
import { usePerfilStore } from '@/stores/perfil';
import { useSessaoStore } from '@/stores/sessao';
import HomePage from '@/views/HomePage.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', component: HomePage },
  { path: '/identificacao', component: () => import('@/views/IdentificacaoPage.vue') },
  { path: '/partida', component: () => import('@/views/PartidaPage.vue'), meta: { precisaNome: true } },
  { path: '/bluetooth', component: () => import('@/views/BluetoothPage.vue'), meta: { precisaNome: true } },
  { path: '/sala', component: () => import('@/views/SalaPage.vue'), meta: { precisaSessao: true } },
  { path: '/jogo', component: () => import('@/views/JogoPage.vue'), meta: { precisaSessao: true } },
  { path: '/resultado', component: () => import('@/views/ResultadoPage.vue') },
  { path: '/historico', component: () => import('@/views/HistoricoPage.vue') },
  { path: '/historico/:id', component: () => import('@/views/DetalhePartidaPage.vue'), props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to: RouteLocationNormalized) => {
  const perfil = usePerfilStore();
  await perfil.carregar();
  if (to.meta.precisaNome && !perfil.identificado) {
    return { path: '/identificacao', query: { voltar: to.fullPath } };
  }
  if (to.meta.precisaSessao && !useSessaoStore().emSessao) return '/partida';
  return true;
});

export default router;

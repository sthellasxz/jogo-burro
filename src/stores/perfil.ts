import { defineStore } from 'pinia';
import { carregarPerfil, salvarPerfil } from '@/storage';

function gerarId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Nome e identificador único do jogador, salvos em arquivo local (perfil.json). */
export const usePerfilStore = defineStore('perfil', {
  state: () => ({ id: '', nome: '', carregado: false }),
  getters: {
    identificado: (s) => s.nome.trim().length > 0,
  },
  actions: {
    async carregar() {
      if (this.carregado) return;
      const p = await carregarPerfil();
      this.id = p?.id ?? gerarId();
      this.nome = p?.nome ?? '';
      this.carregado = true;
    },
    async definirNome(nome: string) {
      const limpo = nome.trim().replace(/\s+/g, ' ').slice(0, 20);
      if (limpo.length < 2) throw new Error('O nome precisa ter pelo menos 2 letras');
      if (!this.id) this.id = gerarId();
      this.nome = limpo;
      await salvarPerfil({ id: this.id, nome: this.nome });
    },
  },
});

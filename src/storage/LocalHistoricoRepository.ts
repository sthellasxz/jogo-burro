import type { HistoricoRepository, RegistroPartida } from './types';

const CHAVE = 'burro.historico.v1';

/**
 * Histórico no navegador (localStorage). Usado apenas no modo web/demonstração,
 * onde o SQLite nativo não existe. Mesma interface do repositório SQLite.
 */
export class LocalHistoricoRepository implements HistoricoRepository {
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {}

  private ler(): RegistroPartida[] {
    try {
      const dados = JSON.parse(this.storage.getItem(CHAVE) ?? '[]');
      return Array.isArray(dados) ? dados : [];
    } catch {
      return [];
    }
  }

  private gravar(lista: RegistroPartida[]): void {
    this.storage.setItem(CHAVE, JSON.stringify(lista));
  }

  async salvar(r: RegistroPartida): Promise<void> {
    this.gravar([r, ...this.ler().filter((x) => x.id !== r.id)]);
  }

  async listar(): Promise<RegistroPartida[]> {
    return this.ler().sort((a, b) => b.iniciadaEm - a.iniciadaEm);
  }

  async buscar(id: string): Promise<RegistroPartida | null> {
    return this.ler().find((x) => x.id === id) ?? null;
  }

  async excluir(id: string): Promise<void> {
    this.gravar(this.ler().filter((x) => x.id !== id));
  }

  async limpar(): Promise<void> {
    this.storage.removeItem(CHAVE);
  }
}

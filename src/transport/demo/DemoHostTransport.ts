import { escolherCartaParaPassar, grupoCompleto, type VisaoJogador } from '@/game';
import { criarMensagem, type MensagemCliente } from '@/protocol/messages';
import { validarMensagemHost } from '@/protocol/validation';
import { Emissor, type AnuncioSala, type HostTransport, type HostTransportEvents } from '../types';

const LATENCIA_MS = 60;
const NOMES_BOTS = ['Bot Zé', 'Bot Ana', 'Bot Lia', 'Bot Téo', 'Bot Bia'];

/**
 * Transporte simulado para o modo demonstração: os "dispositivos" são bots
 * que conversam com o anfitrião usando exatamente o mesmo protocolo JSON do Bluetooth.
 * Serve para testar no navegador e para demonstrar o fluxo sem dois celulares.
 */
export class DemoHostTransport implements HostTransport {
  private eventos = new Emissor<HostTransportEvents>();
  private bots = new Map<string, BotCliente>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private ativo = false;

  constructor(private qtdBots: number) {}

  on<E extends keyof HostTransportEvents>(evento: E, fn: HostTransportEvents[E]): void {
    this.eventos.on(evento, fn);
  }

  async iniciar(_anuncio: AnuncioSala): Promise<void> {
    this.ativo = true;
    for (let i = 0; i < this.qtdBots; i++) {
      this.agendar(() => this.conectarBot(new BotCliente(NOMES_BOTS[i % NOMES_BOTS.length], this)), 700 * (i + 1));
    }
  }

  async atualizarAnuncio(): Promise<void> {}

  async parar(): Promise<void> {
    this.ativo = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.bots.forEach((b) => b.destruir());
    this.bots.clear();
  }

  async enviar(deviceId: string, texto: string): Promise<void> {
    const bot = this.bots.get(deviceId);
    if (bot) this.agendar(() => bot.receber(texto), LATENCIA_MS);
  }

  async desconectar(deviceId: string): Promise<void> {
    const bot = this.bots.get(deviceId);
    if (!bot) return;
    bot.destruir();
    this.bots.delete(deviceId);
    this.agendar(() => this.eventos.emitir('desconectado', deviceId), LATENCIA_MS);
  }

  /** Lista de bots conectados (para os botões de teste de desconexão). */
  listarBots(): { deviceId: string; nome: string }[] {
    return [...this.bots.values()].map((b) => ({ deviceId: b.deviceId, nome: b.nome }));
  }

  /** Simula a queda de conexão de um bot, que tenta reconectar após `retornoMs` (null = nunca volta). */
  simularQueda(deviceId: string, retornoMs: number | null = 4000): void {
    const bot = this.bots.get(deviceId);
    if (!bot) return;
    this.bots.delete(deviceId);
    bot.pausar();
    this.eventos.emitir('desconectado', deviceId);
    if (retornoMs !== null) {
      this.agendar(() => {
        bot.novaConexao();
        this.bots.set(bot.deviceId, bot);
        this.eventos.emitir('conectado', bot.deviceId);
        bot.reconectar();
      }, retornoMs);
    }
  }

  /** Chamado pelo bot para "escrever" no anfitrião. */
  entregar(bot: BotCliente, msg: MensagemCliente): void {
    this.agendar(() => {
      if (this.bots.get(bot.deviceId) === bot) this.eventos.emitir('mensagem', bot.deviceId, JSON.stringify(msg));
    }, LATENCIA_MS);
  }

  agendar(fn: () => void, ms: number): void {
    if (!this.ativo) return;
    const t = setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      if (this.ativo) fn();
    }, ms);
    this.timers.push(t);
  }

  private conectarBot(bot: BotCliente): void {
    this.bots.set(bot.deviceId, bot);
    this.eventos.emitir('conectado', bot.deviceId);
    bot.solicitarEntrada();
  }
}

let seqBot = 0;

class BotCliente {
  deviceId = '';
  readonly jogadorId = `bot-${Date.now().toString(36)}-${++seqBot}`;
  private token: string | null = null;
  private ativo = true;
  /** Chave da última situação em que o bot já agiu, para não agir duas vezes. */
  private ultimaAcao = '';

  constructor(
    readonly nome: string,
    private rede: DemoHostTransport,
  ) {
    this.novaConexao();
  }

  novaConexao(): void {
    this.deviceId = `demo:${this.nome}:${Math.random().toString(36).slice(2, 7)}`;
    this.ativo = true;
  }

  pausar(): void {
    this.ativo = false;
  }

  destruir(): void {
    this.ativo = false;
  }

  solicitarEntrada(): void {
    this.enviar(criarMensagem('SOLICITACAO_ENTRADA', this.jogadorId, { nome: this.nome, jogadorId: this.jogadorId }));
  }

  reconectar(): void {
    if (this.token) {
      this.enviar(criarMensagem('RECONEXAO', this.jogadorId, { jogadorId: this.jogadorId, token: this.token }));
    }
  }

  receber(texto: string): void {
    if (!this.ativo) return;
    const v = validarMensagemHost(texto);
    if (!v.ok) return;
    const m = v.mensagem;
    if (m.tipo === 'ENTRADA_ACEITA') this.token = m.dados.token;
    // Jogada recusada pelo anfitrião: permite tentar de novo na próxima atualização.
    if (m.tipo === 'ERRO') this.ultimaAcao = '';
    const visao = 'visao' in m.dados ? m.dados.visao : null;
    if (visao) this.decidir(visao);
  }

  private decidir(v: VisaoJogador): void {
    if (v.pausada) {
      this.ultimaAcao = '';
      return;
    }
    const chave = `${v.mao}:${v.fase}:${v.totalTrocas}`;
    if (chave === this.ultimaAcao) return;

    if (v.fase === 'jogando' && grupoCompleto(v.minhaMao)) {
      this.ultimaAcao = chave;
      this.depois(700 + Math.random() * 1200, () =>
        this.enviar(criarMensagem('JOGADOR_COMPLETOU', this.jogadorId, {})),
      );
    } else if (v.fase === 'jogando' && v.vez === v.meuId && v.minhaMao.length === 5) {
      this.ultimaAcao = chave;
      const carta = escolherCartaParaPassar(v.minhaMao, Math.random);
      this.depois(900 + Math.random() * 900, () =>
        this.enviar(criarMensagem('JOGADA', this.jogadorId, { cartaId: carta.id })),
      );
    } else if (v.fase === 'batendo' && v.batida && !v.batida.ordem.includes(v.meuId)) {
      this.ultimaAcao = chave;
      this.depois(600 + Math.random() * 2600, () => this.enviar(criarMensagem('BATER', this.jogadorId, {})));
    }
  }

  private depois(ms: number, fn: () => void): void {
    this.rede.agendar(() => this.ativo && fn(), ms);
  }

  private enviar(msg: MensagemCliente): void {
    if (this.ativo) this.rede.entregar(this, msg);
  }
}

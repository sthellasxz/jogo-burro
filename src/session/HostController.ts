import {
  MAX_JOGADORES,
  MIN_JOGADORES,
  aplicarAcao,
  criarPartida,
  visaoPara,
  type Acao,
  type EstadoPartida,
  type Evento,
  type ResultadoPartida,
  type VisaoJogador,
} from '@/game';
import {
  criarMensagem,
  novoId,
  type DadosHostParaCliente,
  type InfoSala,
  type JogadorSala,
  type MensagemCliente,
  type MensagemHost,
  type TipoHostParaCliente,
} from '@/protocol/messages';
import { validarMensagemCliente } from '@/protocol/validation';
import type { HostTransport } from '@/transport/types';
import { descreverMensagem, type Aviso } from './descrever';

/** Tempo máximo esperando um jogador desconectado voltar. */
export const TEMPO_RECONEXAO_MS = 45000;

export interface Perfil {
  id: string;
  nome: string;
}

export interface SolicitacaoPendente {
  deviceId: string;
  jogadorId: string;
  nome: string;
}

interface Participante extends JogadorSala {
  deviceId: string | null;
  token: string;
}

export interface HostCallbacks {
  aoAtualizar(): void;
  aoAvisar(aviso: Aviso): void;
  aoFinalizar(resultado: ResultadoPartida, visao: VisaoJogador | null): void;
}

/**
 * Controla a sessão no dispositivo ANFITRIÃO.
 * - mantém a sala de espera e as solicitações de entrada;
 * - é a única fonte da verdade do estado da partida (motor em src/game);
 * - valida toda mensagem recebida e quem a enviou antes de aplicar;
 * - envia para cada convidado apenas a visão dele (só as próprias cartas).
 */
export class HostController {
  participantes: Participante[] = [];
  pendentes: SolicitacaoPendente[] = [];
  estado: EstadoPartida | null = null;

  private porDevice = new Map<string, string>();
  private timerBatida: ReturnType<typeof setTimeout> | null = null;
  private timersReconexao = new Map<string, ReturnType<typeof setTimeout>>();
  private fechado = false;

  constructor(
    private transporte: HostTransport,
    private perfil: Perfil,
    private cb: HostCallbacks,
    private rng: () => number = Math.random,
  ) {
    this.participantes = [{ id: perfil.id, nome: perfil.nome, anfitriao: true, deviceId: null, token: '' }];
    transporte.on('conectado', () => this.cb.aoAtualizar());
    transporte.on('desconectado', (d) => this.aoDesconectar(d));
    transporte.on('mensagem', (d, t) => this.aoReceber(d, t));
  }

  // ---------- Sala de espera ----------

  get sala(): InfoSala {
    return {
      nomeAnfitriao: this.perfil.nome,
      jogadores: this.participantes.map(({ id, nome, anfitriao }) => ({ id, nome, anfitriao })),
      maxJogadores: MAX_JOGADORES,
      emAndamento: this.estado !== null,
    };
  }

  get visao(): VisaoJogador | null {
    return this.estado ? visaoPara(this.estado, this.perfil.id) : null;
  }

  async abrirSala(): Promise<void> {
    await this.transporte.iniciar(this.anuncio());
  }

  aceitar(deviceId: string): void {
    const p = this.pendentes.find((x) => x.deviceId === deviceId);
    if (!p) return;
    this.pendentes = this.pendentes.filter((x) => x !== p);
    if (this.estado || this.participantes.length >= MAX_JOGADORES) {
      this.recusarDispositivo(deviceId, this.estado ? 'A partida já começou' : 'A sala está cheia');
      return;
    }
    const novo: Participante = { id: p.jogadorId, nome: p.nome, anfitriao: false, deviceId, token: novoId() };
    this.participantes.push(novo);
    this.porDevice.set(deviceId, novo.id);
    this.enviar(deviceId, 'ENTRADA_ACEITA', { jogadorId: novo.id, token: novo.token, sala: this.sala });
    const jogador = { id: novo.id, nome: novo.nome, anfitriao: false };
    this.transmitirSala('JOGADOR_ENTROU', { jogador, sala: this.sala }, deviceId);
    this.cb.aoAvisar({ texto: `${novo.nome} entrou na sala`, tipo: 'sucesso' });
    this.atualizarAnuncio();
    this.cb.aoAtualizar();
  }

  recusar(deviceId: string): void {
    this.pendentes = this.pendentes.filter((x) => x.deviceId !== deviceId);
    this.recusarDispositivo(deviceId, 'O anfitrião recusou sua entrada');
    this.cb.aoAtualizar();
  }

  iniciarPartida(): string | null {
    if (this.estado) return 'A partida já começou';
    if (this.participantes.length < MIN_JOGADORES) return `São necessários pelo menos ${MIN_JOGADORES} jogadores`;
    // Quem ainda estava pendente não entra mais.
    for (const p of this.pendentes) this.recusarDispositivo(p.deviceId, 'A partida já começou');
    this.pendentes = [];

    this.estado = criarPartida(novoId(), this.participantes, this.rng, Date.now());
    this.transmitirJogo('PARTIDA_INICIADA', () => ({}));
    this.atualizarAnuncio();
    this.cb.aoAtualizar();
    return null;
  }

  /** Depois do fim, volta todos que continuam conectados para a sala de espera. */
  novaPartida(): void {
    if (!this.estado || this.estado.fase !== 'encerrada') return;
    this.estado = null;
    this.participantes = this.participantes.filter((p) => p.anfitriao || p.deviceId);
    this.transmitirSala('SALA_ATUALIZADA', { sala: this.sala });
    this.atualizarAnuncio();
    this.cb.aoAtualizar();
  }

  // ---------- Ações do jogador local (anfitrião) ----------

  jogar(cartaId: string): string | null {
    return this.aplicar({ tipo: 'PASSAR', jogadorId: this.perfil.id, cartaId });
  }

  completar(): string | null {
    return this.aplicar({ tipo: 'COMPLETAR', jogadorId: this.perfil.id });
  }

  bater(): string | null {
    return this.aplicar({ tipo: 'BATER', jogadorId: this.perfil.id });
  }

  proximaMao(): string | null {
    return this.aplicar({ tipo: 'PROXIMA_MAO' });
  }

  /** Anfitrião sai: na sala, fecha a sala; em jogo, cancela a partida para todos. */
  async encerrar(): Promise<void> {
    if (this.estado && this.estado.fase !== 'encerrada') {
      this.aplicar({ tipo: 'ENCERRAR', motivo: 'cancelada', jogadorId: this.perfil.id });
    } else if (!this.estado) {
      const resultado: ResultadoPartida = {
        status: 'cancelada',
        motivo: 'cancelada',
        vencedorId: null,
        penalizadoId: null,
        responsavelId: this.perfil.id,
      };
      for (const p of this.participantes) {
        if (p.deviceId) this.enviar(p.deviceId, 'PARTIDA_FINALIZADA', { resultado, visao: null });
      }
    }
    await this.fechar();
  }

  async fechar(): Promise<void> {
    if (this.fechado) return;
    this.fechado = true;
    this.limparTimers();
    // Pequena espera para as últimas mensagens saírem antes de derrubar o servidor.
    await new Promise((r) => setTimeout(r, 400));
    await this.transporte.parar().catch(() => undefined);
  }

  // ---------- Recebimento ----------

  private aoReceber(deviceId: string, texto: string): void {
    const v = validarMensagemCliente(texto);
    if (!v.ok) {
      this.enviar(deviceId, 'ERRO', { codigo: 'MENSAGEM_INVALIDA', mensagem: v.erro });
      return;
    }
    const m = v.mensagem;

    if (m.tipo === 'SOLICITACAO_ENTRADA') return this.aoSolicitarEntrada(deviceId, m);
    if (m.tipo === 'RECONEXAO') return this.aoReconectar(deviceId, m);

    // A partir daqui, só jogadores aceitos, e somente em nome de si mesmos.
    const jogadorId = this.porDevice.get(deviceId);
    if (!jogadorId || m.remetente !== jogadorId) {
      this.enviar(deviceId, 'ERRO', { codigo: 'NAO_AUTORIZADO', mensagem: 'Você não faz parte desta partida' });
      return;
    }

    let erro: string | null = null;
    switch (m.tipo) {
      case 'JOGADA':
        erro = this.aplicar({ tipo: 'PASSAR', jogadorId, cartaId: m.dados.cartaId });
        break;
      case 'JOGADOR_COMPLETOU':
        erro = this.aplicar({ tipo: 'COMPLETAR', jogadorId });
        break;
      case 'BATER':
        erro = this.aplicar({ tipo: 'BATER', jogadorId });
        break;
      case 'JOGADOR_SAIU':
        this.saiu(jogadorId, 'abandono');
        break;
    }
    if (erro) this.enviar(deviceId, 'ERRO', { codigo: 'JOGADA_INVALIDA', mensagem: erro });
  }

  private aoSolicitarEntrada(deviceId: string, m: Extract<MensagemCliente, { tipo: 'SOLICITACAO_ENTRADA' }>): void {
    if (this.porDevice.has(deviceId) || this.pendentes.some((p) => p.deviceId === deviceId)) return;
    if (this.estado) return this.recusarDispositivo(deviceId, 'A partida já começou');
    if (this.participantes.length >= MAX_JOGADORES) return this.recusarDispositivo(deviceId, 'A sala está cheia');
    if (this.participantes.some((p) => p.id === m.dados.jogadorId)) {
      return this.recusarDispositivo(deviceId, 'Você já está nesta sala');
    }
    const nome = m.dados.nome.trim().slice(0, 20);
    this.pendentes.push({ deviceId, jogadorId: m.dados.jogadorId, nome });
    this.cb.aoAvisar({ texto: `${nome} quer entrar na partida`, tipo: 'info' });
    this.cb.aoAtualizar();
  }

  private aoReconectar(deviceId: string, m: Extract<MensagemCliente, { tipo: 'RECONEXAO' }>): void {
    const p = this.participantes.find((x) => x.id === m.dados.jogadorId);
    const jogador = this.estado?.jogadores.find((j) => j.id === m.dados.jogadorId);
    if (!p || !jogador || p.token !== m.dados.token || this.estado?.fase === 'encerrada') {
      return this.recusarDispositivo(deviceId, 'Não foi possível reconectar a esta partida');
    }
    if (p.deviceId) this.porDevice.delete(p.deviceId);
    p.deviceId = deviceId;
    this.porDevice.set(deviceId, p.id);
    const timer = this.timersReconexao.get(p.id);
    if (timer) clearTimeout(timer);
    this.timersReconexao.delete(p.id);
    if (!jogador.conectado) {
      this.aplicar({ tipo: 'RECONECTAR', jogadorId: p.id });
    } else {
      this.enviar(deviceId, 'ESTADO', { visao: visaoPara(this.estado!, p.id) });
    }
  }

  private aoDesconectar(deviceId: string): void {
    const pendente = this.pendentes.find((p) => p.deviceId === deviceId);
    if (pendente) {
      this.pendentes = this.pendentes.filter((p) => p !== pendente);
      this.cb.aoAtualizar();
      return;
    }
    const jogadorId = this.porDevice.get(deviceId);
    this.porDevice.delete(deviceId);
    if (!jogadorId) return;
    const p = this.participantes.find((x) => x.id === jogadorId);
    if (p) p.deviceId = null;

    if (!this.estado) {
      this.saiu(jogadorId, 'abandono');
    } else if (this.estado.fase !== 'encerrada') {
      this.aplicar({ tipo: 'DESCONECTAR', jogadorId });
      this.timersReconexao.set(
        jogadorId,
        setTimeout(() => {
          this.timersReconexao.delete(jogadorId);
          this.aplicar({ tipo: 'ENCERRAR', motivo: 'desconexao', jogadorId });
        }, TEMPO_RECONEXAO_MS),
      );
    }
  }

  private saiu(jogadorId: string, motivo: 'abandono'): void {
    if (this.estado) {
      if (this.estado.fase !== 'encerrada') this.aplicar({ tipo: 'ENCERRAR', motivo, jogadorId });
      return;
    }
    const p = this.participantes.find((x) => x.id === jogadorId);
    if (!p) return;
    this.participantes = this.participantes.filter((x) => x !== p);
    if (p.deviceId) {
      this.porDevice.delete(p.deviceId);
      void this.transporte.desconectar(p.deviceId);
    }
    this.transmitirSala('JOGADOR_SAIU', { jogadorId: p.id, nome: p.nome, sala: this.sala });
    this.cb.aoAvisar({ texto: `${p.nome} saiu da sala`, tipo: 'alerta' });
    this.atualizarAnuncio();
    this.cb.aoAtualizar();
  }

  // ---------- Aplicação de ações e sincronização ----------

  private aplicar(acao: Acao): string | null {
    if (!this.estado) return 'A partida ainda não começou';
    const r = aplicarAcao(this.estado, acao, this.rng, Date.now());
    if (!r.ok) return r.erro;
    this.estado = r.estado;
    for (const ev of r.eventos) this.transmitirEvento(ev);
    this.agendarTimers();
    this.cb.aoAtualizar();

    const fim = r.eventos.find((e) => e.tipo === 'PARTIDA_FINALIZADA');
    if (fim && fim.tipo === 'PARTIDA_FINALIZADA') {
      this.limparTimers();
      this.cb.aoFinalizar(fim.resultado, this.visao);
    }
    return null;
  }

  private transmitirEvento(ev: Evento): void {
    switch (ev.tipo) {
      case 'TROCA_REALIZADA':
        return this.transmitirJogo('TROCA_REALIZADA', () => ({ de: ev.de, para: ev.para }));
      case 'JOGADOR_COMPLETOU':
        return this.transmitirJogo('JOGADOR_COMPLETOU', () => ({ jogadorId: ev.jogadorId, valor: ev.valor }));
      case 'BATER':
        return this.transmitirJogo('BATER', () => ({ jogadorId: ev.jogadorId }));
      case 'MAO_FINALIZADA':
        return this.transmitirJogo('MAO_FINALIZADA', () => ({
          vencedorId: ev.resumo.vencedorId,
          penalizadoId: ev.resumo.penalizadoId,
        }));
      case 'NOVA_MAO':
        return this.transmitirJogo('NOVA_MAO', () => ({ numero: ev.numero }));
      case 'JOGADOR_DESCONECTADO':
        return this.transmitirJogo('JOGADOR_DESCONECTADO', () => ({ jogadorId: ev.jogadorId }));
      case 'RECONEXAO':
        return this.transmitirJogo('RECONEXAO', () => ({ jogadorId: ev.jogadorId }));
      case 'PARTIDA_FINALIZADA':
        return this.transmitirJogo('PARTIDA_FINALIZADA', () => ({ resultado: ev.resultado }));
    }
  }

  /**
   * Envia uma mensagem de jogo para cada participante com a visão individual dele.
   * O anfitrião "recebe" a mesma mensagem localmente, apenas para gerar o aviso na tela.
   */
  private transmitirJogo<T extends TipoHostParaCliente>(
    tipo: T,
    dados: () => Omit<DadosHostParaCliente[T], 'visao'>,
  ): void {
    const estado = this.estado!;
    for (const p of this.participantes) {
      const msg = criarMensagem(tipo, this.perfil.id, { ...dados(), visao: visaoPara(estado, p.id) });
      if (p.id === this.perfil.id) {
        const aviso = descreverMensagem(msg as unknown as MensagemHost, this.perfil.id);
        if (aviso) this.cb.aoAvisar(aviso);
      } else if (p.deviceId) {
        void this.transporte.enviar(p.deviceId, JSON.stringify(msg)).catch(() => undefined);
      }
    }
  }

  private transmitirSala<T extends 'JOGADOR_ENTROU' | 'JOGADOR_SAIU' | 'SALA_ATUALIZADA'>(
    tipo: T,
    dados: DadosHostParaCliente[T],
    exceto?: string,
  ): void {
    for (const p of this.participantes) {
      if (p.deviceId && p.deviceId !== exceto) this.enviar(p.deviceId, tipo, dados);
    }
  }

  private enviar<T extends TipoHostParaCliente>(deviceId: string, tipo: T, dados: DadosHostParaCliente[T]): void {
    const msg = criarMensagem(tipo, this.perfil.id, dados);
    void this.transporte.enviar(deviceId, JSON.stringify(msg)).catch(() => undefined);
  }

  private recusarDispositivo(deviceId: string, motivo: string): void {
    this.enviar(deviceId, 'ENTRADA_RECUSADA', { motivo });
    // Dá tempo da mensagem chegar antes de encerrar a conexão.
    setTimeout(() => void this.transporte.desconectar(deviceId), 800);
  }

  private anuncio() {
    return {
      nomeAnfitriao: this.perfil.nome,
      jogadores: this.participantes.length,
      maxJogadores: MAX_JOGADORES,
      emAndamento: this.estado !== null,
    };
  }

  private atualizarAnuncio(): void {
    if (!this.fechado) void this.transporte.atualizarAnuncio(this.anuncio()).catch(() => undefined);
  }

  private agendarTimers(): void {
    if (this.timerBatida) clearTimeout(this.timerBatida);
    this.timerBatida = null;
    const e = this.estado;
    if (e?.fase === 'batendo' && e.batida && e.jogadores.every((j) => j.conectado)) {
      const espera = Math.max(0, e.batida.prazo - Date.now()) + 50;
      this.timerBatida = setTimeout(() => this.aplicar({ tipo: 'TEMPO_ESGOTADO' }), espera);
    }
  }

  private limparTimers(): void {
    if (this.timerBatida) clearTimeout(this.timerBatida);
    this.timerBatida = null;
    this.timersReconexao.forEach(clearTimeout);
    this.timersReconexao.clear();
  }
}

import { grupoCompleto, type ResultadoPartida, type VisaoJogador } from '@/game';
import {
  criarMensagem,
  type DadosClienteParaHost,
  type InfoSala,
  type MensagemHost,
  type TipoClienteParaHost,
} from '@/protocol/messages';
import { validarMensagemHost } from '@/protocol/validation';
import type { ClientTransport, SalaEncontrada } from '@/transport/types';
import { descreverMensagem, type Aviso } from './descrever';
import { TEMPO_RECONEXAO_MS, type Perfil } from './HostController';

export type EstadoConexao =
  | 'desconectado'
  | 'conectando'
  | 'aguardando_aprovacao'
  | 'conectado'
  | 'reconectando';

export interface ClientCallbacks {
  aoAtualizar(): void;
  aoAvisar(aviso: Aviso): void;
  aoAceito(): void;
  aoRecusado(motivo: string): void;
  aoNovaSala(): void;
  aoIniciar(): void;
  aoFinalizar(resultado: ResultadoPartida, visao: VisaoJogador | null): void;
  aoPerderConexao(mensagem: string): void;
}

const INTERVALO_RECONEXAO_MS = 3000;

/**
 * Controla a sessão no dispositivo CONVIDADO.
 * Valida as mensagens do anfitrião, pré-valida as próprias jogadas
 * (para dar resposta imediata) e tenta reconectar se a conexão cair.
 */
export class ClientController {
  conexao: EstadoConexao = 'desconectado';
  sala: InfoSala | null = null;
  visao: VisaoJogador | null = null;

  private hostDeviceId: string | null = null;
  private token: string | null = null;
  private encerrado = false;
  private cancelarReconexao: (() => void) | null = null;

  constructor(
    private transporte: ClientTransport,
    private perfil: Perfil,
    private cb: ClientCallbacks,
  ) {
    transporte.on('mensagem', (t) => this.aoReceber(t));
    transporte.on('desconectado', () => void this.aoDesconectar());
  }

  procurar(aoEncontrar: (s: SalaEncontrada) => void): Promise<void> {
    return this.transporte.procurar(aoEncontrar);
  }

  pararProcura(): Promise<void> {
    return this.transporte.pararProcura().catch(() => undefined);
  }

  async entrar(sala: SalaEncontrada): Promise<void> {
    await this.pararProcura();
    this.mudar('conectando');
    try {
      await this.transporte.conectar(sala.deviceId);
    } catch (e) {
      this.mudar('desconectado');
      throw new Error(`Não foi possível conectar a ${sala.nomeAnfitriao}: ${(e as Error).message ?? e}`);
    }
    this.hostDeviceId = sala.deviceId;
    this.encerrado = false;
    this.mudar('aguardando_aprovacao');
    await this.enviar('SOLICITACAO_ENTRADA', { nome: this.perfil.nome, jogadorId: this.perfil.id });
  }

  // ---------- Jogadas (pré-validadas localmente) ----------

  async jogar(cartaId: string): Promise<string | null> {
    const v = this.visao;
    if (!v || v.fase !== 'jogando') return 'Não é momento de passar cartas';
    if (v.pausada) return 'Partida pausada: aguardando reconexão';
    if (v.vez !== v.meuId) return 'Não é a sua vez';
    if (!v.minhaMao.some((c) => c.id === cartaId)) return 'Essa carta não está na sua mão';
    return this.enviarJogada('JOGADA', { cartaId });
  }

  async completar(): Promise<string | null> {
    const v = this.visao;
    if (!v || v.fase !== 'jogando' || !grupoCompleto(v.minhaMao)) return 'Você ainda não tem quatro cartas iguais';
    return this.enviarJogada('JOGADOR_COMPLETOU', {});
  }

  async bater(): Promise<string | null> {
    const v = this.visao;
    if (!v || v.fase !== 'batendo') return 'Ninguém completou ainda';
    return this.enviarJogada('BATER', {});
  }

  async sair(): Promise<void> {
    this.encerrado = true;
    this.cancelarReconexao?.();
    if (this.conexao === 'conectado' || this.conexao === 'aguardando_aprovacao') {
      await this.enviar('JOGADOR_SAIU', {}).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 300));
    }
    await this.transporte.desconectar().catch(() => undefined);
    this.mudar('desconectado');
  }

  // ---------- Recebimento ----------

  private aoReceber(texto: string): void {
    const v = validarMensagemHost(texto);
    if (!v.ok) {
      console.warn('[burro] mensagem descartada:', v.erro);
      return;
    }
    const m = v.mensagem;
    // Uma visão destinada a outro jogador indica erro de roteamento: ignora.
    if ('visao' in m.dados && m.dados.visao && m.dados.visao.meuId !== this.perfil.id) return;

    switch (m.tipo) {
      case 'ENTRADA_ACEITA':
        this.token = m.dados.token;
        this.sala = m.dados.sala;
        this.mudar('conectado');
        this.cb.aoAceito();
        return;
      case 'ENTRADA_RECUSADA':
        this.encerrado = true;
        this.mudar('desconectado');
        void this.transporte.desconectar();
        this.cb.aoRecusado(m.dados.motivo);
        return;
      case 'JOGADOR_ENTROU':
      case 'JOGADOR_SAIU':
        this.sala = m.dados.sala;
        break;
      case 'SALA_ATUALIZADA':
        this.sala = m.dados.sala;
        this.visao = null;
        this.cb.aoNovaSala();
        break;
      case 'PARTIDA_INICIADA':
        this.visao = m.dados.visao;
        this.cb.aoIniciar();
        break;
      case 'PARTIDA_FINALIZADA':
        this.visao = m.dados.visao ?? this.visao;
        this.cb.aoFinalizar(m.dados.resultado, m.dados.visao);
        if (!m.dados.visao) {
          // Sala fechada antes de começar.
          this.encerrado = true;
          void this.transporte.desconectar();
          this.mudar('desconectado');
        }
        break;
      case 'RECONEXAO':
      case 'ESTADO':
        if (m.dados.visao) this.visao = m.dados.visao;
        if (this.conexao === 'reconectando' && m.dados.visao) {
          this.cancelarReconexao?.();
          this.mudar('conectado');
          if (m.tipo === 'ESTADO' || m.dados.jogadorId === this.perfil.id) {
            this.cb.aoAvisar({ texto: 'Reconectado à partida!', tipo: 'sucesso' });
          }
        }
        break;
      default:
        if ('visao' in m.dados && m.dados.visao) this.visao = m.dados.visao;
    }
    this.avisar(m);
    this.cb.aoAtualizar();
  }

  private avisar(m: MensagemHost): void {
    if (m.tipo === 'RECONEXAO' && m.dados.jogadorId === this.perfil.id) return;
    const aviso = descreverMensagem(m, this.perfil.id);
    if (aviso) this.cb.aoAvisar(aviso);
  }

  private async aoDesconectar(): Promise<void> {
    if (this.encerrado || this.conexao === 'reconectando') return;
    const emJogo = this.visao && this.visao.fase !== 'encerrada';
    if (!emJogo || !this.token || !this.hostDeviceId) {
      this.mudar('desconectado');
      this.cb.aoPerderConexao('A conexão com o anfitrião foi perdida.');
      return;
    }
    await this.tentarReconectar();
  }

  /** Tenta reconectar ao mesmo anfitrião a cada 3 s, por até 45 s. */
  private async tentarReconectar(): Promise<void> {
    this.mudar('reconectando');
    this.cb.aoAvisar({ texto: 'Conexão perdida. Tentando reconectar…', tipo: 'alerta' });
    let cancelado = false;
    this.cancelarReconexao = () => {
      cancelado = true;
    };
    const limite = Date.now() + TEMPO_RECONEXAO_MS;

    while (!cancelado && Date.now() < limite) {
      try {
        await this.transporte.conectar(this.hostDeviceId!);
        await this.enviar('RECONEXAO', { jogadorId: this.perfil.id, token: this.token! });
        // A confirmação chega como mensagem RECONEXAO/ESTADO; espera um pouco por ela.
        await new Promise((r) => setTimeout(r, INTERVALO_RECONEXAO_MS));
        if (this.conexao === 'conectado') return;
      } catch {
        await new Promise((r) => setTimeout(r, INTERVALO_RECONEXAO_MS));
      }
    }
    if (cancelado || this.conexao === 'conectado') return;

    this.encerrado = true;
    this.mudar('desconectado');
    const resultado: ResultadoPartida = {
      status: 'interrompida',
      motivo: 'desconexao',
      vencedorId: null,
      penalizadoId: null,
      responsavelId: null,
    };
    this.cb.aoFinalizar(resultado, this.visao);
    this.cb.aoPerderConexao('Não foi possível reconectar ao anfitrião. A partida foi interrompida.');
  }

  private async enviarJogada<T extends TipoClienteParaHost>(
    tipo: T,
    dados: DadosClienteParaHost[T],
  ): Promise<string | null> {
    if (this.conexao !== 'conectado') return 'Sem conexão com o anfitrião';
    try {
      await this.enviar(tipo, dados);
      return null;
    } catch (e) {
      return `Falha ao enviar: ${(e as Error).message ?? e}`;
    }
  }

  private enviar<T extends TipoClienteParaHost>(tipo: T, dados: DadosClienteParaHost[T]): Promise<void> {
    return this.transporte.enviar(JSON.stringify(criarMensagem(tipo, this.perfil.id, dados)));
  }

  private mudar(c: EstadoConexao): void {
    this.conexao = c;
    this.cb.aoAtualizar();
  }
}

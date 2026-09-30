import type { ResultadoPartida, VisaoJogador } from '@/game/types';

/**
 * Protocolo de mensagens trocadas via Bluetooth.
 * Toda mensagem é um JSON com envelope fixo:
 *   { v: 1, tipo: "JOGADA", id: "…", remetente: "…", ts: 1700000000000, dados: { … } }
 * Ver docs/PROTOCOLO.md.
 */

export const VERSAO_PROTOCOLO = 1;

/** Informações da sala de espera (antes do início da partida). */
export interface JogadorSala {
  id: string;
  nome: string;
  anfitriao: boolean;
}
export interface InfoSala {
  nomeAnfitriao: string;
  jogadores: JogadorSala[];
  maxJogadores: number;
  emAndamento: boolean;
}

/** Mensagens enviadas pelo convidado para o anfitrião. */
export interface DadosClienteParaHost {
  SOLICITACAO_ENTRADA: { nome: string; jogadorId: string };
  RECONEXAO: { jogadorId: string; token: string };
  JOGADA: { cartaId: string };
  JOGADOR_COMPLETOU: Record<string, never>;
  BATER: Record<string, never>;
  JOGADOR_SAIU: Record<string, never>;
}

/** Mensagens enviadas pelo anfitrião para cada convidado. */
export interface DadosHostParaCliente {
  ENTRADA_ACEITA: { jogadorId: string; token: string; sala: InfoSala };
  ENTRADA_RECUSADA: { motivo: string };
  JOGADOR_ENTROU: { jogador: JogadorSala; sala: InfoSala };
  JOGADOR_SAIU: { jogadorId: string; nome: string; sala: InfoSala };
  /** Nova partida com a mesma sala, após o fim da anterior. */
  SALA_ATUALIZADA: { sala: InfoSala };
  PARTIDA_INICIADA: { visao: VisaoJogador };
  TROCA_REALIZADA: { de: string; para: string; visao: VisaoJogador };
  JOGADOR_COMPLETOU: { jogadorId: string; valor: string; visao: VisaoJogador };
  BATER: { jogadorId: string; visao: VisaoJogador };
  MAO_FINALIZADA: { vencedorId: string; penalizadoId: string; visao: VisaoJogador };
  NOVA_MAO: { numero: number; visao: VisaoJogador };
  JOGADOR_DESCONECTADO: { jogadorId: string; visao?: VisaoJogador; sala?: InfoSala };
  RECONEXAO: { jogadorId: string; visao: VisaoJogador };
  ESTADO: { visao: VisaoJogador };
  PARTIDA_FINALIZADA: { resultado: ResultadoPartida; visao: VisaoJogador | null };
  ERRO: { codigo: string; mensagem: string };
}

export type TipoClienteParaHost = keyof DadosClienteParaHost;
export type TipoHostParaCliente = keyof DadosHostParaCliente;

export interface Envelope<T extends string, D> {
  v: typeof VERSAO_PROTOCOLO;
  tipo: T;
  id: string;
  remetente: string;
  ts: number;
  dados: D;
}

export type MensagemCliente = {
  [K in TipoClienteParaHost]: Envelope<K, DadosClienteParaHost[K]>;
}[TipoClienteParaHost];

export type MensagemHost = {
  [K in TipoHostParaCliente]: Envelope<K, DadosHostParaCliente[K]>;
}[TipoHostParaCliente];

let contador = 0;
export function novoId(): string {
  contador = (contador + 1) % 1_000_000;
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}${contador.toString(36)}${aleatorio}`;
}

export function criarMensagem<T extends string, D>(tipo: T, remetente: string, dados: D): Envelope<T, D> {
  return { v: VERSAO_PROTOCOLO, tipo, id: novoId(), remetente, ts: Date.now(), dados };
}

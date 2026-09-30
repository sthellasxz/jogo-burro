/**
 * Tipos centrais do jogo Burro.
 * Este módulo não depende de Vue, Ionic nem Capacitor: é lógica pura.
 */

export const NAIPES = ['copas', 'ouros', 'espadas', 'paus'] as const;
export type Naipe = (typeof NAIPES)[number];

/** Valores usados no baralho, na ordem em que entram conforme o nº de jogadores. */
export const VALORES = ['A', 'K', 'Q', 'J', '10', '9'] as const;
export type Valor = (typeof VALORES)[number];

/** A carta extra "Burro" (curinga morto): nunca forma grupo. */
export const VALOR_BURRO = 'BURRO' as const;

export interface Carta {
  id: string;
  valor: Valor | typeof VALOR_BURRO;
  naipe: Naipe | null;
}

export const PALAVRA_PENALIDADE = 'BURRO';
export const MAX_LETRAS = PALAVRA_PENALIDADE.length;
export const MIN_JOGADORES = 2;
export const MAX_JOGADORES = 6;
export const CARTAS_POR_JOGADOR = 4;
/** Tempo (ms) que os outros jogadores têm para "bater" depois que alguém completa. */
export const TEMPO_BATIDA_MS = 6000;

export interface Jogador {
  id: string;
  nome: string;
  /** Posição na mesa (0 = anfitrião). A carta sempre vai para ordem + 1. */
  ordem: number;
  anfitriao: boolean;
  /** Quantidade de letras de B-U-R-R-O acumuladas. */
  letras: number;
  maosVencidas: number;
  conectado: boolean;
}

/**
 * lobby     → sala de espera
 * jogando   → jogadores passam cartas em turnos
 * batendo   → alguém completou; os demais precisam bater
 * fim_mao   → mão encerrada, aguardando o anfitrião iniciar a próxima
 * encerrada → partida terminou
 */
export type Fase = 'lobby' | 'jogando' | 'batendo' | 'fim_mao' | 'encerrada';

export type StatusPartida = 'finalizada' | 'cancelada' | 'interrompida';
export type MotivoEncerramento = 'vitoria' | 'cancelada' | 'abandono' | 'desconexao';

export interface Batida {
  vencedorId: string;
  valor: Valor;
  /** Ordem em que os jogadores bateram (o vencedor é o primeiro). */
  ordem: string[];
  prazo: number;
}

export interface ResumoMao {
  numero: number;
  vencedorId: string;
  penalizadoId: string;
  valor: Valor;
}

export interface ResultadoPartida {
  status: StatusPartida;
  motivo: MotivoEncerramento;
  vencedorId: string | null;
  penalizadoId: string | null;
  /** Jogador que abandonou ou desconectou, se houver. */
  responsavelId: string | null;
}

/** Estado completo da partida. Existe apenas no dispositivo anfitrião. */
export interface EstadoPartida {
  id: string;
  jogadores: Jogador[];
  maos: Record<string, Carta[]>;
  fase: Fase;
  vez: string | null;
  mao: number;
  totalTrocas: number;
  batida: Batida | null;
  historicoMaos: ResumoMao[];
  resultado: ResultadoPartida | null;
  iniciadaEm: number;
  finalizadaEm: number | null;
}

/** Dados públicos de um jogador, sem as cartas. */
export interface JogadorPublico extends Jogador {
  qtdCartas: number;
  bateu: boolean;
}

/** O que cada dispositivo recebe: estado público + somente a própria mão. */
export interface VisaoJogador {
  partidaId: string;
  meuId: string;
  fase: Fase;
  pausada: boolean;
  vez: string | null;
  mao: number;
  totalTrocas: number;
  jogadores: JogadorPublico[];
  minhaMao: Carta[];
  recebeDe: string;
  enviaPara: string;
  batida: Batida | null;
  historicoMaos: ResumoMao[];
  resultado: ResultadoPartida | null;
  iniciadaEm: number;
  finalizadaEm: number | null;
}

export type Acao =
  | { tipo: 'PASSAR'; jogadorId: string; cartaId: string }
  | { tipo: 'COMPLETAR'; jogadorId: string }
  | { tipo: 'BATER'; jogadorId: string }
  | { tipo: 'TEMPO_ESGOTADO' }
  | { tipo: 'PROXIMA_MAO' }
  | { tipo: 'DESCONECTAR'; jogadorId: string }
  | { tipo: 'RECONECTAR'; jogadorId: string }
  | { tipo: 'ENCERRAR'; motivo: Exclude<MotivoEncerramento, 'vitoria'>; jogadorId: string | null };

export type Evento =
  | { tipo: 'TROCA_REALIZADA'; de: string; para: string }
  | { tipo: 'JOGADOR_COMPLETOU'; jogadorId: string; valor: Valor }
  | { tipo: 'BATER'; jogadorId: string }
  | { tipo: 'MAO_FINALIZADA'; resumo: ResumoMao }
  | { tipo: 'NOVA_MAO'; numero: number }
  | { tipo: 'JOGADOR_DESCONECTADO'; jogadorId: string }
  | { tipo: 'RECONEXAO'; jogadorId: string }
  | { tipo: 'PARTIDA_FINALIZADA'; resultado: ResultadoPartida };

export type ResultadoAcao =
  | { ok: true; estado: EstadoPartida; eventos: Evento[] }
  | { ok: false; erro: string };

/** Gerador de números aleatórios em [0, 1). Injetável para testes determinísticos. */
export type Rng = () => number;

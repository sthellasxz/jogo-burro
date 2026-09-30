import type { MotivoEncerramento, ResumoMao, StatusPartida } from '@/game/types';

export type ResultadoLocal = 'vitoria' | 'burro' | 'neutro' | 'sem_resultado';

export interface ParticipanteRegistro {
  jogadorId: string;
  nome: string;
  ordem: number;
  letras: number;
  maosVencidas: number;
  anfitriao: boolean;
}

/** Uma partida gravada no histórico local. */
export interface RegistroPartida {
  id: string;
  iniciadaEm: number;
  finalizadaEm: number;
  status: StatusPartida;
  motivo: MotivoEncerramento;
  papel: 'anfitriao' | 'convidado';
  modo: 'bluetooth' | 'demo';
  participantes: ParticipanteRegistro[];
  vencedorNome: string | null;
  penalizadoNome: string | null;
  responsavelNome: string | null;
  qtdMaos: number;
  qtdTrocas: number;
  jogadorLocalId: string;
  resultadoLocal: ResultadoLocal;
  maos: ResumoMao[];
}

export interface HistoricoRepository {
  salvar(registro: RegistroPartida): Promise<void>;
  listar(): Promise<RegistroPartida[]>;
  buscar(id: string): Promise<RegistroPartida | null>;
  excluir(id: string): Promise<void>;
  limpar(): Promise<void>;
}

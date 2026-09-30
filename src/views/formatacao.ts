import type { MotivoEncerramento, StatusPartida } from '@/game/types';
import type { ResultadoLocal } from '@/storage';

export const EMOJI: Record<ResultadoLocal, string> = {
  vitoria: '🏆',
  burro: '🐴',
  neutro: '🃏',
  sem_resultado: '⚠️',
};

export const ROTULO_RESULTADO: Record<ResultadoLocal, string> = {
  vitoria: 'você venceu',
  burro: 'você foi o burro',
  neutro: 'participou',
  sem_resultado: 'sem resultado',
};

export const COR_STATUS: Record<StatusPartida, string> = {
  finalizada: 'success',
  cancelada: 'medium',
  interrompida: 'warning',
};

export const ROTULO_MOTIVO: Record<MotivoEncerramento, string> = {
  vitoria: 'Vitória',
  cancelada: 'Cancelada',
  abandono: 'Abandono de jogador',
  desconexao: 'Desconexão',
};

const formato = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function dataHora(ms: number): string {
  return formato.format(new Date(ms));
}

export function duracao(inicio: number, fim: number): string {
  const min = Math.max(0, Math.round((fim - inicio) / 60000));
  return min < 1 ? 'menos de 1 min' : `${min} min`;
}

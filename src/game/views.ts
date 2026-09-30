import { estaPausada, jogadorAnterior, proximoJogador } from './engine';
import type { EstadoPartida, VisaoJogador } from './types';

/**
 * Projeta o estado completo para um jogador específico.
 * Só a mão do próprio jogador é incluída: as cartas dos adversários
 * nunca saem do anfitrião (apenas a quantidade de cartas).
 */
export function visaoPara(estado: EstadoPartida, jogadorId: string): VisaoJogador {
  return {
    partidaId: estado.id,
    meuId: jogadorId,
    fase: estado.fase,
    pausada: estaPausada(estado),
    vez: estado.vez,
    mao: estado.mao,
    totalTrocas: estado.totalTrocas,
    jogadores: estado.jogadores.map((j) => ({
      ...j,
      qtdCartas: estado.maos[j.id]?.length ?? 0,
      bateu: estado.batida?.ordem.includes(j.id) ?? false,
    })),
    minhaMao: [...(estado.maos[jogadorId] ?? [])],
    recebeDe: jogadorAnterior(estado, jogadorId).id,
    enviaPara: proximoJogador(estado, jogadorId).id,
    batida: estado.batida,
    historicoMaos: estado.historicoMaos,
    resultado: estado.resultado,
    iniciadaEm: estado.iniciadaEm,
    finalizadaEm: estado.finalizadaEm,
  };
}

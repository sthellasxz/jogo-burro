import type { ResultadoPartida, VisaoJogador } from '@/game/types';
import type { RegistroPartida, ResultadoLocal } from './types';

/** Converte o final de uma partida (visão local + resultado) em registro de histórico. */
export function montarRegistro(
  visao: VisaoJogador,
  resultado: ResultadoPartida,
  papel: RegistroPartida['papel'],
  modo: RegistroPartida['modo'],
  agora = Date.now(),
): RegistroPartida {
  const nome = (id: string | null) => (id ? (visao.jogadores.find((j) => j.id === id)?.nome ?? null) : null);

  let resultadoLocal: ResultadoLocal = 'sem_resultado';
  if (resultado.status === 'finalizada') {
    if (resultado.vencedorId === visao.meuId) resultadoLocal = 'vitoria';
    else if (resultado.penalizadoId === visao.meuId) resultadoLocal = 'burro';
    else resultadoLocal = 'neutro';
  }

  return {
    id: visao.partidaId,
    iniciadaEm: visao.iniciadaEm,
    finalizadaEm: visao.finalizadaEm ?? agora,
    status: resultado.status,
    motivo: resultado.motivo,
    papel,
    modo,
    participantes: visao.jogadores.map((j) => ({
      jogadorId: j.id,
      nome: j.nome,
      ordem: j.ordem,
      letras: j.letras,
      maosVencidas: j.maosVencidas,
      anfitriao: j.anfitriao,
    })),
    vencedorNome: nome(resultado.vencedorId),
    penalizadoNome: nome(resultado.penalizadoId),
    responsavelNome: nome(resultado.responsavelId),
    qtdMaos: visao.mao,
    qtdTrocas: visao.totalTrocas,
    jogadorLocalId: visao.meuId,
    resultadoLocal,
    maos: visao.historicoMaos,
  };
}

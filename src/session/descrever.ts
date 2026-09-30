import type { ResultadoPartida, VisaoJogador } from '@/game/types';
import type { MensagemHost } from '@/protocol/messages';

export type TipoAviso = 'info' | 'sucesso' | 'alerta' | 'erro';
export interface Aviso {
  texto: string;
  tipo: TipoAviso;
}

export function nomeDe(visao: VisaoJogador | null, id: string | null | undefined): string {
  if (!id) return '—';
  return visao?.jogadores.find((j) => j.id === id)?.nome ?? 'Jogador';
}

export function textoResultado(r: ResultadoPartida, visao: VisaoJogador | null): string {
  switch (r.motivo) {
    case 'vitoria':
      return `${nomeDe(visao, r.penalizadoId)} virou BURRO! ${nomeDe(visao, r.vencedorId)} venceu a partida.`;
    case 'cancelada':
      return 'A partida foi cancelada pelo anfitrião.';
    case 'abandono':
      return `${nomeDe(visao, r.responsavelId)} abandonou a partida.`;
    case 'desconexao':
      return r.responsavelId
        ? `${nomeDe(visao, r.responsavelId)} desconectou e não voltou. Partida interrompida.`
        : 'A conexão com o anfitrião foi perdida. Partida interrompida.';
  }
}

/** Texto amigável para cada mensagem recebida (mostrado em toasts). */
export function descreverMensagem(m: MensagemHost, meuId: string): Aviso | null {
  const eu = (id: string) => id === meuId;
  switch (m.tipo) {
    case 'JOGADOR_ENTROU':
      return { texto: `${m.dados.jogador.nome} entrou na sala`, tipo: 'info' };
    case 'JOGADOR_SAIU':
      return { texto: `${m.dados.nome} saiu da sala`, tipo: 'alerta' };
    case 'PARTIDA_INICIADA':
      return { texto: 'A partida começou!', tipo: 'sucesso' };
    case 'TROCA_REALIZADA': {
      const v = m.dados.visao;
      if (eu(m.dados.para)) return { texto: `Você recebeu uma carta de ${nomeDe(v, m.dados.de)}`, tipo: 'info' };
      return null;
    }
    case 'JOGADOR_COMPLETOU': {
      const quem = eu(m.dados.jogadorId) ? 'Você' : nomeDe(m.dados.visao, m.dados.jogadorId);
      return { texto: `${quem} completou quatro ${m.dados.valor}! BATA!`, tipo: 'alerta' };
    }
    case 'MAO_FINALIZADA': {
      const v = m.dados.visao;
      const quem = eu(m.dados.penalizadoId) ? 'Você levou' : `${nomeDe(v, m.dados.penalizadoId)} levou`;
      return { texto: `${quem} uma letra!`, tipo: eu(m.dados.penalizadoId) ? 'erro' : 'info' };
    }
    case 'NOVA_MAO':
      return { texto: `Mão ${m.dados.numero} distribuída`, tipo: 'info' };
    case 'JOGADOR_DESCONECTADO':
      return {
        texto: `${nomeDe(m.dados.visao ?? null, m.dados.jogadorId)} desconectou. Aguardando reconexão…`,
        tipo: 'alerta',
      };
    case 'RECONEXAO':
      return { texto: `${nomeDe(m.dados.visao, m.dados.jogadorId)} reconectou`, tipo: 'sucesso' };
    case 'ERRO':
      return { texto: m.dados.mensagem, tipo: 'erro' };
    default:
      return null;
  }
}

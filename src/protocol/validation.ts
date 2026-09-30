import type { VisaoJogador } from '@/game/types';
import {
  VERSAO_PROTOCOLO,
  type MensagemCliente,
  type MensagemHost,
  type TipoClienteParaHost,
  type TipoHostParaCliente,
} from './messages';

/**
 * Validação de mensagens recebidas ANTES de qualquer alteração de estado.
 * Nada que chega pelo Bluetooth é confiável: pode estar truncado, ser de outra
 * versão do app ou ter sido forjado.
 */

export type Validacao<T> = { ok: true; mensagem: T } | { ok: false; erro: string };

const TIPOS_CLIENTE: readonly TipoClienteParaHost[] = [
  'SOLICITACAO_ENTRADA',
  'RECONEXAO',
  'JOGADA',
  'JOGADOR_COMPLETOU',
  'BATER',
  'JOGADOR_SAIU',
];

const TIPOS_HOST: readonly TipoHostParaCliente[] = [
  'ENTRADA_ACEITA',
  'ENTRADA_RECUSADA',
  'JOGADOR_ENTROU',
  'JOGADOR_SAIU',
  'SALA_ATUALIZADA',
  'PARTIDA_INICIADA',
  'TROCA_REALIZADA',
  'JOGADOR_COMPLETOU',
  'BATER',
  'MAO_FINALIZADA',
  'NOVA_MAO',
  'JOGADOR_DESCONECTADO',
  'RECONEXAO',
  'ESTADO',
  'PARTIDA_FINALIZADA',
  'ERRO',
];

type Obj = Record<string, unknown>;
const ehObjeto = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const ehTexto = (x: unknown, max = 200): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;

function parse(texto: string): Obj | string {
  try {
    const dado: unknown = JSON.parse(texto);
    return ehObjeto(dado) ? dado : 'Mensagem não é um objeto JSON';
  } catch {
    return 'JSON inválido';
  }
}

function validarEnvelope(m: Obj, tipos: readonly string[]): string | null {
  if (m.v !== VERSAO_PROTOCOLO) return `Versão de protocolo incompatível (${String(m.v)})`;
  if (!ehTexto(m.tipo) || !tipos.includes(m.tipo)) return `Tipo de mensagem desconhecido: ${String(m.tipo)}`;
  if (!ehTexto(m.id, 64)) return 'Mensagem sem id';
  if (!ehTexto(m.remetente, 64)) return 'Mensagem sem remetente';
  if (typeof m.ts !== 'number' || !Number.isFinite(m.ts)) return 'Mensagem sem data/hora';
  if (!ehObjeto(m.dados)) return 'Mensagem sem dados';
  return null;
}

export function validarMensagemCliente(texto: string): Validacao<MensagemCliente> {
  const m = parse(texto);
  if (typeof m === 'string') return { ok: false, erro: m };
  const erro = validarEnvelope(m, TIPOS_CLIENTE);
  if (erro) return { ok: false, erro };
  const d = m.dados as Obj;

  switch (m.tipo as TipoClienteParaHost) {
    case 'SOLICITACAO_ENTRADA':
      if (!ehTexto(d.nome, 20) || !(d.nome as string).trim()) return { ok: false, erro: 'Nome inválido' };
      if (!ehTexto(d.jogadorId, 64)) return { ok: false, erro: 'jogadorId inválido' };
      break;
    case 'RECONEXAO':
      if (!ehTexto(d.jogadorId, 64) || !ehTexto(d.token, 64)) return { ok: false, erro: 'Dados de reconexão inválidos' };
      break;
    case 'JOGADA':
      if (!ehTexto(d.cartaId, 20)) return { ok: false, erro: 'Carta inválida' };
      break;
    default:
      break;
  }
  return { ok: true, mensagem: m as unknown as MensagemCliente };
}

export function ehVisaoValida(v: unknown): v is VisaoJogador {
  if (!ehObjeto(v)) return false;
  return (
    ehTexto(v.partidaId, 64) &&
    ehTexto(v.meuId, 64) &&
    typeof v.fase === 'string' &&
    typeof v.mao === 'number' &&
    Array.isArray(v.jogadores) &&
    v.jogadores.every((j) => ehObjeto(j) && ehTexto(j.id, 64) && typeof j.nome === 'string') &&
    Array.isArray(v.minhaMao) &&
    v.minhaMao.every((c) => ehObjeto(c) && ehTexto(c.id, 20) && typeof c.valor === 'string')
  );
}

export function validarMensagemHost(texto: string): Validacao<MensagemHost> {
  const m = parse(texto);
  if (typeof m === 'string') return { ok: false, erro: m };
  const erro = validarEnvelope(m, TIPOS_HOST);
  if (erro) return { ok: false, erro };
  const d = m.dados as Obj;

  if ('visao' in d && d.visao !== null && d.visao !== undefined && !ehVisaoValida(d.visao)) {
    return { ok: false, erro: 'Estado da partida inválido' };
  }
  switch (m.tipo as TipoHostParaCliente) {
    case 'PARTIDA_INICIADA':
    case 'TROCA_REALIZADA':
    case 'JOGADOR_COMPLETOU':
    case 'BATER':
    case 'MAO_FINALIZADA':
    case 'NOVA_MAO':
    case 'RECONEXAO':
    case 'ESTADO':
      if (!d.visao) return { ok: false, erro: 'Mensagem sem estado da partida' };
      break;
    case 'ENTRADA_ACEITA':
      if (!ehTexto(d.jogadorId, 64) || !ehTexto(d.token, 64) || !ehObjeto(d.sala)) {
        return { ok: false, erro: 'Aceite inválido' };
      }
      break;
    case 'JOGADOR_ENTROU':
    case 'JOGADOR_SAIU':
    case 'SALA_ATUALIZADA':
      if (!ehObjeto(d.sala)) return { ok: false, erro: 'Sala inválida' };
      break;
    case 'PARTIDA_FINALIZADA':
      if (!ehObjeto(d.resultado)) return { ok: false, erro: 'Resultado inválido' };
      break;
    default:
      break;
  }
  return { ok: true, mensagem: m as unknown as MensagemHost };
}

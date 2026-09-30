import { describe, expect, it } from 'vitest';
import { criarPartida, visaoPara } from '@/game';
import { criarMensagem } from '@/protocol/messages';
import { validarMensagemCliente, validarMensagemHost } from '@/protocol/validation';
import { codificarAnuncio, decodificarAnuncio } from '@/transport/ble/constants';
import { Fragmentador, Remontador } from '@/transport/framing';
import { rngFixo } from './helpers';

describe('validação de mensagens', () => {
  it('aceita uma JOGADA bem formada', () => {
    const m = criarMensagem('JOGADA', 'bia', { cartaId: 'A-copas' });
    const v = validarMensagemCliente(JSON.stringify(m));
    expect(v.ok).toBe(true);
  });

  it.each([
    ['JSON inválido', '{nao é json'],
    ['tipo desconhecido', JSON.stringify({ ...criarMensagem('JOGADA', 'b', { cartaId: 'x' }), tipo: 'HACK' })],
    ['versão diferente', JSON.stringify({ ...criarMensagem('JOGADA', 'b', { cartaId: 'x' }), v: 2 })],
    ['sem dados', JSON.stringify({ ...criarMensagem('JOGADA', 'b', { cartaId: 'x' }), dados: null })],
    ['carta vazia', JSON.stringify(criarMensagem('JOGADA', 'b', { cartaId: '' }))],
    ['nome vazio', JSON.stringify(criarMensagem('SOLICITACAO_ENTRADA', 'b', { nome: '   ', jogadorId: 'b' }))],
    ['nome enorme', JSON.stringify(criarMensagem('SOLICITACAO_ENTRADA', 'b', { nome: 'x'.repeat(50), jogadorId: 'b' }))],
  ])('rejeita: %s', (_nome, texto) => {
    expect(validarMensagemCliente(texto).ok).toBe(false);
  });

  it('valida a visão da partida enviada pelo anfitrião', () => {
    const visao = visaoPara(criarPartida('p', [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }], rngFixo(), 0), 'b');
    const ok = criarMensagem('ESTADO', 'a', { visao });
    expect(validarMensagemHost(JSON.stringify(ok)).ok).toBe(true);
    const ruim = criarMensagem('ESTADO', 'a', { visao: { ...visao, minhaMao: 'nada' } });
    expect(validarMensagemHost(JSON.stringify(ruim)).ok).toBe(false);
    const semVisao = criarMensagem('TROCA_REALIZADA', 'a', { de: 'a', para: 'b' });
    expect(validarMensagemHost(JSON.stringify(semVisao)).ok).toBe(false);
  });
});

describe('fragmentação BLE', () => {
  const texto = JSON.stringify({ msg: 'Olá, BURRO! 🫏 '.repeat(40) });

  it.each([20, 23, 185, 509])('fragmenta e remonta com quadros de %i bytes', (tamanho) => {
    const f = new Fragmentador();
    const r = new Remontador();
    const quadros = f.fragmentar(texto, tamanho);
    expect(quadros.every((q) => q.length <= tamanho)).toBe(true);
    const saidas = quadros.map((q) => r.receber(q));
    expect(saidas.slice(0, -1).every((s) => s === null)).toBe(true);
    expect(saidas.at(-1)).toBe(texto);
  });

  it('descarta mensagem com quadro perdido e recupera na seguinte', () => {
    const f = new Fragmentador();
    const r = new Remontador();
    const a = f.fragmentar(texto, 40);
    const b = f.fragmentar('{"ok":true}', 40);
    a.splice(2, 1); // perde um quadro
    for (const q of a) expect(r.receber(q)).toBeNull();
    expect(r.receber(b[0])).toBe('{"ok":true}');
  });

  it('recusa mensagens maiores que 255 quadros', () => {
    expect(() => new Fragmentador().fragmentar('x'.repeat(10_000), 20)).toThrow();
  });
});

describe('anúncio da sala', () => {
  it('codifica e decodifica, cortando nomes longos sem quebrar acentos', () => {
    const bytes = codificarAnuncio({ nomeAnfitriao: 'João Conceição da Silvão', jogadores: 3, maxJogadores: 6, emAndamento: false });
    expect(bytes.length).toBeLessThanOrEqual(27);
    const a = decodificarAnuncio(bytes)!;
    expect(a.jogadores).toBe(3);
    expect(a.nomeAnfitriao.startsWith('João Conceição')).toBe(true);
    expect(a.nomeAnfitriao).not.toContain('�');
  });
});

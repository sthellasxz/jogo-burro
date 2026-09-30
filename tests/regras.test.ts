import { describe, expect, it } from 'vitest';
import {
  aplicarAcao,
  criarBaralho,
  criarPartida,
  distribuir,
  grupoCompleto,
  visaoPara,
  type Carta,
  type EstadoPartida,
} from '@/game';
import { rngFixo } from './helpers';

const J3 = [
  { id: 'ana', nome: 'Ana' },
  { id: 'bia', nome: 'Bia' },
  { id: 'caio', nome: 'Caio' },
];

function carta(valor: Carta['valor'], naipe: Carta['naipe'] = 'copas'): Carta {
  return { id: `${valor}-${naipe}`, valor, naipe };
}

/** Monta um estado com mãos definidas manualmente. */
function estadoCom(maos: Record<string, Carta[]>, vez = 'ana'): EstadoPartida {
  const e = criarPartida('p1', J3.slice(0, Object.keys(maos).length), rngFixo(), 1000);
  return { ...e, maos, vez };
}

describe('baralho e distribuição', () => {
  it('cria um valor por jogador (4 naipes) + a carta Burro', () => {
    const b = criarBaralho(3);
    expect(b).toHaveLength(13);
    expect(new Set(b.map((c) => c.id)).size).toBe(13);
    expect(b.filter((c) => c.valor === 'BURRO')).toHaveLength(1);
  });

  it('dá 5 cartas para quem começa e 4 para os demais', () => {
    const maos = distribuir(['a', 'b', 'c', 'd'], 'c', rngFixo(7));
    expect(maos.c).toHaveLength(5);
    expect(maos.a).toHaveLength(4);
    expect(maos.b).toHaveLength(4);
    expect(maos.d).toHaveLength(4);
  });

  it('nunca começa uma mão com alguém já completo', () => {
    for (let s = 0; s < 200; s++) {
      const maos = distribuir(['a', 'b'], 'a', rngFixo(s));
      expect(Object.values(maos).every((m) => grupoCompleto(m) === null)).toBe(true);
    }
  });

  it('cada jogador vê somente as próprias cartas', () => {
    const e = criarPartida('p1', J3, rngFixo(), 0);
    const v = visaoPara(e, 'bia');
    expect(v.minhaMao).toEqual(e.maos.bia);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(e.maos.ana[0]));
    expect(v.jogadores.find((j) => j.id === 'ana')?.qtdCartas).toBe(5);
    expect(v.recebeDe).toBe('ana');
    expect(v.enviaPara).toBe('caio');
  });
});

describe('troca de cartas', () => {
  it('passa a carta para o próximo e muda a vez', () => {
    const e = criarPartida('p1', J3, rngFixo(), 0);
    const c = e.maos.ana[0];
    const r = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: 'ana', cartaId: c.id }, rngFixo(), 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estado.maos.ana).toHaveLength(4);
    expect(r.estado.maos.bia).toHaveLength(5);
    expect(r.estado.maos.bia).toContainEqual(c);
    expect(r.estado.vez).toBe('bia');
    expect(r.estado.totalTrocas).toBe(1);
    expect(r.eventos).toEqual([{ tipo: 'TROCA_REALIZADA', de: 'ana', para: 'bia' }]);
    // estado original intacto (funções puras)
    expect(e.maos.ana).toHaveLength(5);
  });

  it('o último jogador passa para o primeiro', () => {
    let e = criarPartida('p1', J3, rngFixo(), 0);
    for (const id of ['ana', 'bia']) {
      const r = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: id, cartaId: e.maos[id][0].id }, rngFixo(), 0);
      if (!r.ok) throw new Error(r.erro);
      e = r.estado;
    }
    const r = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: 'caio', cartaId: e.maos.caio[0].id }, rngFixo(), 0);
    expect(r.ok && r.estado.vez).toBe('ana');
  });

  it('bloqueia jogada fora do turno', () => {
    const e = criarPartida('p1', J3, rngFixo(), 0);
    const r = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: 'bia', cartaId: e.maos.bia[0].id }, rngFixo(), 0);
    expect(r).toEqual({ ok: false, erro: 'Não é a sua vez' });
  });

  it('bloqueia carta que não está na mão', () => {
    const e = criarPartida('p1', J3, rngFixo(), 0);
    const r = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: 'ana', cartaId: e.maos.bia[0].id }, rngFixo(), 0);
    expect(r.ok).toBe(false);
  });

  it('bloqueia jogadas enquanto alguém está desconectado', () => {
    let e = criarPartida('p1', J3, rngFixo(), 0);
    const r1 = aplicarAcao(e, { tipo: 'DESCONECTAR', jogadorId: 'caio' }, rngFixo(), 0);
    if (!r1.ok) throw new Error();
    e = r1.estado;
    expect(visaoPara(e, 'ana').pausada).toBe(true);
    const r2 = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: 'ana', cartaId: e.maos.ana[0].id }, rngFixo(), 0);
    expect(r2.ok).toBe(false);
  });
});

describe('completar, bater e penalidade', () => {
  const quatroAses = [carta('A', 'copas'), carta('A', 'ouros'), carta('A', 'espadas'), carta('A', 'paus')];

  it('detecta quatro cartas iguais (e ignora a carta Burro)', () => {
    expect(grupoCompleto(quatroAses)).toBe('A');
    expect(grupoCompleto([...quatroAses.slice(0, 3), carta('BURRO', null)])).toBeNull();
  });

  it('recusa completar sem quatro iguais', () => {
    const e = criarPartida('p1', J3, rngFixo(), 0);
    expect(aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: 'bia' }, rngFixo(), 0).ok).toBe(false);
  });

  it('último a bater leva uma letra', () => {
    const e = estadoCom({
      ana: [carta('K', 'copas'), carta('K', 'ouros'), carta('Q', 'copas'), carta('Q', 'ouros'), carta('BURRO', null)],
      bia: quatroAses,
      caio: [carta('K', 'espadas'), carta('K', 'paus'), carta('Q', 'espadas'), carta('Q', 'paus')],
    });
    const r1 = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: 'bia' }, rngFixo(), 100);
    if (!r1.ok) throw new Error(r1.erro);
    expect(r1.estado.fase).toBe('batendo');
    expect(aplicarAcao(r1.estado, { tipo: 'PASSAR', jogadorId: 'ana', cartaId: 'BURRO' }, rngFixo(), 0).ok).toBe(false);

    const r2 = aplicarAcao(r1.estado, { tipo: 'BATER', jogadorId: 'caio' }, rngFixo(), 200);
    if (!r2.ok) throw new Error(r2.erro);
    expect(r2.estado.fase).toBe('fim_mao');
    const ana = r2.estado.jogadores.find((j) => j.id === 'ana')!;
    const bia = r2.estado.jogadores.find((j) => j.id === 'bia')!;
    expect(ana.letras).toBe(1);
    expect(bia.maosVencidas).toBe(1);
    expect(r2.estado.historicoMaos[0]).toEqual({ numero: 1, vencedorId: 'bia', penalizadoId: 'ana', valor: 'A' });
  });

  it('não permite bater duas vezes', () => {
    const e = estadoCom({ ana: [], bia: quatroAses, caio: [] });
    const r1 = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: 'bia' }, rngFixo(), 0);
    if (!r1.ok) throw new Error();
    expect(aplicarAcao(r1.estado, { tipo: 'BATER', jogadorId: 'bia' }, rngFixo(), 0).ok).toBe(false);
  });

  it('com 2 jogadores o outro leva a letra na hora', () => {
    const e = estadoCom({ ana: quatroAses, bia: [] });
    const r = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: 'ana' }, rngFixo(), 0);
    expect(r.ok && r.estado.fase).toBe('fim_mao');
    expect(r.ok && r.estado.jogadores[1].letras).toBe(1);
  });

  it('tempo esgotado: penaliza quem não bateu (o mais distante do vencedor)', () => {
    const e = estadoCom({ ana: quatroAses, bia: [], caio: [] });
    const r1 = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: 'ana' }, rngFixo(), 0);
    if (!r1.ok) throw new Error();
    expect(aplicarAcao(r1.estado, { tipo: 'TEMPO_ESGOTADO' }, rngFixo(), 1000).ok).toBe(false);
    const r2 = aplicarAcao(r1.estado, { tipo: 'TEMPO_ESGOTADO' }, rngFixo(), 10_000);
    if (!r2.ok) throw new Error(r2.erro);
    expect(r2.estado.historicoMaos[0].penalizadoId).toBe('caio');
  });

  it('próxima mão: redistribui e quem levou a letra começa', () => {
    const e = estadoCom({ ana: quatroAses, bia: [] });
    const r1 = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: 'ana' }, rngFixo(), 0);
    if (!r1.ok) throw new Error();
    const r2 = aplicarAcao(r1.estado, { tipo: 'PROXIMA_MAO' }, rngFixo(), 0);
    if (!r2.ok) throw new Error(r2.erro);
    expect(r2.estado.mao).toBe(2);
    expect(r2.estado.vez).toBe('bia');
    expect(r2.estado.maos.bia).toHaveLength(5);
  });
});

describe('fim da partida', () => {
  it('termina quando alguém completa B-U-R-R-O', () => {
    let e = criarPartida('p1', J3.slice(0, 2), rngFixo(), 0);
    e = { ...e, jogadores: e.jogadores.map((j) => (j.id === 'bia' ? { ...j, letras: 4 } : j)) };
    e = {
      ...e,
      maos: {
        ana: [carta('A', 'copas'), carta('A', 'ouros'), carta('A', 'espadas'), carta('A', 'paus')],
        bia: [],
      },
    };
    const r = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: 'ana' }, rngFixo(), 5000);
    if (!r.ok) throw new Error(r.erro);
    expect(r.estado.fase).toBe('encerrada');
    expect(r.estado.resultado).toEqual({
      status: 'finalizada',
      motivo: 'vitoria',
      vencedorId: 'ana',
      penalizadoId: 'bia',
      responsavelId: null,
    });
    expect(r.estado.finalizadaEm).toBe(5000);
    expect(r.eventos.at(-1)?.tipo).toBe('PARTIDA_FINALIZADA');
    expect(aplicarAcao(r.estado, { tipo: 'PROXIMA_MAO' }, rngFixo(), 0).ok).toBe(false);
  });

  it('abandono encerra como interrompida', () => {
    const e = criarPartida('p1', J3, rngFixo(), 0);
    const r = aplicarAcao(e, { tipo: 'ENCERRAR', motivo: 'abandono', jogadorId: 'caio' }, rngFixo(), 0);
    expect(r.ok && r.estado.resultado?.status).toBe('interrompida');
  });

  it('partida completa simulada termina sempre', () => {
    const rng = rngFixo(99);
    let e = criarPartida('p1', J3, rng, 0);
    let passos = 0;
    while (e.fase !== 'encerrada' && passos++ < 50_000) {
      let r;
      const completo = e.jogadores.find((j) => grupoCompleto(e.maos[j.id]));
      if (e.fase === 'jogando' && completo) r = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: completo.id }, rng, 0);
      else if (e.fase === 'jogando') {
        const mao = e.maos[e.vez!];
        r = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: e.vez!, cartaId: mao[Math.floor(rng() * mao.length)].id }, rng, 0);
      } else if (e.fase === 'batendo') {
        const falta = e.jogadores.find((j) => !e.batida!.ordem.includes(j.id))!;
        r = aplicarAcao(e, { tipo: 'BATER', jogadorId: falta.id }, rng, 0);
      } else r = aplicarAcao(e, { tipo: 'PROXIMA_MAO' }, rng, 0);
      if (!r.ok) throw new Error(r.erro);
      e = r.estado;
    }
    expect(e.fase).toBe('encerrada');
    expect(e.jogadores.some((j) => j.letras === 5)).toBe(true);
    // Conservação: nenhuma carta criada ou perdida.
    expect(Object.values(e.maos).flat()).toHaveLength(13);
  });
});

describe('bots do modo demonstração', () => {
  it.each([2, 3, 6])('partida só com bots termina (%i jogadores)', async (n) => {
    const { escolherCartaParaPassar } = await import('@/game/bot');
    const rng = rngFixo(n * 11);
    const ids = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, nome: `B${i}` }));
    let e = criarPartida('p', ids, rng, 0);
    let passos = 0;
    while (e.fase !== 'encerrada' && passos++ < 20_000) {
      const completo = e.jogadores.find((j) => grupoCompleto(e.maos[j.id]));
      let r;
      if (e.fase === 'jogando' && completo) r = aplicarAcao(e, { tipo: 'COMPLETAR', jogadorId: completo.id }, rng, 0);
      else if (e.fase === 'jogando') {
        const carta = escolherCartaParaPassar(e.maos[e.vez!], rng);
        r = aplicarAcao(e, { tipo: 'PASSAR', jogadorId: e.vez!, cartaId: carta.id }, rng, 0);
      } else if (e.fase === 'batendo') {
        const falta = e.jogadores.find((j) => !e.batida!.ordem.includes(j.id))!;
        r = aplicarAcao(e, { tipo: 'BATER', jogadorId: falta.id }, rng, 0);
      } else r = aplicarAcao(e, { tipo: 'PROXIMA_MAO' }, rng, 0);
      if (!r.ok) throw new Error(r.erro);
      e = r.estado;
    }
    expect(e.fase).toBe('encerrada');
    // média de trocas por mão razoável para uma partida jogável
    expect(e.totalTrocas / e.mao).toBeLessThan(60);
  });
});

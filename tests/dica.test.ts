import { describe, expect, it } from 'vitest';
import { sugerirCarta } from '@/game/dica';
import type { Carta } from '@/game/types';

function c(valor: Carta['valor'], naipe: Carta['naipe'] = 'copas'): Carta {
  return { id: `${valor}-${naipe}`, valor, naipe };
}

describe('dica de carta', () => {
  it('mão vazia não tem dica', () => {
    expect(sugerirCarta([])).toBeNull();
  });

  it('sugere passar a carta Burro primeiro', () => {
    const mao = [c('A', 'copas'), c('A', 'ouros'), c('K', 'copas'), c('Q', 'paus'), c('BURRO', null)];
    expect(sugerirCarta(mao)?.valor).toBe('BURRO');
  });

  it('sugere a carta do valor com menos cópias', () => {
    const mao = [c('A', 'copas'), c('A', 'ouros'), c('A', 'paus'), c('K', 'copas'), c('K', 'ouros')];
    expect(sugerirCarta(mao)?.valor).toBe('K');
  });
});

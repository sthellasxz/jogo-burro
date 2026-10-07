import { VALOR_BURRO, type Carta } from './types';

/**
 * Sugere qual carta o jogador deveria passar.
 * 1. Se tiver a carta Burro, passe ela (nunca forma grupo).
 * 2. Senão, passe uma carta do valor que tem menos cópias na mão.
 * Retorna null se a mão estiver vazia.
 */
function contarValores(mao: readonly Carta[]): Map<Carta['valor'], number> {
  const contagem = new Map<Carta['valor'], number>();

  for (const carta of mao) {
    const valor = carta.valor;
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
  }

  return contagem;
}

function escolherCartaComMenosCopia(mao: readonly Carta[]): Carta {
  const contagem = contarValores(mao);
  let melhor = mao[0];

  for (const carta of mao) {
    if ((contagem.get(carta.valor) ?? 0) < (contagem.get(melhor.valor) ?? 0)) {
      melhor = carta;
    }
  }

  return melhor;
}

export function sugerirCarta(mao: readonly Carta[]): Carta | null {
  if (mao.length === 0) return null;

  const burro = mao.find((c) => c.valor === VALOR_BURRO);
  if (burro) return burro;

  return escolherCartaComMenosCopia(mao);
}
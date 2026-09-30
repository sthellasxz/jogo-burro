import { grupoCompleto } from './deck';
import { VALOR_BURRO, type Carta, type Rng } from './types';

/** Chance de o bot se livrar da carta Burro quando a tem. */
const CHANCE_PASSAR_BURRO = 0.5;

/**
 * Estratégia simples usada pelos bots do modo demonstração:
 * passa a carta do valor com menos cópias na mão. A carta Burro é passada
 * só metade das vezes: se todos a passassem sempre, só ela giraria na mesa
 * e ninguém mais trocaria cartas.
 */
export function escolherCartaParaPassar(mao: readonly Carta[], rng: Rng): Carta {
  const burro = mao.find((c) => c.valor === VALOR_BURRO);
  const normais = mao.filter((c) => c.valor !== VALOR_BURRO);
  if (burro && (normais.length === 0 || rng() < CHANCE_PASSAR_BURRO)) return burro;

  const contagem = new Map<Carta['valor'], number>();
  for (const c of normais) contagem.set(c.valor, (contagem.get(c.valor) ?? 0) + 1);
  const menor = Math.min(...contagem.values());
  const candidatas = normais.filter((c) => contagem.get(c.valor) === menor);
  return candidatas[Math.floor(rng() * candidatas.length)];
}

export function botDeveCompletar(mao: readonly Carta[]): boolean {
  return grupoCompleto(mao) !== null;
}

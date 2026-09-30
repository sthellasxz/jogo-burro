import { CARTAS_POR_JOGADOR, NAIPES, VALORES, VALOR_BURRO, type Carta, type Rng, type Valor } from './types';

/**
 * Monta o baralho da partida: um valor por jogador (4 naipes cada) + 1 carta "Burro".
 * Ex.: 3 jogadores → A, K, Q (12 cartas) + Burro = 13 cartas.
 * A carta extra é o que permite o giro: quem está na vez segura 5 cartas.
 */
export function criarBaralho(qtdJogadores: number): Carta[] {
  const cartas: Carta[] = [];
  for (const valor of VALORES.slice(0, qtdJogadores)) {
    for (const naipe of NAIPES) {
      cartas.push({ id: `${valor}-${naipe}`, valor, naipe });
    }
  }
  cartas.push({ id: VALOR_BURRO, valor: VALOR_BURRO, naipe: null });
  return cartas;
}

/** Fisher–Yates. Não altera o array original. */
export function embaralhar<T>(itens: readonly T[], rng: Rng): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Retorna o valor que aparece 4 vezes na mão, ou null. A carta Burro nunca conta. */
export function grupoCompleto(mao: readonly Carta[]): Valor | null {
  const contagem = new Map<Valor, number>();
  for (const carta of mao) {
    if (carta.valor === VALOR_BURRO) continue;
    const n = (contagem.get(carta.valor) ?? 0) + 1;
    if (n >= CARTAS_POR_JOGADOR) return carta.valor;
    contagem.set(carta.valor, n);
  }
  return null;
}

/**
 * Distribui as cartas. Quem começa recebe 5 cartas; os demais, 4.
 * Refaz o embaralhamento se alguém já recebe 4 cartas iguais (mão sem graça).
 */
export function distribuir(
  jogadorIds: readonly string[],
  quemComeca: string,
  rng: Rng,
): Record<string, Carta[]> {
  const baralho = criarBaralho(jogadorIds.length);
  const inicio = jogadorIds.indexOf(quemComeca);
  if (inicio < 0) throw new Error('Jogador inicial não está na partida');

  for (let tentativa = 0; tentativa < 100; tentativa++) {
    const cartas = embaralhar(baralho, rng);
    const maos: Record<string, Carta[]> = {};
    for (const id of jogadorIds) maos[id] = [];
    // Distribui em rodízio a partir de quem começa: assim ele recebe a carta sobrando.
    cartas.forEach((carta, i) => {
      const id = jogadorIds[(inicio + i) % jogadorIds.length];
      maos[id].push(carta);
    });
    if (!Object.values(maos).some((m) => grupoCompleto(m))) return maos;
  }
  throw new Error('Não foi possível distribuir as cartas');
}

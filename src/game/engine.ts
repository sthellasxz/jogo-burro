import { distribuir, grupoCompleto } from './deck';
import {
  CARTAS_POR_JOGADOR,
  MAX_JOGADORES,
  MAX_LETRAS,
  MIN_JOGADORES,
  TEMPO_BATIDA_MS,
  type Acao,
  type EstadoPartida,
  type Evento,
  type Jogador,
  type MotivoEncerramento,
  type ResultadoAcao,
  type ResultadoPartida,
  type ResumoMao,
  type Rng,
} from './types';

/**
 * Motor do jogo (autoritativo). Roda somente no anfitrião.
 * Todas as funções são puras: recebem o estado e devolvem um novo estado,
 * nunca alteram o objeto recebido. Isso evita estados inconsistentes.
 */

export interface NovoJogador {
  id: string;
  nome: string;
}

export function criarPartida(
  id: string,
  participantes: readonly NovoJogador[],
  rng: Rng,
  agora: number,
): EstadoPartida {
  if (participantes.length < MIN_JOGADORES) throw new Error(`Mínimo de ${MIN_JOGADORES} jogadores`);
  if (participantes.length > MAX_JOGADORES) throw new Error(`Máximo de ${MAX_JOGADORES} jogadores`);
  if (new Set(participantes.map((p) => p.id)).size !== participantes.length) {
    throw new Error('Identificadores de jogador repetidos');
  }

  const jogadores: Jogador[] = participantes.map((p, ordem) => ({
    id: p.id,
    nome: p.nome,
    ordem,
    anfitriao: ordem === 0,
    letras: 0,
    maosVencidas: 0,
    conectado: true,
  }));
  const quemComeca = jogadores[0].id;

  return {
    id,
    jogadores,
    maos: distribuir(jogadores.map((j) => j.id), quemComeca, rng),
    fase: 'jogando',
    vez: quemComeca,
    mao: 1,
    totalTrocas: 0,
    batida: null,
    historicoMaos: [],
    resultado: null,
    iniciadaEm: agora,
    finalizadaEm: null,
  };
}

export function proximoJogador(estado: EstadoPartida, jogadorId: string): Jogador {
  const i = estado.jogadores.findIndex((j) => j.id === jogadorId);
  return estado.jogadores[(i + 1) % estado.jogadores.length];
}

export function jogadorAnterior(estado: EstadoPartida, jogadorId: string): Jogador {
  const i = estado.jogadores.findIndex((j) => j.id === jogadorId);
  const n = estado.jogadores.length;
  return estado.jogadores[(i - 1 + n) % n];
}

export function estaPausada(estado: EstadoPartida): boolean {
  return estado.fase !== 'encerrada' && estado.jogadores.some((j) => !j.conectado);
}

function jogador(estado: EstadoPartida, id: string): Jogador | undefined {
  return estado.jogadores.find((j) => j.id === id);
}

function falha(erro: string): ResultadoAcao {
  return { ok: false, erro };
}

/** Ponto único de entrada: valida a ação e devolve o novo estado + eventos gerados. */
export function aplicarAcao(
  estado: EstadoPartida,
  acao: Acao,
  rng: Rng,
  agora: number,
): ResultadoAcao {
  if (estado.fase === 'encerrada') return falha('A partida já foi encerrada');

  switch (acao.tipo) {
    case 'PASSAR':
      return passarCarta(estado, acao.jogadorId, acao.cartaId);
    case 'COMPLETAR':
      return completar(estado, acao.jogadorId, agora);
    case 'BATER':
      return bater(estado, acao.jogadorId, agora);
    case 'TEMPO_ESGOTADO':
      return tempoEsgotado(estado, agora);
    case 'PROXIMA_MAO':
      return proximaMao(estado, rng);
    case 'DESCONECTAR':
      return alterarConexao(estado, acao.jogadorId, false, agora);
    case 'RECONECTAR':
      return alterarConexao(estado, acao.jogadorId, true, agora);
    case 'ENCERRAR':
      return encerrarPorMotivo(estado, acao.motivo, acao.jogadorId, agora);
  }
}

function passarCarta(estado: EstadoPartida, jogadorId: string, cartaId: string): ResultadoAcao {
  if (!jogador(estado, jogadorId)) return falha('Jogador desconhecido');
  if (estado.fase !== 'jogando') return falha('Não é momento de passar cartas');
  if (estaPausada(estado)) return falha('Partida pausada: aguardando reconexão');
  if (estado.vez !== jogadorId) return falha('Não é a sua vez');

  const mao = estado.maos[jogadorId];
  if (mao.length !== CARTAS_POR_JOGADOR + 1) return falha('Você precisa ter 5 cartas para passar');
  const carta = mao.find((c) => c.id === cartaId);
  if (!carta) return falha('Essa carta não está na sua mão');

  const destino = proximoJogador(estado, jogadorId);
  return {
    ok: true,
    estado: {
      ...estado,
      maos: {
        ...estado.maos,
        [jogadorId]: mao.filter((c) => c.id !== cartaId),
        [destino.id]: [...estado.maos[destino.id], carta],
      },
      vez: destino.id,
      totalTrocas: estado.totalTrocas + 1,
    },
    eventos: [{ tipo: 'TROCA_REALIZADA', de: jogadorId, para: destino.id }],
  };
}

function completar(estado: EstadoPartida, jogadorId: string, agora: number): ResultadoAcao {
  if (!jogador(estado, jogadorId)) return falha('Jogador desconhecido');
  if (estado.fase !== 'jogando') return falha('Não é possível completar agora');
  if (estaPausada(estado)) return falha('Partida pausada: aguardando reconexão');

  const valor = grupoCompleto(estado.maos[jogadorId]);
  if (!valor) return falha('Você ainda não tem quatro cartas iguais');

  const batida = { vencedorId: jogadorId, valor, ordem: [jogadorId], prazo: agora + TEMPO_BATIDA_MS };
  const eventos: Evento[] = [{ tipo: 'JOGADOR_COMPLETOU', jogadorId, valor }];
  const novo: EstadoPartida = { ...estado, fase: 'batendo', vez: null, batida };

  // Com 2 jogadores o outro é automaticamente o último a bater.
  if (novo.jogadores.length - batida.ordem.length === 1) {
    return finalizarMao(novo, eventos, agora);
  }
  return { ok: true, estado: novo, eventos };
}

function bater(estado: EstadoPartida, jogadorId: string, agora: number): ResultadoAcao {
  if (!jogador(estado, jogadorId)) return falha('Jogador desconhecido');
  if (estado.fase !== 'batendo' || !estado.batida) return falha('Ninguém completou ainda');
  if (estado.batida.ordem.includes(jogadorId)) return falha('Você já bateu');

  const batida = { ...estado.batida, ordem: [...estado.batida.ordem, jogadorId] };
  const novo = { ...estado, batida };
  const eventos: Evento[] = [{ tipo: 'BATER', jogadorId }];
  if (novo.jogadores.length - batida.ordem.length === 1) {
    return finalizarMao(novo, eventos, agora);
  }
  return { ok: true, estado: novo, eventos };
}

function tempoEsgotado(estado: EstadoPartida, agora: number): ResultadoAcao {
  if (estado.fase !== 'batendo' || !estado.batida) return falha('Não há batida em andamento');
  if (estaPausada(estado)) return falha('Partida pausada: aguardando reconexão');
  if (agora < estado.batida.prazo) return falha('O tempo para bater ainda não acabou');
  return finalizarMao(estado, [], agora);
}

/**
 * Penalizado = último a bater. Se o tempo acabou e mais de um não bateu,
 * leva a letra quem estiver mais distante do vencedor, seguindo a ordem da mesa.
 */
export function definirPenalizado(estado: EstadoPartida): string {
  const batida = estado.batida!;
  const n = estado.jogadores.length;
  const inicio = estado.jogadores.findIndex((j) => j.id === batida.vencedorId);
  let penalizado = '';
  for (let passo = 1; passo < n; passo++) {
    const candidato = estado.jogadores[(inicio + passo) % n].id;
    if (!batida.ordem.includes(candidato)) penalizado = candidato;
  }
  return penalizado;
}

function finalizarMao(estado: EstadoPartida, eventos: Evento[], agora: number): ResultadoAcao {
  const batida = estado.batida!;
  const penalizadoId = definirPenalizado(estado);
  const resumo: ResumoMao = {
    numero: estado.mao,
    vencedorId: batida.vencedorId,
    penalizadoId,
    valor: batida.valor,
  };
  const jogadores = estado.jogadores.map((j) => {
    if (j.id === penalizadoId) return { ...j, letras: j.letras + 1 };
    if (j.id === batida.vencedorId) return { ...j, maosVencidas: j.maosVencidas + 1 };
    return j;
  });
  let novo: EstadoPartida = {
    ...estado,
    jogadores,
    fase: 'fim_mao',
    historicoMaos: [...estado.historicoMaos, resumo],
  };
  const todos: Evento[] = [...eventos, { tipo: 'MAO_FINALIZADA', resumo }];

  const burro = jogadores.find((j) => j.letras >= MAX_LETRAS);
  if (burro) {
    const resultado: ResultadoPartida = {
      status: 'finalizada',
      motivo: 'vitoria',
      vencedorId: vencedorDaPartida(jogadores),
      penalizadoId: burro.id,
      responsavelId: null,
    };
    novo = { ...novo, fase: 'encerrada', resultado, finalizadaEm: agora };
    todos.push({ tipo: 'PARTIDA_FINALIZADA', resultado });
  }
  return { ok: true, estado: novo, eventos: todos };
}

/** Menos letras vence; empate → mais mãos vencidas; empate → ordem na mesa. */
export function vencedorDaPartida(jogadores: readonly Jogador[]): string {
  return [...jogadores].sort(
    (a, b) => a.letras - b.letras || b.maosVencidas - a.maosVencidas || a.ordem - b.ordem,
  )[0].id;
}

function proximaMao(estado: EstadoPartida, rng: Rng): ResultadoAcao {
  if (estado.fase !== 'fim_mao') return falha('A mão atual ainda não terminou');
  if (estaPausada(estado)) return falha('Partida pausada: aguardando reconexão');
  // Quem levou a letra começa a próxima mão (recebe 5 cartas).
  const ultima = estado.historicoMaos[estado.historicoMaos.length - 1];
  const quemComeca = ultima?.penalizadoId ?? estado.jogadores[0].id;
  const numero = estado.mao + 1;
  return {
    ok: true,
    estado: {
      ...estado,
      fase: 'jogando',
      mao: numero,
      vez: quemComeca,
      batida: null,
      maos: distribuir(estado.jogadores.map((j) => j.id), quemComeca, rng),
    },
    eventos: [{ tipo: 'NOVA_MAO', numero }],
  };
}

function alterarConexao(
  estado: EstadoPartida,
  jogadorId: string,
  conectado: boolean,
  agora: number,
): ResultadoAcao {
  const alvo = jogador(estado, jogadorId);
  if (!alvo) return falha('Jogador desconhecido');
  if (alvo.conectado === conectado) return { ok: true, estado, eventos: [] };

  let novo: EstadoPartida = {
    ...estado,
    jogadores: estado.jogadores.map((j) => (j.id === jogadorId ? { ...j, conectado } : j)),
  };
  // Ao voltar de uma pausa durante a batida, todos ganham o prazo completo de novo.
  if (conectado && novo.batida && novo.fase === 'batendo' && !estaPausada(novo)) {
    novo = { ...novo, batida: { ...novo.batida, prazo: agora + TEMPO_BATIDA_MS } };
  }
  const evento: Evento = conectado
    ? { tipo: 'RECONEXAO', jogadorId }
    : { tipo: 'JOGADOR_DESCONECTADO', jogadorId };
  return { ok: true, estado: novo, eventos: [evento] };
}

function encerrarPorMotivo(
  estado: EstadoPartida,
  motivo: Exclude<MotivoEncerramento, 'vitoria'>,
  responsavelId: string | null,
  agora: number,
): ResultadoAcao {
  const resultado: ResultadoPartida = {
    status: motivo === 'cancelada' ? 'cancelada' : 'interrompida',
    motivo,
    vencedorId: null,
    penalizadoId: null,
    responsavelId,
  };
  return {
    ok: true,
    estado: { ...estado, fase: 'encerrada', vez: null, resultado, finalizadaEm: agora },
    eventos: [{ tipo: 'PARTIDA_FINALIZADA', resultado }],
  };
}

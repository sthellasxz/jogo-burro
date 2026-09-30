import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultadoPartida, VisaoJogador } from '@/game';
import { criarMensagem, type MensagemHost } from '@/protocol/messages';
import { HostController, TEMPO_RECONEXAO_MS } from '@/session/HostController';
import { LocalHistoricoRepository } from '@/storage/LocalHistoricoRepository';
import { montarRegistro } from '@/storage/registro';
import { Emissor, type HostTransport, type HostTransportEvents } from '@/transport/types';
import { rngFixo } from './helpers';

/** Transporte falso: guarda o que o anfitrião envia e permite simular convidados. */
class TransporteFalso implements HostTransport {
  ev = new Emissor<HostTransportEvents>();
  enviadas = new Map<string, MensagemHost[]>();
  desconectados: string[] = [];
  on<E extends keyof HostTransportEvents>(e: E, fn: HostTransportEvents[E]) {
    this.ev.on(e, fn);
  }
  async iniciar() {}
  async atualizarAnuncio() {}
  async parar() {}
  async enviar(deviceId: string, texto: string) {
    const lista = this.enviadas.get(deviceId) ?? [];
    lista.push(JSON.parse(texto));
    this.enviadas.set(deviceId, lista);
  }
  async desconectar(deviceId: string) {
    this.desconectados.push(deviceId);
  }
  // helpers
  conectar(dev: string) {
    this.ev.emitir('conectado', dev);
  }
  cair(dev: string) {
    this.ev.emitir('desconectado', dev);
  }
  receber(dev: string, msg: object) {
    this.ev.emitir('mensagem', dev, JSON.stringify(msg));
  }
  ultima(dev: string): MensagemHost | undefined {
    return this.enviadas.get(dev)?.at(-1);
  }
  tipos(dev: string): string[] {
    return (this.enviadas.get(dev) ?? []).map((m) => m.tipo);
  }
}

function pedirEntrada(t: TransporteFalso, dev: string, id: string, nome: string) {
  t.conectar(dev);
  t.receber(dev, criarMensagem('SOLICITACAO_ENTRADA', id, { nome, jogadorId: id }));
}

let t: TransporteFalso;
let host: HostController;
let finais: { r: ResultadoPartida; v: VisaoJogador | null }[];

beforeEach(async () => {
  vi.useFakeTimers();
  t = new TransporteFalso();
  finais = [];
  host = new HostController(
    t,
    { id: 'host', nome: 'Ana' },
    { aoAtualizar: () => {}, aoAvisar: () => {}, aoFinalizar: (r, v) => finais.push({ r, v }) },
    rngFixo(3),
  );
  await host.abrirSala();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sala de espera', () => {
  it('criação da partida: anfitrião entra sozinho e não pode iniciar', () => {
    expect(host.sala.jogadores).toEqual([{ id: 'host', nome: 'Ana', anfitriao: true }]);
    expect(host.iniciarPartida()).toMatch(/pelo menos 2/);
  });

  it('entrada de um segundo jogador (após aceite)', () => {
    pedirEntrada(t, 'd1', 'bia', 'Bia');
    expect(host.pendentes).toHaveLength(1);
    expect(host.sala.jogadores).toHaveLength(1);
    host.aceitar('d1');
    expect(host.sala.jogadores.map((j) => j.nome)).toEqual(['Ana', 'Bia']);
    expect(t.ultima('d1')?.tipo).toBe('ENTRADA_ACEITA');
  });

  it('entrada de vários jogadores, todos avisados', () => {
    pedirEntrada(t, 'd1', 'bia', 'Bia');
    host.aceitar('d1');
    pedirEntrada(t, 'd2', 'caio', 'Caio');
    host.aceitar('d2');
    pedirEntrada(t, 'd3', 'duda', 'Duda');
    host.aceitar('d3');
    expect(host.sala.jogadores).toHaveLength(4);
    expect(t.tipos('d1').filter((x) => x === 'JOGADOR_ENTROU')).toHaveLength(2);
  });

  it('recusa de um jogador', () => {
    pedirEntrada(t, 'd1', 'bia', 'Bia');
    host.recusar('d1');
    expect(t.ultima('d1')?.tipo).toBe('ENTRADA_RECUSADA');
    vi.advanceTimersByTime(1000);
    expect(t.desconectados).toContain('d1');
    expect(host.sala.jogadores).toHaveLength(1);
  });

  it('limite de 6 jogadores', () => {
    for (let i = 1; i <= 5; i++) {
      pedirEntrada(t, `d${i}`, `j${i}`, `J${i}`);
      host.aceitar(`d${i}`);
    }
    pedirEntrada(t, 'd6', 'j6', 'J6');
    expect(t.ultima('d6')?.tipo).toBe('ENTRADA_RECUSADA');
  });

  it('jogador sai da sala antes do início', () => {
    pedirEntrada(t, 'd1', 'bia', 'Bia');
    host.aceitar('d1');
    t.receber('d1', criarMensagem('JOGADOR_SAIU', 'bia', {}));
    expect(host.sala.jogadores).toHaveLength(1);
  });
});

describe('partida', () => {
  beforeEach(() => {
    pedirEntrada(t, 'd1', 'bia', 'Bia');
    host.aceitar('d1');
    pedirEntrada(t, 'd2', 'caio', 'Caio');
    host.aceitar('d2');
    expect(host.iniciarPartida()).toBeNull();
  });

  it('distribui e envia a cada um só a própria mão', () => {
    const m = t.ultima('d1')!;
    expect(m.tipo).toBe('PARTIDA_INICIADA');
    const visao = (m.dados as { visao: VisaoJogador }).visao;
    expect(visao.meuId).toBe('bia');
    expect(visao.minhaMao).toEqual(host.estado!.maos.bia);
    const outras = [...host.estado!.maos.host, ...host.estado!.maos.caio].map((c) => c.id);
    expect(outras.some((id) => JSON.stringify(m).includes(`"${id}"`))).toBe(false);
  });

  it('troca de cartas sincroniza todos os dispositivos', () => {
    const carta = host.estado!.maos.host[0];
    expect(host.jogar(carta.id)).toBeNull();
    for (const dev of ['d1', 'd2']) expect(t.ultima(dev)?.tipo).toBe('TROCA_REALIZADA');
    const visaoBia = (t.ultima('d1')!.dados as { visao: VisaoJogador }).visao;
    expect(visaoBia.minhaMao.map((c) => c.id)).toContain(carta.id);
    expect(visaoBia.vez).toBe('bia');
  });

  it('bloqueia jogada fora do turno vinda do Bluetooth', () => {
    const cartaCaio = host.estado!.maos.caio[0];
    t.receber('d2', criarMensagem('JOGADA', 'caio', { cartaId: cartaCaio.id }));
    expect(t.ultima('d2')?.tipo).toBe('ERRO');
    expect(host.estado!.totalTrocas).toBe(0);
  });

  it('impede um dispositivo de jogar em nome de outro', () => {
    host.jogar(host.estado!.maos.host[0].id); // vez da Bia
    const cartaBia = host.estado!.maos.bia[0];
    t.receber('d2', criarMensagem('JOGADA', 'bia', { cartaId: cartaBia.id }));
    expect(t.ultima('d2')?.tipo).toBe('ERRO');
    expect(host.estado!.vez).toBe('bia');
  });

  it('recusa novos jogadores durante a partida', () => {
    pedirEntrada(t, 'd9', 'zeca', 'Zeca');
    expect(t.ultima('d9')?.tipo).toBe('ENTRADA_RECUSADA');
  });

  it('desconexão pausa, reconexão retoma', () => {
    t.cair('d2');
    expect(host.visao!.pausada).toBe(true);
    expect(t.ultima('d1')?.tipo).toBe('JOGADOR_DESCONECTADO');
    expect(host.jogar(host.estado!.maos.host[0].id)).toMatch(/pausada/);

    const token = (t.enviadas.get('d2')!.find((m) => m.tipo === 'ENTRADA_ACEITA')!.dados as { token: string }).token;
    t.conectar('d2b');
    t.receber('d2b', criarMensagem('RECONEXAO', 'caio', { jogadorId: 'caio', token: 'errado' }));
    expect(t.ultima('d2b')?.tipo).toBe('ENTRADA_RECUSADA');

    t.conectar('d2c');
    t.receber('d2c', criarMensagem('RECONEXAO', 'caio', { jogadorId: 'caio', token }));
    expect(host.visao!.pausada).toBe(false);
    expect(t.ultima('d2c')?.tipo).toBe('RECONEXAO');
    expect(host.jogar(host.estado!.maos.host[0].id)).toBeNull();
  });

  it('desconexão sem retorno interrompe a partida', () => {
    t.cair('d2');
    vi.advanceTimersByTime(TEMPO_RECONEXAO_MS + 10);
    expect(host.estado!.fase).toBe('encerrada');
    expect(finais[0].r).toMatchObject({ status: 'interrompida', motivo: 'desconexao', responsavelId: 'caio' });
    expect(t.ultima('d1')?.tipo).toBe('PARTIDA_FINALIZADA');
  });

  it('abandono de jogador encerra a partida', () => {
    t.receber('d1', criarMensagem('JOGADOR_SAIU', 'bia', {}));
    expect(finais[0].r).toMatchObject({ status: 'interrompida', motivo: 'abandono' });
  });

  it('tempo de batida esgotado é aplicado automaticamente', () => {
    const e = host.estado!;
    // força a mão do anfitrião para quatro iguais
    host.estado = {
      ...e,
      maos: {
        ...e.maos,
        host: [
          { id: 'A-copas', valor: 'A', naipe: 'copas' },
          { id: 'A-ouros', valor: 'A', naipe: 'ouros' },
          { id: 'A-espadas', valor: 'A', naipe: 'espadas' },
          { id: 'A-paus', valor: 'A', naipe: 'paus' },
          { id: 'BURRO', valor: 'BURRO', naipe: null },
        ],
      },
    };
    expect(host.completar()).toBeNull();
    t.receber('d1', criarMensagem('BATER', 'bia', {}));
    expect(host.estado!.fase).toBe('fim_mao');
    expect(host.estado!.historicoMaos[0].penalizadoId).toBe('caio');
  });

  it('nova partida volta todos para a sala', () => {
    t.receber('d1', criarMensagem('JOGADOR_SAIU', 'bia', {}));
    host.novaPartida();
    expect(host.estado).toBeNull();
    expect(t.ultima('d2')?.tipo).toBe('SALA_ATUALIZADA');
  });
});

describe('histórico', () => {
  it('salva, consulta detalhes, exclui e limpa', async () => {
    const mem = new Map<string, string>();
    const repo = new LocalHistoricoRepository({
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    });
    pedirEntrada(t, 'd1', 'bia', 'Bia');
    host.aceitar('d1');
    host.iniciarPartida();
    t.receber('d1', criarMensagem('JOGADOR_SAIU', 'bia', {}));
    const { r, v } = finais[0];
    const reg = montarRegistro(v!, r, 'anfitriao', 'bluetooth');
    await repo.salvar(reg);

    const lista = await repo.listar();
    expect(lista).toHaveLength(1);
    const det = await repo.buscar(reg.id);
    expect(det?.status).toBe('interrompida');
    expect(det?.participantes.map((p) => p.nome)).toEqual(['Ana', 'Bia']);
    expect(det?.responsavelNome).toBe('Bia');
    expect(det?.resultadoLocal).toBe('sem_resultado');

    await repo.excluir(reg.id);
    expect(await repo.listar()).toHaveLength(0);
    await repo.salvar(reg);
    await repo.limpar();
    expect(await repo.listar()).toHaveLength(0);
  });
});

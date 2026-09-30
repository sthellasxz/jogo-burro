/**
 * Abstração do meio de comunicação. O jogo não sabe se está falando por
 * Bluetooth de verdade ou com bots do modo demonstração.
 *
 * Topologia estrela: o anfitrião é o servidor (periférico BLE / GATT server);
 * cada convidado é um cliente (central BLE) conectado somente ao anfitrião.
 */

export interface AnuncioSala {
  nomeAnfitriao: string;
  jogadores: number;
  maxJogadores: number;
  emAndamento: boolean;
}

export interface SalaEncontrada extends AnuncioSala {
  deviceId: string;
  rssi: number | null;
}

export interface HostTransportEvents {
  conectado: (deviceId: string) => void;
  desconectado: (deviceId: string) => void;
  mensagem: (deviceId: string, texto: string) => void;
}

export interface HostTransport {
  iniciar(anuncio: AnuncioSala): Promise<void>;
  atualizarAnuncio(anuncio: AnuncioSala): Promise<void>;
  parar(): Promise<void>;
  enviar(deviceId: string, texto: string): Promise<void>;
  desconectar(deviceId: string): Promise<void>;
  on<E extends keyof HostTransportEvents>(evento: E, fn: HostTransportEvents[E]): void;
}

export interface ClientTransportEvents {
  mensagem: (texto: string) => void;
  desconectado: () => void;
}

export interface ClientTransport {
  procurar(aoEncontrar: (sala: SalaEncontrada) => void): Promise<void>;
  pararProcura(): Promise<void>;
  conectar(deviceId: string): Promise<void>;
  desconectar(): Promise<void>;
  enviar(texto: string): Promise<void>;
  on<E extends keyof ClientTransportEvents>(evento: E, fn: ClientTransportEvents[E]): void;
}

/** Emissor de eventos mínimo e tipado. */
export class Emissor<Ev extends { [K in keyof Ev]: (...args: never[]) => void }> {
  private ouvintes: { [K in keyof Ev]?: Ev[K][] } = {};

  on<E extends keyof Ev>(evento: E, fn: Ev[E]): void {
    (this.ouvintes[evento] ??= []).push(fn);
  }

  emitir<E extends keyof Ev>(evento: E, ...args: Parameters<Ev[E]>): void {
    for (const fn of this.ouvintes[evento] ?? []) (fn as (...a: Parameters<Ev[E]>) => void)(...args);
  }
}

/** Fila que executa tarefas assíncronas uma de cada vez (BLE não aceita operações simultâneas). */
export class FilaSerial {
  private cauda: Promise<unknown> = Promise.resolve();

  executar<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = this.cauda.then(tarefa, tarefa);
    this.cauda = resultado.catch(() => undefined);
    return resultado;
  }
}

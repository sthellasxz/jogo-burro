import { Emissor, FilaSerial, type AnuncioSala, type HostTransport, type HostTransportEvents } from '../types';
import { Fragmentador, Remontador, deBase64, paraBase64 } from '../framing';
import { BURRO_RX, BURRO_SERVICE, BURRO_TX, COMPANY_ID, codificarAnuncio } from './constants';
import { BurroPeripheral } from './peripheralPlugin';

interface Conexao {
  mtu: number;
  inscrito: boolean;
  remontador: Remontador;
  /** Mensagens aguardando o convidado assinar as notificações. */
  pendentes: string[];
}

/**
 * Anfitrião: servidor GATT via plugin nativo BurroPeripheral.
 * Cada convidado escreve na característica RX; o anfitrião responde
 * por notificação na característica TX, individualmente para cada dispositivo
 * (é assim que cada jogador recebe apenas as próprias cartas).
 */
export class BleHostTransport implements HostTransport {
  private eventos = new Emissor<HostTransportEvents>();
  private fila = new FilaSerial();
  private fragmentador = new Fragmentador();
  private conexoes = new Map<string, Conexao>();

  on<E extends keyof HostTransportEvents>(evento: E, fn: HostTransportEvents[E]): void {
    this.eventos.on(evento, fn);
  }

  async iniciar(anuncio: AnuncioSala): Promise<void> {
    const { suportado, motivo } = await BurroPeripheral.suportado();
    if (!suportado) throw new Error(motivo ?? 'Este aparelho não consegue anunciar partidas via Bluetooth');
    const { concedidas } = await BurroPeripheral.garantirPermissoes();
    if (!concedidas) throw new Error('Permissão de Bluetooth negada. Libere "Dispositivos próximos" nas configurações.');

    await BurroPeripheral.removeAllListeners();
    await BurroPeripheral.addListener('conexao', ({ deviceId, conectado }) => {
      if (conectado) {
        this.conexoes.set(deviceId, { mtu: 23, inscrito: false, remontador: new Remontador(), pendentes: [] });
        this.eventos.emitir('conectado', deviceId);
      } else if (this.conexoes.delete(deviceId)) {
        this.eventos.emitir('desconectado', deviceId);
      }
    });
    await BurroPeripheral.addListener('mtu', ({ deviceId, mtu }) => {
      const c = this.conexoes.get(deviceId);
      if (c) c.mtu = mtu;
    });
    await BurroPeripheral.addListener('inscricao', ({ deviceId, ativa }) => {
      const c = this.conexoes.get(deviceId);
      if (!c) return;
      c.inscrito = ativa;
      if (ativa) {
        const pendentes = c.pendentes.splice(0);
        for (const texto of pendentes) void this.enviar(deviceId, texto);
      }
    });
    await BurroPeripheral.addListener('escrita', ({ deviceId, valor }) => {
      const c = this.conexoes.get(deviceId);
      if (!c) return;
      const texto = c.remontador.receber(deBase64(valor));
      if (texto !== null) this.eventos.emitir('mensagem', deviceId, texto);
    });

    await BurroPeripheral.iniciar({
      serviceUuid: BURRO_SERVICE,
      rxUuid: BURRO_RX,
      txUuid: BURRO_TX,
      companyId: COMPANY_ID,
      dadosAnuncio: paraBase64(codificarAnuncio(anuncio)),
    });
  }

  async atualizarAnuncio(anuncio: AnuncioSala): Promise<void> {
    await BurroPeripheral.atualizarAnuncio({ dadosAnuncio: paraBase64(codificarAnuncio(anuncio)) });
  }

  async parar(): Promise<void> {
    this.conexoes.clear();
    await BurroPeripheral.parar();
    await BurroPeripheral.removeAllListeners();
  }

  async enviar(deviceId: string, texto: string): Promise<void> {
    const c = this.conexoes.get(deviceId);
    if (!c) return;
    if (!c.inscrito) {
      c.pendentes.push(texto);
      return;
    }
    const quadros = this.fragmentador.fragmentar(texto, Math.min(c.mtu - 3, 509));
    await this.fila.executar(async () => {
      for (const q of quadros) {
        await BurroPeripheral.notificar({ deviceId, valor: paraBase64(q) });
      }
    });
  }

  async desconectar(deviceId: string): Promise<void> {
    await BurroPeripheral.desconectar({ deviceId }).catch(() => undefined);
  }
}

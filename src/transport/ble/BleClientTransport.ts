import { BleClient, numbersToDataView, type ScanResult } from '@capacitor-community/bluetooth-le';
import { Emissor, FilaSerial, type ClientTransport, type ClientTransportEvents, type SalaEncontrada } from '../types';
import { Fragmentador, Remontador } from '../framing';
import { BURRO_RX, BURRO_SERVICE, BURRO_TX, COMPANY_ID, decodificarAnuncio } from './constants';

/**
 * Convidado: usa o plugin @capacitor-community/bluetooth-le no papel de central BLE.
 * Procura dispositivos anunciando o serviço do jogo, conecta, assina as
 * notificações (anfitrião → convidado) e escreve na característica RX.
 */
export class BleClientTransport implements ClientTransport {
  private eventos = new Emissor<ClientTransportEvents>();
  private fila = new FilaSerial();
  private fragmentador = new Fragmentador();
  private remontador = new Remontador();
  private deviceId: string | null = null;
  private tamanhoQuadro = 20;
  private desconexaoIntencional = false;

  on<E extends keyof ClientTransportEvents>(evento: E, fn: ClientTransportEvents[E]): void {
    this.eventos.on(evento, fn);
  }

  async procurar(aoEncontrar: (sala: SalaEncontrada) => void): Promise<void> {
    await BleClient.requestLEScan({ services: [BURRO_SERVICE], allowDuplicates: true }, (r: ScanResult) => {
      const dados = r.manufacturerData?.[String(COMPANY_ID)];
      const anuncio = dados ? decodificarAnuncio(new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength)) : null;
      aoEncontrar({
        deviceId: r.device.deviceId,
        rssi: r.rssi ?? null,
        ...(anuncio ?? {
          nomeAnfitriao: r.localName || r.device.name || 'Partida sem nome',
          jogadores: 0,
          maxJogadores: 6,
          emAndamento: false,
        }),
      });
    });
  }

  async pararProcura(): Promise<void> {
    await BleClient.stopLEScan();
  }

  async conectar(deviceId: string): Promise<void> {
    this.desconexaoIntencional = false;
    this.remontador = new Remontador();
    await BleClient.connect(
      deviceId,
      () => {
        this.deviceId = null;
        if (!this.desconexaoIntencional) this.eventos.emitir('desconectado');
      },
      { timeout: 10000 },
    );
    this.deviceId = deviceId;
    try {
      // O plugin negocia MTU 512 no Android; o valor real define o tamanho dos quadros.
      const mtu = await BleClient.getMtu(deviceId);
      this.tamanhoQuadro = Math.max(20, Math.min(mtu - 3, 509));
    } catch {
      this.tamanhoQuadro = 20;
    }
    await BleClient.startNotifications(deviceId, BURRO_SERVICE, BURRO_TX, (valor) => {
      const texto = this.remontador.receber(new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength));
      if (texto !== null) this.eventos.emitir('mensagem', texto);
    });
  }

  async desconectar(): Promise<void> {
    const id = this.deviceId;
    this.desconexaoIntencional = true;
    this.deviceId = null;
    if (id) await BleClient.disconnect(id).catch(() => undefined);
  }

  async enviar(texto: string): Promise<void> {
    const id = this.deviceId;
    if (!id) throw new Error('Sem conexão com o anfitrião');
    const quadros = this.fragmentador.fragmentar(texto, this.tamanhoQuadro);
    await this.fila.executar(async () => {
      for (const q of quadros) {
        await BleClient.write(id, BURRO_SERVICE, BURRO_RX, numbersToDataView(Array.from(q)));
      }
    });
  }
}

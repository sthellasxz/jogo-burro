import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * Interface TypeScript do plugin nativo BurroPeripheral (Android).
 * Implementação: android/app/src/main/java/com/jogoburro/app/BurroPeripheralPlugin.java
 *
 * Por que um plugin próprio? O @capacitor-community/bluetooth-le só implementa o papel
 * de CENTRAL (procurar/conectar). Para alguém "criar" a partida, o celular precisa ser
 * PERIFÉRICO: anunciar a sala e aceitar conexões (GATT server). Isso é feito aqui.
 */
export interface IniciarOptions {
  serviceUuid: string;
  rxUuid: string;
  txUuid: string;
  companyId: number;
  /** Dados de fabricante do anúncio, em base64. */
  dadosAnuncio: string;
}

export interface BurroPeripheralPlugin {
  suportado(): Promise<{ suportado: boolean; motivo?: string }>;
  garantirPermissoes(): Promise<{ concedidas: boolean }>;
  iniciar(options: IniciarOptions): Promise<void>;
  atualizarAnuncio(options: { dadosAnuncio: string }): Promise<void>;
  parar(): Promise<void>;
  notificar(options: { deviceId: string; valor: string }): Promise<void>;
  desconectar(options: { deviceId: string }): Promise<void>;
  addListener(evento: 'conexao', fn: (e: { deviceId: string; conectado: boolean }) => void): Promise<PluginListenerHandle>;
  addListener(evento: 'escrita', fn: (e: { deviceId: string; valor: string }) => void): Promise<PluginListenerHandle>;
  addListener(evento: 'mtu', fn: (e: { deviceId: string; mtu: number }) => void): Promise<PluginListenerHandle>;
  addListener(evento: 'inscricao', fn: (e: { deviceId: string; ativa: boolean }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const BurroPeripheral = registerPlugin<BurroPeripheralPlugin>('BurroPeripheral');

import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

export type EstadoBluetooth = 'ok' | 'indisponivel' | 'desligado' | 'sem_permissao';

let inicializado = false;

export function bluetoothNativoDisponivel(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Inicializa o plugin (pede as permissões de "Dispositivos próximos" / localização)
 * e confere se o Bluetooth está ligado, oferecendo ligá-lo.
 */
export async function prepararBluetooth(): Promise<EstadoBluetooth> {
  if (!bluetoothNativoDisponivel()) return 'indisponivel';
  try {
    if (!inicializado) {
      await BleClient.initialize({ androidNeverForLocation: true });
      inicializado = true;
    }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    return msg.includes('permission') ? 'sem_permissao' : 'indisponivel';
  }
  if (await BleClient.isEnabled()) return 'ok';
  try {
    await BleClient.requestEnable();
  } catch {
    return 'desligado';
  }
  return (await BleClient.isEnabled()) ? 'ok' : 'desligado';
}

export const MENSAGENS_BLUETOOTH: Record<Exclude<EstadoBluetooth, 'ok'>, string> = {
  indisponivel: 'Bluetooth não disponível neste dispositivo. Use o modo demonstração para testar no navegador.',
  desligado: 'O Bluetooth está desligado. Ligue-o para criar ou entrar em uma partida.',
  sem_permissao: 'Permissão de Bluetooth negada. Libere "Dispositivos próximos" nas configurações do app.',
};

export async function abrirConfiguracoesApp(): Promise<void> {
  await BleClient.openAppSettings().catch(() => undefined);
}

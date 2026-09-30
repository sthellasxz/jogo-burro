import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { alertController, toastController } from '@ionic/vue';
import type { Aviso } from '@/session/descrever';

const COR: Record<Aviso['tipo'], string> = {
  info: 'dark',
  sucesso: 'success',
  alerta: 'warning',
  erro: 'danger',
};

let atual: HTMLIonToastElement | null = null;

/** Mostra um aviso no topo. Um aviso novo substitui o anterior (evita pilha de toasts). */
export async function mostrarAviso(aviso: Aviso): Promise<void> {
  const anterior = atual;
  const toast = await toastController.create({
    message: aviso.texto,
    color: COR[aviso.tipo],
    duration: aviso.tipo === 'erro' ? 3500 : 2200,
    position: 'top',
  });
  atual = toast;
  anterior?.dismiss().catch(() => undefined);
  await toast.present();
  if (aviso.tipo === 'alerta' || aviso.tipo === 'erro') vibrar(aviso.tipo === 'erro' ? 'erro' : 'alerta');
}

export function erro(texto: string): Promise<void> {
  return mostrarAviso({ texto, tipo: 'erro' });
}

export function vibrar(tipo: 'toque' | 'alerta' | 'erro' = 'toque'): void {
  const p =
    tipo === 'toque'
      ? Haptics.impact({ style: ImpactStyle.Light })
      : Haptics.notification({ type: tipo === 'erro' ? NotificationType.Error : NotificationType.Warning });
  p.catch(() => undefined);
}

/** Pede confirmação para ações importantes (sair, excluir…). */
export async function confirmar(titulo: string, mensagem: string, botao = 'Confirmar'): Promise<boolean> {
  const alerta = await alertController.create({
    header: titulo,
    message: mensagem,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: botao, role: 'confirm', cssClass: 'alerta-perigo' },
    ],
  });
  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  return role === 'confirm';
}

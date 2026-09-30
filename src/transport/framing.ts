/**
 * Fragmentação de mensagens para BLE.
 *
 * Cada escrita/notificação BLE carrega no máximo (MTU - 3) bytes. Um JSON com o
 * estado da partida passa facilmente disso, então cada mensagem é quebrada em quadros:
 *
 *   byte 0: número da mensagem (0–255, circular)
 *   byte 1: índice do quadro (0-based)
 *   byte 2: total de quadros
 *   bytes 3…: pedaço do texto UTF-8
 */

export const CABECALHO = 3;
const MAX_QUADROS = 255;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class Fragmentador {
  private numero = 0;

  fragmentar(texto: string, tamanhoQuadro: number): Uint8Array[] {
    const util = tamanhoQuadro - CABECALHO;
    if (util < 1) throw new Error('Quadro BLE pequeno demais');
    const bytes = encoder.encode(texto);
    const total = Math.max(1, Math.ceil(bytes.length / util));
    if (total > MAX_QUADROS) throw new Error('Mensagem grande demais para enviar via Bluetooth');

    const numero = this.numero;
    this.numero = (this.numero + 1) % 256;
    const quadros: Uint8Array[] = [];
    for (let i = 0; i < total; i++) {
      const pedaco = bytes.subarray(i * util, (i + 1) * util);
      const quadro = new Uint8Array(CABECALHO + pedaco.length);
      quadro[0] = numero;
      quadro[1] = i;
      quadro[2] = total;
      quadro.set(pedaco, CABECALHO);
      quadros.push(quadro);
    }
    return quadros;
  }
}

/** Remonta mensagens de UMA origem. Use uma instância por dispositivo conectado. */
export class Remontador {
  private numero = -1;
  private partes: Uint8Array[] = [];
  private total = 0;

  /** Retorna o texto completo quando o último quadro chega; senão, null. */
  receber(quadro: Uint8Array): string | null {
    if (quadro.length < CABECALHO) return null;
    const [numero, indice, total] = quadro;
    if (total === 0 || indice >= total) return null;

    if (numero !== this.numero || indice === 0) {
      // Nova mensagem: descarta qualquer resto incompleto da anterior.
      this.numero = numero;
      this.total = total;
      this.partes = [];
    }
    if (indice !== this.partes.length || total !== this.total) {
      // Quadro fora de ordem: descarta a mensagem inteira.
      this.numero = -1;
      this.partes = [];
      return null;
    }
    this.partes.push(quadro.subarray(CABECALHO));
    if (this.partes.length < this.total) return null;

    const tamanho = this.partes.reduce((s, p) => s + p.length, 0);
    const junto = new Uint8Array(tamanho);
    let pos = 0;
    for (const p of this.partes) {
      junto.set(p, pos);
      pos += p.length;
    }
    this.numero = -1;
    this.partes = [];
    return decoder.decode(junto);
  }
}

export function paraBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function deBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

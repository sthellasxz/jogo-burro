import type { AnuncioSala } from '../types';

/** UUIDs do serviço GATT do jogo (gerados aleatoriamente para este projeto). */
export const BURRO_SERVICE = '6b1d0001-5c3a-4f7e-9b2e-8a4c0f1e2d3b';
/** Convidado → anfitrião (write). */
export const BURRO_RX = '6b1d0002-5c3a-4f7e-9b2e-8a4c0f1e2d3b';
/** Anfitrião → convidado (notify). */
export const BURRO_TX = '6b1d0003-5c3a-4f7e-9b2e-8a4c0f1e2d3b';

/** 0xFFFF é o identificador reservado para testes/uso interno pelo Bluetooth SIG. */
export const COMPANY_ID = 0xffff;
const VERSAO_ANUNCIO = 1;
/** Scan response tem 31 bytes: 2 (tamanho/tipo) + 2 (company id) + 27 de dados. */
const MAX_BYTES_NOME = 23;

/**
 * Dados de fabricante anunciados pelo anfitrião:
 *   [versão, jogadores, máximo, emAndamento, ...nome UTF-8 (até 23 bytes)]
 */
export function codificarAnuncio(a: AnuncioSala): Uint8Array {
  let nome = new TextEncoder().encode(a.nomeAnfitriao);
  if (nome.length > MAX_BYTES_NOME) {
    // Corta sem quebrar um caractere multibyte ao meio.
    let fim = MAX_BYTES_NOME;
    while (fim > 0 && (nome[fim] & 0xc0) === 0x80) fim--;
    nome = nome.subarray(0, fim);
  }
  const bytes = new Uint8Array(4 + nome.length);
  bytes[0] = VERSAO_ANUNCIO;
  bytes[1] = a.jogadores;
  bytes[2] = a.maxJogadores;
  bytes[3] = a.emAndamento ? 1 : 0;
  bytes.set(nome, 4);
  return bytes;
}

export function decodificarAnuncio(bytes: Uint8Array): AnuncioSala | null {
  if (bytes.length < 4 || bytes[0] !== VERSAO_ANUNCIO) return null;
  return {
    jogadores: bytes[1],
    maxJogadores: bytes[2],
    emAndamento: bytes[3] === 1,
    nomeAnfitriao: new TextDecoder().decode(bytes.subarray(4)) || 'Partida',
  };
}

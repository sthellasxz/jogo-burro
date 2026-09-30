import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { LocalHistoricoRepository } from './LocalHistoricoRepository';
import { SqliteHistoricoRepository } from './SqliteHistoricoRepository';
import type { HistoricoRepository, RegistroPartida } from './types';

export * from './types';
export { montarRegistro } from './registro';

let repo: HistoricoRepository | null = null;

/** SQLite no celular; localStorage no navegador. */
export function historico(): HistoricoRepository {
  repo ??= Capacitor.isNativePlatform() ? new SqliteHistoricoRepository() : new LocalHistoricoRepository();
  return repo;
}

// ---------- Perfil do jogador (arquivo JSON local) ----------

export interface PerfilSalvo {
  id: string;
  nome: string;
}

const ARQUIVO_PERFIL = 'perfil.json';

export async function carregarPerfil(): Promise<PerfilSalvo | null> {
  try {
    const { data } = await Filesystem.readFile({
      path: ARQUIVO_PERFIL,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const p = JSON.parse(String(data));
    return typeof p?.id === 'string' && typeof p?.nome === 'string' ? p : null;
  } catch {
    return null;
  }
}

export async function salvarPerfil(p: PerfilSalvo): Promise<void> {
  await Filesystem.writeFile({
    path: ARQUIVO_PERFIL,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    data: JSON.stringify(p),
  });
}

// ---------- Exportação do histórico para arquivo ----------

/** Exporta o histórico como JSON. Retorna onde o arquivo foi salvo. */
export async function exportarHistorico(registros: RegistroPartida[]): Promise<string> {
  const conteudo = JSON.stringify({ app: 'jogo-burro', exportadoEm: new Date().toISOString(), registros }, null, 2);
  const nome = `burro-historico-${new Date().toISOString().slice(0, 10)}.json`;

  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
    return `Downloads/${nome}`;
  }
  try {
    const r = await Filesystem.writeFile({ path: nome, data: conteudo, directory: Directory.Documents, encoding: Encoding.UTF8 });
    return r.uri;
  } catch {
    // Alguns Android restringem a pasta pública; usa a pasta externa do app.
    const r = await Filesystem.writeFile({ path: nome, data: conteudo, directory: Directory.External, encoding: Encoding.UTF8 });
    return r.uri;
  }
}

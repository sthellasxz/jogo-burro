import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { HistoricoRepository, ParticipanteRegistro, RegistroPartida } from './types';

const BANCO = 'burro';

/** Versão 1 do esquema. Novas versões devem acrescentar migrações aqui. */
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS partidas (
  id               TEXT PRIMARY KEY NOT NULL,
  iniciada_em      INTEGER NOT NULL,
  finalizada_em    INTEGER NOT NULL,
  status           TEXT NOT NULL,
  motivo           TEXT NOT NULL,
  papel            TEXT NOT NULL,
  modo             TEXT NOT NULL,
  vencedor_nome    TEXT,
  penalizado_nome  TEXT,
  responsavel_nome TEXT,
  qtd_jogadores    INTEGER NOT NULL,
  qtd_maos         INTEGER NOT NULL,
  qtd_trocas       INTEGER NOT NULL,
  jogador_local_id TEXT NOT NULL,
  resultado_local  TEXT NOT NULL,
  maos_json        TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participantes (
  partida_id     TEXT NOT NULL,
  jogador_id     TEXT NOT NULL,
  nome           TEXT NOT NULL,
  ordem          INTEGER NOT NULL,
  letras         INTEGER NOT NULL,
  maos_vencidas  INTEGER NOT NULL,
  anfitriao      INTEGER NOT NULL,
  PRIMARY KEY (partida_id, jogador_id),
  FOREIGN KEY (partida_id) REFERENCES partidas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_partidas_data ON partidas(iniciada_em DESC);
`;

interface LinhaPartida {
  id: string;
  iniciada_em: number;
  finalizada_em: number;
  status: RegistroPartida['status'];
  motivo: RegistroPartida['motivo'];
  papel: RegistroPartida['papel'];
  modo: RegistroPartida['modo'];
  vencedor_nome: string | null;
  penalizado_nome: string | null;
  responsavel_nome: string | null;
  qtd_maos: number;
  qtd_trocas: number;
  jogador_local_id: string;
  resultado_local: RegistroPartida['resultadoLocal'];
  maos_json: string;
}

interface LinhaParticipante {
  partida_id: string;
  jogador_id: string;
  nome: string;
  ordem: number;
  letras: number;
  maos_vencidas: number;
  anfitriao: number;
}

/** Histórico em SQLite (Android/iOS) via @capacitor-community/sqlite. */
export class SqliteHistoricoRepository implements HistoricoRepository {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private conexao: Promise<SQLiteDBConnection> | null = null;

  private db(): Promise<SQLiteDBConnection> {
    this.conexao ??= (async () => {
      await this.sqlite.checkConnectionsConsistency().catch(() => undefined);
      const existe = (await this.sqlite.isConnection(BANCO, false)).result;
      const db = existe
        ? await this.sqlite.retrieveConnection(BANCO, false)
        : await this.sqlite.createConnection(BANCO, false, 'no-encryption', 1, false);
      await db.open();
      await db.execute(ESQUEMA);
      return db;
    })();
    return this.conexao;
  }

  async salvar(r: RegistroPartida): Promise<void> {
    const db = await this.db();
    // Transação: grava a partida e os participantes juntos, ou nada.
    await db.executeSet([
      { statement: 'DELETE FROM participantes WHERE partida_id = ?', values: [r.id] },
      {
        statement: `INSERT OR REPLACE INTO partidas
          (id, iniciada_em, finalizada_em, status, motivo, papel, modo, vencedor_nome, penalizado_nome,
           responsavel_nome, qtd_jogadores, qtd_maos, qtd_trocas, jogador_local_id, resultado_local, maos_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          r.id,
          r.iniciadaEm,
          r.finalizadaEm,
          r.status,
          r.motivo,
          r.papel,
          r.modo,
          r.vencedorNome,
          r.penalizadoNome,
          r.responsavelNome,
          r.participantes.length,
          r.qtdMaos,
          r.qtdTrocas,
          r.jogadorLocalId,
          r.resultadoLocal,
          JSON.stringify(r.maos),
        ],
      },
      ...r.participantes.map((p) => ({
        statement: `INSERT INTO participantes
          (partida_id, jogador_id, nome, ordem, letras, maos_vencidas, anfitriao) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values: [r.id, p.jogadorId, p.nome, p.ordem, p.letras, p.maosVencidas, p.anfitriao ? 1 : 0],
      })),
    ]);
  }

  async listar(): Promise<RegistroPartida[]> {
    const db = await this.db();
    const partidas = (await db.query('SELECT * FROM partidas ORDER BY iniciada_em DESC')).values as LinhaPartida[];
    const participantes = (await db.query('SELECT * FROM participantes ORDER BY ordem')).values as LinhaParticipante[];
    return (partidas ?? []).map((p) => this.montar(p, participantes ?? []));
  }

  async buscar(id: string): Promise<RegistroPartida | null> {
    const db = await this.db();
    const p = (await db.query('SELECT * FROM partidas WHERE id = ?', [id])).values as LinhaPartida[];
    if (!p?.length) return null;
    const ps = (await db.query('SELECT * FROM participantes WHERE partida_id = ? ORDER BY ordem', [id]))
      .values as LinhaParticipante[];
    return this.montar(p[0], ps ?? []);
  }

  async excluir(id: string): Promise<void> {
    const db = await this.db();
    await db.executeSet([
      { statement: 'DELETE FROM participantes WHERE partida_id = ?', values: [id] },
      { statement: 'DELETE FROM partidas WHERE id = ?', values: [id] },
    ]);
  }

  async limpar(): Promise<void> {
    const db = await this.db();
    await db.execute('DELETE FROM participantes; DELETE FROM partidas;');
  }

  private montar(p: LinhaPartida, todos: LinhaParticipante[]): RegistroPartida {
    const participantes: ParticipanteRegistro[] = todos
      .filter((x) => x.partida_id === p.id)
      .map((x) => ({
        jogadorId: x.jogador_id,
        nome: x.nome,
        ordem: x.ordem,
        letras: x.letras,
        maosVencidas: x.maos_vencidas,
        anfitriao: x.anfitriao === 1,
      }));
    return {
      id: p.id,
      iniciadaEm: p.iniciada_em,
      finalizadaEm: p.finalizada_em,
      status: p.status,
      motivo: p.motivo,
      papel: p.papel,
      modo: p.modo,
      participantes,
      vencedorNome: p.vencedor_nome,
      penalizadoNome: p.penalizado_nome,
      responsavelNome: p.responsavel_nome,
      qtdMaos: p.qtd_maos,
      qtdTrocas: p.qtd_trocas,
      jogadorLocalId: p.jogador_local_id,
      resultadoLocal: p.resultado_local,
      maos: JSON.parse(p.maos_json || '[]'),
    };
  }
}

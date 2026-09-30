import { defineStore } from 'pinia';
import type { ResultadoPartida, VisaoJogador } from '@/game/types';
import type { InfoSala } from '@/protocol/messages';
import { ClientController, type EstadoConexao } from '@/session/ClientController';
import { HostController, type SolicitacaoPendente } from '@/session/HostController';
import { historico, montarRegistro } from '@/storage';
import { BleClientTransport } from '@/transport/ble/BleClientTransport';
import { BleHostTransport } from '@/transport/ble/BleHostTransport';
import { MENSAGENS_BLUETOOTH, prepararBluetooth } from '@/transport/ble/bluetooth';
import { DemoHostTransport } from '@/transport/demo/DemoHostTransport';
import type { SalaEncontrada } from '@/transport/types';
import { erro, mostrarAviso, vibrar } from '@/ui/avisos';
import { usePerfilStore } from './perfil';

export type Papel = 'anfitriao' | 'convidado';
export type Modo = 'bluetooth' | 'demo';
export type ConexaoSessao = EstadoConexao | 'anunciando' | 'erro';

// Controladores ficam fora do estado reativo (são objetos com timers e conexões).
let host: HostController | null = null;
let cliente: ClientController | null = null;
let demo: DemoHostTransport | null = null;

export const useSessaoStore = defineStore('sessao', {
  state: () => ({
    papel: null as Papel | null,
    modo: 'bluetooth' as Modo,
    conexao: 'desconectado' as ConexaoSessao,
    sala: null as InfoSala | null,
    pendentes: [] as SolicitacaoPendente[],
    visao: null as VisaoJogador | null,
    resultado: null as ResultadoPartida | null,
    registroId: null as string | null,
    salasEncontradas: [] as SalaEncontrada[],
    procurando: false,
    carregando: false,
    mensagemErro: null as string | null,
    botsDemo: [] as { deviceId: string; nome: string }[],
  }),

  getters: {
    ehAnfitriao: (s) => s.papel === 'anfitriao',
    emSessao: (s) => s.papel !== null,
  },

  actions: {
    // ---------- Anfitrião ----------

    async criarPartida(modo: Modo, qtdBots = 2) {
      await this.sair(false);
      const perfil = usePerfilStore();
      this.carregando = true;
      this.mensagemErro = null;
      try {
        if (modo === 'bluetooth') {
          const estado = await prepararBluetooth();
          if (estado !== 'ok') throw new Error(MENSAGENS_BLUETOOTH[estado]);
        }
        const transporte = modo === 'demo' ? (demo = new DemoHostTransport(qtdBots)) : new BleHostTransport();
        host = new HostController(transporte, { id: perfil.id, nome: perfil.nome }, {
          aoAtualizar: () => this.sincronizarHost(),
          aoAvisar: (a) => void mostrarAviso(a),
          aoFinalizar: (r, v) => void this.finalizar(r, v),
        });
        this.papel = 'anfitriao';
        this.modo = modo;
        await host.abrirSala();
        this.conexao = 'anunciando';
        this.sincronizarHost();
        await this.router.push('/sala');
      } catch (e) {
        await this.sair(false);
        this.mensagemErro = (e as Error).message;
        await erro(this.mensagemErro);
      } finally {
        this.carregando = false;
      }
    },

    sincronizarHost() {
      if (!host) return;
      this.sala = host.sala;
      this.pendentes = [...host.pendentes];
      this.visao = host.visao;
      this.botsDemo = demo?.listarBots() ?? [];
    },

    aceitar(deviceId: string) {
      host?.aceitar(deviceId);
    },

    recusar(deviceId: string) {
      host?.recusar(deviceId);
    },

    async iniciarPartida() {
      if (!host) return erro('Você não é o anfitrião');
      const falha = host.iniciarPartida();
      if (falha) return erro(falha);
      this.resultado = null;
      this.registroId = null;
      await this.router.replace('/jogo');
    },

    async proximaMao() {
      const falha = host?.proximaMao();
      if (falha) await erro(falha);
    },

    async novaPartida() {
      if (!host) return this.router.replace('/partida');
      host.novaPartida();
      this.resultado = null;
      this.registroId = null;
      this.sincronizarHost();
      await this.router.replace('/sala');
    },

    simularQueda(deviceId: string, volta: boolean) {
      demo?.simularQueda(deviceId, volta ? 4000 : null);
      this.sincronizarHost();
    },

    // ---------- Convidado ----------

    async iniciarProcura() {
      if (this.procurando) return;
      if (this.papel === 'anfitriao') await this.sair(false);
      this.mensagemErro = null;
      const estado = await prepararBluetooth();
      if (estado !== 'ok') {
        this.mensagemErro = MENSAGENS_BLUETOOTH[estado];
        return;
      }
      if (!cliente) this.criarCliente();
      this.salasEncontradas = [];
      this.procurando = true;
      try {
        await cliente!.procurar((sala) => {
          const i = this.salasEncontradas.findIndex((s) => s.deviceId === sala.deviceId);
          if (i >= 0) this.salasEncontradas.splice(i, 1, sala);
          else this.salasEncontradas.push(sala);
        });
      } catch (e) {
        this.procurando = false;
        this.mensagemErro = `Falha ao procurar partidas: ${(e as Error).message}`;
      }
    },

    async pararProcura() {
      this.procurando = false;
      await cliente?.pararProcura();
    },

    criarCliente() {
      const perfil = usePerfilStore();
      cliente = new ClientController(new BleClientTransport(), { id: perfil.id, nome: perfil.nome }, {
        aoAtualizar: () => this.sincronizarCliente(),
        aoAvisar: (a) => void mostrarAviso(a),
        aoAceito: () => void this.router.replace('/sala'),
        aoRecusado: (motivo) => {
          this.papel = null;
          this.mensagemErro = motivo;
          void erro(motivo);
        },
        aoNovaSala: () => {
          this.resultado = null;
          this.registroId = null;
          void this.router.replace('/sala');
        },
        aoIniciar: () => {
          this.resultado = null;
          this.registroId = null;
          vibrar('alerta');
          void this.router.replace('/jogo');
        },
        aoFinalizar: (r, v) => void this.finalizar(r, v),
        aoPerderConexao: (msg) => {
          this.mensagemErro = msg;
          void erro(msg);
          if (!this.resultado) void this.router.replace('/partida');
        },
      });
    },

    sincronizarCliente() {
      if (!cliente) return;
      this.conexao = cliente.conexao;
      this.sala = cliente.sala;
      this.visao = cliente.visao;
    },

    async entrar(sala: SalaEncontrada) {
      if (!cliente) this.criarCliente();
      this.procurando = false;
      this.papel = 'convidado';
      this.modo = 'bluetooth';
      this.mensagemErro = null;
      try {
        await cliente!.entrar(sala);
      } catch (e) {
        this.papel = null;
        this.mensagemErro = (e as Error).message;
        await erro(this.mensagemErro);
      }
    },

    // ---------- Jogadas (anfitrião ou convidado) ----------

    async jogar(cartaId: string) {
      const falha = host ? host.jogar(cartaId) : await cliente?.jogar(cartaId);
      if (falha) await erro(falha);
      else vibrar();
    },

    async completar() {
      const falha = host ? host.completar() : await cliente?.completar();
      if (falha) await erro(falha);
    },

    async bater() {
      const falha = host ? host.bater() : await cliente?.bater();
      if (falha) await erro(falha);
      else vibrar();
    },

    // ---------- Fim e saída ----------

    async finalizar(resultado: ResultadoPartida, visao: VisaoJogador | null) {
      this.resultado = resultado;
      if (visao) this.visao = visao;
      if (!visao) {
        // Sala fechada pelo anfitrião antes de a partida começar: nada a gravar.
        await mostrarAviso({ texto: 'O anfitrião fechou a sala.', tipo: 'alerta' });
        await this.sair(false);
        await this.router.replace('/partida');
        return;
      }
      try {
        const registro = montarRegistro(visao, resultado, this.papel ?? 'convidado', this.modo);
        await historico().salvar(registro);
        this.registroId = registro.id;
      } catch (e) {
        await erro(`Não foi possível salvar o histórico: ${(e as Error).message}`);
      }
      vibrar('alerta');
      await this.router.replace('/resultado');
    },

    /** Sai da sessão atual. `avisarOutros` = enviar mensagem de saída/cancelamento. */
    async sair(avisarOutros = true) {
      const h = host;
      const c = cliente;
      host = null;
      cliente = null;
      demo = null;
      if (h) await (avisarOutros ? h.encerrar() : h.fechar());
      if (c) await c.sair().catch(() => undefined);
      this.$patch({
        papel: null,
        conexao: 'desconectado',
        sala: null,
        pendentes: [],
        visao: null,
        salasEncontradas: [],
        procurando: false,
        botsDemo: [],
      });
    },
  },
});

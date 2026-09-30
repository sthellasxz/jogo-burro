# Decisões técnicas

## Stack

| Decisão | Por quê |
|---|---|
| **Vue 3 + Ionic 9 + Capacitor 8** | Exigência da atividade. Ionic dá componentes móveis prontos (listas, alertas, toasts); Capacitor dá acesso nativo. |
| **TypeScript estrito** | Tipos para jogadores, cartas, partidas e mensagens (`src/game/types.ts`, `src/protocol/messages.ts`). |
| **Pinia** | Estado reativo das telas (`src/stores`). Os controladores de sessão ficam fora do estado reativo porque guardam timers e conexões. |
| **Vitest** | Testes rápidos da lógica sem emulador. |
| **Android como alvo** | O plugin de periférico BLE foi escrito para Android. Ver "Limitações" no README. |

## Arquitetura em camadas

```
src/
  game/        regras puras (sem Vue/Capacitor) → testáveis e reutilizáveis
  protocol/    formato e validação das mensagens
  transport/   meio físico: BLE (cliente e anfitrião) ou demonstração (bots)
  session/     HostController / ClientController: ligam regras + protocolo + transporte
  storage/     histórico (SQLite / localStorage) e perfil (arquivo JSON)
  stores/      Pinia: ponte entre sessão e telas
  views/       telas Ionic
```

A lógica do jogo está totalmente separada da interface: as telas só chamam ações
da store e exibem a `VisaoJogador`.

## Anfitrião autoritativo

- Só o anfitrião roda o motor (`aplicarAcao`). Os convidados enviam **intenções** (`JOGADA`, `BATER`…) e recebem o estado resultante.
- Evita estados divergentes: não existe "cada um calcula a sua versão".
- Privacidade: cada convidado recebe **só as próprias cartas**; as dos outros nunca saem do anfitrião.
- Motor com funções **puras** (estado → novo estado): se uma ação é inválida, nada muda.

## Variação de regras

Escolhemos o Burro **por turnos com giro de uma carta** (quem está na vez tem 5 cartas),
em vez da troca simultânea. Motivos: um "jogador da vez" claro (exigido), uma mensagem por
jogada (mais estável no BLE) e bloqueio simples de jogada fora de turno.
A carta extra "Burro" é o que permite o giro com exatamente um valor por jogador.

## Bluetooth Low Energy

- **Convidado** usa `@capacitor-community/bluetooth-le` (referência da atividade).
- **Anfitrião** precisa ser periférico (anunciar + GATT server), o que o `bluetooth-le` não faz.
  Criamos um **plugin Capacitor nativo** (`BurroPeripheralPlugin.java`),
  registrado no `MainActivity`. Isso também demonstra a integração de recurso nativo do dispositivo.
- **Fragmentação própria** (3 bytes de cabeçalho) porque as mensagens passam do MTU.
- **Fila serial** de envios: o Android só aceita uma operação GATT por vez.
- Anúncio com dados de fabricante (`0xFFFF`) para mostrar nome do anfitrião e lotação **antes** de conectar.
- `androidNeverForLocation`: no Android 12+ o app não pede localização.

## Persistência local

| O quê | Onde | Tecnologia |
|---|---|---|
| Histórico de partidas (celular) | Banco `burro` com tabelas `partidas` e `participantes` | SQLite via `@capacitor-community/sqlite` |
| Histórico (navegador/demonstração) | `localStorage` | Mesma interface `HistoricoRepository` |
| Perfil (nome + id único) | `perfil.json` na pasta de dados do app | `@capacitor/filesystem` |
| Exportação do histórico | `burro-historico-AAAA-MM-DD.json` em Documentos | `@capacitor/filesystem` |

- Gravação da partida + participantes em **transação** (`executeSet`).
- O histórico é salvo **automaticamente** no fim de cada partida, em **cada aparelho**, com o resultado do jogador local.
- Exclusões pedem confirmação.

## Modo demonstração

Os bots conversam com o anfitrião **pelo mesmo protocolo JSON** usado no Bluetooth
(`DemoHostTransport`). Assim dá para testar a sessão inteira no navegador, gravar vídeo e
simular quedas de conexão (ícone de inseto na tela do jogo).

## Tempos

| Parâmetro | Valor | Onde |
|---|---|---|
| Prazo para bater | 6 s | `TEMPO_BATIDA_MS` |
| Espera por reconexão | 45 s | `TEMPO_RECONEXAO_MS` |
| Intervalo entre tentativas de reconexão | 3 s | `ClientController` |

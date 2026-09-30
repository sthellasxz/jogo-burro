# Testes

## Automatizados (Vitest)

```bash
npm test
```

| Teste obrigatório | Onde é coberto |
|---|---|
| Criação de uma partida | `tests/sessao.test.ts` › sala de espera › criação da partida |
| Entrada de um segundo jogador | `sessao.test.ts` › entrada de um segundo jogador |
| Entrada de vários jogadores | `sessao.test.ts` › entrada de vários jogadores / limite de 6 |
| Recusa de um jogador | `sessao.test.ts` › recusa de um jogador |
| Distribuição das cartas | `tests/regras.test.ts` › baralho e distribuição; `sessao.test.ts` › distribui e envia só a própria mão |
| Troca de cartas entre jogadores | `regras.test.ts` › troca de cartas; `sessao.test.ts` › troca sincroniza todos |
| Bloqueio de jogada fora do turno | `regras.test.ts` e `sessao.test.ts` › bloqueia jogada fora do turno / em nome de outro |
| Formação de quatro cartas iguais | `regras.test.ts` › completar, bater e penalidade |
| Finalização da partida | `regras.test.ts` › fim da partida (BURRO completo, partida simulada inteira, bots) |
| Desconexão de um jogador | `sessao.test.ts` › desconexão pausa / sem retorno interrompe |
| Reconexão | `sessao.test.ts` › desconexão pausa, reconexão retoma (inclui token errado) |
| Salvamento do histórico | `sessao.test.ts` › histórico |
| Consulta dos detalhes | `sessao.test.ts` › histórico (buscar) |
| Exclusão do histórico | `sessao.test.ts` › histórico (excluir e limpar) |
| Validação das mensagens | `tests/protocolo.test.ts` |
| Fragmentação BLE | `tests/protocolo.test.ts` › fragmentação BLE |

## Manuais (dois ou mais celulares Android)

Marque cada item ao testar e anote o modelo dos aparelhos.

| # | Passo | Resultado esperado | OK? |
|---|---|---|---|
| 1 | Celular A: Jogar → Criar partida | Pede permissão "Dispositivos próximos"; sala abre com status "Anunciando" | |
| 2 | Celular B: Jogar → Procurar partida | Aparece "Partida de <nome A>" com 1/6 jogadores | |
| 3 | B toca na partida | B mostra "Aguardando o anfitrião aceitar…"; A mostra o pedido | |
| 4 | A toca em **Recusar** | B mostra "O anfitrião recusou sua entrada" | |
| 5 | B pede de novo; A **Aceita** | Os dois veem os 2 nomes na sala | |
| 6 | Celular C entra também | A, B e C veem 3 jogadores | |
| 7 | A inicia a partida | Todos vão para a mesa; cada um vê só as próprias cartas; quem começa tem 5 | |
| 8 | B tenta jogar na vez de A | Cartas desabilitadas; nada é enviado | |
| 9 | A envia uma carta | B recebe (toast "Você recebeu…"), vira a vez de B em todos os aparelhos | |
| 10 | Alguém forma 4 iguais | Aparece "COMPLETEI!"; ao tocar, os outros veem "BATER!" | |
| 11 | Último a bater | Leva uma letra; placar atualizado em todos | |
| 12 | Desligar o Bluetooth de C no meio | A e B: "C desconectou", partida pausada | |
| 13 | Religar o Bluetooth de C em até 45 s | C reconecta e a partida continua | |
| 14 | Repetir 12 sem religar | Após 45 s: partida interrompida em todos, registrada no histórico | |
| 15 | Jogar até alguém completar BURRO | Tela de resultado com vencedor e penalizado; "Salvo no histórico" | |
| 16 | Abrir Histórico e uma partida | Data, jogadores, vencedor, penalizado, rodadas, motivo | |
| 17 | Fechar o app e abrir de novo | Histórico continua lá | |
| 18 | Excluir uma partida / Limpar tudo | Pede confirmação; some da lista | |
| 19 | Modo avião ligado + Bluetooth ligado | O jogo funciona normalmente (**sem internet**) | |
| 20 | Negar a permissão de Bluetooth | Mensagem clara + botão "Abrir configurações do app" | |

## No navegador (modo demonstração)

```bash
npm run dev
```

Abra http://localhost:5173, informe um nome e escolha **Modo demonstração**.
Na mesa, o ícone de inseto (🐞) simula a queda de um bot com e sem retorno.

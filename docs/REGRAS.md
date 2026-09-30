# Regras implementadas

Existem várias variações do Burro. Escolhemos a mais simples de implementar
com turnos bem definidos (bom para Bluetooth: uma jogada por vez, sem disputa).

## Baralho

- Um **valor por jogador**, com os 4 naipes: 2 jogadores → A e K; 3 → A, K, Q; … até 6 → A, K, Q, J, 10, 9.
- Mais **1 carta extra, a "Burro" (🐴)**. Ela nunca forma grupo.
- Total: `4 × jogadores + 1` cartas. Ex.: 3 jogadores = 13 cartas.

## Distribuição

- Cada jogador recebe **4 cartas**; quem começa a mão recebe **5**.
- O sistema embaralha (Fisher–Yates) e refaz a distribuição se alguém já receber 4 iguais.
- Na 1ª mão começa o anfitrião; nas seguintes, começa **quem levou a letra** na mão anterior.

## Turno

1. O jogador da vez (o único com 5 cartas) escolhe **uma carta** e confirma o envio.
2. A carta vai para o **próximo jogador na ordem da mesa** (o último envia para o primeiro).
3. Quem recebeu fica com 5 cartas e passa a ser o jogador da vez.

A tela sempre mostra de quem você recebe e para quem você envia.
Jogadas fora do turno são recusadas no aparelho do jogador e, de novo, no anfitrião.

## Completar e bater

- Quem tiver **4 cartas do mesmo valor** (em qualquer momento da fase de troca) toca em **COMPLETEI**.
  O botão só aparece quando o grupo existe, e o anfitrião confere de novo.
- Os demais jogadores têm **6 segundos** para tocar em **BATER**.
- O **último a bater leva uma letra** de B‑U‑R‑R‑O.
  - Com 2 jogadores, o outro leva a letra na hora.
  - Se o tempo acabar e mais de um não tiver batido, leva a letra quem estiver
    **mais longe do vencedor** seguindo a ordem da mesa.
- Quem completou vence a mão. O anfitrião toca em **Distribuir próxima mão**.

## Fim da partida (condição de encerramento)

- A partida termina quando alguém junta as **5 letras (BURRO)**. Esse é o **jogador penalizado**.
- **Vencedor da partida**: quem tem **menos letras**; empate → mais mãos vencidas; empate → ordem da mesa.
- Outras formas de encerramento (registradas no histórico):

| Situação | Status | Motivo |
|---|---|---|
| Alguém completou BURRO | `finalizada` | `vitoria` |
| Anfitrião saiu/cancelou durante o jogo | `cancelada` | `cancelada` |
| Um convidado saiu durante o jogo | `interrompida` | `abandono` |
| Jogador desconectou e não voltou em 45 s | `interrompida` | `desconexao` |
| Convidado perdeu o anfitrião e não reconectou em 45 s | `interrompida` | `desconexao` |

Depois do fim, o anfitrião pode iniciar **uma nova partida com a mesma sala**.

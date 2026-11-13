# Simulação do Engine V2: justiça e risco R-21

Data: 2026-11-13. Script: `scripts/engine-v2-simulation/` (reproduzível, sementes fixas). Motor: `gameV2` real, com rodada coletiva, ordem de entrada (T-32) e limite por rodada opcional.

**Leitura rápida:** nenhum número abaixo é regra de produto. Todos (24 jogadores, 10 rodadas, 2 a 10 posições, 4 a 16 movimentos, limite de 3 créditos por rodada) são parâmetros do experimento. Cada cenário usa 4.000 partidas, então diferenças menores que cerca de 1 ponto percentual (p.p.) são ruído.

## Como a simulação funciona

- Cada jogador compra posições e movimentos; as posições são distribuídas ao acaso, a barra tem o tamanho da soma das posições e a Sorte começa numa posição sorteada.
- Todos decidem ao mesmo tempo em cada rodada, vendo **só** onde a Sorte está no início da rodada, as próprias posições e o próprio saldo. Ninguém vê a jogada dos outros na rodada.
- Estratégias: **AGGRESSIVE** (gasta o saldo por igual ao longo das rodadas, empurrando a Sorte para a posição própria mais próxima); **HOARDER** (não gasta nada até a última rodada e gasta tudo nela); **RANDOM** (direção e quantidade aleatórias); **PASSIVE** (não age; o motor aplica a ação automática ou pula).
- Resultado: o dono da posição onde a Sorte termina ganha (`winningZoneSize = 1`).

## Resultados

### 1. O jogo base é justo

Quando ninguém se move, a chance de ganhar acompanha a fatia de posições: a maior diferença foi **0,38 p.p.** em 16.000 partidas (dentro do ruído). A Sorte inicial e a barra circular não favorecem ninguém.

### 2. Campo misto (24 jogadores, 4 estratégias)

| Limite por rodada | AGGRESSIVE | HOARDER | RANDOM | PASSIVE |
| ----------------- | ---------- | ------- | ------ | ------- |
| Sem limite        | 1,02       | 1,05    | 0,98   | 0,93    |
| 3 créditos        | **1,18**   | 1,03    | 0,86   | 0,87    |

(Razão entre a chance de ganhar e a fatia de posições; 1,00 é justo.)

- Sem limite, as estratégias se anulam entre si e ninguém tem vantagem relevante.
- Com limite de 3, quem distribui o gasto ao longo das rodadas leva vantagem sobre quem joga ao acaso ou não joga. Estratégia importa, o que é bom para o produto, mas jogador casual perde um pouco (razão 0,86 a 0,87).
- Os 12 primeiros a entrar ganham 50,4% e 50,7% das partidas com 49,6% das posições. Isso mede só o efeito da **ordem de aplicação** das jogadas (T-32) e é pequeno. A vantagem de **escolher posição primeiro** não está medida aqui (as posições foram sorteadas).

### 3. Como dividir 20 créditos entre posições e movimentos

Para quem distribui o gasto (AGGRESSIVE, sem limite), a chance de ganhar fica perto da fatia de posições em quase todas as divisões, ou seja, **comprar posição ou movimento rende parecido**. A exceção é a ponta: com apenas 2 posições e 18 movimentos a razão foi **1,56** (2,35% contra 1,50%), e 1,19 com 4 posições. Isso passa do ruído (cerca de 4 desvios): poucas posições com muitos movimentos têm uma vantagem pequena em valor absoluto, mas relevante em proporção.

### 4. R-21: guardar tudo para a última rodada (mesma compra: 6 posições + 14 movimentos)

| Limite por rodada | Fatia | Gasta ao longo das rodadas | Guarda tudo para a última |
| ----------------- | ----- | -------------------------- | ------------------------- |
| Sem limite        | 4,51% | 5,14%                      | **8,31%**                 |
| 3 créditos        | 4,51% | **6,49%**                  | 5,73%                     |
| 1 crédito         | 4,51% | **7,78%**                  | 6,41%                     |

- **Sem limite, guardar tudo é muito vantajoso:** 8,31% contra 5,14% (+62%). O risco R-21 é real.
- **Com limite por rodada, o efeito se inverte:** quem espalha o gasto passa a ganhar mais. O limite neutraliza o acúmulo, o que confirma a regra BR-068.

## Conclusões e o que fica para a decisão do sócio

1. **O limite por rodada (`maxMovementsPerRound`) é a principal proteção contra o acúmulo.** Recomendo tratá-lo como obrigatório em toda campanha, com um valor escolhido pelo produto. Como referência, 3 créditos por rodada para saldos de 4 a 16 em 10 rodadas já neutralizou o acúmulo; não é regra.
2. **A vantagem de guardar tudo vem de ver onde a Sorte está antes da última rodada.** A simulação deu essa informação por completo, que é o pior caso. Se o produto mostrar só a temperatura em 5 níveis, sem posição exata, o efeito deve diminuir. Isso depende dos limites de temperatura (T-10) e vale uma segunda simulação quando forem definidos.
3. **Quem joga com estratégia vence quem joga ao acaso ou não joga** (razão 1,18 contra 0,86 a 0,87 com limite). Se o produto quiser proteger o jogador casual, isso é uma decisão a tomar.
4. **Poucas posições com muitos movimentos têm leve vantagem proporcional.** Vale observar no piloto antes de fixar o preço do crédito.

## Limites desta simulação

- Jogadores simples e fixos, sem aprender, sem combinar entre si e sem conluio.
- Informação completa sobre a posição da Sorte (ver conclusão 2).
- Posições sorteadas: a vantagem de escolher primeiro não foi medida.
- Um único formato (24 jogadores, 10 rodadas). Outros tamanhos de barra e números de rodadas podem mudar os números.

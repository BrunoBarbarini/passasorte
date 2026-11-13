# Simulação do motor V2 só com temperatura (TASK-108)

> Data: 2026-11-13. Reproduzir: `GAMES=3000 node` sobre o bundle de `scripts/engine-v2-simulation/run-temp.ts`.
> Todos os números abaixo são **parâmetros do experimento**, não regras de produto.

## O que foi simulado

Os jogadores **não veem** a posição da Sorte nem a distância (BR-090). Só veem o nível
(Congelando, Frio, Morno, Quente, Muito quente) no início de cada rodada, calculado com as faixas
iniciais aprovadas em 2026-11-13 (2%, 6%, 15%, 30% da barra). Estratégias:

- **PROBE**: gasta o saldo de forma uniforme; se o nível esfria depois de um movimento, inverte o sentido; para quando está em Muito quente.
- **HOARD_BLIND**: guarda tudo e gasta na última rodada, sentido aleatório.
- **HOARD_SCOUT**: gasta 1 crédito na penúltima rodada para descobrir o sentido, depois gasta o resto.
- **RANDOM** e **PASSIVE**: como na primeira simulação.
- **AGGRESSIVE** (referência): vê a posição da Sorte, como no primeiro experimento.

Campo de 24 jogadores, 2 a 10 posições e 4 a 16 movimentos cada, 10 rodadas, 3000 partidas por cenário.

## 1. Frequência de cada nível por rodada (campo de 24, limite 3/rodada, 3000 partidas)

| Rodada | CONGELANDO | FRIO   | MORNO  | QUENTE | MUITO QUENTE |
| ------ | ---------- | ------ | ------ | ------ | ------------ |
| 1      | 2.34%      | 13.64% | 32.48% | 32.32% | 19.22%       |
| 2      | 2.28%      | 13.73% | 32.32% | 32.46% | 19.20%       |
| 3      | 2.28%      | 13.78% | 32.37% | 32.31% | 19.26%       |
| 4      | 2.28%      | 13.71% | 32.36% | 32.51% | 19.15%       |
| 5      | 2.33%      | 13.68% | 32.35% | 32.47% | 19.19%       |
| 6      | 2.30%      | 13.83% | 32.30% | 32.36% | 19.22%       |
| 7      | 2.33%      | 13.78% | 32.37% | 32.34% | 19.19%       |
| 8      | 2.27%      | 13.84% | 32.20% | 32.51% | 19.18%       |
| 9      | 2.29%      | 13.87% | 32.22% | 32.44% | 19.18%       |
| 10     | 2.31%      | 13.82% | 32.26% | 32.35% | 19.26%       |

## 2. Estratégia contra jogador casual, só com temperatura

### Sem limite por rodada

| Estratégia                                      | Jogadores | Chance de ganhar (soma) | Fatia de posições (soma) | Razão chance/fatia |
| ----------------------------------------------- | --------- | ----------------------- | ------------------------ | ------------------ |
| PROBE                                           | 4         | 16.93%                  | 16.55%                   | 1.02               |
| HOARD_BLIND                                     | 4         | 22.10%                  | 20.69%                   | 1.07               |
| HOARD_SCOUT                                     | 4         | 17.67%                  | 17.24%                   | 1.02               |
| RANDOM                                          | 4         | 13.33%                  | 13.79%                   | 0.97               |
| PASSIVE                                         | 4         | 16.70%                  | 18.62%                   | 0.90               |
| AGGRESSIVE (vê a posição da Sorte — referência) | 4         | 13.27%                  | 13.10%                   | 1.01               |

### Limite de 3 por rodada

| Estratégia                                      | Jogadores | Chance de ganhar (soma) | Fatia de posições (soma) | Razão chance/fatia |
| ----------------------------------------------- | --------- | ----------------------- | ------------------------ | ------------------ |
| PROBE                                           | 4         | 16.30%                  | 16.55%                   | 0.98               |
| HOARD_BLIND                                     | 4         | 20.10%                  | 20.69%                   | 0.97               |
| HOARD_SCOUT                                     | 4         | 16.23%                  | 17.24%                   | 0.94               |
| RANDOM                                          | 4         | 13.67%                  | 13.79%                   | 0.99               |
| PASSIVE                                         | 4         | 17.80%                  | 18.62%                   | 0.96               |
| AGGRESSIVE (vê a posição da Sorte — referência) | 4         | 15.90%                  | 13.10%                   | 1.21               |

### Limite de 1 por rodada

| Estratégia                                      | Jogadores | Chance de ganhar (soma) | Fatia de posições (soma) | Razão chance/fatia |
| ----------------------------------------------- | --------- | ----------------------- | ------------------------ | ------------------ |
| PROBE                                           | 4         | 17.03%                  | 16.55%                   | 1.03               |
| HOARD_BLIND                                     | 4         | 19.13%                  | 20.69%                   | 0.92               |
| HOARD_SCOUT                                     | 4         | 17.20%                  | 17.24%                   | 1.00               |
| RANDOM                                          | 4         | 12.57%                  | 13.79%                   | 0.91               |
| PASSIVE                                         | 4         | 17.60%                  | 18.62%                   | 0.95               |
| AGGRESSIVE (vê a posição da Sorte — referência) | 4         | 16.47%                  | 13.10%                   | 1.26               |

## 3. R-21 só com temperatura: mesma compra (6 posições + 14 movimentos), muda o jeito de gastar

| Limite       | Fatia (cada um) | Sonda e gasta ao longo das rodadas | Guarda tudo (às cegas) | Guarda, sonda 1 na penúltima |
| ------------ | --------------- | ---------------------------------- | ---------------------- | ---------------------------- |
| sem limite   | 3.97%           | 5.17%                              | 3.70%                  | 4.03%                        |
| 3 por rodada | 3.97%           | 4.23%                              | 4.05%                  | 4.10%                        |
| 1 por rodada | 3.97%           | 5.45%                              | 4.18%                  | 3.95%                        |

## Conclusões

1. **R-21 (acumular créditos) deixa de ser vantajoso só com temperatura.** Sem limite por rodada, quem guarda tudo às cegas fica em 3,70% contra 3,97% de fatia; com um crédito de sondagem na penúltima rodada, 4,03%. Na simulação anterior, com a posição da Sorte visível, o acumulador chegava a 8,31%. O limite por rodada (BR-089) continua obrigatório, mas deixa de ser a única defesa.
2. **Esconder a posição da Sorte é a alavanca principal.** O jogador de referência que vê a Sorte tem razão chance/fatia de 1,21 a 1,26 mesmo com limite; quem só vê a temperatura fica entre 0,92 e 1,07.
3. **A estratégia ainda rende alguma vantagem, mas modesta.** No confronto direto com a mesma compra (6 posições + 14 movimentos), quem sonda e gasta ao longo das rodadas chega a 5,17% (sem limite) e 5,45% (limite 1), contra 3,97% de fatia. No campo misto a mesma estratégia fica perto de 1,0, então o efeito depende do campo. Isso confirma a decisão BR-091 (vantagem de estratégia aceita e medida no piloto), mas a amostra é pequena para fechar o número.
4. **As faixas iniciais deixam o jogo quente demais neste cenário.** Com média de 6 posições numa barra de ~140, Congelando aparece em só 2,3% das vezes e Muito quente em 19%. A distribuição é estável entre rodadas porque o limite de 3 por rodada move pouco a Sorte. Vale reavaliar as faixas com a densidade real de posições do piloto antes de tratá-las como definitivas.

## Limites do experimento

- A estratégia PROBE é simples; jogadores humanos podem aprender mais com o nível (por exemplo, usando também a mudança de nível entre rodadas e o que se sabe do tamanho da barra).
- O campo é sintético; a vantagem real depende de como as pessoas jogam.
- Nada aqui altera regra de produto: as faixas continuam configuração, sujeitas a ajuste após o teste e o piloto.
